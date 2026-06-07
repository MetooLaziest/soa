# E-Pet v2.8 大版本功能升级

## 时间
2026-05-31 23:50 ~ 23:55

## 目标
基于用户需求进行多维度功能升级

## 用户原始需求
1. 走动白名单：除了进食、拉屎、睡觉，其余动作应当支持走动
2. 排泄逻辑：每降低10点饱食度就排泄一次，界面要有💩图示
3. 喂食动效：放碗→吃东西→吃完再刷新饱腹度（不要直接刷新）
4. 睡眠时间：默认晚上9点到早上6点，睡眠中不会排泄
5. 睡觉动效 + 睡眠中抚摸会清醒 + 3分钟内不继续交互就会睡着

## v2.8 实现细节

### 1. 走动白名单重构
```javascript
function shouldWalk(state) {
  return ['eating', 'poop', 'sleeping'].indexOf(state) === -1;
}
```
白名单方式：只有三种特殊状态不走动，其余全部走动。

### 2. 排泄物显示系统
- 新增 `.poop-container` 区域在宠物图片下方
- `renderPoops(count)` 函数动态生成💩图标
- 每个💩有 `poopPop` 弹出动画（缩放+位移）
- 最多显示8个，与 totalPoops 数据联动

### 3. 喂食三阶段动效
| 阶段 | 动作 | 时长 |
|------|------|------|
| 1 | 切换 eating 图片 + 停止走动 | 即时 |
| 2 | 食碗 SVG 滑入 + eatBounce 动画 | 0.2s |
| 3 | 吃东西动画持续 | 2.5s |
| 4 | 食碗收回 + 调用 API | 即时 |
| 5 | 刷新界面数据 | 即时 |

- 食碗用内联 SVG 绘制（灰色碗+橙色食物+食物颗粒）
- 喂食期间 `isFeeding=true`，阻止定时刷新和重复点击

### 4. 睡眠系统
```javascript
function getPetState(pet) {
  var hour = new Date().getHours();
  if (hour >= 21 || hour < 6) {
    if (!isAwakened()) return 'sleeping';
  }
  // ... 其他状态判断
}
```
- `isSleepTime()`: hour >= 21 || hour < 6
- `isAwakened()`: Date.now() - lastInteractionTime < 180000 (3分钟)
- 睡觉动效: `@keyframes breathe` 呼吸起伏 + ZZZ 三个字母错开飘出
- 状态徽章: sleeping(蓝色)/awake(绿色)/hungry(橙色)

### 5. 抚摸唤醒逻辑
- 睡眠中点击宠物 → `isAwakened()` 更新时间戳 → 切换 pet 图片 → 走动
- setTimeout 180000ms 后检查是否需要重新入睡

## 文件信息
- 本地: `/tmp/epet_index_v28.html` (723行)
- 服务器: `/var/www/iot-ai-doll/frontend/dist/epet/index.html` (已覆盖, 24KB)

## 待验证
- [ ] 硬刷新后各功能正常
- [ ] 走动：idle/happy/hungry/pet 都能左右移动
- [ ] 不走动：eating/poop/sleeping 静止
- [ ] 💩排泄物正确显示和隐藏
- [ ] 喂食动效：碗出现→吃→碗消失→刷新
- [ ] 睡眠：21:00-06:00 自动睡觉+ZZZ
- [ ] 抚摸唤醒：睡梦中点一下醒来
- [ ] 3分钟无交互自动入睡

## 后端待办（仍未完成）
- calcFullness 修复代码在 `/tmp/_tw_epet_router_fixed.mjs`
- 上传到 `/var/www/iot-ai-doll/backend/src/routes/epet.js`
- pm2 restart iot-backend
