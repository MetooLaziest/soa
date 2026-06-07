# E-Pet1 庭院 PixiJS 改造 — 树屋背景 + 宠物随机漫步

## 目标
将 HomePanel 从 CSS 静态卡片 → PixiJS Canvas 庭院，宠物自由漫步

## 修改文件

### PetEntity.ts（重写）
- 移除：`orbitAngle` 椭圆轨道系统
- 新增：wander 状态机 (IDLE / WALKING / SHAKING / EATING)
- 随机目标点选择 → lerp 平滑移动 → 面朝移动方向
- y轴位置映射缩放（0.7~1.2）模拟景深
- 行走时 bob 弹跳动画

### Game.ts（重写）
- 加载 `treehouse-bg.jpg` 为全屏背景（cover 模式）
- 三层渲染：bgContainer → petContainer
- 漫步区域：WALK_BOUNDS = {xMin:0.05, xMax:0.88, yMin:0.45, yMax:0.78}
- hit-test：sprite.eventMode='static' + pointerdown → 回调 React
- getPetScreenPos() 返回精灵屏幕坐标给浮层菜单

### App.tsx（HomePanel 部分重写）
- PetCard 组件删除
- 新增 `<canvas>` + PixiJS 初始化
- 两个 useEffect：init game / sync yardPets
- 互动：点击宠物 → `pet-menu` 浮层（抚摸/喂食/清洁/对话）
- UI 覆层：emotion-badge、bottom-buttons、travel-banner 不受影响

### App.css（yard/pet 样式重写）
- `.yard-canvas`：全屏 canvas 覆盖
- `.pet-menu`：浮动菜单 + pop 动画
- `.pet-menu-backdrop`：透明遮罩关闭菜单
- 移除旧 `.yard-area`、`.pet-card`、`.pet-card-*` 样式

## 部署
- 构建：tsc + vite → 通过，PixiJS chunk ~576KB
- SCP → 47.98.103.151:/var/www/iot-ai-doll/frontend/dist/epet1/
- 验证：HTTP 200

## 待优化项
- 漫步速度/转向平滑度可能需微调
- 宠物图片仅单帧，行走动画仅靠 bob+scale
- 两只宠物之间无碰撞检测（可能重叠）
- 宠物 monsterType 硬编码为 'white'（需从 pet_model_id 映射到 blue/pink）
