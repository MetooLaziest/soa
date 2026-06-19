#!/bin/bash
# ==============================================
#  SOA 统一构建部署脚本 (v7.1)
#  路径: /var/www/iot-ai-doll/repo/deploy.sh
#
#  部署目标:
#    /             -> 艾瑟拉奇幻谭 (iot-ai-doll-frontend, base="/")
#    /admin/       -> 管理后台 (iot-ai-doll-frontend, base="/admin/")
#    /epet/        -> MOMOTOY 绒绒庭院 (epet1 项目, base="/epet/")
#    /iot-test.html -> iot-sql 测试页
#
#  关键：根和 admin 是同一项目但不同 base 独立构建，互不覆盖。
#  v7.1: 修复 cp -r 展开问题，使用 mktemp -d 临时目录。
# ==============================================
set -e

export PATH="/opt/node20/bin:$PATH"
export NODE_OPTIONS="--max-old-space-size=4096"

SCRIPT_DIR="/var/www/iot-ai-doll/repo"
DIST_DIR="/var/www/iot-ai-doll/frontend/dist"

LOG_DIR="$SCRIPT_DIR/.deploy-logs"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/deploy_$TS.log"
TEMP_BUILD=$(mktemp -d)

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

log() { echo -e "$1" | tee -a "$LOG_FILE"; }

cleanup() { rm -rf "$TEMP_BUILD"; }
trap cleanup EXIT

mkdir -p "$LOG_DIR"

log "${YELLOW}===============================================${NC}"
log "${YELLOW}  SOA 部署脚本 v7.1 - $TS${NC}"
log "${YELLOW}===============================================${NC}"
log "Node: $(node --version)"

# 1. 拉取最新代码（先 sync 再部署！）
log ""
log "${YELLOW}📥 步骤1: 拉取最新代码${NC}"
cd "$SCRIPT_DIR"
git stash 2>/dev/null || true
git pull --rebase 2>&1 | tee -a "$LOG_FILE" || log "${RED}⚠️ git pull 失败，使用本地版本${NC}"
git stash pop 2>/dev/null || true
log "${GREEN}✅ 代码同步完成${NC}"

# 2. 备份当前 dist
log ""
log "${YELLOW}💾 步骤2: 备份当前 dist${NC}"
[ -d "$DIST_DIR" ] && cp -r "$DIST_DIR" "$DIST_DIR.backup_$TS" && log "${GREEN}✅ 备份完成${NC}" || log "${YELLOW}⚠️ 跳过备份（目录不存在）${NC}"

# 3. 构建
mkdir -p "$TEMP_BUILD"

# 3.1 根路径版 (base="/")
log ""
log "${YELLOW}🔨 步骤3.1: 构建根路径版 (艾瑟拉奇幻谭)${NC}"
cd "$SCRIPT_DIR/iot-ai-doll-frontend"
[ -d node_modules ] || npm install 2>&1 | tail -3 | tee -a "$LOG_FILE"
cat > vite.config.ts << 'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "OUT/root", emptyOutDir: true },
});
EOF
sed -i "s|OUT|$TEMP_BUILD|g" vite.config.ts
npm run build 2>&1 | tee -a "$LOG_FILE" | tail -5 && log "${GREEN}✅ 根路径版构建成功${NC}" || { log "${RED}❌ 失败${NC}"; exit 1; }

# 3.2 admin 版 (base="/admin/")
log ""
log "${YELLOW}🔨 步骤3.2: 构建 admin 版 (管理后台)${NC}"
cd "$SCRIPT_DIR/iot-ai-doll-frontend"
cat > vite.config.ts << 'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/admin/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "OUT/admin", emptyOutDir: true },
});
EOF
sed -i "s|OUT|$TEMP_BUILD|g" vite.config.ts
npm run build 2>&1 | tee -a "$LOG_FILE" | tail -5 && log "${GREEN}✅ admin 版构建成功${NC}" || { log "${RED}❌ 失败${NC}"; exit 1; }

# 3.3 epet1 (base="/epet/")
log ""
log "${YELLOW}🔨 步骤3.3: 构建 epet1 (绒绒庭院)${NC}"
cd "$SCRIPT_DIR/epet1"
[ -d node_modules ] || npm install 2>&1 | tail -3 | tee -a "$LOG_FILE"
cat > vite.config.ts << 'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/epet/",
  plugins: [react()],
  build: { outDir: "OUT/epet", emptyOutDir: true },
});
EOF
sed -i "s|OUT|$TEMP_BUILD|g" vite.config.ts
npm run build 2>&1 | tee -a "$LOG_FILE" | tail -5 && log "${GREEN}✅ epet1 构建成功${NC}" || { log "${RED}❌ 失败${NC}"; exit 1; }

# 4. 部署（关键：使用 cp -r dir/. 避免 glob 展开问题）
log ""
log "${YELLOW}📦 步骤4: 部署到 dist${NC}"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
cp -r "$TEMP_BUILD/root/." "$DIST_DIR/"
cp -r "$TEMP_BUILD/admin" "$DIST_DIR/admin"
cp -r "$TEMP_BUILD/epet" "$DIST_DIR/epet"
cp "$SCRIPT_DIR/iot-sql/iot-test.html" "$DIST_DIR/iot-test.html" 2>/dev/null || true
log "${GREEN}✅ 文件部署完成${NC}"

# 5. 校验
log ""
log "${YELLOW}🛡️ 步骤5: 部署后校验${NC}"
errors=0

check_file() {
    local file=$1 local desc=$2
    if [ -f "$DIST_DIR/$file" ]; then
        log "${GREEN}✅ $desc 存在${NC}"
    else
        log "${RED}❌ $desc 不存在${NC}"
        errors=$((errors+1))
    fi
}

check_contains() {
    local file=$1 local pattern=$2 local desc=$3 local fail_msg=$4
    if grep -qE "$pattern" "$DIST_DIR/$file" 2>/dev/null; then
        log "${GREEN}✅ $desc${NC}"
    else
        log "${RED}❌ $fail_msg${NC}"
        errors=$((errors+1))
    fi
}

check_file "index.html" "根 index.html"
check_file "assets/index.css" "根 assets/css"
check_file "admin/index.html" "admin/index.html"
check_file "admin/assets/index.css" "admin assets/css"
check_file "epet/index.html" "epet/index.html"

check_contains "index.html" "/assets/" "根 index.html 指向 /assets/" "根 index.html 未指向 /assets/"
check_contains "admin/index.html" "/admin/assets/" "admin/index.html 指向 /admin/assets/" "admin 未指向 /admin/assets/"
check_contains "epet/index.html" "/epet/assets/" "epet/index.html 指向 /epet/assets/" "epet 未指向 /epet/assets/"

# nginx 检查
log ""
log "${YELLOW}🔄 步骤6: nginx 检查${NC}"
nginx -t 2>&1 | tee -a "$LOG_FILE" | tail -2 && log "${GREEN}✅ nginx 正常${NC}"

log ""
log "${YELLOW}===============================================${NC}"
[ $errors -eq 0 ] && log "${GREEN}🎉 部署成功 $TS${NC}" || log "${RED}⚠️ 有 $errors 个错误${NC}"
log "${YELLOW}===============================================${NC}"
log "日志: $LOG_FILE"
log ""
log "📍 访问:"
log "  https://soa.laziestlife.com/     (艾瑟拉奇幻谭)"
log "  https://soa.laziestlife.com/admin/   (管理后台)"
log "  https://soa.laziestlife.com/epet/  (MOMOTOY 绒绒庭院)"
