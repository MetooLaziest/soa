/**
 * 互动页开场视频管理 API
 *
 * 表: intro_videos (每个 pet_model 独立配置)
 * 匹配: 当前时刻 + growth_level → 先精确等级，fallback 通用(0)，按 id 升序(先入库优先)
 *
 * Admin 路由:
 *   GET    /              - 列出某 model 的所有视频配置
 *   POST   /              - 创建视频配置
 *   PUT    /:id           - 更新视频配置
 *   DELETE /:id           - 删除视频配置(DB记录，不删服务器文件)
 *   POST   /upload        - 上传视频文件(MP4)
 *
 * 公开路由:
 *   GET    /match         - 前端调用，按当前时刻+model+level匹配视频
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { poolEpet1 } from '../lib/db.js';
import { getEffectiveTimeStr } from './admin-demo-time.js';

const router = express.Router();

// 视频文件存储目录 (隔离目录，部署不受影响)
const VIDEO_DIR = '/var/www/iot-ai-doll/epet-assets/intro-videos';

// 上传中间件
const upload = multer({
  dest: '/tmp/intro-video-uploads',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (30s MP4 ~10MB)
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okExt = ['.mp4', '.webm'].includes(ext);
    const okMime = ['video/mp4', 'video/webm'].includes(file.mimetype);
    if (okExt || okMime) cb(null, true);
    else cb(new Error('仅支持 MP4/WebM 格式'));
  },
});

// ═══════════════════════════════════════════════════
// Admin 路由
// ═══════════════════════════════════════════════════

/** GET /api/admin/intro-videos?pet_model_id=X — 列出某 model 的所有视频配置 */
router.get('/', async (req, res) => {
  try {
    const { pet_model_id } = req.query;
    if (!pet_model_id) {
      return res.status(400).json({ success: false, error: 'pet_model_id 必填' });
    }
    const { rows } = await poolEpet1.query(
      `SELECT * FROM intro_videos
       WHERE pet_model_id = $1
       ORDER BY time_start, growth_level, id`,
      [pet_model_id]
    );

    // 按 time_start + time_end 分组方便前端展示
    const groups: Record<string, typeof rows> = {};
    for (const row of rows) {
      const key = `${row.time_start}_${row.time_end}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    res.json({ success: true, videos: rows, groups });
  } catch (err) {
    console.error('admin/intro-videos GET / error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/admin/intro-videos — 创建视频配置 */
router.post('/', async (req, res) => {
  try {
    const { pet_model_id, name, time_start, time_end, growth_level, video_url, duration_sec, is_active, sort_order } = req.body;
    if (!pet_model_id || !time_start || !time_end || !video_url) {
      return res.status(400).json({ success: false, error: 'pet_model_id / time_start / time_end / video_url 必填' });
    }
    // 验证 model 存在
    const modelCheck = await poolEpet1.query('SELECT id, name FROM pet_models WHERE id = $1', [pet_model_id]);
    if (modelCheck.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'pet_model_id 不存在' });
    }
    // 验证 growth_level 范围
    const level = Number(growth_level) || 0;
    if (level < 0 || level > 5) {
      return res.status(400).json({ success: false, error: 'growth_level 范围 0~5 (0=通用)' });
    }

    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO intro_videos (pet_model_id, name, time_start, time_end, growth_level, video_url, duration_sec, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [pet_model_id, name || '', time_start, time_end, level, video_url,
       duration_sec || 30, is_active !== false, sort_order || 0]
    );
    res.json({ success: true, video: row });
  } catch (err) {
    console.error('admin/intro-videos POST / error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** PUT /api/admin/intro-videos/:id — 更新视频配置 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'time_start', 'time_end', 'growth_level', 'video_url', 'duration_sec', 'is_active', 'sort_order'];
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
    sets.push('updated_at = now()');
    vals.push(id);

    const { rows: [row] } = await poolEpet1.query(
      `UPDATE intro_videos SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!row) {
      return res.status(404).json({ success: false, error: 'Video config not found' });
    }
    res.json({ success: true, video: row });
  } catch (err) {
    console.error('admin/intro-videos PUT /:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** DELETE /api/admin/intro-videos/:id — 删除视频配置 (只删DB记录，不删服务器文件) */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 先查记录，返回被删除的信息
    const { rows: [deleted] } = await poolEpet1.query(
      'DELETE FROM intro_videos WHERE id = $1 RETURNING *',
      [id]
    );
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Video config not found' });
    }
    // 注意: 不删除服务器上的视频文件，保留素材
    res.json({ success: true, deleted, note: 'DB记录已删除，视频文件保留在服务器上' });
  } catch (err) {
    console.error('admin/intro-videos DELETE /:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/admin/intro-videos/upload — 上传视频文件 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }
    const { pet_model_id } = req.body;
    if (!pet_model_id) {
      // 清理临时文件
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ success: false, error: 'pet_model_id 必填' });
    }

    // 确保目录存在
    fs.mkdirSync(VIDEO_DIR, { recursive: true });

    // 文件名: model_{id}_{timestamp}.mp4
    const ext = path.extname(req.file.originalname) || '.mp4';
    const filename = `model_${pet_model_id}_${Date.now()}${ext}`;
    const dest = path.join(VIDEO_DIR, filename);

    // 移动文件
    fs.renameSync(req.file.path, dest);

    const url = `/epet/assets/intro-videos/${filename}`;

    res.json({
      success: true,
      url,
      filename,
      size: req.file.size,
      note: '视频已上传到隔离目录，部署不受影响',
    });
  } catch (err) {
    // 清理临时文件
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('admin/intro-videos POST /upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// 公开路由 (前端调用)
// ═══════════════════════════════════════════════════

/** GET /api/epet1/intro-video?pet_model_id=X&growth_level=N — 匹配当前时段的视频 */
router.get('/match', async (req, res) => {
  try {
    const { pet_model_id, growth_level } = req.query;
    if (!pet_model_id) {
      return res.status(400).json({ success: false, error: 'pet_model_id 必填' });
    }
    const level = Number(growth_level) || 0;
    if (level < 0 || level > 5) {
      return res.status(400).json({ success: false, error: 'growth_level 范围 0~5' });
    }

    // Use demo_time if active, otherwise real LOCALTIME
    const effectiveTime = getEffectiveTimeStr();

    // 1) 精确匹配: 当前时刻 + 指定 level
    const exact = await poolEpet1.query(
      `SELECT * FROM intro_videos
       WHERE pet_model_id = $1 AND is_active = true
         AND time_start <= $3::time AND $3::time < time_end
         AND growth_level = $2
       ORDER BY id ASC LIMIT 1`,
      [pet_model_id, level, effectiveTime]
    );

    if (exact.rowCount > 0) {
      return res.json({ success: true, video: exact.rows[0] });
    }

    // 2) Fallback: 当前时刻 + 通用 (growth_level = 0)
    const fallback = await poolEpet1.query(
      `SELECT * FROM intro_videos
       WHERE pet_model_id = $1 AND is_active = true
         AND time_start <= $2::time AND $2::time < time_end
         AND growth_level = 0
       ORDER BY id ASC LIMIT 1`,
      [pet_model_id, effectiveTime]
    );

    if (fallback.rowCount > 0) {
      return res.json({ success: true, video: fallback.rows[0] });
    }

    // 3) 无匹配 → 直接进互动页
    res.json({ success: true, video: null });
  } catch (err) {
    console.error('intro-video GET /match error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
