# E-Pet 5层提示词架构实施

## 目标
解决宠物对话"串台"和"性格不稳定"问题，将单层 System Prompt 改为结构化5层架构。

## 实施步骤

### 1. 数据库改造（pet_models 表）
新增6个字段：`identity_anchor`(L1), `core_personality`(L2), `behavior_rules`(L3), `skill_layer`(L4), `context_memory_template`(L5), `prompt_version`(INT)
原有 `personality_template` 保留做 v1 兼容。
3只宠物（海浪沫沫/团子糯糯/糖心莓莓）数据已从 old template 拆分到5层。

### 2. 后端 chat.js 重写
路径：`/var/www/iot-ai-doll/epet1-backend/src/routes/chat.js`
- `buildSystemPromptV2()`: 按 L1→L5 顺序拼接，层间有明确分隔标记
- `buildSystemPromptV1()`: 保留旧 `personality_template` 逻辑
- 自动检测：`prompt_version >= 2 && identity_anchor` 非空 → 用 v2，否则 v1

### 3. 新增 Admin API 路由
路径：`/var/www/iot-ai-doll/epet1-backend/src/routes/admin.js`
- `GET /api/epet1/admin/pet-models/:id/layers` — 读取5层数据
- `PUT /api/epet1/admin/pet-models/:id/layers` — 更新5层数据（保存时自动设 prompt_version=2）

### 4. 前端 Companions.tsx 重构
路径：`/Users/lintingrui/.qclaw/workspace/iot-ai-doll-frontend/src/pages/admin/Companions.tsx`
- 新增 `LayerEditModal` 组件：5个标签页（🪪身份/🎭性格/📋行为/🔧技能/🧠记忆）
- 每个标签页有灰色提示说明层的作用
- 折叠面板展示完整5层拼接预览
- "测试对话"按钮调用 `/api/epet1/chat` 验证效果
- 保存调用 `PUT /api/epet1/admin/pet-models/:id/layers`

### 5. 部署
- 后端：pm2 restart epet1-backend → 成功
- 前端：构建+SCP部署 → HTTP 200 验证通过

## 验证结果
- `/api/epet1/chat` 返回 `prompt_version: 2`，AI回复符合海浪沫沫台湾腔+俏皮话设定
- `/api/epet1/admin/pet-models/1/layers` 返回完整5层数据
- `/admin/companions` 页面正常加载，显示3只宠物卡片+5层编辑按钮

## 已知限制
- L4(RAG)字段可编辑但后端 chat.js 暂不调用 RAG 检索管道
- 青提扭扭/酪酪/焦糖可可的5层数据仍为空（待后续完善性格设定）
- IoT 机伴对话系统（ai.js）未改造，仍用旧版 prompt
