/**
 * 出游路由（修复版 v2：自动归来定时任务）
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // ========== POST /start ==========
  router.post('/start', async (req, res) => {
    const client = await pool.connect();
    try {
      const { pet_instance_id, user_id } = req.body;
      if (!pet_instance_id || !user_id) {
        return res.status(400).json({ success: false, error: '缺少参数' });
      }
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT id FROM travel_records WHERE pet_instance_id = $1 AND status = 'traveling'`,
        [pet_instance_id]
      );
      if (existing.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '宠物正在出游中' });
      }
      const inYard = await client.query(
        'SELECT id FROM yard_pets WHERE pet_instance_id = $1 AND is_active = true',
        [pet_instance_id]
      );
      if (!inYard.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '宠物不在庭院中，无法出游' });
      }
      const started_at = new Date();
      const expected_end_at = new Date(started_at.getTime() + 12 * 60 * 60 * 1000);
      const result = await client.query(
        `INSERT INTO travel_records (user_id, pet_instance_id, started_at, expected_end_at, status)
         VALUES ($1, $2, $3, $4, 'traveling') RETURNING *`,
        [user_id, pet_instance_id, started_at, expected_end_at]
      );
      await client.query('UPDATE yard_pets SET is_active = false WHERE pet_instance_id = $1', [pet_instance_id]);
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

  // ========== GET /:userId ==========
  router.get('/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT tr.*, pi.pet_model_id, pm.name as pet_name, pm.image_url
         FROM travel_records tr
         JOIN pet_instances pi ON pi.id = tr.pet_instance_id
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE tr.user_id = $1 ORDER BY tr.started_at DESC`,
        [req.params.userId]
      );
      res.json({ records: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== GET /status/:userId ==========
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

  // ========== POST /return ==========
  router.post('/return', async (req, res) => {
    try {
      const { travel_record_id, user_id } = req.body;
      if (!travel_record_id) {
        return res.status(400).json({ success: false, error: '缺少 travel_record_id' });
      }
      const result = await processReturn(pool, travel_record_id);
      res.json(result);
    } catch (err) {
      console.error('travel return error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });


  // ========== POST /cancel — 取消旅行 ==========
  router.post('/cancel', async (req, res) => {
    const client = await pool.connect();
    try {
      const { pet_instance_id } = req.body;
      if (!pet_instance_id) {
        return res.status(400).json({ success: false, error: '缺少 pet_instance_id' });
      }
      await client.query('BEGIN');

      // 查找该宠物当前是否有旅行记录
      const record = await client.query(
        `SELECT * FROM travel_records WHERE pet_instance_id = $1 AND status = 'traveling'`,
        [pet_instance_id]
      );
      if (!record.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '该宠物不在旅行中' });
      }

      // 删除旅行记录
      await client.query(
        `DELETE FROM travel_records WHERE pet_instance_id = $1 AND status = 'traveling'`,
        [pet_instance_id]
      );

      // 恢复庭院状态
      await client.query(
        `UPDATE yard_pets SET is_active = true WHERE pet_instance_id = $1`,
        [pet_instance_id]
      );

      await client.query('COMMIT');
      res.json({ success: true, message: '已取消旅行' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('travel cancel error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // ===== 启动自动归来定时任务 =====
  startAutoReturnScheduler(pool);

  return router;
};

/**
 * 处理宠物归来核心逻辑（独立函数，供路由和定时任务复用）
 * 使用事务 + SELECT FOR UPDATE 防止并发重复处理
 */
async function processReturn(pool, travel_record_id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 原子锁定该行，防止并发
    const travel = await client.query(
      `SELECT * FROM travel_records WHERE id = $1 AND status = 'traveling' FOR UPDATE`,
      [travel_record_id]
    );
    if (!travel.rows[0]) {
      await client.query('ROLLBACK');
      throw new Error('出游记录不存在或已结束');
    }
    const record = travel.rows[0];

    // 按权重抽明信片
    const postcards = await client.query(`SELECT id, rarity_weight FROM postcards WHERE is_active = true`);
    const totalWeight = postcards.rows.reduce((sum, p) => sum + p.rarity_weight, 0);
    let rand = Math.random() * totalWeight;
    let selectedPostcardId = postcards.rows[0].id;
    for (const p of postcards.rows) {
      rand -= p.rarity_weight;
      if (rand <= 0) { selectedPostcardId = p.id; break; }
    }

    await client.query(
      `UPDATE travel_records SET status = 'returned', actual_end_at = NOW(), postcard_id = $1 WHERE id = $2`,
      [selectedPostcardId, travel_record_id]
    );

    const postcard = await pool.query('SELECT * FROM postcards WHERE id = $1', [selectedPostcardId]);

    const existing = await client.query(
      'SELECT id, duplicate_count FROM user_postcards WHERE user_id = $1 AND postcard_id = $2',
      [record.user_id, selectedPostcardId]
    );

    let is_new = !existing.rows[0];
    if (existing.rows[0]) {
      await client.query('UPDATE user_postcards SET duplicate_count = duplicate_count + 1 WHERE id = $1', [existing.rows[0].id]);
    } else {
      await client.query('INSERT INTO user_postcards (user_id, postcard_id) VALUES ($1, $2)', [record.user_id, selectedPostcardId]);
      await client.query('UPDATE users SET emotion_points = emotion_points + 10 WHERE id = $1', [record.user_id]);
    }

    await client.query(
      'UPDATE pet_instances SET total_travels = total_travels + 1, total_postcards = total_postcards + 1 WHERE id = $1',
      [record.pet_instance_id]
    );

    await client.query('COMMIT');

    console.log(`✅ [Return] 宠物 ${record.pet_instance_id} 出游归来，获得明信片 ${selectedPostcardId}`);
    return { success: true, postcard: postcard.rows[0], is_new, travel_record_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 定时检查到期出游，自动执行归来
 * 每 60 秒执行一次，查找 expected_end_at <= NOW() 且 status='traveling' 的记录
 */
function startAutoReturnScheduler(pool) {
  setInterval(async () => {
    try {
      const overdue = await pool.query(
        `SELECT id FROM travel_records WHERE status = 'traveling' AND expected_end_at <= NOW()`
      );
      if (overdue.rows.length > 0) {
        console.log(`⏰ [AutoReturn] 发现 ${overdue.rows.length} 条到期出游，开始处理...`);
      }
      for (const row of overdue.rows) {
        try {
          const result = await processReturn(pool, row.id);
          console.log(`✅ [AutoReturn] 宠物归来成功，明信片: ${result.postcard?.name || row.id}`);
        } catch (err) {
          console.error(`❌ [AutoReturn] 处理记录 ${row.id} 失败:`, err.message);
        }
      }
    } catch (err) {
      console.error('❌ [AutoReturn] 定时检查失败:', err.message);
    }
  }, 60 * 1000);

  console.log('✅ [AutoReturn] 自动归来定时任务已启动（每 60 秒检查）');
}

module.exports.processReturn = processReturn;
