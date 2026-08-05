/**
 * Token 使用量日志记录工具
 * 用于记录每次 LLM 调用的 token 消耗，支持成本监控和流量异常检测
 */

const MODEL_COSTS = {
  // DashScope Qwen 系列 (元/1K tokens)
  'qwen-plus': { input: 0.0008, output: 0.002 },
  'qwen-turbo': { input: 0.0003, output: 0.0006 },
  'qwen-max': { input: 0.02, output: 0.06 },
  // OpenAI (元/1K tokens, 需要按汇率换算，这里用近似值)
  'gpt-4': { input: 0.21, output: 0.63 },
  'gpt-3.5-turbo': { input: 0.0105, output: 0.014 },
  // Kimi/Moonshot
  'moonshot-v1-8k': { input: 0.084, output: 0.084 },
  'moonshot-v1-32k': { input: 0.168, output: 0.168 },
};

/**
 * 计算调用成本
 * @param {string} model - 模型名称
 * @param {number} inputTokens - 输入 token 数
 * @param {number} outputTokens - 输出 token 数
 * @returns {number} 成本 (元)
 */
function calculateCost(model, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[model] || { input: 0, output: 0 };
  const inputCost = (inputTokens / 1000) * costs.input;
  const outputCost = (outputTokens / 1000) * costs.output;
  return Math.round((inputCost + outputCost) * 1000000) / 1000000; // 保留6位小数
}

/**
 * 记录 AI 使用日志
 * @param {object} pool - PostgreSQL 连接池
 * @param {object} params - 日志参数
 * @param {string} params.userId - 用户 ID (可选)
 * @param {string} params.petInstanceId - 宠物实例 ID (可选)
 * @param {string} params.model - 模型名称
 * @param {string} params.provider - 提供商
 * @param {object} params.usage - OpenAI 格式的 usage 对象 { prompt_tokens, completion_tokens, total_tokens }
 * @param {string} params.endpoint - 调用来源
 * @param {string} params.status - 状态 success/error/timeout
 * @param {number} params.latencyMs - 响应耗时 (毫秒)
 * @param {string} params.errorMessage - 错误信息
 * @param {object} params.metadata - 额外信息
 * @returns {Promise<object|null>} 插入的记录，失败返回 null
 */
async function logTokenUsage(pool, params) {
  const {
    userId = null,
    petInstanceId = null,
    model,
    provider,
    usage = {},
    endpoint = null,
    status = 'success',
    latencyMs = null,
    errorMessage = null,
    metadata = {},
  } = params;

  const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
  const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
  const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
  const cost = calculateCost(model, inputTokens, outputTokens);

  try {
    const result = await pool.query(
      `INSERT INTO ai_usage_logs (
        user_id, pet_instance_id, model, provider,
        input_tokens, output_tokens, total_tokens, cost,
        endpoint, status, latency_ms, error_message, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, model, total_tokens, cost`,
      [
        userId,
        petInstanceId,
        model,
        provider,
        inputTokens,
        outputTokens,
        totalTokens,
        cost,
        endpoint,
        status,
        latencyMs,
        errorMessage,
        JSON.stringify(metadata),
      ]
    );

    return result.rows[0];
  } catch (error) {
    // 日志记录失败不应影响主流程，只打印警告
    console.warn('[token-logger] Failed to log usage:', error.message);
    return null;
  }
}

/**
 * 获取使用统计摘要
 * @param {object} pool - PostgreSQL 连接池
 * @param {string} range - 时间范围 today/week/month/all
 * @returns {Promise<object>} 统计摘要
 */
async function getUsageSummary(pool, range = 'all') {
  const timeFilter = {
    today: "created_at >= CURRENT_DATE",
    week: "created_at >= CURRENT_DATE - INTERVAL '7 days'",
    month: "created_at >= CURRENT_DATE - INTERVAL '30 days'",
    all: "TRUE",
  }[range] || "TRUE";

  const summaryQuery = await pool.query(
    `SELECT
      COUNT(*) as total_requests,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(AVG(latency_ms), 0) as avg_latency_ms
    FROM ai_usage_logs
    WHERE status = 'success' AND ${timeFilter}`
  );

  const byModelQuery = await pool.query(
    `SELECT
      model,
      provider,
      COUNT(*) as request_count,
      SUM(total_tokens) as total_tokens,
      SUM(cost) as total_cost
    FROM ai_usage_logs
    WHERE status = 'success' AND ${timeFilter}
    GROUP BY model, provider
    ORDER BY total_cost DESC`
  );

  const summary = summaryQuery.rows[0];
  return {
    total_requests: parseInt(summary.total_requests, 10),
    total_input_tokens: parseInt(summary.total_input_tokens, 10),
    total_output_tokens: parseInt(summary.total_output_tokens, 10),
    total_tokens: parseInt(summary.total_tokens, 10),
    total_cost: parseFloat(summary.total_cost),
    avg_latency_ms: Math.round(parseFloat(summary.avg_latency_ms)),
    models: byModelQuery.rows.map((r) => ({
      model: r.model,
      provider: r.provider,
      request_count: parseInt(r.request_count, 10),
      total_tokens: parseInt(r.total_tokens, 10),
      total_cost: parseFloat(r.total_cost),
    })),
  };
}

/**
 * 获取使用日志列表 (分页)
 * @param {object} pool - PostgreSQL 连接池
 * @param {object} options - 查询选项
 * @param {string} options.range - 时间范围
 * @param {string} options.model - 模型过滤
 * @param {number} options.limit - 每页数量
 * @param {number} options.offset - 偏移量
 * @returns {Promise<object>} 日志列表和总数
 */
async function getUsageLogs(pool, options = {}) {
  const { range = 'week', model = null, limit = 50, offset = 0 } = options;

  const timeFilter = {
    today: "created_at >= CURRENT_DATE",
    week: "created_at >= CURRENT_DATE - INTERVAL '7 days'",
    month: "created_at >= CURRENT_DATE - INTERVAL '30 days'",
    all: "TRUE",
  }[range] || "TRUE";

  let whereClause = timeFilter;
  const params = [limit, offset];

  if (model) {
    params.push(model);
    whereClause += ` AND model = $${params.length}`;
  }

  const logsQuery = await pool.query(
    `SELECT
      id, user_id, pet_instance_id, model, provider,
      input_tokens, output_tokens, total_tokens, cost,
      endpoint, status, latency_ms, error_message, metadata, created_at
    FROM ai_usage_logs
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2`,
    params
  );

  const countQuery = await pool.query(
    `SELECT COUNT(*) FROM ai_usage_logs WHERE ${whereClause}`,
    params.slice(2) // 只传 model 参数
  );

  return {
    logs: logsQuery.rows,
    total: parseInt(countQuery.rows[0].count, 10),
  };
}

export { logTokenUsage, getUsageSummary, getUsageLogs, calculateCost, MODEL_COSTS };
