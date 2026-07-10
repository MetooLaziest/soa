#!/bin/bash
# Admin 后台部署脚本 - 防错版本

set -e  # 出错立即退出

echo "=== Admin 后台部署 ==="
echo ""

# 1. 确认目录
cd "$(dirname "$0")/iot-ai-doll-frontend" || {
    echo "❌ 错误: 无法进入 iot-ai-doll-frontend 目录"
    exit 1
}

echo "✓ 当前目录: $(pwd)"

# 2. 构建
echo "→ 开始构建..."
npm run build

# 3. 验证构建产物
echo "→ 验证构建产物..."
JS_FILE=$(ls dist/admin/assets/index-*.js | head -1)
if [ -z "$JS_FILE" ]; then
    echo "❌ 错误: 未找到构建产物"
    exit 1
fi

# 检查关键功能是否存在
if ! grep -q "机伴系列" "$JS_FILE"; then
    echo "❌ 错误: 构建产物缺少关键功能 (机伴系列)"
    echo "   你可能在错误的目录构建了！"
    exit 1
fi

echo "✓ 构建产物检查通过"
echo "  JS 文件: $(basename "$JS_FILE")"
echo "  大小: $(du -h "$JS_FILE" | cut -f1)"

# 4. 打包
echo "→ 打包..."
cd dist
rm -f /tmp/admin-deploy.tar.gz
tar czf /tmp/admin-deploy.tar.gz admin/

# 5. 验证 tar 包
echo "→ 验证 tar 包..."
if tar tzf /tmp/admin-deploy.tar.gz | grep -q "^index.html$"; then
    echo "❌ 错误: tar 包包含根目录 index.html，会覆盖艾瑟拉首页！"
    exit 1
fi

echo "✓ 打包检查通过"

# 6. 输出部署命令
echo ""
echo "=== 构建完成 ==="
echo "部署包: /tmp/admin-deploy.tar.gz"
echo ""
echo "接下来执行:"
echo "  1. 上传 /tmp/admin-deploy.tar.gz 到服务器"
echo "  2. 解压到 /var/www/iot-ai-doll/frontend/dist/"
echo ""
echo "或使用 bridge 接口自动化部署"
