/**
 * 装扮管理 (Admin API)
 * GET    /                           - 所有装扮列表
 * POST   /                           - 创建装扮
 * PUT    /:id                        - 更新装扮元数据
 * DELETE /:id                        - 删除装扮
 * POST   /:id/assign-model           - 绑定机伴
 * DELETE /:id/assign-model/:petModelId - 解绑机伴
 * POST   /:id/upload-frame/:petModelId - 上传动画帧
 * PUT    /:id/animations/:petModelId   - 批量更新 animations JSONB
 * PUT    /:id/anchor-override/:petModelId - 更新 anchor_override
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();
const upload = multer({ dest: '/tmp/outfit-uploads', limits: { fileSize: 10 * 1024 * 1024 } });
const ASSETS_BASE = '/var/www/iot-ai-doll/epet-assets/outfits';

// ─── 所有装扮列表 ───
router.get('/', async (_req, res) => {
  try {
    const r = await poolEpet1.query(
      `SELECT si.*,
              COALESCE(model_info.model_count, 0) as compatible_model_count,
              model_info.model_names
       FROM shop_items si
       LEFT JOIN LATERAL (
         SELECT COUNT(*) as model_count,
                STRING_AGG(pm.name, ', ') as model_names
         FROM outfit_pet_models opm
         JOIN pet_models pm ON pm.id = opm.pet_model_id
         WHERE opm.outfit_shop_item_id = si.id
       ) model_info ON true
       WHERE si.item_category = 'outfit'
       ORDER BY si.equip_slot, si.name`
    );
    res.json({ success: true, outfits: r.rows });
  } catch (err) {
    console.error('admin/outfits GET error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 创建装扮 ───
router.post('/', async (req, res) => {
  try {
    const { name, description, image_url, equip_slot, price_emotion, price_real, shop_tab } = req.body;
    if (!name || !equip_slot) {
      return res.status(400).json({ success: false, error: 'name, equip_slot 必填' });
    }
    const validSlots = ['hat', 'accessory', 'back', 'body'];
    if (!validSlots.includes(equip_slot)) {
      return res.status(400).json({ success: false, error: `equip_slot 必须为 ${validSlots.join('/')}` });
    }
    const r = await poolEpet1.query(
      `INSERT INTO shop_items (name, description, image_url, item_type, item_category, shop_tab, equip_slot, price_emotion, price_real)
       VALUES ($1, $2, $3, 'virtual', 'outfit', $4, $5, $6, $7)
       RETURNING *`,
      [name, description || '', image_url || '', shop_tab || 'outfit', equip_slot, price_emotion || 0, price_real || 0]
    );
    res.json({ success: true, outfit: r.rows[0] });
  } catch (err) {
    console.error('admin/outfits POST error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 更新装扮元数据 ───
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'image_url', 'equip_slot', 'price_emotion', 'price_real', 'shop_tab', 'is_active'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = $${i++}`);
        vals.push(req.body[f]);
      }
    }
    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    vals.push(id);
    const r = await poolEpet1.query(
      `UPDATE shop_items SET ${sets.join(', ')} WHERE id = $${i} AND item_category = 'outfit' RETURNING *`,
      vals
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: '装扮不存在' });
    }
    res.json({ success: true, outfit: r.rows[0] });
  } catch (err) {
    console.error('admin/outfits PUT error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 删除装扮 ───
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // CASCADE 会自动清理 outfit_pet_models 和 pet_equipped_outfits
    const r = await poolEpet1.query(
      `DELETE FROM shop_items WHERE id = $1 AND item_category = 'outfit' RETURNING id`,
      [id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: '装扮不存在' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('admin/outfits DELETE error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 装扮的机伴绑定列表 ───
router.get('/:id/assignments', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await poolEpet1.query(
      `SELECT opm.*, pm.name as model_name
       FROM outfit_pet_models opm
       JOIN pet_models pm ON pm.id = opm.pet_model_id
       WHERE opm.outfit_shop_item_id = $1
       ORDER BY pm.name`,
      [id]
    );
    res.json({ success: true, assignments: r.rows });
  } catch (err) {
    console.error('admin/outfits assignments GET error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 绑定机伴 ───
router.post('/:id/assign-model', async (req, res) => {
  try {
    const { id } = req.params;
    const { pet_model_id } = req.body;
    if (!pet_model_id) {
      return res.status(400).json({ success: false, error: 'pet_model_id 必填' });
    }
    // 校验装扮存在
    const outfit = await poolEpet1.query(
      `SELECT id FROM shop_items WHERE id = $1 AND item_category = 'outfit'`, [id]
    );
    if (!outfit.rows[0]) {
      return res.status(404).json({ success: false, error: '装扮不存在' });
    }
    // 校验机伴存在
    const model = await poolEpet1.query(
      `SELECT id FROM pet_models WHERE id = $1 AND is_active = true`, [pet_model_id]
    );
    if (!model.rows[0]) {
      return res.status(404).json({ success: false, error: '机伴不存在或已停用' });
    }
    const r = await poolEpet1.query(
      `INSERT INTO outfit_pet_models (outfit_shop_item_id, pet_model_id, animations)
       VALUES ($1, $2, '{}')
       ON CONFLICT (outfit_shop_item_id, pet_model_id) DO UPDATE SET animations = outfit_pet_models.animations
       RETURNING *`,
      [id, pet_model_id]
    );
    res.json({ success: true, assignment: r.rows[0] });
  } catch (err) {
    console.error('admin/outfits assign-model error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 解绑机伴 ───
router.delete('/:id/assign-model/:petModelId', async (req, res) => {
  try {
    const { id, petModelId } = req.params;
    const r = await poolEpet1.query(
      `DELETE FROM outfit_pet_models WHERE outfit_shop_item_id = $1 AND pet_model_id = $2 RETURNING id`,
      [id, petModelId]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: '绑定不存在' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('admin/outfits unassign-model error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 上传动画帧 ───
router.post('/:id/upload-frame/:petModelId', upload.single('file'), async (req, res) => {
  try {
    const { id, petModelId } = req.params;
    const { type = 'idle' } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }
    // 校验绑定存在
    const bind = await poolEpet1.query(
      `SELECT id, animations FROM outfit_pet_models WHERE outfit_shop_item_id = $1 AND pet_model_id = $2`,
      [id, petModelId]
    );
    if (!bind.rows[0]) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: '该装扮未绑定此机伴' });
    }
    // 写文件
    const dir = path.join(ASSETS_BASE, String(id), String(petModelId));
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(req.file.originalname) || '.png';
    const safeType = type.replace(/[^a-z0-9_-]/gi, '_');
    const filename = `${safeType}_${Date.now()}${ext}`;
    const dest = path.join(dir, filename);
    fs.renameSync(req.file.path, dest);
    const url = `/epet/static/outfits/${id}/${petModelId}/${filename}`;
    // 追加到 animations[type]
    const curAnims = bind.rows[0].animations || {};
    const newAnims = { ...curAnims, [type]: [...(curAnims[type] || []), url] };
    await poolEpet1.query(
      `UPDATE outfit_pet_models SET animations = $1::jsonb WHERE outfit_shop_item_id = $2 AND pet_model_id = $3`,
      [JSON.stringify(newAnims), id, petModelId]
    );
    res.json({ success: true, url, animations: newAnims });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    console.error('admin/outfits upload-frame error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 批量更新 animations JSONB ───
router.put('/:id/animations/:petModelId', async (req, res) => {
  try {
    const { id, petModelId } = req.params;
    const { animations } = req.body;
    if (!animations || typeof animations !== 'object') {
      return res.status(400).json({ success: false, error: 'animations 必填 (object)' });
    }
    const r = await poolEpet1.query(
      `UPDATE outfit_pet_models SET animations = $1::jsonb
       WHERE outfit_shop_item_id = $2 AND pet_model_id = $3
       RETURNING animations`,
      [JSON.stringify(animations), id, petModelId]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: '绑定不存在' });
    }
    res.json({ success: true, animations: r.rows[0].animations });
  } catch (err) {
    console.error('admin/outfits animations PUT error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 更新 anchor_override ───
router.put('/:id/anchor-override/:petModelId', async (req, res) => {
  try {
    const { id, petModelId } = req.params;
    const { anchor_override } = req.body;
    const r = await poolEpet1.query(
      `UPDATE outfit_pet_models SET anchor_override = $1::jsonb
       WHERE outfit_shop_item_id = $2 AND pet_model_id = $3
       RETURNING anchor_override`,
      [anchor_override ? JSON.stringify(anchor_override) : null, id, petModelId]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: '绑定不存在' });
    }
    res.json({ success: true, anchor_override: r.rows[0].anchor_override });
  } catch (err) {
    console.error('admin/outfits anchor-override PUT error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
