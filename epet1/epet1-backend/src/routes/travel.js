/**
 * 出游路由
 * POST /api/epet1/travel/start   - 开始出游
 * GET  /api/epet1/travel/status  - 查询出游状态
 * POST /api/epet1/travel/return  - 宠物归来
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 开始出游
  router.post('/start', async (req, res) => {
    const client = await pool.connect();
    try {
      const { pet_instance_id, user_id } = req.body;
      if (!pet_instance_id || !user_id) {
        return res.status(400).json({ success: false, error: '缺少参数' });
      }

      await client.query('BEGIN');

      // 检查宠物是否已在出游中
      const existing = await client.query(
        `SELECT id FROM travel_records WHERE pet_instance_id = $1 AND status = 'traveling'`,
        [pet_instance_id]
      );
      if (existing.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '宠物正在出游中' });
      }

      // 检查宠物是否在庭院
      const inYard = await client.query(
        'SELECT id FROM yard_pets WHERE pet_instance_id = $1 AND is_active = true',
        [pet_instance_id]
      );
      if (!inYard.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '宠物不在庭院中，无法出游' });
      }

      const started_at = new Date();
      const expected_end_at = new Date(started_at.getTime() + 12 * 60 * 60 * 1000); // 12小时

      const result = await client.query(
        `INSERT INTO travel_records (user_id, pet_instance_id, started_at, expected_end_at, status)
         VALUES ($1, $2, $3, $4, 'traveling')
         RETURNING *`,
        [user_id, pet_instance_id, started_at, expected_end_at]
      );

      // 移出庭院
      await client.query(
        'UPDATE yard_pets SET is_active = false WHERE pet_instance_id = $1',
        [pet_instance_id]
      );

      await client.query('COMMIT');
      res.json({ success: true, travel: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('travel start error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // 查询出游状态（宠物是否在出游 / 预计返回时间）
  router.get('/status/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT tr.*, pi.pet_model_id, pm.name as pet_name, pm.image_url
         FROM travel_records tr
         JOIN pet_instances pi ON pi.id = tr.pet_instance_id
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE tr.user_id = $1 AND tr.status = 'traveling'
         ORDER BY tr.expected_end_at`,
        [req.params.userId]
      );
      res.json({ success: true, travels: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 宠物归来（前端轮询到时间后调用，或者后端定时任务触发）
  router.post('/return', async (req, res) => {
    const client = await pool.connect();
    try {
      const { travel_record_id, user_id } = req.body;
      if (!travel_record_id) {
        return res.status(400).json({ success: false, error: '缺少 travel_record_id' });
      }

      await client.query('BEGIN');

      // 获取出游记录
      const travel = await client.query(
        'SELECT * FROM travel_records WHERE id = $1 AND status = $2',
        [travel_record_id, 'traveling']
      );
      if (!travel.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: '出游记录不存在或已结束' });
      }

      const record = travel.rows[0];

      // 按权重抽明信片
      const postcards = await client.query(
        `SELECT id, rarity_weight FROM postcards WHERE is_active = true`
      );

      const totalWeight = postcards.rows.reduce((sum, p) => sum + p.rarity_weight, 0);
      let rand = Math.random() * totalWeight;
      let selectedPostcardId = postcards.rows[0].id;

      for (const p of postcards.rows) {
        rand -= p.rarity_weight;
        if (rand <= 0) {
          selectedPostcardId = p.id;
          break;
        }
      }

      // 标记返回
      await client.query(
        `UPDATE travel_records
         SET status = 'returned', actual_end_at = NOW(), postcard_id = $1, postcard_is_new = false
         WHERE id = $2`,
        [selectedPostcardId, travel_record_id]
      );

      // 获取明信片详情
      const postcard = await client.query('SELECT * FROM postcards WHERE id = $1', [selectedPostcardId]);

      // 检查是否首次获得
      const existingPostcard = await client.query(
        'SELECT id, duplicate_count FROM user_postcards WHERE user_id = $1 AND postcard_id = $2',
        [record.user_id, selectedPostcardId]
      );

      let is_new = !existingPostcard.rows[0];
      if (existingPostcard.rows[0]) {
        // 重复，增加duplicate_count
        await client.query(
          'UPDATE user_postcards SET duplicate_count = duplicate_count + 1 WHERE id = $1',
          [existingPostcard.rows[0].id]
        );
      } else {
        // 首次，给情绪值
        await client.query(
          'INSERT INTO user_postcards (user_id, postcard_id) VALUES ($1, $2)',
          [record.user_id, selectedPostcardId]
        );
        await client.query(
          'UPDATE users SET emotion_points = emotion_points + 10 WHERE id = $1',
          [record.user_id]
        );
      }

      // 更新宠物出游计数
      await client.query(
        'UPDATE pet_instances SET total_travels = total_travels + 1, total_postcards = total_postcards + 1 WHERE id = $1',
        [record.pet_instance_id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        postcard: postcard.rows[0],
        is_new,
        travel_record_id: travel_record_id
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('travel return error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};
