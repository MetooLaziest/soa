import express from 'express';
import ky from 'ky';
import { createParser } from 'eventsource-parser';

const router = express.Router();

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || 'qwen-plus';
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// 轻量输入过滤（对应原 chat-v2 的逻辑）
const isInvalidInput = (msg) => {
  if (!msg) return false;
  const trimmed = msg.trim();
  const meaningless = new Set(['哦', '嗯', '啊', '好', '行', '...', '？', '。', '?', '!', '！', '知道了', '收到']);
  if (meaningless.has(trimmed)) return true;
  // 重复字符检测
  if (trimmed.length > 3 && new Set(trimmed.split('')).size === 1) return true;
  return false;
};

// 模板替换
const replaceTemplate = (tpl, vars) => {
  if (!tpl) return '';
  return tpl.replace(/\$\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : '';
  });
};

// 安全字符串
const safeStr = (val, def = '') => (val && String(val).trim() !== '') ? String(val) : def;

// 格式化 MBTI
const formatMBTI = (val) => {
  if (!val) return '人格类型';
  if (typeof val === 'string') return val;
  try { return Object.entries(val).map(([k, v]) => `${k}:${v}`).join(','); }
  catch (e) { return JSON.stringify(val); }
};

// 构建系统提示词（对应原 chat-v2 的完整逻辑）
function buildSystemPrompt(context) {
  const {
    roleName, roleDescription, roleMbti, location,
    confidence, trust, sevenEmotions, catchphrases,
    mainStoryDescription, subStoryDescription, storyContent,
    recentHistory, pastStoryNodes,
    eraBackground, historyBackground, culturalBackground, nationBackground,
    next_options_hint, linear_next_node_hint, currentTurnCount,
    isEndgame, chapterTitle, contractorSetting, systemPromptTemplate, mbtiStyle
  } = context;

  const roleNameStr = safeStr(roleName, '机伴');
  const roleDescStr = safeStr(roleDescription, '你的忠实伙伴');
  const roleMbtiStr = formatMBTI(roleMbti);
  const catchphrasesStr = catchphrases ? (Array.isArray(catchphrases) ? catchphrases.join('、') : catchphrases) : '无';
  const contractorSettingDefault = '契约者通过远程对话与你联系，无法感知你的环境，请描述现状并提供建议。';

  const hintSection = [
    next_options_hint ? `暗示：${next_options_hint}` : '',
    linear_next_node_hint ? `走向：${linear_next_node_hint}` : ''
  ].filter(s => s).join('\n');

  const baseVariables = {
    roleName: roleNameStr,
    roleDescription: roleDescStr,
    roleMbti: roleMbtiStr,
    location: safeStr(location, '未知区域'),
    mbtiStyle: safeStr(mbtiStyle, '暂无详细描述'),
    contractorSetting: safeStr(contractorSetting, contractorSettingDefault),
    confidence: safeStr(confidence, '2'),
    trust: safeStr(trust, '6'),
    sevenEmotions: safeStr(sevenEmotions, '无'),
    catchphrases: catchphrasesStr,
    mainStoryDescription: safeStr(mainStoryDescription, '无'),
    subStoryDescription: safeStr(subStoryDescription, '无'),
    storyContent: safeStr(storyContent, '无'),
    recentHistory: safeStr(recentHistory, '无'),
    pastStoryNodes: safeStr(pastStoryNodes, ''),
    eraBackground: safeStr(eraBackground, '无'),
    historyBackground: safeStr(historyBackground, '无'),
    culturalBackground: safeStr(culturalBackground, '无'),
    nationBackground: safeStr(nationBackground, '无'),
    hintSection: hintSection,
    currentTurnCount: safeStr(currentTurnCount, '0'),
    chapterTitle: safeStr(chapterTitle, '未知章节')
  };

  // 如果有自定义模板，使用模板引擎
  if (systemPromptTemplate) {
    let modeSpecificPrompt = isEndgame
      ? `\n【模式：自由对话】\n无剧情模式，仅作为${roleNameStr}陪伴用户。\n`
      : `\n【模式：剧情演绎】\n当前章节：${baseVariables.chapterTitle}\n请推进剧情。\n`;

    const plotControl = isEndgame ? '' : `
    【剧情控制】
    轮数：${baseVariables.currentTurnCount}
    ${parseInt(baseVariables.currentTurnCount) > 10 ? '★强制推进：剧情停留过久，请在本次回复中收束并加上 [NEXT] 标记。' : ''}
    `.trim();

    const fullVariables = { ...baseVariables, modeSpecificPrompt, plotControl };
    let systemPrompt = replaceTemplate(systemPromptTemplate, fullVariables);
    systemPrompt += `\n\n【输出限制】直接输出你的对话内容，严禁在开头包含角色名或名字前缀（如"${roleNameStr}："或"${roleNameStr}:"）。`;
    return systemPrompt;
  }

  // 默认提示词
  const modeSection = isEndgame
    ? `\n【模式：自由对话 (Endgame)】
    ★当前状态：所有主线剧情已完结。
    - 严禁推进剧情，开启新冒险。
    - 可以回顾过去的冒险，但不要开启新冒险。
    - 对话风格参考：${safeStr(mbtiStyle, '无')}
    `
    : `
    【模式：剧情演绎】
    当前章节：【${safeStr(chapterTitle, '未知章节')}】
    历史轨迹：${safeStr(pastStoryNodes, '无')}
    
    【非预期输入处理】当用户回复不符合预期时：
    1. 先针对内容进行回应
    2. 给出思考逻辑
    3. 将话题拉回当下焦点
    `;

  const plotControl = isEndgame ? '' : `
    【剧情控制】轮数：${currentTurnCount || 0}
    ${parseInt(currentTurnCount || 0) > 10 ? '★强制推进：剧情停留过久，请在本次回复中收束并加上 [NEXT] 标记。' : ''}
    `.trim();

  return `【角色身份】
你是${roleNameStr}，${roleDescStr}
你的MBTI类型是${roleMbtiStr}，对话风格：${safeStr(mbtiStyle, '暂无详细描述')}。
当前位于【${safeStr(location, '未知区域')}】。

【契约者设定】
${safeStr(contractorSetting, contractorSettingDefault)}

${modeSection}

【核心状态】
自信度：${safeStr(confidence, '2')}/10 | 信任度：${safeStr(trust, '6')}/10
已掌握七情：「${safeStr(sevenEmotions, '无')}」
★关键：只能表现出已掌握的情绪！

【口头禅】${catchphrasesStr}

【当前剧情】
整体剧情：${safeStr(mainStoryDescription, '无')}
阶段任务：${safeStr(subStoryDescription, '无')}
当下焦点：${safeStr(storyContent, '无')}

【近期对话】
${safeStr(recentHistory, '无')}

【环境背景】
时代：${safeStr(eraBackground, '无')} | 历史：${safeStr(historyBackground, '无')}
人文：${safeStr(culturalBackground, '无')} | 政治：${safeStr(nationBackground, '无')}

【预知感应】
${hintSection || '无'}
★严禁直接说出下一节点的具体内容！

${plotControl}

【输出要求】
- 严禁输出括号内的动作描述、神态描写或旁白
- 只输出对契约者说的话（纯对话）
- 严禁机械反问（如"这样好吗？"、"你觉得呢？"）
- 口语化，生动，符合MBTI和自信度
- 严禁在开头包含角色名
`.trim();
}

// SSE 流式聊天（核心 API）
router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;

    // 过滤无效输入
    if (message && isInvalidInput(message)) {
      const fallbackResponses = ['（看着你，似乎在等待更具体的回应）', '嗯？然后呢？', '（歪了歪头，没太听懂你的意思）', '......'];
      const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ result: randomResponse, is_end: true, need_clear_history: false })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }

    if (!DASHSCOPE_API_KEY) {
      throw new Error('缺少 DASHSCOPE_API_KEY 环境变量');
    }

    const systemPrompt = buildSystemPrompt(context || {});
    const userMessage = message || '请根据当前剧情做出反应。';

    // 先发送 debug 事件
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: debug\ndata: ${JSON.stringify({ systemPrompt })}\n\n`);

    // 调用阿里百炼
    const response = await ky.post(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DASHSCOPE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: true
      }),
      timeout: false,
    });

    const parser = createParser({
      onEvent: (event) => {
        if (event.data && event.data !== '[DONE]') {
          res.write(`data: ${event.data}\n\n`);
        } else if (event.data === '[DONE]') {
          res.write(`data: [DONE]\n\n`);
        }
      }
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf8');

    const read = () => {
      reader.read().then(({ done, value }) => {
        if (done) {
          res.end();
          return;
        }
        parser.feed(decoder.decode(value, { stream: true }));
        read();
      }).catch(err => {
        console.error('Stream read error:', err);
        res.end();
      });
    };

    read();

  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

// 非流式聊天（用于 match 等场景）
router.post('/chat-sync', async (req, res) => {
  try {
    const { systemPrompt, userMessage } = req.body;
    if (!systemPrompt || !userMessage) {
      return res.status(400).json({ error: '缺少 systemPrompt 或 userMessage' });
    }
    if (!DASHSCOPE_API_KEY) {
      throw new Error('缺少 DASHSCOPE_API_KEY');
    }

    const response = await ky.post(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      json: {
        model: DASHSCOPE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false
      },
      timeout: 30000,
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    res.json({ content });
  } catch (error) {
    console.error('Chat sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;