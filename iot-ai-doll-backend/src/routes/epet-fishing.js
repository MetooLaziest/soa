import express from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// ─── 钓鱼 API ────────────────────────────────────────

const DAILY_FISH_LIMIT = 3;

// GET /api/epet1/fishing/maps - 获取钓鱼地图列表
router.get('/maps', async (req, res) => {
  try {
    const { rows: maps } = await poolEpet1.query(
      'SELECT id, name, description, image_url, sort_order FROM fishing_maps WHERE is_active = true ORDER BY sort_order'
    );
    // 每个地图附带可钓到的鱼
    for (const map of maps) {
      const { rows: fish } = await poolEpet1.query(
        'SELECT id, name, rarity, description, image_url, weight FROM fish_items WHERE fishing_map_id = $1 AND is_active = true ORDER BY sort_order',
        [map.id]
      );
      map.fish = fish;
    }
    res.json({ ok: true, maps });
  } catch (err) {
    console.error('[fishing] maps error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/epet1/fishing/daily-status - 获取今日钓鱼次数
router.get('/daily-status', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: '缺少 user_id' });

    const today = new Date().toISOString().slice(0, 10);
    const { rows: rows } = await poolEpet1.query(
      `SELECT COUNT(*)::int as count FROM fishing_daily_records
       WHERE user_id = $1 AND caught_at::date = $2::date`,
      [userId, today]
    );
    const used = rows[0].count;
    res.json({ ok: true, used, limit: DAILY_FISH_LIMIT, remaining: Math.max(0, DAILY_FISH_LIMIT - used) });
  } catch (err) {
    console.error('[fishing] daily-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/fishing/cast - 钓鱼（投竿）
router.post('/cast', async (req, res) => {
  try {
    const { user_id, pet_instance_id, fishing_map_id } = req.body;
    if (!user_id || !fishing_map_id) return res.status(400).json({ error: '缺少参数' });

    // 检查今日次数
    const today = new Date().toISOString().slice(0, 10);
    const { rows: countRows } = await poolEpet1.query(
      `SELECT COUNT(*)::int as count FROM fishing_daily_records
       WHERE user_id = $1 AND caught_at::date = $2::date`,
      [user_id, today]
    );
    if (countRows[0].count >= DAILY_FISH_LIMIT) {
      return res.json({ ok: false, error: '今日钓鱼次数已用完', remaining: 0 });
    }

    // 根据地图随机抽鱼
    const { rows: fishRows } = await poolEpet1.query(
      'SELECT id, name, rarity, description, image_url, weight FROM fish_items WHERE fishing_map_id = $1 AND is_active = true',
      [fishing_map_id]
    );
    if (fishRows.length === 0) {
      return res.json({ ok: false, error: '该地图没有鱼' });
    }

    const totalWeight = fishRows.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * totalWeight;
    let caught = fishRows[0];
    for (const fish of fishRows) {
      r -= fish.weight;
      if (r <= 0) { caught = fish; break; }
    }

    // 记录钓鱼
    await poolEpet1.query(
      `INSERT INTO fishing_daily_records (user_id, pet_instance_id, fishing_map_id, fish_item_id) VALUES ($1, $2, $3, $4)`,
      [user_id, pet_instance_id || null, fishing_map_id, caught.id]
    );

    // 加入背包（user_inventory）— 鱼作为 shop_item 的虚拟物品
    // 先检查是否已有对应的 shop_item，没有就自动创建
    const { rows: existingRows } = await poolEpet1.query(
      "SELECT id FROM shop_items WHERE name = $1 AND item_type = 'virtual' AND item_category = 'food' LIMIT 1",
      [caught.name]
    );
    let shopItemId;
    if (existingRows.length > 0) {
      shopItemId = existingRows[0].id;
    } else {
      // 自动创建 shop_item
      const { rows: insertedRows } = await poolEpet1.query(
        `INSERT INTO shop_items (name, item_type, item_category, price_emotion, image_url, description)
         VALUES ($1, 'virtual', 'food', 0, $2, $3) RETURNING id`,
        [caught.name, caught.image_url, `钓鱼获得的${caught.name}`]
      );
      shopItemId = insertedRows[0].id;
    }

    // 更新背包
    const { rows: invRows } = await poolEpet1.query(
      'SELECT id, quantity FROM user_inventory WHERE user_id = $1 AND shop_item_id = $2',
      [user_id, shopItemId]
    );
    if (invRows.length > 0) {
      await poolEpet1.query(
        'UPDATE user_inventory SET quantity = quantity + 1, item_category = $1, source = $2 WHERE id = $3',
        ['food', 'fishing', invRows[0].id]
      );
    } else {
      await poolEpet1.query(
        'INSERT INTO user_inventory (user_id, shop_item_id, quantity, item_category, source) VALUES ($1, $2, 1, $3, $4)',
        [user_id, shopItemId, 'food', 'fishing']
      );
    }

    const remaining = DAILY_FISH_LIMIT - countRows[0].count - 1;
    res.json({
      ok: true,
      fish: {
        id: caught.id,
        name: caught.name,
        rarity: caught.rarity,
        description: caught.description,
        image_url: caught.image_url,
      },
      remaining: Math.max(0, remaining),
    });
  } catch (err) {
    console.error('[fishing] cast error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/epet1/fishing/history - 钓鱼历史
router.get('/history', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: '缺少 user_id' });
    const limit = parseInt(req.query.limit) || 20;

    const { rows: rows } = await poolEpet1.query(
      `SELECT r.caught_at, f.name, f.rarity, f.image_url, fm.name as map_name
       FROM fishing_daily_records r
       JOIN fish_items f ON f.id = r.fish_item_id
       JOIN fishing_maps fm ON fm.id = r.fishing_map_id
       WHERE r.user_id = $1
       ORDER BY r.caught_at DESC LIMIT $2`,
      [userId, limit]
    );
    res.json({ ok: true, history: rows });
  } catch (err) {
    console.error('[fishing] history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin 钓鱼管理 ──────────────────────────────────

// GET /api/epet1/fishing/admin/fish - 管理鱼类列表
router.get('/admin/fish', async (_req, res) => {
  try {
    const { rows: rows } = await poolEpet1.query(
      `SELECT f.*, fm.name as map_name FROM fish_items f
       LEFT JOIN fishing_maps fm ON fm.id = f.fishing_map_id
       ORDER BY f.sort_order`
    );
    res.json({ ok: true, fish: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/fishing/admin/fish - 新增鱼类
router.post('/admin/fish', async (req, res) => {
  try {
    const { name, rarity, description, image_url, fishing_map_id, weight, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: '缺少鱼名' });
    const { rows: insertedRows } = await poolEpet1.query(
      `INSERT INTO fish_items (name, rarity, description, image_url, fishing_map_id, weight, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, rarity || 'common', description || '', image_url || '', fishing_map_id || null, weight || 10, sort_order || 0]
    );
    res.json({ ok: true, fish: insertedRows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/epet1/fishing/admin/fish/:id - 更新鱼类
router.put('/admin/fish/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rarity, description, image_url, fishing_map_id, weight, sort_order, is_active } = req.body;
    const { rows: updated } = await poolEpet1.query(
      `UPDATE fish_items SET name=COALESCE($1,name), rarity=COALESCE($2,rarity), description=COALESCE($3,description),
       image_url=COALESCE($4,image_url), fishing_map_id=COALESCE($5,fishing_map_id), weight=COALESCE($6,weight),
       sort_order=COALESCE($7,sort_order), is_active=COALESCE($8,is_active)
       WHERE id=$9 RETURNING *`,
      [name, rarity, description, image_url, fishing_map_id, weight, sort_order, is_active, id]
    );
    if (!updated.length) return res.status(404).json({ error: '鱼不存在' });
    res.json({ ok: true, fish: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/epet1/fishing/admin/fish/:id
router.delete('/admin/fish/:id', async (req, res) => {
  try {
    await poolEpet1.query('UPDATE fish_items SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/epet1/fishing/admin/maps - 管理地图列表
router.get('/admin/maps', async (_req, res) => {
  try {
    const { rows: rows } = await poolEpet1.query('SELECT * FROM fishing_maps ORDER BY sort_order');
    res.json({ ok: true, maps: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/fishing/admin/maps - 新增地图
router.post('/admin/maps', async (req, res) => {
  try {
    const { name, description, image_url, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: '缺少地图名' });
    const { rows: insertedRows } = await poolEpet1.query(
      `INSERT INTO fishing_maps (name, description, image_url, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description || '', image_url || '', sort_order || 0]
    );
    res.json({ ok: true, map: insertedRows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/epet1/fishing/admin/maps/:id - 更新地图
router.put('/admin/maps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url, sort_order, is_active } = req.body;
    const { rows: updated } = await poolEpet1.query(
      `UPDATE fishing_maps SET name=COALESCE($1,name), description=COALESCE($2,description),
       image_url=COALESCE($3,image_url), sort_order=COALESCE($4,sort_order), is_active=COALESCE($5,is_active)
       WHERE id=$6 RETURNING *`,
      [name, description, image_url, sort_order, is_active, id]
    );
    if (!updated.length) return res.status(404).json({ error: '地图不存在' });
    res.json({ ok: true, map: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/epet1/fishing/admin/maps/:id
router.delete('/admin/maps/:id', async (req, res) => {
  try {
    await poolEpet1.query('UPDATE fishing_maps SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
