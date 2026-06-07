/**
 * 小游戏路由
 * GET  /api/epet1/game/types    - 获取可用游戏列表
 * POST /api/epet1/game/record    - 上报游戏成绩
 * GET  /api/epet1/game/records   - 获取用户游戏记录
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 可用游戏列表（硬编码，后续可放入数据库配置）
  const GAME_TYPES = [
    { id: 'frisbee',   name: '丢飞盘',       desc: '和宠物一起丢飞盘，看谁接得准',  icon: '🥏', min_level: 1 },
    { id: '100floor',  name: '是男人就下100层', desc: '经典跳台阶，看你能下多少层',   icon: '🏃', min_level: 1 },
    { id: 'puzzle',    name: '拼图',          desc: '和宠物一起完成拼图',            icon: '🧩', min_level: 2 },
    { id: 'riddle',    name: '解谜',          desc: '开动脑筋解开谜题',             icon: '🔮', min_level: 3 },
  ];

  // 获取游戏列表
  router.get('/types', (req, res) => {
    res.json({ success: true, games: GAME_TYPES });
  });

  // 上报游戏成绩
  router.post('/record', async (req, res) => {
    const client = await pool.connect();
    try {
      const { user_id, pet_instance_id, game_type, score } = req.body;
      if (!user_id || !game_type || score === undefined) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }

      await client.query('BEGIN');

      // 检查是否解锁
      const game = GAME_TYPES.find(g => g.id === game_type);
      if (!game) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: '游戏不存在' });
      }

      // 记录成绩
      const result = await client.query(
        `INSERT INTO mini_game_records (user_id, pet_instance_id, game_type, score)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [user_id, pet_instance_id || null, game_type, score]
      );

      // 参与小游戏给情绪值（每局+3）
      await client.query(
        'UPDATE users SET emotion_points = emotion_points + 3 WHERE id = $1',
        [user_id]
      );

      await client.query('COMMIT');
      res.json({ success: true, record: result.rows[0], emotion_reward: 3 });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('game record error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // 获取用户游戏记录
  router.get('/records/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT mgr.*, pm.name as pet_name
         FROM mini_game_records mgr
         LEFT JOIN pet_instances pi ON pi.id = mgr.pet_instance_id
         LEFT JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE mgr.user_id = $1
         ORDER BY mgr.played_at DESC
         LIMIT 50`,
        [req.params.userId]
      );
      res.json({ success: true, records: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
