/**
 * 旅行管理 Admin API
 *
 * GET  /api/epet1/travel/admin/models          — 列出所有 pet_model 及其明信片配置
 * GET  /api/epet1/travel/admin/models/:id/postcards — 获取某 model 的明信片配置
 * POST /api/epet1/travel/admin/models/:id/postcards — 为某 model 添加明信片
 * PUT  /api/epet1/travel/admin/postcards/:id   — 更新明信片配置 (probability, unlock_shop_item_id)
 * DELETE /api/epet1/travel/admin/postcards/:id — 删除 model-postcard 关联
 * PUT  /api/epet1/travel/admin/postcards-detail/:id — 更新明信片本身 (video_url, image_url 等)
 * POST /api/epet1/travel/admin/force-return    — 强制让某旅行记录归来 (测试用)
 * POST /api/epet1/travel/admin/force-start     — admin 直接触发宠物旅行 (测试用，不消耗料理)
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // ─── 列出所有 model 及其明信片概要 ───
  router.get('/models', async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT pm.id, pm.name, pm.image_url, pm.rarity,
               (SELECT count(*) FROM pet_model_postcards pmp WHERE pmp.pet_model_id = pm.id) as postcard_count
        FROM pet_models pm
        WHERE pm.is_active = true
        ORDER BY pm.display_order, pm.id
      `);
      res.json({ success: true, models: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 获取某 model 的明信片配置 ───
  router.get('/models/:id/postcards', async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT pmp.id, pmp.pet_model_id, pmp.postcard_id, pmp.probability,
               pmp.unlock_shop_item_id,
               pc.name, pc.image_url, pc.video_url, pc.rarity, pc.description, pc.display_scene,
               si.name as unlock_shop_item_name
        FROM pet_model_postcards pmp
        JOIN postcards pc ON pc.id = pmp.postcard_id
        LEFT JOIN shop_items si ON si.id = pmp.unlock_shop_item_id
        WHERE pmp.pet_model_id = $1
        ORDER BY pc.rarity, pc.id
      `, [req.params.id]);
      res.json({ success: true, postcards: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 为某 model 添加明信片 ───
  router.post('/models/:id/postcards', async (req, res) => {
    try {
      const { postcard_id, probability, unlock_shop_item_id } = req.body;
      if (!postcard_id) return res.status(400).json({ error: '缺少 postcard_id' });

      const { rows } = await pool.query(
        `INSERT INTO pet_model_postcards (pet_model_id, postcard_id, probability, unlock_shop_item_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (pet_model_id, postcard_id) DO UPDATE SET probability = $3, unlock_shop_item_id = $4
         RETURNING *`,
        [req.params.id, postcard_id, probability || 10, unlock_shop_item_id || null]
      );
      res.json({ success: true, postcard: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 更新 model-postcard 关联 ───
  router.put('/postcards/:id', async (req, res) => {
    try {
      const { probability, unlock_shop_item_id } = req.body;
      const { rows } = await pool.query(
        `UPDATE pet_model_postcards SET probability = COALESCE($1, probability), unlock_shop_item_id = COALESCE($2, unlock_shop_item_id)
         WHERE id = $3 RETURNING *`,
        [probability, unlock_shop_item_id, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: '关联不存在' });
      res.json({ success: true, postcard: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 删除 model-postcard 关联 ───
  router.delete('/postcards/:id', async (req, res) => {
    try {
      const { rows } = await pool.query('DELETE FROM pet_model_postcards WHERE id = $1 RETURNING *', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: '关联不存在' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 更新明信片本身 (video_url, image_url 等) ───
  router.put('/postcards-detail/:id', async (req, res) => {
    try {
      const { name, image_url, video_url, description, rarity, rarity_weight, is_active, display_scene } = req.body;
      const sets = [];
      const vals = [];
      let n = 1;
      for (const [key, val] of Object.entries({ name, image_url, video_url, description, rarity, rarity_weight, is_active, display_scene })) {
        if (val !== undefined) {
          sets.push(`${key} = $${n}`);
          vals.push(val);
          n++;
        }
      }
      if (sets.length === 0) return res.status(400).json({ error: '没有更新字段' });
      vals.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE postcards SET ${sets.join(', ')} WHERE id = $${n} RETURNING *`,
        vals
      );
      if (!rows[0]) return res.status(404).json({ error: '明信片不存在' });
      res.json({ success: true, postcard: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 列出所有明信片 (admin 用) ───
  router.get('/all-postcards', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM postcards ORDER BY rarity, id');
      res.json({ success: true, postcards: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 创建新明信片 ───
  router.post('/all-postcards', async (req, res) => {
    try {
      const { name, image_url, video_url, rarity, rarity_weight, description, display_scene } = req.body;
      if (!name) return res.status(400).json({ error: '缺少 name' });
      const { rows } = await pool.query(
        `INSERT INTO postcards (name, image_url, video_url, rarity, rarity_weight, description, display_scene)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, image_url || '', video_url || '', rarity || 'N', rarity_weight || 10, description || '', display_scene || '']
      );
      res.json({ success: true, postcard: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 强制归来 (测试用) ───
  router.post('/force-return', async (req, res) => {
    try {
      const { travel_record_id } = req.body;
      if (!travel_record_id) return res.status(400).json({ error: '缺少 travel_record_id' });

      // 直接将 expected_end_at 设为过去，然后触发 processReturn
      await pool.query(
        `UPDATE travel_records SET expected_end_at = NOW() - interval '1 minute' WHERE id = $1 AND status = 'traveling'`,
        [travel_record_id]
      );
      const { processReturn } = require('./travel.cjs');
      const result = await processReturn(pool, travel_record_id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Admin 直接触发旅行 (测试用, 不消耗料理) ───
  router.post('/force-start', async (req, res) => {
    const client = await pool.connect();
    try {
      const { pet_instance_id, user_id, dish_rating, duration_minutes } = req.body;
      if (!pet_instance_id || !user_id) return res.status(400).json({ error: '缺少 pet_instance_id, user_id' });

      const rating = dish_rating || 3;
      const durationMs = (duration_minutes || 1) * 60_000; // 默认1分钟

      await client.query('BEGIN');

      // 检查是否已在旅行
      const existing = await client.query(
        `SELECT id FROM travel_records WHERE user_id = $1 AND status = 'traveling'`,
        [user_id]
      );
      if (existing.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '该用户已有宠物在旅行中' });
      }

      const started_at = new Date();
      const expected_end_at = new Date(started_at.getTime() + durationMs);

      const result = await client.query(
        `INSERT INTO travel_records (user_id, pet_instance_id, started_at, expected_end_at, status, dish_rating)
         VALUES ($1, $2, $3, $4, 'traveling', $5) RETURNING *`,
        [user_id, pet_instance_id, started_at, expected_end_at, rating]
      );

      await client.query('UPDATE yard_pets SET is_active = false WHERE pet_instance_id = $1', [pet_instance_id]);
      await client.query('COMMIT');

      res.json({ success: true, travel: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};
