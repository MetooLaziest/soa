# E-Pet v2.6 部署记录 - 2026-05-31 23:12

## 目标
修复走动动画不工作的问题（v2.5 的 transition 移除后仍无效）

## 根因分析演进

| 版本 | 尝试的修复 | 结果 |
|------|-----------|------|
| v2.4 | happy也触发动画 | ❌ 不动 |
| v2.5 | 移除 transition:transform + 简化CSS + 修复typo | ❌ 仍不动 |
| v2.6 | **彻底重写动画方案：用 margin-left 替代 translateX** | ⏳ 待验证 |

## v2.6 关键改动

### 动画方案变更（核心）
- **旧方案**：`transform: translateX(-60px/60px)` — 与 flex 布局的居中机制冲突
- **新方案**：`@keyframes walk { 0%,100% { margin-left: calc(50%-130px) } 50% { margin-left: calc(50%-10px) } }`
- 原因推测：flex 容器的 `justify-content: center` 可能在每帧重新计算子元素位置，抵消了 translateX 的效果

### 其他改动
- pet-display 改为 block 布局（去掉 display:flex），加 padding: 20px 60px 给动画留空间
- walking 状态下 img 用 position:relative + margin:auto + margin-left动画
- 所有 animation 加 !important 防止被覆盖
- 添加 .pet-display::before 虚线调试边框
- console.log 加 [ANIM] 前缀便于过滤

## 文件
- 本地：`/tmp/epet_index_v26.html`（422行）
- 服务器：`/var/www/iot-ai-doll/frontend/dist/epet/index.html`（已覆盖）

## 待验证
- [ ] 小怪兽左右走动可见
- [ ] 表情气泡显示
- [ ] 标题显示 【MOMOTOY数字生命】
- [ ] 底部提示隐藏
