/**
 * 用户路由（游客模式）
 * POST /api/epet1/user              - 游客模式（device_id 自动创建）
 * POST /api/epet1/user/createOrUpdate - 微信授权后创建/更新用户
 * GET  /api/epet1/user/:id         - 获取用户信息
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 游客模式：首次访问自动创建用户
  router.post('/', async (req, res) => {
    try {
      const { device_id } = req.body;
      const openid = 'guest_' + (device_id || 'dev_' + Math.random().toString(36).slice(2));
      const result = await pool.query(
        `INSERT INTO users (openid, nickname, avatar_url)
         VALUES ($1, '匿名玩家', '')
         ON CONFLICT (openid) DO UPDATE SET updated_at = NOW()
         RETURNING id, openid, nickname, emotion_points`,
        [openid]
      );
      const user = result.rows[0];
      return res.json({ user_id: user.id, emotion_points: user.emotion_points || 0 });
    } catch (err) {
      console.error('guest user error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/createOrUpdate', async (req, res) => {
    try {
      const { openid, nickname, avatar_url } = req.body;

      if (!openid) {
        const result = await pool.query(
          `INSERT INTO users (openid, nickname, avatar_url)
           VALUES (COALESCE($1, 'guest_' || gen_random_uuid(8)), COALESCE($2, '匿名玩家'), COALESCE($3, ''))
           ON CONFLICT (openid) DO UPDATE SET
             nickname = COALESCE(EXCLUDED.nickname, users.nickname),
             avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
             updated_at = NOW()
           RETURNING *`,
          [openid || null, nickname, avatar_url]
        );
        return res.json({ success: true, user: result.rows[0] });
      }

      const result = await pool.query(
        `INSERT INTO users (openid, nickname, avatar_url)
         VALUES ($1, COALESCE($2, '匿名玩家'), COALESCE($3, ''))
         ON CONFLICT (openid) DO UPDATE SET
           nickname = COALESCE(EXCLUDED.nickname, users.nickname),
           avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
           updated_at = NOW()
         RETURNING *`,
        [openid, nickname, avatar_url]
      );
      res.json({ success: true, user: result.rows[0] });
    } catch (err) {
      console.error('createOrUpdate error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 获取用户信息
  router.get('/:id', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, openid, nickname, avatar_url, emotion_points, created_at FROM users WHERE id = $1',
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: '用户不存在' });
      res.json({ success: true, user: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
