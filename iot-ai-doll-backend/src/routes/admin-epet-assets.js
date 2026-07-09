/**
 * 素材管理 API (Admin) — 管理员上传/列表/删除 epet 静态素材
 * 文件存储在 /var/www/iot-ai-doll/epet-assets/ (nginx /epet/static/ 代理)
 *
 * GET    /           - 列出所有素材文件
 * POST   /           - 上传素材 (multipart)
 * DELETE /:filename  - 删除素材
 */
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const ASSETS_DIR = '/var/www/iot-ai-doll/epet-assets';

// 确保目录存在
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const upload = multer({
  dest: '/tmp/asset-uploads',
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm', '.json'].includes(ext);
    if (okExt) cb(null, true);
    else cb(new Error('不支持的文件类型'));
  },
});

// 列出所有文件（不含子目录中的文件）
router.get('/', async (_req, res) => {
  try {
    const entries = fs.readdirSync(ASSETS_DIR).filter(name => {
      const full = path.join(ASSETS_DIR, name);
      return fs.statSync(full).isFile();
    });
    res.json({ ok: true, files: entries });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 上传素材
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: '未上传文件' });

    const filename = req.body.filename || req.file.originalname;
    // 安全：只允许文件名，不允许路径
    const safeName = path.basename(filename);
    const dest = path.join(ASSETS_DIR, safeName);

    // 如果已存在则覆盖
    fs.renameSync(req.file.path, dest);

    res.json({ ok: true, filename: safeName, url: `/epet/static/${safeName}` });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 删除素材
router.delete('/:filename', async (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const full = path.join(ASSETS_DIR, safeName);
    if (!fs.existsSync(full)) {
      return res.status(404).json({ ok: false, error: '文件不存在' });
    }
    fs.unlinkSync(full);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
