import express from 'express';
import multer from 'multer';
import { writeFile, readFile, mkdir, stat, access } from 'fs/promises';
import { dirname, join } from 'path';

const router = express.Router();

const DIST_BASE = '/var/www/iot-ai-doll/frontend/dist/epet';
const ICONS_DIR = join(DIST_BASE, 'icons');

const SIZES = [
  { size: 32,   name: 'favicon.png',          purpose: 'favicon' },
  { size: 180,  name: 'apple-touch-icon.png', purpose: 'ios' },
  { size: 192,  name: 'icons/icon-192.png',   purpose: 'android' },
  { size: 512,  name: 'icons/icon-512.png',   purpose: 'android-splash' },
  { size: 1024, name: 'icons/icon-1024.png',  purpose: 'hd' },
];

const MAX_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(png|jpeg|svg\+xml|webp)/i.test(file.mimetype) ||
               /\.(png|jpg|jpeg|svg|webp)$/i.test(file.originalname);
    if (!ok) return cb(new Error('仅支持 PNG/JPG/SVG/WebP 图片'));
    cb(null, true);
  },
});

// GET: 当前 5 尺寸文件状态
router.get('/', async (_req, res) => {
  try {
    const out = { lastUpdate: null, sizes: {} };
    for (const s of SIZES) {
      try {
        const st = await stat(join(DIST_BASE, s.name));
        out.sizes[s.size] = {
          url: '/epet/' + s.name,
          bytes: st.size,
          mtime: st.mtime.toISOString(),
        };
        if (!out.lastUpdate || st.mtime > new Date(out.lastUpdate)) {
          out.lastUpdate = st.mtime.toISOString();
        }
      } catch {
        out.sizes[s.size] = null;
      }
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /export?size=N: 流式下载某个尺寸
router.get('/export', async (req, res) => {
  const size = parseInt(req.query.size, 10);
  const s = SIZES.find(x => x.size === size);
  if (!s) return res.status(400).json({ error: 'invalid size, expect one of: ' + SIZES.map(x => x.size).join(',') });
  const p = join(DIST_BASE, s.name);
  try {
    await access(p);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="epet-icon-${size}.png"`);
    const fs = await import('fs');
    fs.createReadStream(p).pipe(res);
  } catch {
    res.status(404).json({ error: 'icon not generated yet, upload first' });
  }
});

// POST: 上传图标, sharp 5 尺寸, 直写 dist, patch 3 个文本文件
router.post('/', upload.single('icon'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传图标文件 (字段名: icon)' });
  }

  // 关键: 每次请求都建 icons/ 目录, 不依赖 module top-level mkdir
  // (烟测或手工清理后不需要重启 PM2 也能写)
  try {
    await mkdir(ICONS_DIR, { recursive: true });
  } catch (e) {
    return res.status(500).json({ error: '创建图标目录失败: ' + e.message });
  }

  const buf = req.file.buffer;
  const written = [];
  // Lazy load sharp: libvips init may corrupt libuv main loop if loaded at module top
  const sharp = (await import('sharp')).default;
  try {
    for (const s of SIZES) {
      const out = await sharp(buf)
        .resize(s.size, s.size, { fit: 'cover', position: 'center' })
        .png({ quality: 90, compressionLevel: 9 })
        .toBuffer();
      const p = join(DIST_BASE, s.name);
      // 防御: 每个文件都确保父目录存在 (e.g. icons/icon-1024.png 需 icons/)
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, out);
      written.push({ size: s.size, path: s.name, url: '/epet/' + s.name, bytes: out.length });
    }

    // === auto-patch dist/epet/index.html ===
    const indexPath = join(DIST_BASE, 'index.html');
    let html = await readFile(indexPath, 'utf8');
    html = html.replace(
      /<link rel="icon"[^>]*\/>/i,
      '<link rel="icon" type="image/png" href="/epet/favicon.png" />'
    );
    html = html.replace(
      /<link rel="apple-touch-icon"[^>]*\/>/i,
      '<link rel="apple-touch-icon" href="/epet/apple-touch-icon.png" />'
    );
    await writeFile(indexPath, html);

    // === auto-patch dist/epet/manifest.webmanifest ===
    const manifestPath = join(DIST_BASE, 'manifest.webmanifest');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.icons = [
      { src: '/epet/icons/icon-192.png',  sizes: '192x192',   type: 'image/png', purpose: 'any' },
      { src: '/epet/icons/icon-512.png',  sizes: '512x512',   type: 'image/png', purpose: 'any' },
      { src: '/epet/icons/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
    ];
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

    // === auto-patch dist/epet/sw.js (CACHE_NAME bump + .svg -> .png refs) ===
    const swPath = join(DIST_BASE, 'sw.js');
    let sw = await readFile(swPath, 'utf8');
    const m = sw.match(/CACHE_NAME\s*=\s*'([^']+)'/);
    let newCacheName = null;
    if (m) {
      const oldName = m[1];
      newCacheName = oldName.replace(/-v(\d+)$/, (_mm, n) => `-v${parseInt(n, 10) + 1}`);
      sw = sw.replace(m[0], `CACHE_NAME = '${newCacheName}'`);
    }
    sw = sw.replace(/'\/epet\/favicon\.svg'/g, "'/epet/favicon.png'");
    sw = sw.replace(/'\/epet\/icons\.svg'/g,   "'/epet/apple-touch-icon.png'");
    await writeFile(swPath, sw);

    res.json({
      success: true,
      files: written,
      cacheName: newCacheName,
      note: '5 PNG 已生成, index.html/manifest.webmanifest/sw.js 已自动 patch. 用户浏览器需强刷 (Ctrl+Shift+R) 看新图标',
    });
  } catch (e) {
    console.error('[admin-pwa-icon] failed:', e);
    res.status(500).json({ error: '图标处理失败: ' + e.message });
  }
});

export default router;
