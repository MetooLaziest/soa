#!/bin/bash
# restore.sh - SOA 项目恢复脚本
# 用法: ./restore.sh <备份名称>
# 示例: ./restore.sh 2026-06-05_123456

set -e

# === 配置 ===
BACKUP_ROOT="$HOME/.qclaw/workspace/backups"
SERVER="47.98.103.151"
USER="root"
PASS="123ASDasd!@#"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

show_usage() {
    echo "用法: $0 <备份名称|LATEST>"
    echo ""
    echo "备份名称:"
    echo "  LATEST  - 恢复到最新备份"
    echo "  2026-06-05_123456 - 恢复到指定备份"
    echo ""
    echo "可用备份:"
    ls -1t "${BACKUP_ROOT}" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}$' | head -10 || echo "  (无可用备份)"
    echo ""
    echo "示例:"
    echo "  $0 LATEST"
    echo "  $0 2026-06-05_123456"
}

# 检查备份是否存在
check_backup() {
    local backup_name="$1"
    
    if [[ "$backup_name" == "LATEST" ]]; then
        if [[ -L "${BACKUP_ROOT}/LATEST" ]]; then
            BACKUP_DIR=$(readlink "${BACKUP_ROOT}/LATEST")
            BACKUP_NAME=$(basename "$BACKUP_DIR")
            log_info "使用 LATEST 链接: ${BACKUP_NAME}"
        else
            log_error "LATEST 链接不存在"
            exit 1
        fi
    else
        BACKUP_DIR="${BACKUP_ROOT}/${backup_name}"
        if [[ ! -d "$BACKUP_DIR" ]]; then
            log_error "备份不存在: ${BACKUP_NAME}"
            echo ""
            show_usage
            exit 1
        fi
        BACKUP_NAME="$backup_name"
    fi
    
    log_info "备份目录: ${BACKUP_DIR}"
    
    # 显示备份信息
    if [[ -f "${BACKUP_DIR}/backup_info.txt" ]]; then
        echo ""
        cat "${BACKUP_DIR}/backup_info.txt"
        echo ""
    fi
}

# 恢复后端代码
restore_backend() {
    if [[ ! -d "${BACKUP_DIR}/backend" ]]; then
        log_warn "后端备份不存在，跳过"
        return
    fi
    
    log_info "恢复后端代码..."
    
    python3 << PYEOF
import paramiko
import os

SERVER = "${SERVER}"
USER = "${USER}"
PASS = "${PASS}"
LOCAL_PATH = "${BACKUP_DIR}/backend"
REMOTE_PATH = "/var/www/iot-ai-doll/backend/src"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER, username=USER, password=PASS, timeout=10)

sftp = client.open_sftp()

# 递归上传后端代码
def upload_dir(local_dir, remote_dir):
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)
    
    for item in os.listdir(local_dir):
        local_item = os.path.join(local_dir, item)
        remote_item = remote_dir + '/' + item
        
        if os.path.isdir(local_item):
            upload_dir(local_item, remote_item)
        else:
            sftp.put(local_item, remote_item)
            print(f"  ✓ {item}")

print("上传后端代码...")
upload_dir(LOCAL_PATH, REMOTE_PATH)

sftp.close()
client.close()
print("✓ 后端代码恢复完成")
PYEOF
}

# 恢复前端构建
restore_frontend() {
    if [[ ! -d "${BACKUP_DIR}/frontend" ]]; then
        log_warn "前端备份不存在，跳过"
        return
    fi
    
    log_info "恢复前端构建..."
    
    python3 << PYEOF
import paramiko
import os

SERVER = "${SERVER}"
USER = "${USER}"
PASS = "${PASS}"
LOCAL_PATH = "${BACKUP_DIR}/frontend"
REMOTE_PATH = "/var/www/iot-ai-doll/frontend/dist"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER, username=USER, password=PASS, timeout=10)

sftp = client.open_sftp()

# 递归上传前端构建
def upload_dir(local_dir, remote_dir):
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)
    
    for item in os.listdir(local_dir):
        local_item = os.path.join(local_dir, item)
        remote_item = remote_dir + '/' + item
        
        if os.path.isdir(local_item):
            upload_dir(local_item, remote_item)
        else:
            sftp.put(local_item, remote_item)
            print(f"  ✓ {item}")

print("上传前端构建...")
upload_dir(LOCAL_PATH, REMOTE_PATH)

sftp.close()
client.close()
print("✓ 前端构建恢复完成")
PYEOF
}

# 恢复数据库
restore_database() {
    if [[ ! -f "${BACKUP_DIR}/database/epet.sql" ]]; then
        log_warn "数据库备份不存在，跳过"
        return
    fi
    
    log_warn "恢复数据库会覆盖当前数据！"
    read -p "确认恢复数据库？(yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_info "跳过数据库恢复"
        return
    fi
    
    log_info "恢复数据库..."
    
    python3 << PYEOF
import paramiko

SERVER = "${SERVER}"
USER = "${USER}"
PASS = "${PASS}"
LOCAL_SQL = "${BACKUP_DIR}/database/epet.sql"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER, username=USER, password=PASS, timeout=10)

# 上传 SQL 文件
sftp = client.open_sftp()
sftp.put(LOCAL_SQL, "/tmp/epet_restore.sql")
sftp.close()

# 恢复数据库
stdin, stdout, stderr = client.exec_command(
    "psql -U postgres epet < /tmp/epet_restore.sql && echo 'DONE'",
    timeout=60
)
result = stdout.read().decode('utf-8', errors='ignore')
print(f"数据库恢复结果: {result}")

# 清理临时文件
client.exec_command("rm -f /tmp/epet_restore.sql")

client.close()
print("✓ 数据库恢复完成")
PYEOF
}

# 恢复配置文件
restore_config() {
    if [[ ! -d "${BACKUP_DIR}/config" ]]; then
        log_warn "配置文件备份不存在，跳过"
        return
    fi
    
    log_warn "恢复配置文件会覆盖当前配置！"
    read -p "确认恢复配置文件？(yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_info "跳过配置文件恢复"
        return
    fi
    
    log_info "恢复配置文件..."
    
    python3 << PYEOF
import paramiko
import os

SERVER = "${SERVER}"
USER = "${USER}"
PASS = "${PASS}"
LOCAL_PATH = "${BACKUP_DIR}/config"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER, username=USER, password=PASS, timeout=10)

sftp = client.open_sftp()

for filename in os.listdir(LOCAL_PATH):
    local_file = os.path.join(LOCAL_PATH, filename)
    if os.path.isfile(local_file):
        # 根据文件名确定远程路径
        if filename == "soa.laziestlife.com.conf":
            remote_file = f"/etc/nginx/conf.d/{filename}"
        elif filename == ".env":
            remote_file = f"/var/www/iot-ai-doll/backend/{filename}"
        elif filename == "ecosystem.config.js":
            remote_file = f"/var/www/iot-ai-doll/{filename}"
        else:
            print(f"  ⚠ 未知配置文件: {filename}")
            continue
        
        sftp.put(local_file, remote_file)
        print(f"  ✓ {filename} -> {remote_file}")

sftp.close()
client.close()
print("✓ 配置文件恢复完成")

# 重启 Nginx
stdin, stdout, stderr = client.exec_command("nginx -t && systemctl reload nginx", timeout=10)
print("Nginx 配置测试并重载")
PYEOF
}

# 重启服务
restart_services() {
    log_info "重启后端服务..."
    
    python3 << PYEOF
import paramiko

SERVER = "${SERVER}"
USER = "${USER}"
PASS = "${PASS}"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER, username=USER, password=PASS, timeout=10)

stdin, stdout, stderr = client.exec_command("pm2 restart iot-backend", timeout=30)
result = stdout.read().decode('utf-8', errors='ignore')
print(f"PM2 重启结果: {result}")

client.close()
print("✓ 服务重启完成")
PYEOF
}

# === 主流程 ===

main() {
    local backup_name="${1:-LATEST}"
    
    echo "=========================================="
    echo "  SOA 项目恢复"
    echo "=========================================="
    echo ""
    
    # 检查备份
    check_backup "$backup_name"
    
    # 确认恢复
    echo ""
    read -p "确认要恢复此备份吗？(yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "取消恢复"
        exit 0
    fi
    
    echo ""
    
    # 执行恢复
    restore_backend
    restore_frontend
    restore_database
    restore_config
    
    # 重启服务
    restart_services
    
    echo ""
    echo "=========================================="
    log_info "恢复完成！"
    echo "备份: ${BACKUP_NAME}"
    echo "=========================================="
}

# === 入口 ===

if [[ $# -eq 0 ]]; then
    show_usage
    exit 1
fi

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

main "$@"
