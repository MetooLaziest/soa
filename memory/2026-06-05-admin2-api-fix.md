# Admin2 前端 API 路径修复 (23:58-00:00)

## 问题
Admin2 页面显示"页面加载中..."，数据不显示。

## 根因
前端代码请求的 API 路径与后端不匹配：
- 前端请求：`/api/admin/models` → 后端**没有**这个路由
- 后端实际路由：`/api/epet/models` ✅ 返回正确数据
- 请求被后端 catch-all 拦截，返回了 HTML 而非 JSON

## 修复
1. **CompanionList.tsx**：
   - API: `/api/admin/models` → `/api/epet/models`
   - 数据解析: `data.data` → `data.models`（匹配 epet.js 返回格式）
2. **CompanionEdit.tsx**：
   - API: `/api/admin/models/${id}` → `/api/epet/models` + 前端 find 过滤

## 部署
- 本地 npm run build 成功
- SCP 上传到 /var/www/iot-ai-doll/frontend/admin2/
- HTTPS 验证 200 OK

## 经验教训
- 前端 API 路径必须与后端 index.js 中注册的路由完全一致
- 后端路由注册清单：/api/db, /api/admin/rag-kbs, /api/epet, /api/game-assets 等
- 新增功能时先确认后端有对应路由再写前端
