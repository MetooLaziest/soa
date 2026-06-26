/**
 * AI 对话路由（阿里千问）— v2 多层提示词架构
 * POST /api/epet1/chat  - 发送对话（支持 message / touch_area）
 */
const axios = require('axios');

const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const API_KEY = process.env.DASHSCOPE_API_KEY || '';

const TOUCH_PROMPTS = {
  head:  '主人轻轻摸了摸你的头，温柔地揉了揉你的头顶。请用可爱、享受的语气回应这次抚摸。',
  belly:'主人摸了摸你圆鼓鼓的肚子，手指轻轻挠了挠。请用痒痒的、撒娇的语气回应。',
  hands:'主人握住了你的小手，轻轻捏了捏你的爪子。请用亲昵、信赖的语气回应。',
  feet: '主人碰了碰你的脚底，你的小肉垫被轻轻按了一下。请用害羞、俏皮的语气回应。',
};

module.exports = (pool) => {
  const router = require('express').Router();

  // RAG 查询用 epet 库的连接 (rag_knowledge_bases 表在 epet 库)
  let poolEpet = null;
  try {
    // 动态创建连接池 (CJS 环境无法直接 import db.js)
    const { Pool } = require('pg');
    poolEpet = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'epet',
      user: 'postgres',
      password: 'iot2026pass',
      max: 3,
    });
  } catch (e) {
    console.warn('[chat.cjs] Cannot create epet pool for RAG:', e.message);
  }
  const chatHistory = new Map();

  function getHistoryKey(userId, petId) {
    return `${userId}_${petId}`;
  }

  function appendHistory(key, role, content) {
    if (!chatHistory.has(key)) chatHistory.set(key, []);
    const history = chatHistory.get(key);
    history.push({ role, content });
    if (history.length > 40) {
      chatHistory.set(key, history.slice(-40));
    }
  }

  /**
   * v2 多层提示词构建器
   * 从 pet_models 读取 5 层 struct，拼接成优先级的 system prompt
   */
  function buildSystemPromptV2(petModel, petInstance, ragContent = '') {
    const petName = petModel.name || '宠物';
    const petNickname = petInstance.nickname || petName;

    const identity    = petModel.identity_anchor || '';
    const personality = petModel.core_personality || '';
    const behavior    = petModel.behavior_rules || '';
    const skills      = petModel.skill_layer || '';

    // ==== L1: 身份锚定层（最高优先级）====
    const l1 = identity || `你是${petName}，绒绒谷家族的一员。你不是AI，不是助手，不是程序。`;

    // ==== L2: 核心性格层 ====
    const l2 = personality || `你是${petName}，${petModel.mbti || ''}。`;

    // ==== L3: 行为准则层 ====
    const l3 = behavior || '与用户友好互动，保持角色一致性。';

    // ==== L4: 技能层 + RAG 知识库 ====
    let l4 = skills || '暂无特殊技能。';
    if (ragContent) {
      l4 += `\n\n【关联知识库】\n以下是你掌握的背景知识，在相关话题时可以自然引用：\n${ragContent}`;
    }

    // ==== L5: 上下文记忆层（自动生成，不读 DB 字段）====
    const l5 = [
      `昵称：${petNickname}`,
      `成长等级：${petInstance.growth_level || 1}`,
      `累计互动：${petInstance.total_interactions || 0} 次`,
      `累计出游：${petInstance.total_travels || 0} 次`,
      `累计明信片：${petInstance.total_postcards || 0} 张`,
    ].join('\n');

    // 拼接：层级分隔线帮助大模型理解结构
    return `【第一层：身份锚定层】\n${l1}\n\n【第二层：核心性格层】\n${l2}\n\n【第三层：行为准则层】\n${l3}\n\n【第四层：技能层】\n${l4}\n\n【第五层：上下文记忆层】\n${l5}\n\n【输出规则】\n- 直接以${petName}的身份说话\n- 严禁输出括号内的动作描写、神态描写或旁白\n- 严禁在回复开头加角色名或名字前缀\n- 严禁说"作为AI"或"我是一个AI助手"之类的话\n- 字数控制在150字以内`;
  }

  /**
   * v1 兼容构建器（旧版 personality_template）
   */
  function buildSystemPromptV1(petModel, petInstance) {
    const base = petModel.personality_template || '';
    const petName = petModel.name || '宠物';
    const petNickname = petInstance.nickname || petName;
    return `${base}

当前宠物实例信息：
- 昵称：${petNickname}
- 成长等级：${petInstance.growth_level || 1}
- 累计互动次数：${petInstance.total_interactions || 0}
- 累计出游次数：${petInstance.total_travels || 0}
- 累计获得明信片：${petInstance.total_postcards || 0}

注意：你是在和玩家对话，请以${petName}的身份回复。如果用户给宠物起了昵称请使用昵称。`;
  }

  router.post('/', async (req, res) => {
    try {
      const { user_id, pet_instance_id, message, touch_area } = req.body;
      if (!user_id || !pet_instance_id) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      if (!message && !touch_area) {
        return res.status(400).json({ success: false, error: '缺少 message 或 touch_area' });
      }

      if (!API_KEY) {
        return res.status(503).json({ success: false, error: 'AI服务未配置（DASHSCOPE_API_KEY）' });
      }

      // 查询宠物模型 + 实例
      const petRes = await pool.query(
        `SELECT pi.*, pm.name, pm.mbti,
                pm.personality_template,
                pm.identity_anchor,
                pm.core_personality,
                pm.behavior_rules,
                pm.skill_layer,
                pm.context_memory_template,
                pm.prompt_version
         FROM pet_instances pi
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE pi.id = $1`,
        [pet_instance_id]
      );

      if (!petRes.rows[0]) {
        return res.status(404).json({ success: false, error: '宠物不存在' });
      }

      const pet = petRes.rows[0];
      const key = getHistoryKey(user_id, pet_instance_id);

      // 选择 v2 或 v1 构建器（prompt_version >= 2 即走 v2，空层用默认兜底）
      const useV2 = (pet.prompt_version >= 2);

      // 获取 RAG 知识库内容（仅 v2）
      let ragContent = '';
      if (useV2 && poolEpet) {
        try {
          const ragRes = await poolEpet.query(
            `SELECT kb.name, kb.content
             FROM rag_knowledge_bases kb
             JOIN pet_model_rag_kbs pmr ON kb.id = pmr.rag_kb_id
             WHERE pmr.model_id = $1
             ORDER BY kb.name`,
            [pet.pet_model_id]
          );
          if (ragRes.rows.length > 0) {
            ragContent = ragRes.rows.map(r => `【${r.name}】\n${r.content}`).join('\n\n');
          }
        } catch (e) {
          // RAG 查询失败不影响对话
          console.warn('[chat] RAG query failed:', e.message);
        }
      }

      let systemPrompt = useV2
        ? buildSystemPromptV2(pet, pet, ragContent)
        : buildSystemPromptV1(pet, pet);

      let userMessage;

      if (touch_area) {
        userMessage = TOUCH_PROMPTS[touch_area]
          ? `[系统] ${TOUCH_PROMPTS[touch_area]}`
          : `[系统] 主人摸了摸你`;
        systemPrompt += `\n\n当前场景：${TOUCH_PROMPTS[touch_area] || '主人正在抚摸你'}`;
      } else {
        userMessage = message;
      }

      appendHistory(key, 'user', userMessage);

      const history = chatHistory.get(key) || [];

      const response = await axios.post(
        `${DASHSCOPE_BASE_URL}/chat/completions`,
        {
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(0, -1),
            { role: 'user', content: userMessage }
          ],
          max_tokens: 500,
          temperature: 0.85,
        },
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const reply = response.data.choices?.[0]?.message?.content || '...';
      appendHistory(key, 'assistant', reply);

      // 同时更新 total_interactions
      try {
        await pool.query(
          `UPDATE pet_instances SET total_interactions = COALESCE(total_interactions, 0) + 1 WHERE id = $1`,
          [pet_instance_id]
        );
      } catch (e) { /* non-critical */ }

      res.json({
        success: true,
        reply,
        prompt_version: useV2 ? 2 : 1,
        usage: response.data.usage,
      });
    } catch (err) {
      console.error('chat error:', err?.response?.data || err.message);
      res.status(500).json({
        success: false,
        error: err?.response?.data?.error?.message || err.message,
      });
    }
  });

  router.delete('/history', async (req, res) => {
    const { user_id, pet_instance_id } = req.query;
    if (user_id && pet_instance_id) {
      chatHistory.delete(getHistoryKey(user_id, pet_instance_id));
    }
    res.json({ success: true });
  });

  return router;
};
