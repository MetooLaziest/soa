/**
 * 漂流瓶路由
 * POST /api/epet1/drift/send     - 发送漂流瓶
 * GET  /api/epet1/drift/inbox    - 获取收件箱
 * POST /api/epet1/drift/reply    - 回复漂流瓶
 * GET  /api/epet1/drift/pickup   - 随机捡一个漂流瓶
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 发送漂流瓶
  router.post('/send', async (req, res) => {
    const client = await pool.connect();
    try {
      const sender_id = req.user.userId;
      const { content } = req.body;
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ success: false, error: '内容不能为空' });
      }
      if (content.length > 200) {
        return res.status(400).json({ success: false, error: '内容不能超过200字' });
      }

      await client.query('BEGIN');

      // 消耗情绪值（投放费用 5 点）
      const user = await client.query(
        'SELECT emotion_points FROM users WHERE id = $1 FOR UPDATE',
        [sender_id]
      );
      if (user.rows[0].emotion_points < 5) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '情绪值不足（需要5点发送漂流瓶）' });
      }
      await client.query(
        'UPDATE users SET emotion_points = emotion_points - 5 WHERE id = $1',
        [sender_id]
      );

      // 随机决定是否有奖励
      const hasReward = Math.random() < 0.3; // 30%概率附带碎片或情绪值
      let emotionReward = 0;
      let fragmentRewardId = null;
      let fragmentCount = 0;

      if (hasReward) {
        const rewardType = Math.random();
        if (rewardType < 0.6) {
          emotionReward = Math.floor(Math.random() * 10) + 5; // 5-15点情绪值
        } else {
          // 随机一个碎片
          const frag = await client.query(
            'SELECT id FROM fragments ORDER BY RANDOM() LIMIT 1'
          );
          if (frag.rows[0]) {
            fragmentRewardId = frag.rows[0].id;
            fragmentCount = 1;
          }
        }
      }

      const result = await client.query(
        `INSERT INTO drift_bottles (sender_id, content, emotion_reward, fragment_reward_id, fragment_count, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [sender_id, content.trim(), emotionReward, fragmentRewardId, fragmentCount]
      );

      await client.query('COMMIT');
      res.json({ success: true, bottle: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // 获取收件箱
  router.get('/inbox/:userId', async (req, res) => {
    try {
      if (parseInt(req.params.userId) !== req.user.userId) {
        return res.status(403).json({ error: '无权访问' });
      }
      const result = await pool.query(
        `SELECT db.*,
                sender.nickname as sender_nickname,
                frag.name as fragment_name
         FROM drift_bottles db
         LEFT JOIN users sender ON sender.id = db.sender_id
         LEFT JOIN fragments frag ON frag.id = db.fragment_reward_id
         WHERE db.receiver_id = $1 AND db.status = 'delivered'
         ORDER BY db.created_at DESC`,
        [req.params.userId]
      );
      res.json({ success: true, bottles: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 回复漂流瓶
  router.post('/reply', async (req, res) => {
    try {
      const sender_id = req.user.userId;
      const { reply_to_id, content } = req.body;
      if (!content || content.length > 200) {
        return res.status(400).json({ success: false, error: '内容无效' });
      }

      const result = await pool.query(
        `INSERT INTO drift_bottles (sender_id, reply_to_id, content, status)
         VALUES ($1, $2, $3, 'delivered')
         RETURNING *`,
        [sender_id, reply_to_id, content.trim()]
      );
      res.json({ success: true, bottle: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 捡漂流瓶（随机一个pending状态的瓶子）
  router.get('/pickup/:userId', async (req, res) => {
    const client = await pool.connect();
    try {
      if (parseInt(req.params.userId) !== req.user.userId) {
        return res.status(403).json({ error: '无权访问' });
      }
      const userId = parseInt(req.params.userId);

      await client.query('BEGIN');

      // 随机找一个其他用户发送的pending瓶子
      const bottle = await client.query(
        `SELECT db.*, u.nickname as sender_nickname
         FROM drift_bottles db
         LEFT JOIN users u ON u.id = db.sender_id
         WHERE db.sender_id != $1 AND db.status = 'pending'
         ORDER BY RANDOM()
         LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [userId]
      );

      if (!bottle.rows[0]) {
        // 没瓶子，生成一个系统瓶子
        const sysMessages = [
          '今天也要好好照顾自己哦 🌟',
          '宠物出游了，好期待它带回什么明信片！',
          '情绪值又变多了呢～',
          '明信片收集了多少张啦？',
        ];
        const msg = sysMessages[Math.floor(Math.random() * sysMessages.length)];
        const reward = Math.floor(Math.random() * 10) + 5;
        const result = await client.query(
          `INSERT INTO drift_bottles (sender_id, content, emotion_reward, status)
           VALUES (NULL, $1, $2, 'delivered')
           RETURNING *`,
          [msg, reward]
        );
        await client.query('COMMIT');
        return res.json({ success: true, bottle: result.rows[0], is_system: true });
      }

      // 标记为已送达
      await client.query(
        'UPDATE drift_bottles SET receiver_id = $1, status = $2 WHERE id = $3',
        [userId, 'delivered', bottle.rows[0].id]
      );

      // 给接收者发情绪值/碎片奖励
      if (bottle.rows[0].emotion_reward > 0) {
        await client.query(
          'UPDATE users SET emotion_points = emotion_points + $1 WHERE id = $2',
          [bottle.rows[0].emotion_reward, userId]
        );
      }
      if (bottle.rows[0].fragment_reward_id) {
        await client.query(
          `INSERT INTO user_fragments (user_id, fragment_id, count)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, fragment_id) DO UPDATE SET count = user_fragments.count + $3`,
          [userId, bottle.rows[0].fragment_reward_id, bottle.rows[0].fragment_count]
        );
      }

      await client.query('COMMIT');

      // 清理已送达瓶子里的sender_id显示（防止隐私泄露）
      const displayBottle = { ...bottle.rows[0] };
      delete displayBottle.sender_id;

      res.json({ success: true, bottle: displayBottle });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('pickup error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};
