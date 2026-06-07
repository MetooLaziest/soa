# E-Pet v2.5 部署记录 - 2026-05-31 22:56

## 目标
按照用户截图中的红色标注进行界面调整，同时修复走动动画不工作的bug。

## 用户需求（截图红色标注）
1. 标题 "🐱 我的电子宠物" → 改为 "【MOMOTOY数字生命】"
2. 底部提示文字 "点击宠物头像抚摸 · 饱腹感每10分钟-0.69" → 隐藏该行

## 实施的修改

### 界面调整 ✅
- h1 标题改为 `【MOMOTOY数字生命】`
- title 标签改为 `MOMOTOY数字生命`
- `.tip` 类添加 `display: none !important`

### 动画Bug修复 ✅（v2.4遗留问题）
**根因分析：** `.pet-img` 上的 `transition: transform 0.15s ease` 与 `@keyframes walk` 中的 `transform: translateX()` 冲突。CSS transition 会覆盖/干扰 animation 的 transform 属性，导致 translateX 动画无法生效。

**修复措施：**
1. 移除 `.pet-img { transition: transform 0.15s ease; }` — 这是核心修复
2. 简化 walking 动画：去掉 bounce keyframe 和 CSS变量方案，使用纯 walk keyframe
3. 修复所有 JS 模板字符串反引号为普通字符串（之前版本生成的 typo bug）
4. const → var 提升兼容性
5. pet-display overflow: hidden → visible（防止走动裁剪）
6. 表情气泡位置微调（top:10px, right:-10px, font-size:28px）

## 文件变更
- 本地生成：`/tmp/epet_index_v25.html`（400行）
- 服务器目标：`/var/www/iot-ai-doll/frontend/dist/epet/index.html`（覆盖）
- SCP上传成功：13KB @ 382KB/s

## 待验证
- [ ] 标题显示为 【MOMOTOY数字生命】
- [ ] 底部提示文字已隐藏
- [ ] 小怪兽左右走动动画可见（60px幅度，2秒周期）
- [ ] 表情气泡每5秒切换显示
- [ ] 喂食/抚摸/铲屎功能正常
- [ ] 两个新按钮正常显示和点击

## 后端待处理（仍挂起）
- calcFullness 修复代码在 `/tmp/_tw_epet_router_fixed.mjs`，尚未上传到服务器 epet.js
- 上传后需 pm2 restart iot-backend
