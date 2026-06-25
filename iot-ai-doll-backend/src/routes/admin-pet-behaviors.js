import express from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// ─── Admin CRUD ────────────────────────────────────────

// GET / - 列出某宠物的所有行为配置
router.get('/', async (req, res) => {
  try {
    const { pet_model_id } = req.query;
    if (!pet_model_id) return res.status(400).json({ success: false, error: 'pet_model_id required' });
    const { rows } = await poolEpet1.query(
      'SELECT * FROM pet_behaviors WHERE pet_model_id = $1 ORDER BY time_start, sort_order, id',
      [pet_model_id]
    );
    res.json({ success: true, behaviors: rows });
  } catch (err) {
    console.error('admin/pet-behaviors GET / error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / - 创建行为配置
router.post('/', async (req, res) => {
  try {
    const { pet_model_id, name, behavior_type, time_start, time_end, position_x, position_y, is_active, sort_order } = req.body;
    if (!pet_model_id || !time_start || !time_end)
      return res.status(400).json({ success: false, error: 'pet_model_id / time_start / time_end required' });
    const validTypes = ['idle', 'walk', 'eat', 'sleep', 'shake', 'work'];
    const btype = validTypes.includes(behavior_type) ? behavior_type : 'idle';
    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO pet_behaviors (pet_model_id, name, behavior_type, time_start, time_end, position_x, position_y, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [pet_model_id, name || '', btype, time_start, time_end,
       position_x != null ? position_x : null,
       position_y != null ? position_y : null,
       is_active !== false, sort_order || 0]
    );
    res.json({ success: true, behavior: row });
  } catch (err) {
    console.error('admin/pet-behaviors POST / error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id - 更新行为配置
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'behavior_type', 'time_start', 'time_end', 'position_x', 'position_y', 'is_active', 'sort_order'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(f + ' = $' + i++); vals.push(req.body[f]); }
    }
    if (sets.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    sets.push('updated_at = now()');
    vals.push(id);
    const { rows: [row] } = await poolEpet1.query(
      'UPDATE pet_behaviors SET ' + sets.join(', ') + ' WHERE id = $' + i + ' RETURNING *', vals
    );
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, behavior: row });
  } catch (err) {
    console.error('admin/pet-behaviors PUT /:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:id - 删除行为配置
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: [deleted] } = await poolEpet1.query('DELETE FROM pet_behaviors WHERE id = $1 RETURNING *', [id]);
    if (!deleted) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, deleted });
  } catch (err) {
    console.error('admin/pet-behaviors DELETE /:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 公开 API ──────────────────────────────────────────

// GET /match - 匹配当前时间的宠物行为
// ?pet_model_ids=1,2,3  (逗号分隔，一次查多个宠物)
router.get('/match', async (req, res) => {
  try {
    const { pet_model_ids } = req.query;
    if (!pet_model_ids) return res.status(400).json({ success: false, error: 'pet_model_ids required' });
    const ids = String(pet_model_ids).split(',').map(Number).filter(n => n > 0);
    if (ids.length === 0) return res.status(400).json({ success: false, error: 'invalid pet_model_ids' });

    const { rows } = await poolEpet1.query(
      `SELECT * FROM pet_behaviors
       WHERE pet_model_id = ANY($1)
         AND is_active = true
         AND (
           (time_start <= time_end AND time_start <= LOCALTIME AND LOCALTIME < time_end)
           OR
           (time_start > time_end AND (time_start <= LOCALTIME OR LOCALTIME < time_end))
         )
       ORDER BY sort_order, id`,
      [ids]
    );

    // 每个宠物只取优先级最高的一条
    const result = {};
    for (const row of rows) {
      if (!result[row.pet_model_id]) {
        result[row.pet_model_id] = row;
      }
    }

    res.json({ success: true, behaviors: result });
  } catch (err) {
    console.error('pet-behaviors GET /match error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
