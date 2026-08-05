/**
 * Admin AI 使用量监控 API
 * GET  /admin/ai-usage          - 使用日志列表 (分页 + 时间范围)
 * GET  /admin/ai-usage/summary  - 汇总统计
 * GET  /admin/ai-usage/daily    - 按日统计
 * GET  /admin/ai-usage/models   - 按模型统计
 */
import express from 'express';
import { poolIot as db } from '../lib/db.js';
import { getUsageSummary, getUsageLogs } from '../lib/token-logger.js';

const router = express.Router();

// 获取使用日志列表
router.get('/', async (req, res) => {
  try {
    const {
      range = 'week',      // today / week / month / all
      model = null,        // 模型过滤
      limit = 50,          // 每页数量
      offset = 0,          // 偏移量
    } = req.query;

    const result = await getUsageLogs(db, {
      range,
      model,
      limit: Math.min(parseInt(limit, 10) || 50, 500),
      offset: parseInt(offset, 10) || 0,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[admin-ai-usage] GET / error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取汇总统计
router.get('/summary', async (req, res) => {
  try {
    const { range = 'all' } = req.query;
    const summary = await getUsageSummary(db, range);

    res.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('[admin-ai-usage] GET /summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 按日统计 (用于图表)
router.get('/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await db.query(
      `SELECT
        DATE(created_at) as date,
        model,
        COUNT(*) as request_count,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost,
        AVG(latency_ms) as avg_latency_ms
      FROM ai_usage_logs
      WHERE status = 'success'
        AND created_at >= CURRENT_DATE - INTERVAL '${parseInt(days, 10) || 30} days'
      GROUP BY DATE(created_at), model
      ORDER BY date DESC, model`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('[admin-ai-usage] GET /daily error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 按模型统计
router.get('/models', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        model,
        provider,
        COUNT(*) as request_count,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost,
        AVG(latency_ms) as avg_latency_ms,
        MIN(created_at) as first_used,
        MAX(created_at) as last_used
      FROM ai_usage_logs
      WHERE status = 'success'
      GROUP BY model, provider
      ORDER BY total_cost DESC`
    );

    res.json({
      success: true,
      models: result.rows,
    });
  } catch (error) {
    console.error('[admin-ai-usage] GET /models error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 异常检测：最近 N 小时请求量突增
router.get('/anomalies', async (req, res) => {
  try {
    const { hours = 24, threshold = 3 } = req.query;
    const hoursInt = parseInt(hours, 10) || 24;
    const thresholdFloat = parseFloat(threshold) || 3;

    // 计算每小时请求量，找出超过平均值 N 倍的时段
    const result = await db.query(`
      WITH hourly_stats AS (
        SELECT
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as request_count,
          SUM(total_tokens) as total_tokens,
          SUM(cost) as total_cost
        FROM ai_usage_logs
        WHERE created_at >= NOW() - INTERVAL '${hoursInt} hours'
          AND status = 'success'
        GROUP BY DATE_TRUNC('hour', created_at)
      ),
      avg_stats AS (
        SELECT
          AVG(request_count) as avg_requests,
          STDDEV(request_count) as stddev_requests
        FROM hourly_stats
      )
      SELECT
        h.hour,
        h.request_count,
        h.total_tokens,
        h.total_cost,
        a.avg_requests,
        CASE WHEN a.avg_requests > 0
          THEN ROUND((h.request_count / a.avg_requests)::numeric, 2)
          ELSE 0
        END as ratio_to_avg
      FROM hourly_stats h
      CROSS JOIN avg_stats a
      WHERE h.request_count > a.avg_requests * $1
         OR (a.stddev_requests > 0 AND h.request_count > a.avg_requests + 2 * a.stddev_requests)
      ORDER BY h.hour DESC
    `, [thresholdFloat]);

    res.json({
      success: true,
      anomalies: result.rows,
      period_hours: hoursInt,
      threshold: thresholdFloat,
    });
  } catch (error) {
    console.error('[admin-ai-usage] GET /anomalies error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
