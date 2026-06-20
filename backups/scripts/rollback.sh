#!/bin/bash
# rollback.sh - 一键回滚到指定备份版本
# 用法: ./rollback.sh <备份ID>
# 示例: ./rollback.sh 20260621_003500

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_ROOT="${SCRIPT_DIR}/snapshots"

SERVER="47.98.103.151"
USER="root"
PASS="123ASDasd!@#"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKUP_ID="${1:-LATEST}"
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_ID}"

if [ "$BACKUP_ID" = "LATEST" ]; then
    BACKUP_DIR=$(readlink -f "${BACKUP_ROOT}/LATEST" 2>/dev/null || echo "")
    if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
        echo -e "${RED}错误: 没有找到 LATEST 备份${NC}"
        exit 1
    fi
    BACKUP_ID=$(basename "$BACKUP_DIR")
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}错误: 备份不存在: ${BACKUP_DIR}${NC}"
    echo "可用备份:"
    ls -1 "${BACKUP_ROOT}/" 2>/dev/null | grep -v LATEST || echo "  (无)"
    exit 1
fi

# 显示备份信息
echo "=========================================="
echo "  回滚操作"
echo "=========================================="
echo -e "${YELLOW}备份ID:${NC} ${BACKUP_ID}"
if [ -f "${BACKUP_DIR}/META.json" ]; then
    echo -e "${YELLOW}描述:${NC} $(grep description ${BACKUP_DIR}/META.json | head -1)"
    echo -e "${YELLOW}时间:${NC} $(grep timestamp ${BACKUP_DIR}/META.json | head -1)"
fi
echo "=========================================="
echo ""
echo -e "${RED}⚠️  此操作将覆盖线上文件，确认回滚？${NC}"
read -p "输入 YES 确认回滚: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "取消回滚"; exit 0; }

# === 回滚函数 ===
ssh_cmd() {
    expect -c "
        spawn ssh -o StrictHostKeyChecking=no $USER@$SERVER \"$1\"
        expect \"password:\"
        send \"$PASS\r\"
        expect eof
    " 2>&1
}

scp_up() {
    local local_path="$1"
    local remote="$2"
    expect -c "
        spawn scp -o StrictHostKeyChecking=no $local_path $USER@$SERVER:$remote
        expect \"password:\"
        send \"$PASS\r\"
        expect eof
    " 2>&1
}

echo ""
echo -e "${GREEN}[1/5]${NC} 恢复前端页面..."
# 上传 index.html
scp_up "${BACKUP_DIR}/frontend/epet-index.html" "/var/www/iot-ai-doll/frontend/dist/epet/index.html" 2>/dev/null && \
    echo "  ✓ index.html" || echo "  ✗ index.html (SSH不可用)"

# 上传 JS bundle
if [ -d "${BACKUP_DIR}/frontend/epet-assets" ]; then
    for f in "${BACKUP_DIR}/frontend/epet-assets/"*; do
        [ -f "$f" ] || continue
        scp_up "$f" "/var/www/iot-ai-doll/frontend/dist/epet/assets/" 2>/dev/null && \
            echo "  ✓ $(basename $f)" || echo "  ✗ $(basename $f)"
    done
fi

echo -e "${GREEN}[2/5]${NC} 恢复背景图和宠物图片..."
for img in yard-bg.png pet-blue.png pet-white.png pet-pink.png; do
    [ -f "${BACKUP_DIR}/frontend/${img}" ] || continue
    scp_up "${BACKUP_DIR}/frontend/${img}" "/var/www/iot-ai-doll/frontend/dist/epet/${img}" 2>/dev/null && \
        echo "  ✓ ${img}" || echo "  ✗ ${img}"
done

echo -e "${GREEN}[3/5]${NC} 恢复数据库..."
if [ -f "${BACKUP_DIR}/database/epet.sql" ] && [ -s "${BACKUP_DIR}/database/epet.sql" ]; then
    scp_up "${BACKUP_DIR}/database/epet.sql" "/tmp/epet_rollback.sql" 2>/dev/null && \
    ssh_cmd "psql -U postgres epet < /tmp/epet_rollback.sql && echo DB_OK || echo DB_FAIL" | tail -3
else
    echo "  ⚠ 数据库备份不存在或为空，跳过"
fi

echo -e "${GREEN}[4/5]${NC} 恢复后端代码..."
if [ -f "${BACKUP_DIR}/backend/backend.tar.gz" ] && [ -s "${BACKUP_DIR}/backend/backend.tar.gz" ]; then
    scp_up "${BACKUP_DIR}/backend/backend.tar.gz" "/tmp/backend_rollback.tar.gz" 2>/dev/null && \
    ssh_cmd "cd /var/www/iot-ai-doll && rm -rf backend/src && tar xzf /tmp/backend_rollback.tar.gz && pm2 restart iot-backend && echo BACKEND_OK" | tail -3
else
    echo "  ⚠ 后端备份不存在，跳过"
fi

echo -e "${GREEN}[5/5]${NC} 恢复nginx配置..."
if [ -f "${BACKUP_DIR}/config/nginx.conf" ] && [ -s "${BACKUP_DIR}/config/nginx.conf" ]; then
    scp_up "${BACKUP_DIR}/config/nginx.conf" "/etc/nginx/conf.d/soa.laziestlife.com.conf" 2>/dev/null && \
    ssh_cmd "nginx -t && nginx -s reload && echo NGINX_OK" | tail -3
else
    echo "  ⚠ nginx配置备份不存在，跳过"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}回滚完成！${NC}"
echo "验证: curl -sI https://soa.laziestlife.com/epet/ | head -3"
echo "=========================================="
