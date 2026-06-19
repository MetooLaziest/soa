#!/bin/bash
# IoT AI Doll 自建后端部署脚本
# 运行方式: bash deploy.sh

set -e

echo "=========================================="
echo "IoT AI Doll 后端部署脚本"
echo "=========================================="

# 1. 安装系统依赖
echo "[1/8] 安装系统依赖..."
apt-get update -qq
apt-get install -y -qq postgresql postgresql-contrib nginx curl > /dev/null 2>&1
echo "  ✓ 系统依赖安装完成"

# 2. 启动 PostgreSQL
echo "[2/8] 启动 PostgreSQL..."
service postgresql start
sleep 2
echo "  ✓ PostgreSQL 启动完成"

# 3. 创建数据库和用户
echo "[3/8] 创建数据库..."
su - postgres -c "psql -c \"CREATE DATABASE iot_doll;\"" 2>/dev/null || echo "  数据库已存在，跳过"
su - postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\"" 2>/dev/null || true
echo "  ✓ 数据库 iot_doll 创建完成"

# 4. 安装 Node.js 依赖
echo "[4/8] 安装 Node.js 依赖..."
cd /var/www/iot-ai-doll/backend
npm install --silent 2>/dev/null
echo "  ✓ npm 依赖安装完成"

# 5. 运行数据库迁移
echo "[5/8] 运行数据库迁移..."
npm run db:migrate 2>&1 | tail -5
echo "  ✓ 数据库迁移完成"

# 6. 创建环境变量文件
echo "[6/8] 配置环境变量..."
cat > /var/www/iot-ai-doll/backend/.env << 'EOF'
# 阿里百炼 AI 配置（请替换为你的 API Key）
DASHSCOPE_API_KEY=sk-88531931fa2149028a52329c50c2d49e
DASHSCOPE_MODEL=qwen-plus

# MiniMax 配置（如果有）
MINIMAX_API_KEY=
MINIMAX_TTS_URL=https://api.minimaxi.com/v1/t2a_v2
MINIMAX_STT_URL=https://api.minimaxi.com/v1/asr

# JWT 密钥
JWT_SECRET=iot-ai-doll-jwt-secret-$(date +%s)

# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iot_doll
DB_USER=postgres
DB_PASSWORD=postgres

# 服务端口
PORT=3000
EOF
echo "  ✓ 环境变量配置完成"

# 7. 启动后端服务
echo "[7/8] 启动后端服务..."
cd /var/www/iot-ai-doll/backend
pkill -f "node src/index.js" 2>/dev/null || true
nohup node src/index.js > /var/log/iot-backend.log 2>&1 &
sleep 2

# 检查启动状态
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "  ✓ 后端服务启动成功"
else
    echo "  ⚠ 后端启动可能有问题，请检查日志: /var/log/iot-backend.log"
fi

# 8. 配置 Nginx
echo "[8/8] 配置 Nginx..."
cp /var/www/iot-ai-doll/backend/nginx.conf /etc/nginx/sites-available/iot-doll
ln -sf /etc/nginx/sites-available/iot-doll /etc/nginx/sites-enabled/iot-doll
rm -f /etc/nginx/sites-enabled/default
nginx -t && service nginx reload || nginx -s reload
echo "  ✓ Nginx 配置完成"

echo ""
echo "=========================================="
echo "✅ 部署完成!"
echo "=========================================="
echo ""
echo "📍 访问地址: http://47.98.103.151"
echo "🔧 后端健康检查: http://47.98.103.151/api/health"
echo "📝 后端日志: /var/log/iot-backend.log"
echo ""
echo "📝 接下来请执行前端部署（需要先修改前端代码适配新后端）"
echo "   1. 修改 vite.config.ts - 移除 miaodaDevPlugin"
echo "   2. 修改 .env - 设置 VITE_API_BASE=http://47.98.103.151"
echo "   3. 修改 src/lib/ai.ts 和 src/pages/GamePage.tsx - 适配新 API"
echo "   4. 运行 pnpm build"
echo "   5. 将 dist/ 内容复制到 /var/www/iot-ai-doll/frontend/"
echo ""
