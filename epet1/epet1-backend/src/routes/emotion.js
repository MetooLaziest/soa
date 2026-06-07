/**
 * 情绪值路由
 * GET  /api/epet1/emotion/:userId - 获取用户情绪值
 */
module.exports = (pool) => {
  const router = require('express').Router();

  router.get('/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, nickname, emotion_points FROM users WHERE id = $1',
        [req.params.userId]
      );
      if (!result.rows[0]) return res.status(404).json({ error: '用户不存在' });
      res.json({ success: true, emotion_points: result.rows[0].emotion_points });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
