import express from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// GET /api/epet1/shop2/items - 获取商品列表(按tab分组)
router.get('/items', async (req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      `SELECT id, name, item_type, item_category, shop_tab, price_emotion, price_real,
              image_url, description, stock, is_active, yard_width, yard_height, match3_level_id, unlock_zone_id
       FROM shop_items WHERE is_active = true AND purchasable = true ORDER BY shop_tab, price_emotion`
    );
    const tabs = { food: [], furniture: [], decoration: [], map: [], toy: [] };
    for (const item of rows) {
      const tab = item.shop_tab || 'food';
      if (!tabs[tab]) tabs[tab] = [];
      tabs[tab].push(item);
    }
    res.json({ ok: true, tabs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/epet1/shop2/config - 获取商店配置(背景图等)
router.get('/config', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query('SELECT key, value FROM shop_config');
    const config = {};
    for (const row of rows) config[row.key] = row.value;
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/shop2/config - 更新商店配置
router.post('/config', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: '缺少 key' });
    await poolEpet1.query(
      `INSERT INTO shop_config (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
      [key, value || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin CRUD ──────────────────────────────────

// GET /api/epet1/shop2/admin/items
router.get('/admin/items', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      `SELECT id, name, item_type, item_category, shop_tab, price_emotion, price_real,
              image_url, description, stock, is_active, purchasable, yard_width, yard_height, match3_level_id, unlock_zone_id, emotion_bonus_pct
       FROM shop_items ORDER BY shop_tab, id`
    );
    res.json({ ok: true, items: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/shop2/admin/items
router.post('/admin/items', async (req, res) => {
  try {
    const { name, item_type, item_category, shop_tab, price_emotion, price_real,
            image_url, description, stock, yard_width, yard_height, match3_level_id, unlock_zone_id, emotion_bonus_pct } = req.body;
    if (!name) return res.status(400).json({ error: '缺少名称' });
    const { rows: inserted } = await poolEpet1.query(
      `INSERT INTO shop_items (name, item_type, item_category, shop_tab, price_emotion, price_real,
        image_url, description, stock, yard_width, yard_height, match3_level_id, unlock_zone_id, emotion_bonus_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [name, item_type || 'virtual', item_category || 'food', shop_tab || 'food',
       price_emotion || 0, price_real || 0, image_url || '', description || '', stock ?? -1,
       yard_width || 0.08, yard_height || 0.12, match3_level_id || null,
       unlock_zone_id || null, emotion_bonus_pct || 0]
    );
    res.json({ ok: true, item: inserted[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/epet1/shop2/admin/items/:id
router.put('/admin/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, item_type, item_category, shop_tab, price_emotion, price_real,
            image_url, description, stock, is_active, purchasable, yard_width, yard_height, match3_level_id, unlock_zone_id, emotion_bonus_pct } = req.body;
    const { rows: updated } = await poolEpet1.query(
      `UPDATE shop_items SET
        name=COALESCE($1,name), item_type=COALESCE($2,item_type),
        item_category=COALESCE($3,item_category), shop_tab=COALESCE($4,shop_tab),
        price_emotion=COALESCE($5,price_emotion), price_real=COALESCE($6,price_real),
        image_url=COALESCE($7,image_url), description=COALESCE($8,description),
        stock=COALESCE($9,stock), is_active=COALESCE($10,is_active),
        purchasable=COALESCE($11,purchasable),
        yard_width=COALESCE($12,yard_width), yard_height=COALESCE($13,yard_height),
        match3_level_id=$14, unlock_zone_id=$15,
        emotion_bonus_pct=COALESCE($17,emotion_bonus_pct)
       WHERE id=$16 RETURNING *`,
      [name, item_type, item_category, shop_tab, price_emotion, price_real,
       image_url, description, stock, is_active, purchasable, yard_width, yard_height,
       match3_level_id === undefined ? null : (match3_level_id || null),
       unlock_zone_id === undefined ? null : (unlock_zone_id || null),
       id,
       emotion_bonus_pct === undefined ? null : emotion_bonus_pct]
    );
    if (!updated.length) return res.status(404).json({ error: '商品不存在' });
    res.json({ ok: true, item: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/epet1/shop2/admin/items/:id
router.delete('/admin/items/:id', async (req, res) => {
  try {
    await poolEpet1.query('UPDATE shop_items SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
