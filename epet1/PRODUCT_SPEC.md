# E-Pet 1 产品结构定义文档 v1.0

> 起草日期：2026-06-03
> 状态：初稿，待确认

---

## 一、产品定位与愿景

**一句话定位：** 旅行青蛙-like AI情感陪伴宠物游戏，NFC实体联动。

**核心体验：** 玩家通过扫描实体玩偶NFC获得虚拟宠物，在庭院中养育、互动、出游、收集明信片，感受情感羁绊与收集成就感。

**关键词：** NFC实体联动 / AI情感陪伴 / 收集养成 / 旅行探索 / 碎片合成

---

## 二、核心数据模型

### 2.1 用户 / User

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| openid | VARCHAR(64) | 微信 openid（唯一） |
| nickname | VARCHAR(32) | 昵称 |
| avatar_url | VARCHAR(255) | 头像 URL |
| emotion_points | INT | 情绪值余额，默认 0 |
| created_at | TIMESTAMP | 注册时间 |

---

### 2.2 宠物型号 / PetModel（管理员配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| name | VARCHAR(32) | 宠物名称，如"团子糯糯" |
| description | TEXT | 描述文案 |
| image_url | VARCHAR(255) | 宠物主图 URL |
| animations | JSON | 动画配置（见下方） |
| personality_template | TEXT | AI性格 prompt 模板 |
| mbti | VARCHAR(4) | MBTI 性格（如 INFP） |
| growth_unlock_config | JSON | 各等级解锁条件配置 |
| nfc_range_start | BIGINT | NFC ID 范围起始 |
| nfc_range_end | BIGINT | NFC ID 范围结束 |
| rarity | VARCHAR(16) | 稀有度：common/rare/epic/legendary |
| created_at | TIMESTAMP | 创建时间 |

**animations JSON 结构：**
```json
{
  "idle": "url或帧序列",
  "happy": "...",
  "eating": "...",
  "sleeping": "...",
  "traveling": "...",
  "greeting": "..."
}
```

---

### 2.3 宠物实例 / PetInstance（用户 NFC 激活后产生）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| user_id | BIGINT | 所属用户 FK |
| pet_model_id | BIGINT | 宠物型号 FK |
| nfc_id | BIGINT | NFC 卡 ID（唯一） |
| nickname | VARCHAR(32) | 用户自定义昵称 |
| growth_level | INT | 成长等级，默认 1 |
| growth_exp | INT | 成长经验值，默认 0 |
| total_interactions | INT | 累计互动次数 |
| total_travels | INT | 累计出游次数 |
| total_postcards | INT | 累计获得明信片数 |
| created_at | TIMESTAMP | 首次扫描时间 |

> 一张 NFC 卡只能创建一个 PetInstance；重复扫描或他人扫描均无效（由 nfc_id 唯一约束 + 后端校验）。

---

### 2.4 庭院宠物 / YardPet（用户在庭院放置的宠物实例）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| user_id | BIGINT | FK |
| pet_instance_id | BIGINT | FK，指向 PetInstance |
| position | INT | 位置 1 或 2 |
| is_active | BOOLEAN | 是否在庭院中 |
| added_at | TIMESTAMP | 放入庭院时间 |

> 每个用户最多 2 条 is_active=true 的 YardPet 记录。

---

### 2.5 明信片 / Postcard（管理员配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| name | VARCHAR(64) | 明信片名称 |
| image_url | VARCHAR(255) | 明信片图片 URL |
| animation_url | VARCHAR(255) | 配套动画 URL（MP4/GIF/Lottie） |
| rarity | VARCHAR(16) | 稀有度：N/R/SR/SSR/UR |
| rarity_weight | INT | 抽卡权重（数值越大概率越高） |
| description | TEXT | 描述文案 |
| display_scene | VARCHAR(128) | 场景描述（如"巴黎铁塔下"） |
| is_active | BOOLEAN | 是否在卡池中 |
| created_at | TIMESTAMP | 创建时间 |

> 卡池由管理员通过后台配置（is_active 控制上下线）。
> 出游返回时，根据各明信片 rarity_weight 权重随机抽取。

---

### 2.6 用户明信片 / UserPostcard

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| user_id | BIGINT | FK |
| postcard_id | BIGINT | FK |
| obtained_at | TIMESTAMP | 获得时间 |
| duplicate_count | INT | 重复获得次数（≥1 表示重复） |

> duplicate_count = 0 表示首次获得；> 0 时视为"未获得新明信片"，用户收到提示"已拥有此明信片"。

---

### 2.7 碎片 / Fragment（管理员配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| pet_model_id | BIGINT | 对应宠物型号 FK |
| rarity | VARCHAR(16) | 稀有度：common/rare/epic |
| name | VARCHAR(64) | 碎片名称 |
| image_url | VARCHAR(255) | 碎片图片 |
| created_at | TIMESTAMP | 创建时间 |

---

### 2.8 用户碎片 / UserFragment

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| user_id | BIGINT | FK |
| fragment_id | BIGINT | FK |
| count | INT | 碎片数量 |

---

### 2.9 出游记录 / TravelRecord

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| user_id | BIGINT | FK |
| pet_instance_id | BIGINT | FK |
| started_at | TIMESTAMP | 出发时间 |
| expected_end_at | TIMESTAMP | 预计返回时间（= started_at + 12h） |
| actual_end_at | TIMESTAMP | 实际返回时间（宠物回来时写入） |
| status | VARCHAR(16) | traveling / returned |
| postcard_id | BIGINT | FK（返回后填写） |
| postcard_is_new | BOOLEAN | 是否是新获得的（首次获得） |

---

### 2.10 漂流瓶 / DriftBottle

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| sender_id | BIGINT | 发送者 FK（可为空=系统） |
| receiver_id | BIGINT | 接收者 FK（随机匹配或指定） |
| content | TEXT | 留言内容（最多 200 字） |
| reply_to_id | BIGINT | 回复目标 DriftBottle ID（可为空） |
| emotion_reward | INT | 附带情绪值（系统发放时>0） |
| fragment_reward_id | BIGINT | 附带碎片 FK（可为空） |
| status | VARCHAR(16) | pending / delivered / replied / expired |
| created_at | TIMESTAMP | 投放时间 |

---

### 2.11 小游戏记录 / MiniGameRecord

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| user_id | BIGINT | FK |
| pet_instance_id | BIGINT | FK（参与的宠物，可为空） |
| game_type | VARCHAR(32) | 游戏类型标识（frisbee / 100floor / ...） |
| score | INT | 本次得分 |
| played_at | TIMESTAMP | 游戏时间 |

---

### 2.12 商店物品 / ShopItem（管理员配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| name | VARCHAR(64) | 商品名称 |
| item_type | VARCHAR(16) | virtual / physical |
| price_emotion | INT | 情绪值价格（虚拟商品用） |
| price_real | DECIMAL(10,2) | 真实货币价格（实物用） |
| pet_model_id_required | BIGINT | 需要的宠物型号 ID（可为空表示无限制） |
| growth_level_required | INT | 需要的成长等级（解锁条件） |
| stock | INT | 库存（-1 表示无限） |
| image_url | VARCHAR(255) | 商品图片 |
| description | TEXT | 商品描述 |
| is_active | BOOLEAN | 是否上架 |
| created_at | TIMESTAMP | 创建时间 |

---

### 2.13 用户背包 / UserInventory

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| user_id | BIGINT | FK |
| shop_item_id | BIGINT | FK |
| quantity | INT | 持有数量 |

---

## 三、API 接口设计

### 3.1 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/epet1/user/createOrUpdate | 微信授权登录，创建/更新用户 |

### 3.2 宠物相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/epet1/pet/models | 获取所有宠物型号列表 |
| POST | /api/epet1/pet/nfc/activate | NFC 扫描激活宠物（body: {nfc_id}） |
| GET | /api/epet1/pet/instances | 获取用户所有宠物实例 |
| GET | /api/epet1/pet/yard | 获取当前庭院宠物列表 |
| POST | /api/epet1/pet/yard/add | 放入庭院（body: {pet_instance_id}） |
| POST | /api/epet1/pet/yard/remove | 移出庭院（body: {pet_instance_id}） |
| POST | /api/epet1/pet/interact/feed | 喂食（body: {pet_instance_id, item_id}） |
| POST | /api/epet1/pet/interact/pet | 抚摸（body: {pet_instance_id, body_part}） |
| POST | /api/epet1/pet/interact/chat | AI对话（body: {pet_instance_id, message}） |
| POST | /api/epet1/pet/travel/start | 开始出游（body: {pet_instance_id}） |
| GET | /api/epet1/pet/travel/status | 查询出游状态 |

### 3.3 明信片与收集

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/epet1/postcard/collection | 获取用户明信片收藏 |
| GET | /api/epet1/postcard/pool | 获取当前卡池（管理员） |

### 3.4 漂流瓶

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/epet1/drift/send | 发送漂流瓶 |
| GET | /api/epet1/drift/inbox | 获取收到的漂流瓶 |
| POST | /api/epet1/drift/reply | 回复漂流瓶 |
| GET | /api/epet1/drift/pickup | 捡一个漂流瓶 |

### 3.5 小游戏

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/epet1/game/types | 获取可用游戏列表 |
| POST | /api/epet1/game/record | 上报游戏成绩 |

### 3.6 商店与背包

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/epet1/shop/items | 获取商店物品列表 |
| POST | /api/epet1/shop/buy | 购买物品（body: {item_id, payment: emotion/real}） |
| GET | /api/epet1/inventory | 获取用户背包 |

### 3.7 管理后台

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PATCH/DELETE | /api/epet1/admin/pet-models | 宠物型号 CRUD |
| GET/POST/PATCH/DELETE | /api/epet1/admin/postcards | 明信片 CRUD |
| GET/POST/PATCH/DELETE | /api/epet1/admin/fragments | 碎片 CRUD |
| GET/POST/PATCH/DELETE | /api/epet1/admin/shop-items | 商店物品 CRUD |
| GET/POST/PATCH/DELETE | /api/epet1/admin/drift-rewards | 漂流瓶奖励配置 |

---

## 四、页面结构

```
┌─────────────────────────────────────┐
│           庭院页面（主页）             │
│                                     │
│  左上：情绪值                        │
│  右上：设置                          │
│                                     │
│  中间：庭院场景（宠物在场景中idle动画） │
│                                     │
│  左下：其他（展开面板）               │
│  右下：漂流瓶 | 藏品库 | 明信片 |      │
│        小游戏 | 商店                 │
│                                     │
│  底部：喂食桌子（点击弹出食物选择）     │
└─────────────────────────────────────┘
```

### 4.1 主页 → 宠物互动页
点击庭院中的宠物 → 全屏互动页
- 宠物全身大图（居中）
- 底部：抚摸区域（头/身/背/尾）+ 对话输入框
- 右上：出游按钮
- 左上：返回

### 4.2 宠物出游流程
互动页 → 点击出游 → 选择出游目的地（可选） → 确认出发
→ 宠物离开画面，显示倒计时 12:00
→ 宠物回来 → 动画 → 明信片翻牌（抽卡展示）

### 4.3 藏品库页面
- 网格展示所有已收集宠物
- 点击宠物 → 详情弹窗（成长等级、XP、累计互动/出游次数）
- 切换按钮：放入庭院 / 移出庭院
- 碎片显示区

### 4.4 明信片收藏页
- 按稀有度分类 Tab（N/R/SR/SSR/UR）
- 每张明信片配动画（点击播放）
- 首次获得标记（NEW 徽章）

### 4.5 漂流瓶页
- 发送区：文本输入 + 发送按钮
- 收件箱列表：谁发来的 + 内容预览 + 回复按钮
- 附带奖励提示（情绪值/碎片）

### 4.6 小游戏中心
- 游戏列表（图标+名称+简介）
- 进入游戏时选择宠物（可选）
- 游戏结束后展示成绩 + 奖励

### 4.7 商店页
- Tab：虚拟商品 | 实物商品
- 虚拟：情绪值购买
- 实物：微信支付（演示）
- 锁定状态显示解锁条件

---

## 五、情绪值经济体系

| 行为 | 获得 | 消耗 |
|------|------|------|
| 每日首次抚摸 | +5 | - |
| 收到漂流瓶 | +随机 | - |
| 明信片首次获得 | +10 | - |
| 购买虚拟商品 | - | 按定价 |
| 小游戏参与 | +3 | - |

---

## 六、小游戏技术方案

**推荐架构：PixiJS v8 + Taro 3**

| 平台 | 技术 |
|------|------|
| Web（H5） | Vite + React + PixiJS v8 |
| 微信小程序 | Taro 3 + PixiJS v8（Canvas适配） |
| APP | Taro + React Native |

游戏核心逻辑（游戏规则、关卡、AI）统一用 TypeScript 编写，不涉及平台特定 API。
PixiJS 负责所有渲染，天然跨平台。

---

## 七、后台管理需求

| 功能 | 说明 |
|------|------|
| 宠物型号管理 | 增删改查、上线/下线、NFC范围配置 |
| 明信片管理 | 增删改查、上线/下线、抽卡权重配置、动画上传 |
| 碎片管理 | 增删改查、对应宠物绑定 |
| 商店物品管理 | 增删改查、上下架、库存、价格、解锁条件 |
| 漂流瓶奖励配置 | 情绪值/碎片掉落概率配置 |
| 成长解锁配置 | 各宠物等级对应解锁内容配置 |

---

## 八、v1 优先开发范围

**第一期（MVP）优先实现：**
1. 微信登录 + 用户基础信息
2. NFC 激活宠物
3. 庭院展示（2只宠物idle动画）
4. 宠物互动（抚摸 + AI对话 + 喂食）
5. 出游系统（12h，概率明信片）
6. 藏品库
7. 情绪值基础闭环
8. 商店（情绪值购买虚拟商品）

**第二期：**
- 漂流瓶
- 明信片动画
- 小游戏
- 实物商品 + 微信支付（演示）
- 管理后台

---

*文档状态：初稿，待 Metoo 确认后迭代*
