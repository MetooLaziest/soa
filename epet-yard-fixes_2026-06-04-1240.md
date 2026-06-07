# E-Pet1 庭院三连修复 + URL 交换

## 修复内容

### 1. 点击无菜单 → 已修复
- **根因**：Game.init() 异步加载背景图（Assets.load），同步 effect 在 `isReady` 为 false 时提前返回，背景加载完成后不重新触发
- **修复**：Game 新增 `onReady` 回调 → App 新增 `gameReady` state → sync effect 依赖 `[yardPets, gameReady]`

### 2. 宠物图片映射 → 已修复
- 新增 `getMonsterType(modelId)` 映射：1→blue / 2→white / 3→pink
- PetEntity.getImageName() 原有映射正确（blue→pet-blue.png, white→pet-idle.png, pink→pet-pink.png）
- 服务器 PNG 文件已丢失，用 Python Pillow 重新生成占位图

### 3. URL 交换 → 已完成
- `/epet/` → 新 React 应用（原 /epet1/）
- `/epet1/` → 新 React 应用（镜像）
- `/epet2/` → 旧版占位（Nginx 已配置，目录为空）
- Vite `base: './'` 改为相对路径，构建产物可在任意路径运行

## 服务器状态
- `/var/www/iot-ai-doll/frontend/dist/epet/` — React 构建 + 4 张图片
- `/var/www/iot-ai-doll/frontend/dist/epet1/` — React 构建（镜像）
- `/var/www/iot-ai-doll/frontend/dist/epet2/` — 空（旧文件丢失）
- Nginx 已 reload，所有 URL 200 OK

## 遗留问题
- ⚠️ 旧的 epet HTML 文件（index.html, epet-v2.4.html 等）丢失，/epet2/ 为空
- 占位图片非原始素材，后续可替换为正式素材
