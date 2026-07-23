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
import epetFishingRoutes from './routes/epet-fishing.js';
import epetInventoryRoutes from './routes/epet-inventory.js';
import epetShop2Routes from './routes/epet-shop2.js';
import epetSpotdiffRoutes from './routes/epet-spotdiff.js';
import adminIntroVideosRoutes from './routes/admin-intro-videos.js';
import adminPetBehaviorsRoutes from './routes/admin-pet-behaviors.js';
import adminExecRoutes from './routes/admin-exec.js';
import match3AdminRoutes from './routes/admin-match3.js';
import epetCookingRoutes from './routes/epet-cooking.js';
import adminZonesRoutes from './routes/admin-zones.js';
import adminIconsRoutes from './routes/admin-icons.js';
import adminEpetUsersRoutes from './routes/admin-epet-users.js';
import adminEpetAssetsRoutes from './routes/admin-epet-assets.js';
import adminPetSeriesRoutes from './routes/admin-pet-series.js';
import landingPageRoutes from './routes/landing-page.js';
import adminDemoTimeRoutes, { publicRouter as demoTimePublicRouter } from './routes/admin-demo-time.js';

// ========== EPET1 路由（合并自 epet1-backend，CommonJS）==========
import { createRequire } from 'module';
const requireCjs = createRequire(import.meta.url);
import { poolEpet1 } from './lib/db.js';
import { jwtAuth } from './middleware/auth.js';


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
app.use('/api/admin/epet-assets', adminEpetAssetsRoutes);
app.use('/api/admin/pet-series', adminPetSeriesRoutes);
app.use('/api/admin/yard-scenes', adminYardScenesRoutes);
app.use('/api/admin/zones', adminZonesRoutes);
app.use('/api/admin/icons', adminIconsRoutes);
app.use('/api/admin/intro-videos', adminIntroVideosRoutes);
app.use('/api/admin/pet-behaviors', adminPetBehaviorsRoutes);
app.use('/api/epet1/intro-video', adminIntroVideosRoutes);
app.use('/api/epet1/pet-behavior', adminPetBehaviorsRoutes);
app.use('/api/admin/exec', adminExecRoutes);
app.use('/api/admin/match3', match3AdminRoutes);
app.use('/api/admin/epet-users', adminEpetUsersRoutes);
app.use('/api/admin/demo-time', adminDemoTimeRoutes);
app.use('/api/epet1/demo-time', demoTimePublicRouter);

// ========== 着陆页 + 站点配置 (Plan C) ==========
app.use('/api', landingPageRoutes);  // GET /api/landing, GET /api/site-config, POST /api/admin/site-config

// ========== EPET1 认证路由（无需 Token）==========
app.use('/api/epet1/auth',       requireCjs('./routes-epet1/auth.cjs')(poolEpet1));

// ========== EPET1 公开接口（无需admin权限，但需登录）==========
app.use('/api/epet1/yard',        jwtAuth, requireCjs('./routes-epet1/yard-scene.cjs')(poolEpet1));
app.use('/api/epet1/furniture',   jwtAuth, requireCjs('./routes-epet1/furniture.cjs')(poolEpet1));
app.use('/api/epet1/emotion-drops', jwtAuth, requireCjs('./routes-epet1/emotion-drops.cjs')(poolEpet1));

// ========== EPET1 路由注册（需 jwtAuth 鉴权）==========
app.use('/api/epet1/user',        jwtAuth, requireCjs('./routes-epet1/users.cjs')(poolEpet1));
app.use('/api/epet1/pet',         jwtAuth, requireCjs('./routes-epet1/pets.cjs')(poolEpet1));
app.use('/api/epet1/postcard',    jwtAuth, requireCjs('./routes-epet1/postcards.cjs')(poolEpet1));
app.use('/api/epet1/shop',        jwtAuth, requireCjs('./routes-epet1/shop.cjs')(poolEpet1));
app.use('/api/epet1/travel',      jwtAuth, requireCjs('./routes-epet1/travel.cjs')(poolEpet1));
app.use('/api/epet1/travel/admin', jwtAuth, requireCjs('./routes-epet1/travel-admin.cjs')(poolEpet1));
app.use('/api/epet1/drift',       jwtAuth, requireCjs('./routes-epet1/drift.cjs')(poolEpet1));
app.use('/api/epet1/game',        jwtAuth, requireCjs('./routes-epet1/games.cjs')(poolEpet1));
app.use('/api/epet1/chat',        jwtAuth, requireCjs('./routes-epet1/chat.cjs')(poolEpet1));
app.use('/api/epet1/emotion',     jwtAuth, requireCjs('./routes-epet1/emotion.cjs')(poolEpet1));
app.use('/api/epet1/admin',       jwtAuth, requireCjs('./routes-epet1/admin.cjs')(poolEpet1));
app.use('/api/epet1/fishing',     jwtAuth, epetFishingRoutes);
app.use('/api/epet1/inventory',   jwtAuth, epetInventoryRoutes);
app.use('/api/epet1/shop2',       jwtAuth, epetShop2Routes);
app.use('/api/epet1/spotdiff',    jwtAuth, epetSpotdiffRoutes);
app.use('/api/epet1/match3',      jwtAuth, requireCjs('./routes-epet1/match3.cjs')(poolEpet1));
app.use('/api/epet1/cooking',     jwtAuth, epetCookingRoutes);
app.use('/api/epet1/collection',  jwtAuth, requireCjs('./routes-epet1/collection.cjs')(poolEpet1));
app.use('/api/epet1/user/settings', jwtAuth, requireCjs('./routes-epet1/user-settings.cjs')(poolEpet1));

// ========== API 404 拦截：未匹配的 /api/* 路由返回 JSON，而非 SPA fallback ==========
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found', path: req.originalUrl });
});

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