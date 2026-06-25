/**
 * 消消乐管理后台 API
 * GET    /api/admin/match3/icons          - 获取所有图标
 * POST   /api/admin/match3/icons          - 创建图标
 * PUT    /api/admin/match3/icons/:id      - 更新图标
 * DELETE /api/admin/match3/icons/:id      - 删除图标
 *
 * GET    /api/admin/match3/levels         - 获取所有关卡
 * POST   /api/admin/match3/levels         - 创建关卡
 * PUT    /api/admin/match3/levels/:id     - 更新关卡
 * DELETE /api/admin/match3/levels/:id     - 删除关卡
 */
import { Router } from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = Router();

// ===================== Icons =====================

/** GET /api/admin/match3/icons — 获取所有图标 */
router.get('/icons', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      'SELECT * FROM match3_icons ORDER BY sort_order, id'
    );
    res.json({ success: true, icons: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/admin/match3/icons — 创建图标 */
router.post('/icons', async (req, res) => {
  try {
    const { name, icon_type, image_url, sort_order, is_active } = req.body;
    if (!name) return res.status(400).json({ error: '缺少名称' });
    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO match3_icons (name, icon_type, image_url, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, icon_type || 'normal', image_url || '', sort_order || 0, is_active !== false]
    );
    res.json({ success: true, icon: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/match3/icons/:id — 更新图标 */
router.put('/icons/:id', async (req, res) => {
  try {
    const iconId = Number(req.params.id);
    const { name, icon_type, image_url, sort_order, is_active } = req.body;
    const sets = [];
    const vals = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (icon_type !== undefined) { sets.push(`icon_type = $${idx++}`); vals.push(icon_type); }
    if (image_url !== undefined) { sets.push(`image_url = $${idx++}`); vals.push(image_url); }
    if (sort_order !== undefined) { sets.push(`sort_order = $${idx++}`); vals.push(sort_order); }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(is_active); }

    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(iconId);

    const { rows: [row] } = await poolEpet1.query(
      `UPDATE match3_icons SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!row) return res.status(404).json({ error: '图标不存在' });
    res.json({ success: true, icon: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/admin/match3/icons/:id */
router.delete('/icons/:id', async (req, res) => {
  try {
    const { rowCount } = await poolEpet1.query(
      'DELETE FROM match3_icons WHERE id = $1', [Number(req.params.id)]
    );
    if (!rowCount) return res.status(404).json({ error: '图标不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================== Levels =====================

/** GET /api/admin/match3/levels — 获取所有关卡 */
router.get('/levels', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      'SELECT * FROM match3_levels ORDER BY difficulty, id'
    );
    res.json({ success: true, levels: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/admin/match3/levels — 创建关卡 */
router.post('/levels', async (req, res) => {
  try {
    const { name, grid_rows, grid_cols, grid_shape, score_target, max_moves, available_icons, difficulty, is_active } = req.body;
    if (!name) return res.status(400).json({ error: '缺少名称' });
    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO match3_levels (name, grid_rows, grid_cols, grid_shape, score_target, max_moves, available_icons, difficulty, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, grid_rows || 8, grid_cols || 8,
       JSON.stringify(grid_shape || []),
       score_target || 1000, max_moves || 20,
       JSON.stringify(available_icons || []),
       difficulty || 1, is_active !== false]
    );
    res.json({ success: true, level: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/match3/levels/:id — 更新关卡 */
router.put('/levels/:id', async (req, res) => {
  try {
    const levelId = Number(req.params.id);
    const { name, grid_rows, grid_cols, grid_shape, score_target, max_moves, available_icons, difficulty, is_active } = req.body;
    const sets = [];
    const vals = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (grid_rows !== undefined) { sets.push(`grid_rows = $${idx++}`); vals.push(grid_rows); }
    if (grid_cols !== undefined) { sets.push(`grid_cols = $${idx++}`); vals.push(grid_cols); }
    if (grid_shape !== undefined) { sets.push(`grid_shape = $${idx++}`); vals.push(JSON.stringify(grid_shape)); }
    if (score_target !== undefined) { sets.push(`score_target = $${idx++}`); vals.push(score_target); }
    if (max_moves !== undefined) { sets.push(`max_moves = $${idx++}`); vals.push(max_moves); }
    if (available_icons !== undefined) { sets.push(`available_icons = $${idx++}`); vals.push(JSON.stringify(available_icons)); }
    if (difficulty !== undefined) { sets.push(`difficulty = $${idx++}`); vals.push(difficulty); }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(is_active); }

    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(levelId);

    const { rows: [row] } = await poolEpet1.query(
      `UPDATE match3_levels SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!row) return res.status(404).json({ error: '关卡不存在' });
    res.json({ success: true, level: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/admin/match3/levels/:id */
router.delete('/levels/:id', async (req, res) => {
  try {
    const { rowCount } = await poolEpet1.query(
      'DELETE FROM match3_levels WHERE id = $1', [Number(req.params.id)]
    );
    if (!rowCount) return res.status(404).json({ error: '关卡不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
