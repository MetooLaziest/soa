/**
 * 明信片路由
 * GET /api/epet1/postcard/collection/:userId - 获取用户明信片收藏
 * POST /api/epet1/postcard/draw              - 出游返回时抽明信片
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 获取用户明信片收藏
  router.get('/collection/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT up.*, p.name, p.image_url, p.animation_url, p.rarity,
                p.rarity_weight, p.description, p.display_scene,
                CASE WHEN up.duplicate_count = 0 THEN true ELSE false END as is_new
         FROM user_postcards up
         JOIN postcards p ON p.id = up.postcard_id
         WHERE up.user_id = $1
         ORDER BY up.obtained_at DESC`,
        [req.params.userId]
      );
      res.json({ success: true, postcards: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 抽明信片（出游返回时调用）
  router.post('/draw', async (req, res) => {
    try {
      const { user_id, postcard_id } = req.body;

      // 先检查用户是否已有这张明信片
      const existing = await pool.query(
        'SELECT id, duplicate_count FROM user_postcards WHERE user_id = $1 AND postcard_id = $2',
        [user_id, postcard_id]
      );

      const postcard = await pool.query(
        'SELECT * FROM postcards WHERE id = $1',
        [postcard_id]
      );
      if (!postcard.rows[0]) return res.status(404).json({ error: '明信片不存在' });

      if (existing.rows[0]) {
        // 重复：duplicate_count + 1，不给情绪值
        await pool.query(
          'UPDATE user_postcards SET duplicate_count = duplicate_count + 1 WHERE id = $1',
          [existing.rows[0].id]
        );
        return res.json({
          success: true,
          is_new: false,
          postcard: postcard.rows[0],
          duplicate_count: existing.rows[0].duplicate_count + 1
        });
      }

      // 首次获得
      await pool.query(
        `INSERT INTO user_postcards (user_id, postcard_id, duplicate_count)
         VALUES ($1, $2, 0)`,
        [user_id, postcard_id]
      );

      // 增加用户情绪值
      await pool.query(
        'UPDATE users SET emotion_points = emotion_points + 10 WHERE id = $1',
        [user_id]
      );

      res.json({ success: true, is_new: true, postcard: postcard.rows[0] });
    } catch (err) {
      console.error('draw postcard error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 获取所有可用明信片（管理员用）
  router.get('/pool', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM postcards WHERE is_active = true ORDER BY rarity, id'
      );
      res.json({ success: true, postcards: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
