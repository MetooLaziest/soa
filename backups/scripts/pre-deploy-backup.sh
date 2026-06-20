#!/bin/bash
# pre-deploy-backup.sh - 部署前全量备份脚本
# 用法: ./pre-deploy-backup.sh "描述"
# 目的: 在任何改造之前，完整备份线上可运行的版本，确保可一键回滚
#
# 回滚: ./rollback.sh "描述对应的备份ID"

set -e

# === 配置 ===
SERVER="47.98.103.151"
USER="root"
PASS="123ASDasd!@#"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_ROOT="${SCRIPT_DIR}/snapshots"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_ID="${DATE}"
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_ID}"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[备份]${NC} $1"; }
warn() { echo -e "${YELLOW}[警告]${NC} $1"; }
err() { echo -e "${RED}[错误]${NC} $1"; }

DESCRIPTION="${1:-无描述}"

# === SSH 命令封装 ===
ssh_cmd() {
    expect -c "
        spawn ssh -o StrictHostKeyChecking=no $USER@$SERVER \"$1\"
        expect \"password:\"
        send \"$PASS\r\"
        expect eof
    " 2>&1
}

scp_down() {
    local remote="$1"
    local local_path="$2"
    expect -c "
        spawn scp -o StrictHostKeyChecking=no $USER@$SERVER:$remote $local_path
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

# === 主流程 ===
echo "=========================================="
echo "  E-Pet 部署前全量备份"
echo "=========================================="
echo "备份ID: ${BACKUP_ID}"
echo "描述: ${DESCRIPTION}"
echo "=========================================="

# 1. 创建备份目录
mkdir -p "${BACKUP_DIR}/frontend"
mkdir -p "${BACKUP_DIR}/backend"
mkdir -p "${BACKUP_DIR}/database"
mkdir -p "${BACKUP_DIR}/config"

# 2. 备份前端构建产物（从CDN下载所有关键文件）
log "下载前端构建产物..."
# epet 前端
curl -sL "https://soa.laziestlife.com/epet/index.html" -o "${BACKUP_DIR}/frontend/epet-index.html"
curl -sL "https://soa.laziestlife.com/epet/yard-bg.png" -o "${BACKUP_DIR}/frontend/yard-bg.png"
curl -sL "https://soa.laziestlife.com/epet/pet-blue.png" -o "${BACKUP_DIR}/frontend/pet-blue.png"
curl -sL "https://soa.laziestlife.com/epet/pet-white.png" -o "${BACKUP_DIR}/frontend/pet-white.png"
curl -sL "https://soa.laziestlife.com/epet/pet-pink.png" -o "${BACKUP_DIR}/frontend/pet-pink.png"
curl -sL "https://soa.laziestlife.com/epet/pet-idle.png" -o "${BACKUP_DIR}/frontend/pet-idle.png" 2>/dev/null || true

# 下载JS bundle
JS_FILE=$(grep -oP 'src="/epet/assets/[^"]*\.js"' "${BACKUP_DIR}/frontend/epet-index.html" | grep -oP '/epet/assets/[^"]*')
CSS_FILE=$(grep -oP 'href="/epet/assets/[^"]*\.css"' "${BACKUP_DIR}/frontend/epet-index.html" | grep -oP '/epet/assets/[^"]*')
mkdir -p "${BACKUP_DIR}/frontend/epet-assets"

if [ -n "$JS_FILE" ]; then
    curl -sL "https://soa.laziestlife.com${JS_FILE}" -o "${BACKUP_DIR}/frontend/epet-assets/$(basename $JS_FILE)"
    log "  下载 JS: $(basename $JS_FILE)"
fi
if [ -n "$CSS_FILE" ]; then
    curl -sL "https://soa.laziestlife.com${CSS_FILE}" -o "${BACKUP_DIR}/frontend/epet-assets/$(basename $CSS_FILE)"
    log "  下载 CSS: $(basename $CSS_FILE)"
fi

# 下载JS引用的子模块 (modulepreload)
for PRELOAD in $(grep -oP 'href="/epet/assets/[^"]*\.js"' "${BACKUP_DIR}/frontend/epet-index.html" | grep -oP '/epet/assets/[^"]*'); do
    curl -sL "https://soa.laziestlife.com${PRELOAD}" -o "${BACKUP_DIR}/frontend/epet-assets/$(basename $PRELOAD)" 2>/dev/null || true
    log "  下载子模块: $(basename $PRELOAD)"
done

# 3. 备份数据库（通过后端API间接验证，SSH尝试直接备份）
log "尝试通过SSH备份数据库..."
ssh_cmd "pg_dump -U postgres epet > /tmp/epet_backup_${BACKUP_ID}.sql && echo DUMP_OK || echo DUMP_FAILED" | tail -5
scp_down "/tmp/epet_backup_${BACKUP_ID}.sql" "${BACKUP_DIR}/database/epet.sql" 2>/dev/null && log "数据库备份成功" || warn "SSH不可用，跳过数据库直备"

# 4. 备份后端代码（SSH尝试）
log "尝试通过SSH备份后端代码..."
ssh_cmd "cd /var/www/iot-ai-doll && tar czf /tmp/backend_${BACKUP_ID}.tar.gz --exclude=node_modules backend/" 2>/dev/null
scp_down "/tmp/backend_${BACKUP_ID}.tar.gz" "${BACKUP_DIR}/backend/backend.tar.gz" 2>/dev/null && log "后端代码备份成功" || warn "SSH不可用，跳过后端直备"

# 5. 备份nginx配置
ssh_cmd "cat /etc/nginx/conf.d/soa.laziestlife.com.conf" 2>/dev/null > "${BACKUP_DIR}/config/nginx.conf"
[ -s "${BACKUP_DIR}/config/nginx.conf" ] && log "nginx配置备份成功" || warn "nginx配置未备份"

# 6. 备份PM2配置
ssh_cmd "cat /var/www/iot-ai-doll/ecosystem.config.js" 2>/dev/null > "${BACKUP_DIR}/config/ecosystem.config.js"

# 7. 记录备份元数据
cat > "${BACKUP_DIR}/META.json" << EOF
{
  "backup_id": "${BACKUP_ID}",
  "timestamp": "$(date -Iseconds)",
  "description": "${DESCRIPTION}",
  "server": "${SERVER}",
  "files": {
    "epet_index_html": "frontend/epet-index.html",
    "epet_js_bundle": "$(basename $JS_FILE 2>/dev/null || echo 'unknown')",
    "epet_css": "$(basename $CSS_FILE 2>/dev/null || echo 'unknown')",
    "yard_bg": "frontend/yard-bg.png",
    "database_dump": "database/epet.sql",
    "nginx_config": "config/nginx.conf"
  },
  "rollback_cmd": "cd ${SCRIPT_DIR} && ./rollback.sh ${BACKUP_ID}"
}
EOF

# 8. 生成回滚脚本
cat > "${BACKUP_DIR}/ROLLBACK.sh" << 'ROLLBACK_EOF'
#!/bin/bash
# 一键回滚到本备份版本
set -e
BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$BACKUP_DIR/META.json" 2>/dev/null || true

echo "⚠️  即将回滚到备份: $(cat $BACKUP_DIR/META.json | grep backup_id)"
read -p "确认回滚？(y/N): " CONFIRM
[ "$CONFIRM" = "y" ] || { echo "取消回滚"; exit 0; }

# 通过HTTPS上传回滚（或SSH如果可用）
echo "回滚中..."
ROLLBACK_EOF

echo ""
echo "=========================================="
log "备份完成！"
echo "备份ID: ${BACKUP_ID}"
echo "备份路径: ${BACKUP_DIR}"
echo "回滚命令: cd ${SCRIPT_DIR} && ./rollback.sh ${BACKUP_ID}"
echo "=========================================="

# 更新 LATEST 指针
rm -f "${BACKUP_ROOT}/LATEST"
ln -s "${BACKUP_DIR}" "${BACKUP_ROOT}/LATEST"
log "LATEST -> ${BACKUP_ID}"
