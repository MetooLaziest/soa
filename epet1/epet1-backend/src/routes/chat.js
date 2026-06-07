/**
 * AI 对话路由（阿里千问）
 * POST /api/epet1/chat  - 发送对话
 */
const axios = require('axios');

const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const API_KEY = process.env.DASHSCOPE_API_KEY || '';

module.exports = (pool) => {
  const router = require('express').Router();

  // 全局对话历史存储（生产环境建议用 Redis）
  const chatHistory = new Map(); // key: `${user_id}_${pet_instance_id}`

  function getHistoryKey(userId, petId) {
    return `${userId}_${petId}`;
  }

  function appendHistory(key, role, content) {
    if (!chatHistory.has(key)) chatHistory.set(key, []);
    const history = chatHistory.get(key);
    history.push({ role, content });
    // 限制历史长度
    if (history.length > 40) {
      chatHistory.set(key, history.slice(-40));
    }
  }

  function buildSystemPrompt(petModel, petInstance) {
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

  // 聊天
  router.post('/', async (req, res) => {
    try {
      const { user_id, pet_instance_id, message } = req.body;
      if (!user_id || !pet_instance_id || !message) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }

      if (!API_KEY) {
        return res.status(503).json({ success: false, error: 'AI服务未配置（DASHSCOPE_API_KEY）' });
      }

      // 获取宠物信息
      const petRes = await pool.query(
        `SELECT pi.*, pm.name, pm.personality_template, pm.mbti
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

      // 构建 system prompt
      const systemPrompt = buildSystemPrompt(pet, pet);

      // 加入用户消息
      appendHistory(key, 'user', message);

      const history = chatHistory.get(key) || [];

      // 调用千问
      const response = await axios.post(
        `${DASHSCOPE_BASE_URL}/chat/completions`,
        {
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(0, -1),
            { role: 'user', content: message }
          ],
          max_tokens: 500,
          temperature: 0.8,
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

      res.json({
        success: true,
        reply,
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

  // 清空对话历史
  router.delete('/history', async (req, res) => {
    const { user_id, pet_instance_id } = req.query;
    if (user_id && pet_instance_id) {
      chatHistory.delete(getHistoryKey(user_id, pet_instance_id));
    }
    res.json({ success: true });
  });

  return router;
};
