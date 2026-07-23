/**
 * Epet1 用户管理 API（Admin）
 * GET    /api/admin/epet-users              - 用户列表（含手机号/角色）
 * POST   /api/admin/epet-users/:id/emotion  - 修改情绪值
 * PATCH  /api/admin/epet-users/:id/phone    - 绑定手机号
 * PATCH  /api/admin/epet-users/:id/password - 设置/重置密码
 * PATCH  /api/admin/epet-users/:id/unphone  - 解绑手机号
 * DELETE /api/admin/epet-users/:id/inventory/:invId - 删除背包道具
 * DELETE /api/admin/epet-users/:id/match3-records    - 清空消消乐闯关记录
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// GET /api/admin/epet-users — 用户列表
router.get('/', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      `SELECT u.id, u.nickname, u.phone, u.role, u.is_guest,
              u.emotion_points, u.created_at, u.updated_at,
              (SELECT count(*) FROM pet_instances WHERE user_id = u.id AND status != 'merged') AS pet_count,
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

// GET /api/admin/epet-users/:id/has-password — 检查用户是否设置了密码
router.get('/:id/has-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await poolEpet1.query('SELECT password_hash IS NOT NULL AS has_password FROM users WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: '用户不存在' });
    res.json({ ok: true, hasPassword: rows[0].has_password });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/admin/epet-users/:id/phone — 绑定手机号
router.patch('/:id/phone', async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body;
    if (!phone || !/^1\d{10}$/.test(phone)) {
      return res.status(400).json({ ok: false, error: '手机号格式不正确（需11位，1开头）' });
    }
    // 检查用户是否已有手机号
    const userRes = await poolEpet1.query('SELECT phone FROM users WHERE id = $1', [id]);
    if (!userRes.rows.length) return res.status(404).json({ ok: false, error: '用户不存在' });
    if (userRes.rows[0].phone) {
      return res.status(400).json({ ok: false, error: '该用户已绑定手机号，如需换绑请先解绑' });
    }
    // 唯一性检查
    const dupRes = await poolEpet1.query('SELECT id FROM users WHERE phone = $1 AND id != $2', [phone, id]);
    if (dupRes.rows.length) {
      return res.status(409).json({ ok: false, error: '该手机号已被其他用户绑定' });
    }
    const { rows } = await poolEpet1.query(
      `UPDATE users SET phone = $1, is_guest = false, updated_at = now() WHERE id = $2 RETURNING id, nickname, phone, role, is_guest`,
      [phone, id]
    );
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/admin/epet-users/:id/unphone — 解绑手机号
router.patch('/:id/unphone', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await poolEpet1.query(
      `UPDATE users SET phone = NULL, updated_at = now() WHERE id = $1 RETURNING id, nickname, phone, role, is_guest`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: '用户不存在' });
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/admin/epet-users/:id/password — 设置/重置密码
router.patch('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: '密码长度至少6位' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await poolEpet1.query(
      `UPDATE users SET password_hash = $1, is_guest = false, updated_at = now() WHERE id = $2 RETURNING id, nickname, phone`,
      [hashedPassword, id]
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

// DELETE /api/admin/epet-users/:id/fishing-today — 重置今日钓鱼次数
router.delete('/:id/fishing-today', async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().slice(0, 10);
    const { rowCount } = await poolEpet1.query(
      `DELETE FROM fishing_daily_records WHERE user_id = $1 AND caught_at::date = $2::date`,
      [id, today]
    );
    res.json({ ok: true, deleted: rowCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
