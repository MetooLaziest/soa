# E-Pet 小怪兽 SVG 素材生成任务总结

**任务时间**: 2026-05-31 19:37  
**任务目标**: 为 E-Pet 电子宠物项目生成小怪兽风格的 SVG 素材，替换现有的猫咪图片

---

## 📦 交付成果

### 生成的文件

共 **13 个文件**（12 个 SVG + 1 个预览页面）：

| 文件名 | 状态 | 文件大小 | 描述 |
|--------|------|----------|------|
| `monster-idle.svg` | 待机 | 1.7KB | 正常站立，微笑 |
| `monster-eating.svg` | 进食 | 1.7KB | 张嘴吃东西，食物特效 |
| `monster-happy.svg` | 开心 | 2.0KB | 跳跃，大笑，星星特效 |
| `monster-sleeping.svg` | 睡觉 | 2.1KB | 横躺，ZZZ 符号 |
| `monster-hungry.svg` | 饥饿 | 2.1KB | 流泪，想食物符号 |
| `monster-poop.svg` | 便便 | 2.3KB | 不舒服，眼珠螺旋状 |
| `monster-pet.svg` | 抚摸 | 2.1KB | 享受，爱心特效，手抚摸动画 |
| `monster-sick.svg` | 生病 | 2.1KB | 苍白，发烧，X_X 眼 |
| `monster-clean.svg` | 清洁 | 2.3KB | 清爽，泡泡特效 |
| `monster-evolution.svg` | 进化 | 3.1KB | 光环，更强大形态 |
| `monster-dead.svg` | 死亡 | 2.6KB | 可爱版死亡，X_X 眼 + 光环 |
| `monster-egg.svg` | 孵化 | 2.0KB | 蛋壳裂缝，小怪兽露出 |
| `preview.html` | 预览页 | 3.2KB | 所有素材的 HTML 预览页面 |

**总大小**: ~27KB (比原 PNG 图片 2.8MB 小了 **99%**！)

---

## 🎨 设计说明

### 配色方案

| 部位 | 颜色代码 | 说明 |
|------|----------|------|
| 身体 | `#7ED957` → `#5DBF3A` | 绿色渐变 (径向渐变) |
| 肚皮 | `#F0FFF0` | 淡绿色，半透明 |
| 角 | `#FF6B6B` | 红色小角 |
| 眼睛 - 白 | `#FFFFFF` | 眼白 |
| 眼睛 - 瞳 | `#333333` | 瞳孔 |
| 眼睛 - 高光 | `#FFFFFF` | 眼神光 |
| 腮红 | `#FFB6C1` | 粉色，半透明 |
| 嘴巴 | `#333333` / `#FF6B6B` | 线条或填充 |
| 眼泪 | `#87CEEB` | 天蓝色 |
| 便便 | `#8B4513` | 棕色 |
| 进化光环 | `#FFD700` → `#FFA500` | 金色渐变 |

### 小怪兽特征

1. **绿色身体** - 椭圆形状，使用径向渐变
2. **红色小角** - 头顶两个小角 (可爱风格)
3. **椭圆眼睛** - 垂直椭圆，有高光
4. **腮红** - 脸颊粉色，不同状态下透明度变化
5. **短手臂和脚** - 简洁的线条风格
6. **肚皮** - 浅色椭圆表示肚皮

### 状态变化设计

| 状态 | 关键视觉变化 |
|------|--------------|
| **待机** | 正常站立，微笑，眼睛正常 |
| **进食** | 眼睛眯起，嘴巴张开，有食物 |
| **开心** | 眼睛弯成月牙，大笑，星星特效 |
| **睡觉** | 身体横躺，闭合眼睛，ZZZ 符号 |
| **饥饿** | 流泪，想食物符号，嘴巴下垂 |
| **便便** | 眼珠螺旋状，不舒服表情 |
| **抚摸** | 闭眼享受，爱心特效，手抚摸 |
| **生病** | 身体变浅，发烧符号，X_X 眼 |
| **清洁** | 清爽，泡泡特效 |
| **进化** | 光环，身体更大，眼睛变蓝 |
| **死亡** | 灰色身体，X_X 眼，十字架 (可爱版) |
| **孵化** | 蛋壳裂缝，小怪兽部分露出 |

---

## 🚀 如何使用

### 方法 1：本地预览

```bash
cd /Users/lintingrui/.qclaw/workspace/epet-svgs
open preview.html
```

### 方法 2：集成到 E-Pet 前端

将 SVG 文件上传到服务器：

```bash
# 使用 expect + scp 上传（需要密码 123ASDasd!@#）
# 目标路径: /var/www/iot-ai-doll/frontend/dist/epet/

# 1. 先通过某种方式上传所有 SVG 到服务器
# 2. 修改前端代码，根据状态切换图片
```

修改 `epet-v2.html` 中的 JavaScript，根据宠物状态切换图片：

```javascript
function getPetImage(state) {
  const baseUrl = '/epet/';  // Nginx 静态文件路径
  const images = {
    'idle': baseUrl + 'monster-idle.svg',
    'eating': baseUrl + 'monster-eating.svg',
    'happy': baseUrl + 'monster-happy.svg',
    'sleeping': baseUrl + 'monster-sleeping.svg',
    'hungry': baseUrl + 'monster-hungry.svg',
    'poop': baseUrl + 'monster-poop.svg',
    'pet': baseUrl + 'monster-pet.svg',
    'sick': baseUrl + 'monster-sick.svg',
    'clean': baseUrl + 'monster-clean.svg',
    'evolution': baseUrl + 'monster-evolution.svg',
    'dead': baseUrl + 'monster-dead.svg',
    'egg': baseUrl + 'monster-egg.svg',
  };
  return images[state] || images['idle'];
}

// 在 load() 函数中根据 hunger 值判断状态
function getStateFromHunger(hunger) {
  if (hunger < 20) return 'hungry';
  if (hunger > 80) return 'happy';
  return 'idle';
}

// 更新图片
document.getElementById('petImg').src = getPetImage(getStateFromHunger(p.hunger));
```

### 方法 3：转成 Data URI（内嵌到 HTML）

如果无法上传文件到服务器，可以将 SVG 转成 Data URI 嵌入到 HTML 中：

```javascript
const monsterIdle = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
```

---

## 📍 文件位置

| 文件类型 | 路径 |
|----------|------|
| SVG 素材 | `/Users/lintingrui/.qclaw/workspace/epet-svgs/*.svg` |
| 预览页面 | `/Users/lintingrui/.qclaw/workspace/epet-svgs/preview.html` |
| 本文档 | `/Users/lintingrui/.qclaw/workspace/epet-monster-svgs_20260531.md` |

---

## 🎯 后续工作

1. **上传到服务器** - 将 SVG 文件上传到 `/var/www/iot-ai-doll/frontend/dist/epet/`
2. **修改前端代码** - 根据宠物状态动态切换图片
3. **测试** - 在不同状态下验证图片切换是否正确
4. **优化** - 根据实际效果调整 SVG 设计

---

## 💡 技术亮点

1. **纯 SVG 代码** - 无需外部图片依赖，加载速度快
2. **矢量图形** - 任意缩放不失真
3. **文件体积极小** - 每个 SVG 约 2KB，比 PNG 小 99%
4. **可动画化** - SVG 元素可以用 CSS/JS 添加动画
5. **可访问性** - SVG 支持 `<title>` 和 `<desc>` 标签

---

## ✅ 任务完成确认

- [x] 生成 12 种状态的小怪兽 SVG
- [x] 创建 HTML 预览页面
- [x] 使用 qclaw-text-file skill 规范写入文件
- [x] 编写任务总结文档

---

**生成者**: QClaw (OpenClaw Main Agent)  
**时间戳**: 2026-05-31T19:37:00+08:00
