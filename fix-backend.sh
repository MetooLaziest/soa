#!/bin/bash
# 紧急修复脚本 - 修复 yard-scene.cjs 中的 TypeScript 类型注解导致的语法错误
# 后端因此错误无法启动

echo "=== 修复 yard-scene.cjs TypeScript 类型注解 ==="

TARGET="/var/www/iot-ai-doll/backend/src/routes-epet1/yard-scene.cjs"

# 修复1: 移除 TypeScript 类型注解
sed -i 's/let iconsList: any\[\] = \[\]/let iconsList = []/' "$TARGET"

# 验证修复
if grep -q "let iconsList: any" "$TARGET"; then
  echo "❌ 修复失败：仍存在 TypeScript 类型注解"
  exit 1
else
  echo "✅ TypeScript 类型注解已移除"
fi

# 重启后端
cd /var/www/iot-ai-doll/backend
pm2 restart iot-backend
sleep 3
pm2 status iot-backend

echo "=== 修复完成 ==="
