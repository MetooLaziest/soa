#!/bin/bash
# backup.sh - SOA 项目自动备份脚本
# 用法: ./backup.sh [备份类型] [描述]
# 示例: ./backup.sh deploy "部署前备份"
#       ./backup.sh migration "数据库迁移前"

set -e  # 遇到错误立即退出

# === 配置 ===
BACKUP_ROOT="$HOME/.qclaw/workspace/backups"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H%M%S)
BACKUP_NAME="${DATE}_${TIME}"
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"
LATEST_LINK="${BACKUP_ROOT}/LATEST"

# 服务器信息
SERVER="47.98.103.151"
USER="root"
PASS="123ASDasd!@#"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# === 函数 ===

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示用法
show_usage() {
    echo "用法: $0 [备份类型] [描述]"
    echo ""
    echo "备份类型:"
    echo "  deploy    - 部署前备份"
    echo "  migration - 数据库迁移前"
    echo "  refactor  - 代码重构前"
    echo "  manual    - 手动备份"
    echo ""
    echo "示例:"
    echo "  $0 deploy \"v1.2.3 部署前\""
    echo "  $0 migration \"添加 RAG 表\""
}

# 创建备份目录
create_backup_dir() {
    log_info "创建备份目录: ${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}/backend"
    mkdir -p "${BACKUP_DIR}/frontend"
    mkdir -p "${BACKUP_DIR}/database"
    mkdir -p "${BACKUP_DIR}/config"
    
    # 记录备份信息
    cat > "${BACKUP_DIR}/backup_info.txt" << EOF
备份时间: $(date "+%Y-%m-%d %H:%M:%S")
备份类型: ${1:-manual}
描述: ${2:-无}
操作者: QClaw Agent
EOF
}

# 备份后端代码
backup_backend() {
    log_info "备份后端代码..."
    
    python3 << PYEOF
import paramiko
import os

SERVER = "${SERVER}"
USER = "${USER}"
PASS = "${PASS}"
REMOTE_PATH = "/var/www/iot-ai-doll/backend/src"
LOCAL_PATH = "${BACKUP_DIR}/backend"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER, username=USER, password=PASS, timeout=10)

sftp = client.open_sftp()

# 递归下载后端代码
def download_dir(remote_dir, local_dir):
    os.makedirs(local_dir, exist_ok=True)
    for item in sftp.listdir_attr(remote_dir):
        remote_item = remote_dir + '/' + item.filename
        local_item = os.path.join(local_dir, item.filename)
        if item.st_mode and os.S_ISDIR(item.st_mode):
            download_dir(remote_item, local_item)
        else:
            sftp.get(remote_item, local_item)
            print(f"  ✓ {item.filename}")

print("下载后端代码...")
download_dir(REMOTE_PATH, LOCAL_PATH)

sftp.close()
client.close()
print("✓ 后端代码备份完成")
PYEOF
}

# 备份前端构建
backup_frontend() {
    log_info "备份前端构建文件..."
    
    python3 << PYEOF
import paramiko
import os

SERVER = "${SERVER}"
USER = "${USER}"
PASS = "${PASS}"
REMOTE_PATH = "/var/www/iot-ai-doll/frontend/dist"
LOCAL_PATH = "${BACKUP_DIR}/frontend"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER, username=USER, password=PASS, timeout=10)

sftp = client.open_sftp()

# 递归下载前端构建
def download_dir(remote_dir, local_dir):
    os.makedirs(local_dir, exist_ok=True)
    for item in sftp.listdir_attr(remote_dir):
        remote_item = remote_dir + '/' + item.filename
        local_item = os.path.join(local_dir, item.filename)
        if item.st_mode and os.S_ISDIR(item.st_mode):
            download_dir(remote_item, local_item)
        else:
            sftp.get(remote_item, local_item)
            print(f"  ✓ {item.filename}")

print("下载前端构建...")
download_dir(REMOTE_PATH, LOCAL_PATH)

sftp.close()
client.close()
print("✓ 前端构建备份完成")
PYEOF
}

# 备份数据库
backup_database() {
    log_info "备份 PostgreSQL 数据库..."
    
    python3 << PYEOF
import paramiko

SERVER = "${SERVER}"
USER = "${USER}"
PASS = "${PASS}"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER, username=USER, password=PASS, timeout=10)

# 备份 epet 数据库
stdin, stdout, stderr = client.exec_command(
    f"pg_dump -U postgres epet > /tmp/epet_backup_{DATE}.sql && echo 'DONE'",
    timeout=30
)
result = stdout.read().decode('utf-8', errors='ignore')
print(f"pg_dump 结果: {result}")

# 下载备份文件
sftp = client.open_sftp()
sftp.get(f"/tmp/epet_backup_{DATE}.sql", "${BACKUP_DIR}/database/epet.sql")
sftp.close()

client.close()
print("✓ 数据库备份完成")
PYEOF
}

# 备份配置文件
backup_config() {
    log_info "备份配置文件..."
    
    python3 << PYEOF
import paramiko
import os

SERVER = "${SERVER}"
USER = "${USER}"
PASS = "${PASS}"
CONFIG_FILES = [
    "/etc/nginx/conf.d/soa.laziestlife.com.conf",
    "/var/www/iot-ai-doll/backend/.env",
    "/var/www/iot-ai-doll/ecosystem.config.js"
]
LOCAL_PATH = "${BACKUP_DIR}/config"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER, username=USER, password=PASS, timeout=10)

sftp = client.open_sftp()
os.makedirs(LOCAL_PATH, exist_ok=True)

for remote_file in CONFIG_FILES:
    try:
        filename = remote_file.split('/')[-1]
        local_file = os.path.join(LOCAL_PATH, filename)
        sftp.get(remote_file, local_file)
        print(f"  ✓ {filename}")
    except FileNotFoundError:
        print(f"  ⚠  {remote_file} 不存在")

sftp.close()
client.close()
print("✓ 配置文件备份完成")
PYEOF
}

# 更新 LATEST 软链接
update_latest_link() {
    log_info "更新 LATEST 链接..."
    
    rm -f "${LATEST_LINK}"
    ln -s "${BACKUP_DIR}" "${LATEST_LINK}"
    
    echo "✓ LATEST -> ${BACKUP_NAME}"
}

# 生成备份报告
generate_report() {
    log_info "生成备份报告..."
    
    cat > "${BACKUP_DIR}/BACKUP_REPORT.md" << EOF
# 备份报告

**备份ID**: ${BACKUP_NAME}
**时间**: $(date "+%Y-%m-%d %H:%M:%S")
**类型**: ${1:-manual}
**描述**: ${2:-无}

## 备份内容

### 后端代码
\`\`\`bash
ls -lh backend/
\`\`\`

### 前端构建
\`\`\`bash
du -sh frontend/
\`\`\`

### 数据库
\`\`\`bash
ls -lh database/
\`\`\`

### 配置文件
\`\`\`bash
ls -lh config/
\`\`\`

## 恢复命令

\`\`\`bash
${BACKUP_ROOT}/scripts/restore.sh ${BACKUP_NAME}
\`\`\`

---
*此报告由自动备份脚本生成*
EOF
    
    echo "✓ 报告已生成: ${BACKUP_DIR}/BACKUP_REPORT.md"
}

# === 主流程 ===

main() {
    local backup_type="${1:-manual}"
    local description="${2:-无}"
    
    echo "=========================================="
    echo "  SOA 项目自动备份"
    echo "=========================================="
    echo "备份类型: ${backup_type}"
    echo "描述: ${description}"
    echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
    echo ""
    
    # 创建备份目录
    create_backup_dir "${backup_type}" "${description}"
    
    # 执行备份
    backup_backend
    backup_frontend
    backup_database
    backup_config
    
    # 更新链接和报告
    update_latest_link
    generate_report "${backup_type}" "${description}"
    
    echo ""
    echo "=========================================="
    log_info "备份完成！"
    echo "备份位置: ${BACKUP_DIR}"
    echo "LATEST 链接: ${LATEST_LINK}"
    echo "=========================================="
}

# === 入口 ===

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

main "$@"
