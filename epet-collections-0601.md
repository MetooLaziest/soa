# E-Pet 藏品库功能 v2 - 多宠物展示系统

## 核心变化
从"单只宠物"升级为"多宠物藏品库"，用户关联3只小怪兽，可选择同时展示1-2只进行交互。

## 完成状态 ✅

### 后端
- `/api/epet/monsters` GET: 返回用户所有藏品（petId/displayName/monsterType/isVisible/stats）
- `/api/epet/:id/visibility` POST: 切换展示/隐藏，`MAX_VISIBLE`错误码阻止超过2只
- PostgreSQL postgres密码修复：`ALTER USER postgres WITH PASSWORD 'iot2026pass'`
- 3只宠物入库: 9527(green,展示), 2333(blue,隐藏), 10086(pink,隐藏)

### 前端 v4
- 顶部藏品库横条: 3只怪兽缩略图，点击切换展示/隐藏
- 主区域: 最多2只宠物卡片上下排列，每卡含状态动画+4项属性+进度条+排泄物+3操作按钮
- 空槽位提示: 单只展示时右侧显示"再选一只"提示

### 资源
- `/epet/monster-green.svg`, `monster-blue.svg`, `monster-pink.svg` (1755-1757 bytes each)

### 验证
- 前端: `https://soa.laziestlife.com/epet/` (硬刷新)
- API: `curl https://soa.laziestlife.com/api/epet/monsters`
- 超过2只展示被阻止，返回"最多只能同时展示2只"