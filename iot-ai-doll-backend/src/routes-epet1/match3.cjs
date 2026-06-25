/**
 * 消消乐（开心连连看）路由
 * GET  /api/epet1/match3/icons           - 获取所有活跃图标
 * GET  /api/epet1/match3/levels           - 获取关卡列表
 * GET  /api/epet1/match3/levels/:id       - 获取关卡详情
 * POST /api/epet1/match3/record           - 上报游戏成绩
 * GET  /api/epet1/match3/passed/:userId   - 获取用户已通关的关卡列表
 * GET  /api/epet1/match3/check/:userId/:shopItemId - 检查用户是否满足购买条件
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 获取所有活跃图标
  router.get('/icons', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM match3_icons WHERE is_active = true ORDER BY sort_order, id'
      );
      res.json({ success: true, icons: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取关卡列表（不含 grid_shape 大字段，列表页用）
  router.get('/levels', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, grid_rows, grid_cols, score_target, max_moves,
                available_icons, difficulty, is_active
         FROM match3_levels WHERE is_active = true ORDER BY difficulty, id`
      );
      res.json({ success: true, levels: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取关卡详情（含 grid_shape）
  router.get('/levels/:id', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM match3_levels WHERE id = $1 AND is_active = true',
        [req.params.id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ success: false, error: '关卡不存在' });
      }
      res.json({ success: true, level: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 上报游戏成绩
  router.post('/record', async (req, res) => {
    try {
      const { user_id, level_id, score, passed, moves_used } = req.body;
      if (!user_id || !level_id || score === undefined || passed === undefined) {
        return res.status(400).json({ success: false, error: '缺少参数' });
      }
      const result = await pool.query(
        `INSERT INTO match3_records (user_id, level_id, score, passed, moves_used)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user_id, level_id, score, passed, moves_used || 0]
      );
      res.json({ success: true, record: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取用户已通关的关卡列表
  router.get('/passed/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT level_id FROM match3_records
         WHERE user_id = $1 AND passed = true`,
        [req.params.userId]
      );
      res.json({ success: true, passedLevels: result.rows.map(r => r.level_id) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 检查用户是否满足购买条件（消消乐通关 + 情绪值够不够由 shop/buy 判断）
  router.get('/check/:userId/:shopItemId', async (req, res) => {
    try {
      const { userId, shopItemId } = req.params;
      // 查商品所需关卡
      const itemRes = await pool.query(
        'SELECT match3_level_id FROM shop_items WHERE id = $1',
        [shopItemId]
      );
      if (!itemRes.rows[0]) {
        return res.status(404).json({ success: false, error: '商品不存在' });
      }
      const requiredLevelId = itemRes.rows[0].match3_level_id;
      if (!requiredLevelId) {
        // 该商品不需要消消乐通关
        return res.json({ success: true, required: false, passed: true });
      }
      // 检查用户是否通过该关卡
      const recordRes = await pool.query(
        `SELECT 1 FROM match3_records WHERE user_id = $1 AND level_id = $2 AND passed = true LIMIT 1`,
        [userId, requiredLevelId]
      );
      res.json({
        success: true,
        required: true,
        level_id: requiredLevelId,
        passed: recordRes.rows.length > 0,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
