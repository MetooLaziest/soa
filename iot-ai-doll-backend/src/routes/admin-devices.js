import express from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  host: 'localhost',
  database: 'epet',
  user: 'postgres',
  password: 'iot2026pass',
});

// ==================== 设备 SN 管理 ====================
// 设备 SN 本质上是宠物实体的 NFC/序列号
// 创建 SN = 基于模板创建实体 → 出现在宠物实体管理

// 1. 获取所有设备 SN（pets 表）
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.nfc as device_sn, p.model_id, p.display_name, m.name as model_name,
              p.is_visible, p.created_at
       FROM pets p
       LEFT JOIN models m ON p.model_id = m.model_id
       ORDER BY p.created_at DESC`
    );
    res.json({ success: true, devices: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 创建设备 SN（= 创建宠物实体）
router.post('/', async (req, res) => {
  try {
    const { device_sn, model_id, display_name } = req.body;
    if (!device_sn || !model_id) {
      return res.status(400).json({ success: false, error: '序列号和模板不能为空' });
    }

    // 检查是否已存在
    const exist = await pool.query('SELECT nfc FROM pets WHERE nfc = $1', [device_sn]);
    if (exist.rows.length > 0) {
      return res.status(409).json({ success: false, error: '该序列号已存在' });
    }

    // 检查 model_id 是否有效
    const model = await pool.query('SELECT model_id, name FROM models WHERE model_id = $1', [model_id]);
    if (!model.rows.length) {
      return res.status(400).json({ success: false, error: '模板不存在' });
    }

    // 插入 pets 表（创建实体）
    const monsterTypes = { 1: 'blue', 2: 'white', 3: 'pink' };
    await pool.query(
      `INSERT INTO pets (nfc, model_id, display_name, monster_type, hunger, is_visible, created_at)
       VALUES ($1, $2, $3, $4, 100, false, now())`,
      [device_sn, model_id, display_name || model.rows[0].name, monsterTypes[model_id] || 'green']
    );

    res.json({ success: true, message: '设备创建成功', nfc: device_sn });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. 删除设备 SN（= 删除宠物实体）
router.delete('/:nfc', async (req, res) => {
  try {
    const { nfc } = req.params;
    await pool.query('DELETE FROM pets WHERE nfc = $1', [nfc]);
    res.json({ success: true, message: '设备删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// 4. 更新设备 SN（model_id / is_visible）
router.put('/:nfc', async (req, res) => {
  try {
    const { nfc } = req.params;
    const { model_id, is_visible, display_name } = req.body;

    // 检查是否存在
    const exist = await pool.query('SELECT nfc FROM pets WHERE nfc = $1', [nfc]);
    if (exist.rows.length === 0) {
      return res.status(404).json({ success: false, error: '该设备不存在' });
    }

    // 检查 model_id 是否有效
    if (model_id !== undefined) {
      const model = await pool.query('SELECT model_id FROM models WHERE model_id = $1', [model_id]);
      if (!model.rows.length) {
        return res.status(400).json({ success: false, error: '模板不存在' });
      }
    }

    const updates = [];
    const vals = [];
    let idx = 1;
    if (model_id !== undefined) { updates.push(`model_id=$${idx++}`); vals.push(model_id); }
    if (is_visible !== undefined) { updates.push(`is_visible=$${idx++}`); vals.push(is_visible); }
    if (display_name !== undefined) { updates.push(`display_name=$${idx++}`); vals.push(display_name); }

    if (updates.length === 0) {
      return res.json({ success: true, message: '无更新字段' });
    }

    vals.push(nfc);
    await pool.query(
      `UPDATE pets SET ${updates.join(', ')} WHERE nfc=$${idx}`,
      vals
    );
    res.json({ success: true, message: '设备更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 获取可用模板列表（供录入时选择）
router.get('/models', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT model_id, name, description FROM models ORDER BY model_id'
    );
    res.json({ success: true, models: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
