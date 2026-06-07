#!/bin/bash
# E-Pet 安全部署脚本 - 保护素材不被误删
# 用法: ./deploy-with-assets.sh

set -e

SERVER_IP="47.98.103.151"
SERVER_USER="root"
SERVER_PASS="123ASDasd!@#"
REMOTE_DIR="/var/www/iot-ai-doll/frontend/dist/epet"
LOCAL_BUILD="/Users/lintingrui/.qclaw/workspace/epet1/dist"
ASSETS_BACKUP="/tmp/epet-assets-backup"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== E-Pet 安全部署脚本 ===${NC}"

# 1. 本地构建
echo -e "${YELLOW}[1/6] 本地构建...${NC}"
cd /Users/lintingrui/.qclaw/workspace/epet1
npm run build

# 2. 备份服务器上的素材文件
echo -e "${YELLOW}[2/6] 备份服务器素材...${NC}"
mkdir -p $ASSETS_BACKUP
expect <<EOF
spawn scp -r $SERVER_USER@$SERVER_IP:$REMOTE_DIR/*.png $ASSETS_BACKUP/ 2>/dev/null || true
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

expect <<EOF
spawn scp -r $SERVER_USER@$SERVER_IP:$REMOTE_DIR/*.jpg $ASSETS_BACKUP/ 2>/dev/null || true
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

expect <<EOF  
spawn scp -r $SERVER_USER@$SERVER_IP:$REMOTE_DIR/*.jpeg $ASSETS_BACKUP/ 2>/dev/null || true
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

echo -e "${GREEN}素材已备份到 $ASSETS_BACKUP${NC}"

# 3. 打包构建产物（不包含素材）
echo -e "${YELLOW}[3/6] 打包构建产物...${NC}"
cd $LOCAL_BUILD
tar czf /tmp/epet-build.tar.gz --exclude='*.png' --exclude='*.jpg' --exclude='*.jpeg' .

# 4. 上传到服务器
echo -e "${YELLOW}[4/6] 上传到服务器...${NC}"
expect <<EOF
spawn scp /tmp/epet-build.tar.gz $SERVER_USER@$SERVER_IP:/tmp/
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

# 5. 部署到服务器（保留素材）
echo -e "${YELLOW}[5/6] 部署到服务器（保留素材）...${NC}"
expect <<EOF
spawn ssh $SERVER_USER@$SERVER_IP
expect "password:"
send "$SERVER_PASS\r"

expect "#"
send "cd $REMOTE_DIR && rm -rf assets/ index.html *.js *.css *.svg 2>/dev/null || true\r"

expect "#"
send "tar xzf /tmp/epet-build.tar.gz -C $REMOTE_DIR\r"

expect "#"
send "ls -la $REMOTE_DIR/*.png 2>/dev/null | head -5 || echo 'No PNG files'\r"

expect "#"
send "exit\r"
expect eof
EOF

# 6. 恢复素材（如果部署过程中被删除）
echo -e "${YELLOW}[6/6] 检查并恢复素材...${NC}"
for file in $ASSETS_BACKUP/*; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        expect <<EOF
spawn scp "$file" $SERVER_USER@$SERVER_IP:$REMOTE_DIR/
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF
        echo -e "${GREEN}恢复素材: $filename${NC}"
    fi
done

echo -e "${GREEN}=== 部署完成 ===${NC}"
echo -e "访问: https://soa.laziestlife.com/epet/"
