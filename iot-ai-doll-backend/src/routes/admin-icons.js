/**
 * Icon Assets API — CRUD for epet_icons (uploadable icon assets)
 */
import { Router } from 'express';
import { poolEpet1 } from '../lib/db.js';
import fs from 'fs';
import { join } from 'path';

const router = Router();

/** GET /api/admin/icons — list all icons */
router.get('/', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      'SELECT * FROM epet_icons ORDER BY icon_key'
    );
    res.json({ success: true, icons: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/admin/icons/:key — get single icon */
router.get('/:key', async (req, res) => {
  try {
    const { rows: [icon] } = await poolEpet1.query(
      'SELECT * FROM epet_icons WHERE icon_key = $1', [req.params.key]
    );
    if (!icon) return res.status(404).json({ error: 'Icon not found' });
    res.json({ success: true, icon });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/admin/icons — create icon entry */
router.post('/', async (req, res) => {
  try {
    const { icon_key, label, image_url, width, height } = req.body;
    if (!icon_key) return res.status(400).json({ error: 'icon_key required' });

    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO epet_icons (icon_key, label, image_url, width, height)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (icon_key) DO UPDATE SET label = $2, updated_at = now()
       RETURNING *`,
      [icon_key, label || icon_key, image_url || '', width || 64, height || 64]
    );
    res.json({ success: true, icon: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/icons/:key — update icon metadata */
router.put('/:key', async (req, res) => {
  try {
    const { label, width, height } = req.body;
    const sets = [];
    const vals = [];
    let idx = 1;

    if (label !== undefined) { sets.push(`label = $${idx++}`); vals.push(label); }
    if (width !== undefined) { sets.push(`width = $${idx++}`); vals.push(width); }
    if (height !== undefined) { sets.push(`height = $${idx++}`); vals.push(height); }
    sets.push('updated_at = now()');

    if (sets.length === 1) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.key);

    const { rows: [row] } = await poolEpet1.query(
      `UPDATE epet_icons SET ${sets.join(', ')} WHERE icon_key = $${idx} RETURNING *`,
      vals
    );
    if (!row) return res.status(404).json({ error: 'Icon not found' });
    res.json({ success: true, icon: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/admin/icons/:key */
router.delete('/:key', async (req, res) => {
  try {
    const { rowCount } = await poolEpet1.query('DELETE FROM epet_icons WHERE icon_key = $1', [req.params.key]);
    if (!rowCount) return res.status(404).json({ error: 'Icon not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/admin/icons/upload — upload icon image */
router.post('/upload', async (req, res) => {
  try {
    const { icon_key, image_data } = req.body;
    if (!icon_key || !image_data) return res.status(400).json({ error: 'icon_key and image_data required' });

    const match = image_data.match(/^data:(image\/(png|jpe?g|webp|svg\+xml));base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });

    const ext = match[2].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    const base64 = match[3];
    const buffer = Buffer.from(base64, 'base64');

    const dir = '/var/www/iot-ai-doll/epet-assets/icons';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `${icon_key}-${Date.now()}.${ext}`;
    const filepath = join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    const url = `/epet/static/icons/${filename}`;

    // Upsert icon record
    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO epet_icons (icon_key, image_url)
       VALUES ($1, $2)
       ON CONFLICT (icon_key) DO UPDATE SET image_url = $2, updated_at = now()
       RETURNING *`,
      [icon_key, url]
    );

    res.json({ success: true, icon: row, url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/admin/icons/init-defaults — seed default icon keys */
router.post('/init-defaults', async (_req, res) => {
  try {
    const defaults = [
      { icon_key: 'icon-collection', label: '藏品库', emoji: '🏠' },
      { icon_key: 'icon-minigame', label: '小游戏', emoji: '🎮' },
      { icon_key: 'icon-shop', label: '商店', emoji: '🛍️' },
      { icon_key: 'icon-backpack', label: '背包', emoji: '🎒' },
      { icon_key: 'icon-travel', label: '旅行', emoji: '✈️' },
      { icon_key: 'icon-driftbottle', label: '漂流瓶', emoji: '🌊' },
      { icon_key: 'icon-chat', label: '聊天', emoji: '💬' },
      { icon_key: 'icon-feed', label: '喂食', emoji: '🍽️' },
      { icon_key: 'icon-clean', label: '清理', emoji: '🧹' },
      { icon_key: 'icon-place', label: '布置', emoji: '🏗️' },
      { icon_key: 'icon-recycle', label: '回收', emoji: '🔄' },
      { icon_key: 'icon-dawn', label: '清晨', emoji: '🌅' },
      { icon_key: 'icon-day', label: '白天', emoji: '☀️' },
      { icon_key: 'icon-night', label: '夜晚', emoji: '🌙' },
      { icon_key: 'icon-map', label: '区域导航', emoji: '🗺️' },
    ];

    let created = 0;
    for (const d of defaults) {
      const { rowCount } = await poolEpet1.query(
        `INSERT INTO epet_icons (icon_key, label, image_url, width, height)
         VALUES ($1, $2, '', 64, 64)
         ON CONFLICT (icon_key) DO NOTHING`,
        [d.icon_key, d.label]
      );
      if (rowCount) created++;
    }

    res.json({ success: true, created, total: defaults.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
