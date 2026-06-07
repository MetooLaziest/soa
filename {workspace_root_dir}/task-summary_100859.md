# E-Pet statusPill 空指针修复

## 问题
藏品库点击宠物时报 `TypeError: Cannot set properties of null (setting 'className')`，指向 `updateUI()` 函数第 558 行操作的 `statusPill` DOM 元素不存在。

## 根因
1. `updateUI()` 调用 `document.getElementById('statusPill')` 获取状态栏元素，但 HTML 中无此元素
2. `state` 变量直接引用全局未定义的 `state`，而非从 `visiblePets` 中计算得出

## 修复内容（/tmp/epet_live.html）

### 修复 1：HTML 中添加 statusPill 元素
```html
<div class="scene-bg"></div>
<div class="container">
  <div id="statusPill" class="status-pill"></div>
  <div class="pet-area" id="petArea">
```

### 修复 2：updateUI() 计算 state
```javascript
function updateUI() {
  if (!visiblePets || visiblePets.length === 0) return;

  for (var i = 0; i < visiblePets.length; i++) {
    visiblePets[i]._state = getState(visiblePets[i]);
  }
  var pill = document.getElementById('statusPill');
  var primaryPet = visiblePets[0] || {};
  var state = primaryPet._state;
  ...
```

### 修复 3：loadVisiblePets() 给每只宠物计算 state
```javascript
if (d.success && d.pet) {
  d.pet._state = getState(d.pet);
  visiblePets.push(d.pet);
}
```

## 部署
- HTML → `/var/www/iot-ai-doll/frontend/dist/epet/index.html`（SCP）
- 后端 PM2 重启：`pm2 restart iot-backend`

## 验证
访问 https://soa.laziestlife.com/epet/ ，点击任意宠物，藏品库应正常弹出且无控制台报错