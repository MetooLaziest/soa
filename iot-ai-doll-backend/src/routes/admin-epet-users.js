/**
 * Epet1 用户管理 API（Admin）
 * GET    /api/admin/epet-users           - 用户列表（含情绪值）
 * POST   /api/admin/epet-users/:id/emotion - 修改情绪值
 * DELETE /api/admin/epet-users/:id/inventory/:invId - 删除背包道具
 * DELETE /api/admin/epet-users/:id/match3-records - 清空消消乐闯关记录
 */
import express from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// GET /api/admin/epet-users — 用户列表
router.get('/', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      `SELECT u.id, u.nickname, u.emotion_points, u.created_at, u.updated_at,
              (SELECT count(*) FROM pet_instances WHERE user_id = u.id) AS pet_count,
              (SELECT count(*) FROM yard_furniture WHERE user_id = u.id) AS furniture_count
       FROM users u ORDER BY u.id`
    );
    // inventory count per user
    const invRes = await poolEpet1.query(
      `SELECT user_id, count(*) AS cnt FROM user_inventory GROUP BY user_id`
    );
    const invMap = Object.fromEntries(invRes.rows.map(r => [r.user_id, parseInt(r.cnt)]));
    const users = rows.map(u => ({ ...u, pet_count: parseInt(u.pet_count), furniture_count: parseInt(u.furniture_count), inventory_count: invMap[u.id] || 0 }));
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/epet-users/:id/inventory — 用户背包
router.get('/:id/inventory', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await poolEpet1.query(
      `SELECT ui.id, ui.user_id, ui.shop_item_id, ui.quantity, ui.item_category, ui.source, ui.dish_rating,
              si.name, si.image_url, si.price_emotion
       FROM user_inventory ui
       JOIN shop_items si ON si.id = ui.shop_item_id
       WHERE ui.user_id = $1
       ORDER BY ui.item_category, si.name`,
      [id]
    );
    res.json({ ok: true, inventory: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/epet-users/:id/emotion — 修改情绪值
router.post('/:id/emotion', async (req, res) => {
  try {
    const { id } = req.params;
    const { emotion_points } = req.body;
    if (typeof emotion_points !== 'number') {
      return res.status(400).json({ ok: false, error: 'emotion_points 必须是数字' });
    }
    const { rows } = await poolEpet1.query(
      `UPDATE users SET emotion_points = $1, updated_at = now() WHERE id = $2 RETURNING id, nickname, emotion_points`,
      [emotion_points, id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: '用户不存在' });
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/admin/epet-users/:id/inventory/:invId — 删除背包道具
router.delete('/:id/inventory/:invId', async (req, res) => {
  try {
    const { id, invId } = req.params;
    const { rowCount } = await poolEpet1.query(
      'DELETE FROM user_inventory WHERE id = $1 AND user_id = $2',
      [invId, id]
    );
    if (!rowCount) return res.status(404).json({ ok: false, error: '道具不存在' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/admin/epet-users/:id/match3-records — 清空消消乐闯关记录
router.delete('/:id/match3-records', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await poolEpet1.query(
      'DELETE FROM match3_records WHERE user_id = $1',
      [id]
    );
    res.json({ ok: true, deleted: rowCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
