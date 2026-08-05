-- AI 使用量监控表
-- 记录每次 LLM 调用的 token 消耗，用于成本监控和流量异常检测

-- AI 使用日志表
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                          -- 可选，关联触发调用的用户
  pet_instance_id UUID,                  -- 可选，关联具体宠物实例
  model VARCHAR(100) NOT NULL,           -- 模型名称 e.g. 'qwen-plus', 'qwen-turbo'
  provider VARCHAR(50) NOT NULL,         -- 提供商 e.g. 'dashscope', 'openai', 'kimi'
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10, 6) DEFAULT 0,        -- 单次调用费用 (元)
  endpoint VARCHAR(100),                 -- 调用来源 e.g. '/api/epet1/chat', '/api/ai/chat'
  status VARCHAR(20) DEFAULT 'success',  -- success / error / timeout
  latency_ms INTEGER,                    -- 响应耗时 (毫秒)
  error_message TEXT,                    -- 错误信息 (status=error 时)
  metadata JSONB DEFAULT '{}',          -- 额外信息 e.g. {touch_area, rag_enabled}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON ai_usage_logs(model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider ON ai_usage_logs(provider);

-- AI 模型配置表
CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,            -- 显示名称 e.g. '通义千问 Plus'
  provider VARCHAR(50) NOT NULL,         -- 提供商 e.g. 'dashscope'
  model_id VARCHAR(100) NOT NULL UNIQUE, -- 模型 ID e.g. 'qwen-plus'
  description TEXT,                      -- 模型描述
  api_endpoint VARCHAR(500),             -- API 端点 (可选，覆盖默认)
  max_tokens INTEGER DEFAULT 4096,       -- 最大输出 token
  temperature DECIMAL(3,2) DEFAULT 0.70, -- 默认温度
  is_active BOOLEAN DEFAULT true,        -- 是否启用
  cost_per_1k_input DECIMAL(10,6) DEFAULT 0,   -- 每 1K 输入 token 费用 (元)
  cost_per_1k_output DECIMAL(10,6) DEFAULT 0,  -- 每 1K 输出 token 费用 (元)
  priority INTEGER DEFAULT 0,            -- 优先级 (高优先级用于主聊天)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认模型配置 (DashScope Qwen 系列定价，2026-08)
INSERT INTO ai_models (name, provider, model_id, description, cost_per_1k_input, cost_per_1k_output, priority)
VALUES
  ('通义千问 Plus', 'dashscope', 'qwen-plus', '主力对话模型，性价比高', 0.0008, 0.002, 10),
  ('通义千问 Turbo', 'dashscope', 'qwen-turbo', '轻量快速，适合简单任务', 0.0003, 0.0006, 5),
  ('通义千问 Max', 'dashscope', 'qwen-max', '最强能力，复杂任务', 0.02, 0.06, 15)
ON CONFLICT (model_id) DO NOTHING;

-- 视图：按日汇总 (方便 Dashboard 展示)
CREATE OR REPLACE VIEW v_ai_usage_daily AS
SELECT
  DATE(created_at) as date,
  model,
  provider,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost) as total_cost,
  AVG(latency_ms) as avg_latency_ms
FROM ai_usage_logs
WHERE status = 'success'
GROUP BY DATE(created_at), model, provider
ORDER BY date DESC;

-- 视图：按模型汇总
CREATE OR REPLACE VIEW v_ai_usage_by_model AS
SELECT
  model,
  provider,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost) as total_cost,
  AVG(latency_ms) as avg_latency_ms
FROM ai_usage_logs
WHERE status = 'success'
GROUP BY model, provider
ORDER BY total_cost DESC;

COMMENT ON TABLE ai_usage_logs IS 'AI/LLM 调用使用日志，用于成本监控和流量异常检测';
COMMENT ON TABLE ai_models IS 'AI 模型配置，包含定价信息';
COMMENT ON VIEW v_ai_usage_daily IS '按日汇总的 AI 使用统计';
COMMENT ON VIEW v_ai_usage_by_model IS '按模型汇总的 AI 使用统计';
