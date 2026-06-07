# E-Pet v2.7 部署记录

## 时间
2026-05-31 23:45 ~ 23:50

## 目标
修复走动动画不生效问题

## 根因分析
用户截图显示 Console 日志：
- `Pet state: poop (fullness: 84.3)`
- `WALKING STOPPED` / `EXPRESSION STOPPED` 反复出现
- `WALKING STARTED` 出现过但立即被 STOPPED

**原因**：`getPetState()` 返回 `poop`（因为 totalPoops=11 >= 3），但 v2.6 的走动条件是 `state === 'idle' || state === 'happy'`，所以 `poop` 状态下动画启动后被 load() 循环立即停止。

## v2.7 改动

### 1. 状态判断逻辑不变
`getPetState()` 保持原有优先级：dead < hungry < happy < poop < sleeping < idle

### 2. 新增 shouldWalk() 函数
```javascript
function shouldWalk(state) {
  return !['dead', 'sick', 'egg', 'eating'].indexOf(state) === -1;
}
```
白名单方式：除了4种特殊状态外，所有状态都触发走动动画。

### 3. 动画结构重写
- `.pet-display` → `position: relative; overflow: visible`
- `.pet-wrapper` → 绝对定位居中 + animation target
- `@keyframes walk` → `transform: translate(-50%, -50%) translateX(±60px)`
- 避免了 flex justify-content 干扰 translateX 效果

### 4. Console 调试日志增强
- `[ANIM] state=xxx, shouldWalk=boolean`
- `[ANIM] WALKING STARTED on .pet-wrapper`
- computedStyle 检查 animationName

## 部署路径
- 本地: `/tmp/epet_index_v27.html` (419行)
- 服务器: `/var/www/iot-ai-doll/frontend/dist/epet/index.html` (覆盖)
- SCP上传成功 (14KB)

## 待验证
- [ ] 硬刷新后小怪兽是否左右走动
- [ ] Console 中 shouldWalk 是否为 true
- [ ] 表情气泡是否出现
- [ ] 喂食/抚摸/铲屎按钮是否正常工作

## 后端待办（仍未完成）
- calcFullness 修复代码在 `/tmp/_tw_epet_router_fixed.mjs`，尚未上传到服务器
