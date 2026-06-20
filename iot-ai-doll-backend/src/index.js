import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import iotRoute from './routes/iot.js';
import dbRoutes from './routes/db.js';
import adminRoutes from './routes/admin.js';
import ttsRoutes from './routes/tts.js';
import sttRoutes from './routes/stt.js';
import epetRoutes from './routes/epet.js';
import gameAssetsRoutes from './routes/game-assets.js';
import gameConfigsRoutes from './routes/game-configs.js';
import chatStylesRoutes from './routes/admin-chat-styles.js';
import adminDevicesRoutes from './routes/admin-devices.js';
import adminPetsRoutes from './routes/admin-pets.js';
import adminRagRoutes from './routes/admin-rag.js';
import adminModelsRoutes from './routes/admin-models.js';
import adminYardScenesRoutes from './routes/admin-yard-scenes.js';

// ========== EPET1 路由（合并自 epet1-backend，CommonJS）==========
import { createRequire } from 'module';
const requireCjs = createRequire(import.meta.url);
import { poolEpet1 } from './lib/db.js';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/iot', iotRoute);
app.use('/api/db', dbRoutes);
app.use('/api/db', adminRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/stt', sttRoutes);
app.use('/api/epet', epetRoutes);
app.use('/api/game-assets', gameAssetsRoutes);
app.use('/api/game-configs', gameConfigsRoutes);


app.use('/api/admin/chat-styles', chatStylesRoutes);
app.use('/api/admin/devices', adminDevicesRoutes);
app.use('/api/admin/pets', adminPetsRoutes);
app.use('/api/admin/rag-kbs', adminRagRoutes);
app.use('/api/admin/models', adminModelsRoutes);
app.use('/api/admin/yard-scenes', adminYardScenesRoutes);


// ========== EPET1 公开接口（无需admin权限）==========
app.use('/api/epet1/yard', requireCjs('./routes-epet1/yard-scene.cjs')(poolEpet1));

// ========== EPET1 路由注册（与原 epet1-backend 3001 端口完全等价）==========
app.use('/api/epet1/user',      requireCjs('./routes-epet1/users.cjs')(poolEpet1));
app.use('/api/epet1/pet',        requireCjs('./routes-epet1/pets.cjs')(poolEpet1));
app.use('/api/epet1/postcard',   requireCjs('./routes-epet1/postcards.cjs')(poolEpet1));
app.use('/api/epet1/shop',       requireCjs('./routes-epet1/shop.cjs')(poolEpet1));
app.use('/api/epet1/travel',     requireCjs('./routes-epet1/travel.cjs')(poolEpet1));
app.use('/api/epet1/drift',      requireCjs('./routes-epet1/drift.cjs')(poolEpet1));
app.use('/api/epet1/game',       requireCjs('./routes-epet1/games.cjs')(poolEpet1));
app.use('/api/epet1/chat',       requireCjs('./routes-epet1/chat.cjs')(poolEpet1));
app.use('/api/epet1/emotion',    requireCjs('./routes-epet1/emotion.cjs')(poolEpet1));
app.use('/api/epet1/admin',      requireCjs('./routes-epet1/admin.cjs')(poolEpet1));
// 静态文件服务（前端构建产物）
app.use(express.static(join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../frontend/index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 IoT AI Doll Backend running on port ${PORT}`);
  console.log(`   AI Chat: http://localhost:${PORT}/api/ai/chat`);
  console.log(`   TTS:     http://localhost:${PORT}/api/tts/synthesize`);
  console.log(`   STT:     http://localhost:${PORT}/api/stt/recognize`);
  console.log(`   Auth:    http://localhost:${PORT}/api/auth/register`);
});