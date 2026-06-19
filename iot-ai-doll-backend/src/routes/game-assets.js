import express from 'express';
import { readdir, unlink, stat, mkdir, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

// 素材根目录
const EPET_ASSETS_BASE = '/var/www/iot-ai-doll/frontend/dist/epet/assets';
const ASSET_TYPES = ['bg', 'cg', 'pets', 'ui', 'fx', 'game-assets', 'chat-bgs', 'art-assets'];

// 确保目录存在
async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (e) { /* ignore */ }
}

// Multer 配置
const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    const type = req.body?.type || 'game-assets';
    const dir = join(EPET_ASSETS_BASE, type === 'game-assets' ? '..' : type);
    await ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    const baseName = file.originalname.replace(/\.[^.]+$/, '');
    const safeBase = baseName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_').substring(0, 30);
    const timestamp = Date.now().toString(36).substring(0, 6);
    cb(null, safeBase + '_' + timestamp + '.' + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // 优先用扩展名判断（更可靠，不依赖客户端 mimetype）
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
    if (allowedExts.includes(ext)) return cb(null, true);
    // 退化：用 mimetype 判断
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) return cb(null, true);
    cb(new Error('仅支持 PNG/JPG/GIF/WebP/SVG 格式'));
  },
});

// GET /api/game-assets - 列表
router.get('/', async (req, res) => {
  try {
    const type = req.query.type || 'game-assets';
    const dirPath = type === 'game-assets' 
      ? join(EPET_ASSETS_BASE, '..') 
      : join(EPET_ASSETS_BASE, type);
    
    await ensureDir(dirPath);
    const files = await readdir(dirPath);
    const assets = [];
    
    for (const name of files) {
      try {
        const filePath = join(dirPath, name);
        const s = await stat(filePath);
        if (s.isFile()) {
          const urlPath = type === 'game-assets' 
            ? '/epet/' + name 
            : '/epet/assets/' + type + '/' + name;
          assets.push({
            name, url: urlPath, type,
            size: s.size,
            sizeFormatted: formatSize(s.size),
            modified: s.mtime.toISOString(),
          });
        }
      } catch (_) { }
    }
    
    assets.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json({ ok: true, count: assets.length, type, assets });
  } catch (err) {
    console.error('[game-assets] list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/game-assets/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    
    const type = req.body?.type || 'game-assets';
    const urlPath = type === 'game-assets' 
      ? '/epet/' + req.file.filename 
      : '/epet/assets/' + type + '/' + req.file.filename;

    console.log('[game-assets] uploaded:', type, req.file.filename);
    res.json({ 
      ok: true, 
      message: '上传成功', 
      asset: {
        name: req.file.filename,
        url: urlPath,
        type,
        size: req.file.size,
        sizeFormatted: formatSize(req.file.size),
        modified: new Date().toISOString(),
      }
    });
  } catch (err) {
    console.error('[game-assets] upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/game-assets/:type/:name
router.delete('/:type/:name', async (req, res) => {
  try {
    const { type, name } = req.params;
    if (!ASSET_TYPES.includes(type) || /[\/\\.]{2,}/.test(name)) {
      return res.status(400).json({ error: '非法参数' });
    }

    const dirPath = type === 'game-assets' 
      ? join(EPET_ASSETS_BASE, '..') 
      : join(EPET_ASSETS_BASE, type);
    await unlink(join(dirPath, name));
    
    console.log('[game-assets] deleted:', type, name);
    res.json({ ok: true, message: '删除成功' });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: '文件不存在' });
    res.status(500).json({ error: err.message });
  }
});

// 互动页背景文件: dist/epet/chat-bg.png
const CHAT_BG_PATH = join(EPET_ASSETS_BASE, '..', 'chat-bg.png');

// GET /api/game-assets/config - 返回当前 yard-bg / chat-bg 是否就绪 + URL
router.get('/config', async (req, res) => {
  try {
    const yardExists = await stat(join(EPET_ASSETS_BASE, '..', 'yard-bg.png')).then(() => true).catch(() => false);
    const chatExists = await stat(CHAT_BG_PATH).then(() => true).catch(() => false);
    res.json({
      ok: true,
      yardBg: yardExists ? '/epet/yard-bg.png' : null,
      chatBg: chatExists ? '/epet/chat-bg.png' : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/game-assets/set-chat-bg - 把指定素材设为互动页背景
router.post('/set-chat-bg', async (req, res) => {
  try {
    const { filename, type } = req.body;
    if (!filename || !type) return res.status(400).json({ error: '缺少参数' });
    if (!ASSET_TYPES.includes(type) || /[\/\\.]{2,}/.test(filename)) {
      return res.status(400).json({ error: '非法参数' });
    }

    const sourceDir = type === 'game-assets'
      ? join(EPET_ASSETS_BASE, '..')
      : join(EPET_ASSETS_BASE, type);
    const sourcePath = join(sourceDir, filename);
    await copyFile(sourcePath, CHAT_BG_PATH);
    console.log('[game-assets] set as chat-bg:', filename);
    res.json({ ok: true, message: '已设为互动页背景', target: '/epet/chat-bg.png' });
  } catch (err) {
    console.error('[game-assets] set-chat-bg error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/game-assets/set-yard-bg
router.post('/set-yard-bg', async (req, res) => {
  try {
    const { filename, type } = req.body;
    if (!filename || !type) return res.status(400).json({ error: '缺少参数' });
    if (/[\/\\.]{2,}/.test(filename)) return res.status(400).json({ error: '非法文件名' });

    const sourceDir = type === 'game-assets' 
      ? join(EPET_ASSETS_BASE, '..') 
      : join(EPET_ASSETS_BASE, type);
    const sourcePath = join(sourceDir, filename);
    const targetPath = join(EPET_ASSETS_BASE, '..', 'yard-bg.png');

    await copyFile(sourcePath, targetPath);
    console.log('[game-assets] set as yard-bg:', filename);
    res.json({ ok: true, message: '已设为庭院背景', target: '/epet/yard-bg.png' });
  } catch (err) {
    console.error('[game-assets] set-yard-bg error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default router;
