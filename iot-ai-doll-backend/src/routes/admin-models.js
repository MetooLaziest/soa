/**
 * 机伴模型管理 - 改读 epet1.pet_models (2026-06-19)
 *
 * 数据源切换:
 *   - 老 epet.models (iot-backend) → 不再使用 (数据脱节)
 *   - 新 epet1.pet_models → 5 层提示词独立字段 (符合用户设计)
 *
 * 5 层提示词 (epet1.pet_models 字段):
 *   L1 identity_anchor       (身份锚点)
 *   L2 core_personality      (核心性格)
 *   L3 behavior_rules        (行为规则)
 *   L4 skill_layer           (技能/能力)
 *   L5 context_memory_template (上下文记忆模板)
 *
 * 路由:
 *   GET    /            - 列出全部 models
 *   GET    /:id         - 单个 model 详情 (含 5 层独立字段)
 *   POST   /            - 创建 model
 *   PUT    /:id         - 更新 model (5 层独立字段)
 *   DELETE /:id         - 删除 model
 *   POST   /:id/upload-image - 机伴图片上传 (multipart, 写到 /var/www/iot-ai-doll/frontend/dist/assets/pets/{name}/)
 *   GET    /:id/animations - 获取 sprite 配置 (从 animations 字段 jsonb)
 *   PUT    /:id/animations - 更新 sprite 配置
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { poolEpet1 } from '../lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 资源基础目录 (隔离目录，部署不受影响)
const ASSETS_BASE = '/var/www/iot-ai-doll/epet-assets/pets';

// 上传中间件: 临时目录
const upload = multer({
  dest: '/tmp/companion-uploads',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
    const okMime = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype);
    if (okExt || okMime) cb(null, true);
    else cb(new Error('仅支持 PNG/JPG/WebP/GIF'));
  },
});

// ─── 列出全部 models ───
router.get('/', async (_req, res) => {
  try {
    const r = await poolEpet1.query(
      `SELECT id, name, description, image_url, animations, personality_template, mbti,
              growth_unlock_config, nfc_range_start, nfc_range_end, rarity, display_order, is_active,
              identity_anchor, core_personality, behavior_rules, skill_layer, context_memory_template,
              prompt_version, created_at
       FROM pet_models
       WHERE is_active = true
       ORDER BY display_order, id`
    );
    res.json({ success: true, models: r.rows, count: r.rowCount });
  } catch (err) {
    console.error('admin/models GET / error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 单个 model 详情 ───
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await poolEpet1.query(
      `SELECT * FROM pet_models WHERE id = $1`,
      [id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 创建 model ───
router.post('/', async (req, res) => {
  try {
    const {
      name, description, image_url, mbti, rarity, nfc_range_start, nfc_range_end,
      identity_anchor, core_personality, behavior_rules, skill_layer, context_memory_template,
      display_order
    } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'name 必填' });
    }
    const r = await poolEpet1.query(
      `INSERT INTO pet_models
        (name, description, image_url, mbti, rarity, nfc_range_start, nfc_range_end,
         identity_anchor, core_personality, behavior_rules, skill_layer, context_memory_template,
         display_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, true)
       RETURNING *`,
      [name, description || '', image_url || '', mbti || '', rarity || 'common',
       nfc_range_start || null, nfc_range_end || null,
       identity_anchor || '', core_personality || '', behavior_rules || '',
       skill_layer || '', context_memory_template || '',
       display_order || 999]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 更新 model (5 层独立字段) ───
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    // 允许更新的字段
    const fields = [
      'name', 'description', 'image_url', 'animations', 'mbti', 'rarity',
      'nfc_range_start', 'nfc_range_end', 'display_order', 'is_active',
      'identity_anchor', 'core_personality', 'behavior_rules',
      'skill_layer', 'context_memory_template', 'personality_template',
    ];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const f of fields) {
      if (body[f] !== undefined) {
        sets.push(`${f} = $${i++}`);
        vals.push(body[f]);
      }
    }
    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    // 如果改了 name，先查旧名
    let oldName = null;
    if (body.name !== undefined) {
      try {
        const oldRes = await poolEpet1.query('SELECT name FROM pet_models WHERE id = $1', [id]);
        oldName = oldRes.rows[0]?.name || null;
      } catch (_) {}
    }

    sets.push(`prompt_version = COALESCE(prompt_version, 0) + 1`);
    vals.push(id);
    const r = await poolEpet1.query(
      `UPDATE pet_models SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }

    // 同步: 该 model 下 nickname 仍为旧名的 pet_instances 自动更新为新名
    if (oldName && body.name && oldName !== body.name) {
      try {
        const syncRes = await poolEpet1.query(
          `UPDATE pet_instances SET nickname = $1 WHERE pet_model_id = $2 AND nickname = $3`,
          [body.name, id, oldName]
        );
        console.log(`[admin-models] Synced ${syncRes.rowCount} instance nicknames: "${oldName}" → "${body.name}"`);
      } catch (syncErr) {
        console.warn('[admin-models] Failed to sync instance nicknames:', syncErr.message);
      }
    }

    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 删除 model (软删除) ───
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 检查是否有 instance
    const instCount = await poolEpet1.query(
      'SELECT COUNT(*) FROM pet_instances WHERE pet_model_id = $1', [id]
    );
    if (parseInt(instCount.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        error: `有 ${instCount.rows[0].count} 只实体还在用此 model, 不能删除 (可设置 is_active=false 停用)`
      });
    }
    const r = await poolEpet1.query(
      'UPDATE pet_models SET is_active = false WHERE id = $1 RETURNING *', [id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 上传机伴图片 ───
// POST /:id/upload-image  (form field: file, type=portrait|walk|idle|eat|shake|...)
router.post('/:id/upload-image', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'portrait' } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }
    // 查 model 拿到 name
    const mr = await poolEpet1.query('SELECT name FROM pet_models WHERE id = $1', [id]);
    if (mr.rowCount === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    const modelName = mr.rows[0].name;
    // 目录: /var/www/iot-ai-doll/frontend/dist/assets/pets/{modelName}/
    const dir = path.join(ASSETS_BASE, modelName);
    fs.mkdirSync(dir, { recursive: true });
    // 文件名: {type}_{timestamp}{ext}
    const ext = path.extname(req.file.originalname) || '.png';
    const safeType = type.replace(/[^a-z0-9_-]/gi, '_');
    const filename = `${safeType}_${Date.now()}${ext}`;
    const dest = path.join(dir, filename);
    fs.renameSync(req.file.path, dest);
    const url = `/assets/pets/${modelName}/${filename}`;
    // 写回 DB
    if (type === 'portrait') {
      // 立绘: 更新 model.image_url
      await poolEpet1.query(
        'UPDATE pet_models SET image_url = $1 WHERE id = $2',
        [url, id]
      );
    } else {
      // sprite: 追加到 animations[type] 数组
      const cur = await poolEpet1.query('SELECT animations FROM pet_models WHERE id = $1', [id]);
      const curAnims = cur.rows[0]?.animations || {};
      const newAnims = { ...curAnims, [type]: [...(curAnims[type] || []), url] };
      await poolEpet1.query(
        'UPDATE pet_models SET animations = $1::jsonb WHERE id = $2',
        [JSON.stringify(newAnims), id]
      );
    }
    res.json({
      success: true,
      url,
      path: dest,
      type,
      model_name: modelName,
    });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 获取 sprite 配置 (animations 字段) ───
router.get('/:id/animations', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await poolEpet1.query('SELECT animations FROM pet_models WHERE id = $1', [id]);
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    res.json({ success: true, animations: r.rows[0].animations || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 更新 sprite 配置 ───
router.put('/:id/animations', async (req, res) => {
  try {
    const { id } = req.params;
    const { animations } = req.body;
    if (!animations || typeof animations !== 'object') {
      return res.status(400).json({ success: false, error: 'animations 必填 (object)' });
    }
    const r = await poolEpet1.query(
      'UPDATE pet_models SET animations = $1::jsonb WHERE id = $2 RETURNING animations',
      [JSON.stringify(animations), id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    res.json({ success: true, animations: r.rows[0].animations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
