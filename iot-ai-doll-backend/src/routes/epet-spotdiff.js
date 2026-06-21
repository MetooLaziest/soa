import express from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// GET /api/epet1/spotdiff/levels?count=3 - 获取随机关卡（游戏端）
router.get('/levels', async (req, res) => {
  try {
    const count = Math.min(Number(req.query.count) || 3, 10);
    const { rows } = await poolEpet1.query(
      `SELECT id, name, image_a_url, image_b_url, diff_spots
       FROM spot_diff_levels WHERE is_active = true AND image_a_url != '' AND image_b_url != ''
       ORDER BY RANDOM() LIMIT $1`, [count]
    );
    // 如果配置的关卡不够，补上系统默认的
    if (rows.length < count) {
      const { rows: all } = await poolEpet1.query(
        `SELECT id, name, image_a_url, image_b_url, diff_spots
         FROM spot_diff_levels WHERE is_active = true
         ORDER BY RANDOM() LIMIT $1`, [count]
      );
      // 去重合并
      const seen = new Set(rows.map(r => r.id));
      for (const r of all) {
        if (!seen.has(r.id) && rows.length < count) {
          rows.push(r);
          seen.add(r.id);
        }
      }
    }
    res.json({ ok: true, levels: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin ──────────────────────────────────────────

// GET /api/epet1/spotdiff/admin/levels
router.get('/admin/levels', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      `SELECT * FROM spot_diff_levels ORDER BY sort_order, id`
    );
    res.json({ ok: true, levels: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/spotdiff/admin/levels
router.post('/admin/levels', async (req, res) => {
  try {
    const { name, image_a_url, image_b_url, diff_spots, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: '缺少名称' });
    const { rows: inserted } = await poolEpet1.query(
      `INSERT INTO spot_diff_levels (name, image_a_url, image_b_url, diff_spots, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, image_a_url || '', image_b_url || '',
       JSON.stringify(diff_spots || []), sort_order || 0]
    );
    res.json({ ok: true, level: inserted[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/epet1/spotdiff/admin/levels/:id
router.put('/admin/levels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image_a_url, image_b_url, diff_spots, sort_order, is_active } = req.body;
    const { rows: updated } = await poolEpet1.query(
      `UPDATE spot_diff_levels SET
        name=COALESCE($1,name), image_a_url=COALESCE($2,image_a_url),
        image_b_url=COALESCE($3,image_b_url), diff_spots=COALESCE($4,diff_spots),
        sort_order=COALESCE($5,sort_order), is_active=COALESCE($6,is_active)
       WHERE id=$7 RETURNING *`,
      [name, image_a_url, image_b_url,
       diff_spots ? JSON.stringify(diff_spots) : null,
       sort_order, is_active, id]
    );
    if (!updated.length) return res.status(404).json({ error: '关卡不存在' });
    res.json({ ok: true, level: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/epet1/spotdiff/admin/levels/:id
router.delete('/admin/levels/:id', async (req, res) => {
  try {
    await poolEpet1.query('DELETE FROM spot_diff_levels WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
