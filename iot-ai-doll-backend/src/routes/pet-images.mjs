/**
 * 宠物图片上传 API (ES Module 版本)
 * 支持上传宠物图片到 /var/www/iot-ai-doll/frontend/dist/epet/ 目录
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = '/var/www/iot-ai-doll/frontend/dist/epet/';
    // 确保目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 文件名格式：pet-white.png, pet-blue.png, pet-pink.png
    const { modelId } = req.body;
    const colorMap = {
      '1': 'pet-white',
      '2': 'pet-blue',
      '3': 'pet-pink'
    };
    const baseName = colorMap[modelId] || `pet-${Date.now()}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${baseName}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG/PNG/GIF/WebP 格式'));
    }
  }
});

/**
 * POST /api/pet-images/upload
 * 上传宠物图片
 * Body: { modelId: string }
 * File: image (field name: 'image')
 */
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { modelId } = req.body;
    
    if (!modelId) {
      return res.status(400).json({ success: false, error: '缺少 modelId' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }

    const imageUrl = `/epet/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        url: imageUrl,
        size: req.file.size,
        modelId: modelId
      }
    });

  } catch (err) {
    console.error('上传宠物图片失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/pet-images
 * 列出所有宠物图片
 */
router.get('/', async (req, res) => {
  try {
    const uploadDir = '/var/www/iot-ai-doll/frontend/dist/epet/';
    const files = fs.readdirSync(uploadDir)
      .filter(f => /^pet-(white|blue|pink)\.(png|jpg|jpeg|gif|webp)$/i.test(f))
      .map(f => ({
        filename: f,
        url: `/epet/${f}`,
        path: path.join(uploadDir, f),
        size: fs.statSync(path.join(uploadDir, f)).size,
        mtime: fs.statSync(path.join(uploadDir, f)).mtime
      }));

    res.json({ success: true, count: files.length, images: files });
  } catch (err) {
    console.error('列出宠物图片失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/pet-images/:filename
 * 删除宠物图片
 */
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // 路径穿越防护
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ success: false, error: '非法文件名' });
    }

    const filePath = path.join('/var/www/iot-ai-doll/frontend/dist/epet/', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('删除宠物图片失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
