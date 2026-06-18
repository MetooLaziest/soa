#!/bin/bash
# ==============================================
#  SOA 统一构建部署脚本 (v6)
#  路径: /var/www/iot-ai-doll/repo/deploy.sh
#  说明: 拉取最新代码 → 构建两个项目 → 部署到 frontend/dist/
#  
#  部署目标:
#    /             -> 根入口，指向 admin 应用（admin 入口的 JS）
#    /admin/       -> 后台管理 (iot-ai-doll-frontend 项目)
#    /epet/        -> MOMOTOY 绒绒庭院 (epet1 项目)
#    /iot-test.html -> iot-sql 测试页
# ==============================================
set -e

# 用 Node 20 (Vite 8 / React 19 需要)
export PATH="/opt/node20/bin:$PATH"
export NODE_OPTIONS="--max-old-space-size=4096"

SCRIPT_DIR="/var/www/iot-ai-doll/repo"
DIST_DIR="/var/www/iot-ai-doll/frontend/dist"
LOG_DIR="$SCRIPT_DIR/.deploy-logs"
TEMP_BUILD="/tmp/build-temp-$$"
mkdir -p "$LOG_DIR"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/deploy_$TS.log"

# 颜色
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

cleanup() {
    if [ -d "$TEMP_BUILD" ]; then
        rm -rf "$TEMP_BUILD"
    fi
}
trap cleanup EXIT

log "${YELLOW}===============================================${NC}"
log "${YELLOW}  SOA 部署脚本 v6 - $TS${NC}"
log "${YELLOW}===============================================${NC}"
log "Node: $(node --version)"
log "npm:  $(npm --version)"

# 1. 拉取最新代码
log ""
log "${YELLOW}📥 步骤1: 拉取最新代码${NC}"
cd "$SCRIPT_DIR"
if git pull --rebase 2>&1 | tee -a "$LOG_FILE"; then
    log "${GREEN}✅ 代码已更新${NC}"
else
    log "${RED}❌ git pull 失败，继续构建本地版本${NC}"
fi

# 2. 备份当前 dist
log ""
log "${YELLOW}💾 步骤2: 备份当前 dist${NC}"
if [ -d "$DIST_DIR" ]; then
    cp -r "$DIST_DIR" "$DIST_DIR.backup_$TS"
    log "${GREEN}✅ 已备份到 $DIST_DIR.backup_$TS${NC}"
fi

# 3. 临时构建
rm -rf "$TEMP_BUILD"
mkdir -p "$TEMP_BUILD"

# 3.1 构建 iot-ai-doll-frontend (主项目)
log ""
log "${YELLOW}🔨 步骤3.1: 构建 iot-ai-doll-frontend (admin + 根入口)${NC}"
cd "$SCRIPT_DIR/iot-ai-doll-frontend"
[ -d node_modules ] || npm install 2>&1 | tail -3 | tee -a "$LOG_FILE"
cat > vite.config.ts << VCONF
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "$TEMP_BUILD/main",
    emptyOutDir: true,
  },
});
VCONF
if npm run build 2>&1 | tee -a "$LOG_FILE" | tail -8; then
    log "${GREEN}✅ iot-ai-doll-frontend 构建成功${NC}"
else
    log "${RED}❌ iot-ai-doll-frontend 构建失败${NC}"
    exit 1
fi

# 3.2 构建 epet1
log ""
log "${YELLOW}🔨 步骤3.2: 构建 epet1 (绒绒庭院)${NC}"
cd "$SCRIPT_DIR/epet1"
[ -d node_modules ] || npm install 2>&1 | tail -3 | tee -a "$LOG_FILE"
cat > vite.config.ts << VCONF
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/epet/",
  plugins: [react()],
  build: {
    outDir: "$TEMP_BUILD/epet",
    emptyOutDir: true,
  },
});
VCONF
if npm run build 2>&1 | tee -a "$LOG_FILE" | tail -8; then
    log "${GREEN}✅ epet1 构建成功${NC}"
else
    log "${RED}❌ epet1 构建失败${NC}"
    exit 1
fi

# 4. 部署到 dist
log ""
log "${YELLOW}📦 步骤4: 部署到 dist${NC}"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
cp -r "$TEMP_BUILD/main" "$DIST_DIR/admin/"
cp -r "$TEMP_BUILD/epet" "$DIST_DIR/epet/"
cp -r "$TEMP_BUILD/main" "$DIST_DIR/"
cp "$SCRIPT_DIR/iot-sql/iot-test.html" "$DIST_DIR/iot-test.html" 2>/dev/null || true

# 5. 重写根 index.html
log ""
log "${YELLOW}🔧 步骤5: 重写根 index.html 指向 admin 入口${NC}"
ADMIN_JS=$(grep -oE 'index-[A-Za-z0-9_-]+\.js' "$DIST_DIR/admin/index.html" | head -1)
ADMIN_CSS=$(grep -oE 'index-[A-Za-z0-9_-]+\.css' "$DIST_DIR/admin/index.html" | head -1)
log "  admin JS: $ADMIN_JS"
log "  admin CSS: $ADMIN_CSS"

cat > "$DIST_DIR/index.html" << INDEXHTML
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/admin/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MOMOTOY 绒绒庭院 · Admin</title>
    <script type="module" crossorigin src="/admin/assets/$ADMIN_JS"></script>
    <link rel="stylesheet" crossorigin href="/admin/assets/$ADMIN_CSS">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
INDEXHTML

# 6. 修复 admin/index.html
cat > "$DIST_DIR/admin/index.html" << INDEXHTML
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/admin/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MOMOTOY 绒绒庭院 · Admin</title>
    <script type="module" crossorigin src="/admin/assets/$ADMIN_JS"></script>
    <link rel="stylesheet" crossorigin href="/admin/assets/$ADMIN_CSS">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
INDEXHTML

# 7. 部署后校验
log ""
log "${YELLOW}🛡️ 步骤7: 部署后校验${NC}"
errors=0

if [ -f "$DIST_DIR/index.html" ]; then
    if grep -qE "MOMOTOY绒绒庭院|/epet/assets/" "$DIST_DIR/index.html"; then
        log "${RED}❌ 根 index.html 错误指向 epet${NC}"
        errors=$((errors+1))
    else
        log "${GREEN}✅ 根 index.html 正常${NC}"
    fi
fi

for path in "$DIST_DIR/admin/assets/$ADMIN_JS" "$DIST_DIR/admin/assets/$ADMIN_CSS" "$DIST_DIR/epet/index.html"; do
    if [ -f "$path" ]; then
        log "${GREEN}✅ $path 存在${NC}"
    else
        log "${RED}❌ $path 不存在${NC}"
        errors=$((errors+1))
    fi
done

# 8. nginx 配置检查
log ""
log "${YELLOW}🔄 步骤8: nginx 配置检查${NC}"
if nginx -t 2>&1 | tee -a "$LOG_FILE" | tail -3; then
    log "${GREEN}✅ nginx 配置正确${NC}"
fi

# 9. 部署完成
log ""
log "${YELLOW}===============================================${NC}"
if [ $errors -eq 0 ]; then
    log "${GREEN}🎉 部署成功 $TS${NC}"
else
    log "${RED}⚠️ 部署完成但有 $errors 个错误，请检查日志${NC}"
fi
log "${YELLOW}===============================================${NC}"
log "日志: $LOG_FILE"
log ""
log "📍 部署后访问地址:"
log "  https://soa.laziestlife.com/         (admin 后台入口)"
log "  https://soa.laziestlife.com/admin/   (admin 后台)"
log "  https://soa.laziestlife.com/epet/    (MOMOTOY 绒绒庭院)"
log "  https://soa.laziestlife.com/iot-test.html"
