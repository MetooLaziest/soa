
/**
 * 宠物路由
 * GET  /api/epet1/pet/models            - 获取所有宠物型号
 * POST /api/epet1/pet/nfc/activate      - NFC扫描激活宠物
 * GET  /api/epet1/pet/instances/:userId - 获取用户所有宠物实例
 * GET  /api/epet1/pet/yard/:userId      - 获取庭院宠物
 * POST /api/epet1/pet/yard/add          - 放入庭院
 * POST /api/epet1/pet/yard/remove       - 移出庭院
 * POST /api/epet1/pet/interact/:action   - 互动（feed/pet/clean）
 * GET  /api/epet1/pet/instance/:id       - 获取单只宠物详情
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 获取所有宠物型号
  router.get('/models', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, description, image_url, rarity, nfc_range_start, nfc_range_end,
                mbti, personality_template, growth_unlock_config, is_active, display_order
         FROM pet_models WHERE is_active = true ORDER BY display_order`
      );
      res.json({ success: true, models: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // NFC 激活宠物
  router.post('/nfc/activate', async (req, res) => {
    const client = await pool.connect();
    try {
      const { nfc_id, user_id } = req.body;
      if (!nfc_id || !user_id) {
        return res.status(400).json({ success: false, error: 'nfc_id 和 user_id 必填' });
      }

      await client.query('BEGIN');

      // 查找该 NFC 是否在型号范围内
      const modelRow = await client.query(
        `SELECT id, name FROM pet_models
         WHERE nfc_range_start <= $1 AND nfc_range_end >= $1 AND is_active = true
         LIMIT 1`,
        [nfc_id]
      );

      if (!modelRow.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: '该NFC未匹配到任何宠物型号' });
      }

      const pet_model_id = modelRow.rows[0].id;

      // 检查是否已被激活
      const existing = await client.query(
        'SELECT id FROM pet_instances WHERE nfc_id = $1',
        [nfc_id]
      );

      if (existing.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, error: '该NFC已被激活' });
      }

      // 创建宠物实例
      const instance = await client.query(
        `INSERT INTO pet_instances (user_id, pet_model_id, nfc_id)
         VALUES ($1, $2, $3) RETURNING *`,
        [user_id, pet_model_id, nfc_id]
      );

      // 自动放入庭院（位置1）
      await client.query(
        `INSERT INTO yard_pets (user_id, pet_instance_id, position)
         VALUES ($1, $2, 1) ON CONFLICT DO NOTHING`,
        [user_id, instance.rows[0].id]
      );

      // 获取宠物详情
      const detail = await client.query(
        `SELECT pi.*, pm.name as model_name, pm.image_url, pm.rarity
         FROM pet_instances pi
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE pi.id = $1`,
        [instance.rows[0].id]
      );

      await client.query('COMMIT');
      res.json({ success: true, pet: detail.rows[0], model: modelRow.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('activate error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // 获取用户所有宠物实例
  router.get('/instances/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT pi.*, pm.name as model_name, pm.image_url, pm.rarity, pm.nfc_range_start, pm.nfc_range_end,
                yp.position as yard_position, yp.is_active as yard_active
         FROM pet_instances pi
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         LEFT JOIN yard_pets yp ON yp.pet_instance_id = pi.id AND yp.is_active = true
         WHERE pi.user_id = $1
         ORDER BY pi.created_at`,
        [req.params.userId]
      );
      res.json({ success: true, pets: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取庭院宠物
  router.get('/yard/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT pi.*, pm.name as model_name, pm.image_url, pm.rarity,
                pm.personality_template, pm.mbti, pm.nfc_range_start, pm.nfc_range_end,
                yp.position, yp.is_active, yp.added_at
         FROM yard_pets yp
         JOIN pet_instances pi ON pi.id = yp.pet_instance_id
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE yp.user_id = $1 AND yp.is_active = true
         ORDER BY yp.position`,
        [req.params.userId]
      );
      res.json({ success: true, pets: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 放入庭院（修复：补上 BEGIN，修复事务流程）
  router.post('/yard/add', async (req, res) => {
    const client = await pool.connect();
    try {
      const { user_id, pet_instance_id } = req.body;

      if (!user_id || !pet_instance_id) {
        return res.status(400).json({ success: false, error: '缺少 user_id 或 pet_instance_id' });
      }

      await client.query('BEGIN');

      // 检查庭院是否已有2只
      const count = await client.query(
        'SELECT COUNT(*) FROM yard_pets WHERE user_id = $1 AND is_active = true',
        [user_id]
      );
      if (parseInt(count.rows[0].count) >= 2) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '庭院最多放2只宠物' });
      }

      // 查找最小可用位置
      const used = await client.query(
        'SELECT position FROM yard_pets WHERE user_id = $1 AND is_active = true ORDER BY position',
        [user_id]
      );
      const usedPositions = used.rows.map(r => r.position);
      const newPosition = usedPositions.includes(1) ? 2 : 1;

      // 检查宠物是否已在庭院活跃中
      const existing = await client.query(
        'SELECT id FROM yard_pets WHERE user_id = $1 AND pet_instance_id = $2 AND is_active = true',
        [user_id, pet_instance_id]
      );
      if (existing.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, error: '宠物已在庭院中' });
      }

      // 删除同一个 (user_id, pet_instance_id) 的旧 inactive 记录
      await client.query(
        'DELETE FROM yard_pets WHERE user_id = $1 AND pet_instance_id = $2 AND is_active = false',
        [user_id, pet_instance_id]
      );

      // 删除目标位置的 inactive 记录（为本次插入清空坑位）
      await client.query(
        'DELETE FROM yard_pets WHERE user_id = $1 AND position = $2 AND is_active = false',
        [user_id, newPosition]
      );

      // 插入（此时唯一约束不会冲突）
      await client.query(
        'INSERT INTO yard_pets (user_id, pet_instance_id, position, is_active) VALUES ($1, $2, $3, true)',
        [user_id, pet_instance_id, newPosition]
      );

      await client.query('COMMIT');
      res.json({ success: true, position: newPosition });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('yard/add error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // 移出庭院
  router.post('/yard/remove', async (req, res) => {
    try {
      const { user_id, pet_instance_id } = req.body;
      await pool.query(
        'UPDATE yard_pets SET is_active = false WHERE user_id = $1 AND pet_instance_id = $2',
        [user_id, pet_instance_id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 互动操作（喂食/抚摸/清洁）
  router.post('/interact/:action', async (req, res) => {
    try {
      const { action } = req.params;
      const { pet_instance_id, user_id, item_id } = req.body;

      if (!pet_instance_id || !user_id) {
        return res.status(400).json({ success: false, error: '缺少参数' });
      }

      // 检查宠物是否正在出游
      const traveling = await pool.query(
        `SELECT id FROM travel_records WHERE pet_instance_id = $1 AND status = 'traveling' LIMIT 1`,
        [pet_instance_id]
      );
      if (traveling.rows[0]) {
        return res.status(400).json({ success: false, error: '宠物正在出游中，无法互动' });
      }

      // 更新互动计数
      if (action === 'feed') {
        await pool.query(
          'UPDATE pet_instances SET total_interactions = total_interactions + 1, updated_at = NOW() WHERE id = $1',
          [pet_instance_id]
        );
      } else if (action === 'pet') {
        await pool.query(
          'UPDATE pet_instances SET total_interactions = total_interactions + 1, updated_at = NOW() WHERE id = $1',
          [pet_instance_id]
        );
        // 每日首次抚摸给情绪值
        const today = new Date().toDateString();
        const lastPet = await pool.query(
          'SELECT last_pet_date FROM user_daily_pets WHERE user_id = $1 AND pet_instance_id = $2 AND last_pet_date = $3',
          [user_id, pet_instance_id, today]
        );
        if (!lastPet.rows[0]) {
          await pool.query(
            `INSERT INTO user_daily_pets (user_id, pet_instance_id, last_pet_date, daily_count)
             VALUES ($1, $2, $3, 1)
             ON CONFLICT (user_id, pet_instance_id, last_pet_date)
             DO UPDATE SET daily_count = user_daily_pets.daily_count + 1`,
            [user_id, pet_instance_id, today]
          );
          const firstToday = await pool.query(
            'SELECT COUNT(*) FROM user_daily_pets WHERE user_id = $1 AND last_pet_date = $2 AND daily_count = 1',
            [user_id, today]
          );
          if (parseInt(firstToday.rows[0].count) === 1) {
            await pool.query(
              'UPDATE users SET emotion_points = emotion_points + 5 WHERE id = $1',
              [user_id]
            );
            return res.json({ success: true, action, emotion_reward: 5, message: '每日首次抚摸+5情绪值' });
          }
        }
      }

      res.json({ success: true, action });
    } catch (err) {
      console.error('interact error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 获取单只宠物详情
  router.get('/instance/:id', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT pi.*, pm.name as model_name, pm.image_url, pm.rarity,
                pm.personality_template, pm.mbti, pm.nfc_range_start, pm.nfc_range_end,
                yp.position, yp.is_active as yard_active
         FROM pet_instances pi
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         LEFT JOIN yard_pets yp ON yp.pet_instance_id = pi.id AND yp.is_active = true
         WHERE pi.id = $1`,
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: '宠物不存在' });
      res.json({ success: true, pet: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
