# IoT AI Doll 项目状态 - 2026-05-13 21:18

## 项目概述
将「艾瑟拉奇幻谭」IoT AI 玩偶项目从 Supabase 迁移到自建后端，部署在阿里云轻量应用服务器上。

## 服务器信息
- **公网 IP**: 47.98.103.151
- **SSH**: root / 123ASDasd!@#
- **系统**: Ubuntu 22.04.5 LTS (3.4G内存/49G磁盘)

## ✅ 已完成

### 1. 后端代码 (Node.js + Express)
- 位置: `/var/www/iot-ai-doll/backend/`
- 运行: `nohup node src/index.js > /var/log/iot-backend.log 2>&1 &`
- 端口: 3000
- 路由:
  - `/api/health` — 健康检查 ✅
  - `/api/auth/register` — 注册 ✅
  - `/api/auth/login` — 登录 ✅
  - `/api/auth/me` — 用户信息 (JWT认证) ✅
  - `/api/ai` — AI对话 (需DashScope API Key)
  - `/api/tts` — 语音合成 (需配置)
  - `/api/stt` — 语音识别 (需配置)
  - `/api/db` — 数据库操作 (路由有404问题待修)

### 2. 数据库 (PostgreSQL)
- 数据库名: `iot_doll`
- 17张表已创建并迁移完成
- seed数据已导入

### 3. Nginx 反向代理
- 配置: `/etc/nginx/sites-available/iot-doll`
- 已删除旧冲突配置 `iot-ai-doll.conf`
- `proxy_pass http://127.0.0.1:3000/api/;` 正常工作

## 🔧 关键问题修复记录

### Nginx 反代路径不匹配 (已解决)
- **根因**: 两个nginx配置文件冲突。旧文件 `iot-ai-doll.conf` 使用 `proxy_pass http://127.0.0.1:3000/;`（有trailing slash），先于新文件加载，导致 `/api/` 前缀被剥离
- **修复**: 删除旧配置文件，只保留 `iot-doll` 配置

### Health 路由不在 /api/ 前缀下 (已解决)
- **根因**: `app.get('/health', ...)` 没有走 `/api/` 前缀
- **修复**: 改为 `app.get('/api/health', ...)`

## ⚠️ 待解决

1. **DB 查询路由 404** — `/api/db/query` 返回 Cannot POST，需检查路由实现
2. **前端改造** — 移除 Supabase 依赖，改用自建后端 API
3. **AI 对话功能** — 需要配置 DashScope API Key
4. **TTS/STT** — 需要配置对应服务
5. **后端进程守护** — 当前用 nohup 运行，应改用 pm2 或 systemd
6. **前端构建部署** — 还未开始

## 测试账号
- 用户名: `apitest`, 密码: `test123`
- 用户名: `test1`-`test5`, 密码: `123456`
