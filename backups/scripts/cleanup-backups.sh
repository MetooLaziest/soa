#!/bin/bash
# cleanup-backups.sh - 【封板】时清理旧备份
# 用法: ./cleanup-backups.sh [--keep=N]
# 示例: ./cleanup-backups.sh --keep=3

set -e

# === 配置 ===
BACKUP_ROOT="$HOME/.qclaw/workspace/backups"
KEEP=3  # 默认保留最近 3 个版本

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
    echo "用法: $0 [--keep=N]"
    echo ""
    echo "选项:"
    echo "  --keep=N  保留最近 N 个版本（默认: 3）"
    echo "  -h, --help  显示帮助"
    echo ""
    echo "示例:"
    echo "  $0          # 保留最近 3 个"
    echo "  $0 --keep=5  # 保留最近 5 个"
}

# 解析参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --keep=*)
                KEEP="${1#*=}"
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# 获取所有备份（按时间排序）
get_all_backups() {
    ls -1t "${BACKUP_ROOT}" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}$' || true
}

# 获取【封板】版本（有 CHANGELOG.md 的）
get_sealed_versions() {
    for backup in $(get_all_backups); do
        if [[ -f "${BACKUP_ROOT}/${backup}/CHANGELOG.md" ]]; then
            echo "$backup"
        fi
    done
}

# 清理旧备份
cleanup_backups() {
    log_info "开始清理旧备份..."
    echo ""
    
    # 获取所有备份
    local all_backups=($(get_all_backups))
    local total=${#all_backups[@]}
    
    if [[ $total -eq 0 ]]; then
        log_warn "没有找到任何备份"
        exit 0
    fi
    
    log_info "找到 ${total} 个备份"
    echo ""
    
    # 显示所有备份
    echo "备份列表（按时间倒序）:"
    echo "=========================================="
    local i=1
    for backup in "${all_backups[@]}"; do
        local sealed=""
        if [[ -f "${BACKUP_ROOT}/${backup}/CHANGELOG.md" ]]; then
            sealed=" [封板]"
        fi
        
        if [[ $i -le $KEEP ]]; then
            echo "  $i. $backup (保留)${sealed}"
        else
            echo "  $i. $backup (待清理)${sealed}"
        fi
        ((i++))
    done
    echo "=========================================="
    echo ""
    
    # 确认清理
    if [[ $total -le $KEEP ]]; then
        log_info "备份数量 ($total) <= 保留数量 ($KEEP)，无需清理"
        exit 0
    fi
    
    log_warn "将清理 ${total} 个备份中的 $((total - KEEP)) 个"
    read -p "确认清理？(yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_info "取消清理"
        exit 0
    fi
    
    echo ""
    log_info "开始清理..."
    
    # 清理旧备份
    local count=0
    for ((i = KEEP; i < total; i++)); do
        local backup="${all_backups[$i]}"
        
        # 检查是否有【封板】标记
        if [[ -f "${BACKUP_ROOT}/${backup}/CHANGELOG.md" ]]; then
            log_warn "跳过【封板】版本: $backup"
            continue
        fi
        
        log_info "删除: $backup"
        rm -rf "${BACKUP_ROOT}/${backup}"
        ((count++))
    done
    
    echo ""
    log_info "清理完成！删除了 ${count} 个旧备份"
    echo ""
    
    # 显示剩余备份
    echo "剩余备份:"
    get_all_backups | head -10
}

# 生成清理报告
generate_report() {
    local report_file="${BACKUP_ROOT}/cleanup_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# 备份清理报告

**时间**: $(date "+%Y-%m-%d %H:%M:%S")
**操作**: 【封板】清理
**保留数量**: ${KEEP}

## 剩余备份

\`\`\`bash
$(ls -1t "${BACKUP_ROOT}" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}$' | head -10)
\`\`\`

## 【封板】版本

\`\`\`bash
$(get_sealed_versions)
\`\`\`

---
*此报告由自动清理脚本生成*
EOF
    
    log_info "报告已生成: $report_file"
}

# === 主流程 ===

main() {
    parse_args "$@"
    
    echo "=========================================="
    echo "  【封板】备份清理"
    echo "=========================================="
    echo "保留数量: ${KEEP}"
    echo "=========================================="
    echo ""
    
    cleanup_backups
    generate_report
    
    echo ""
    echo "=========================================="
    log_info "【封板】清理完成！"
    echo "=========================================="
}

# === 入口 ===

main "$@"
