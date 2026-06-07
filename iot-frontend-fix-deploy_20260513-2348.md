# IoT/AI 玩偶项目 - 前端修复与部署

## 时间：2026-05-13 23:48

## 目标
修复前端构建失败问题并重新部署，使管理员能正常登录访问后台管理面板。

## 问题诊断

1. **api.ts 括号不匹配**：之前 session 做前端改造（移除 Supabase 依赖，改用自建 API）时，在 api.ts 中添加了 `authApi`、`adminApi` 和 `AdminQueryBuilder` 类，但引入了括号不匹配（最终 depth=-2），导致 esbuild 编译失败。
2. **vite 未安装**：`npm install` 时遇到 `ETXTBSY` 错误（esbuild 二进制被锁定），需要先 kill 旧进程再重装。

## 解决方案

1. 从本地 project.zip 恢复原始 api.ts（254行，使用 supabase，括号平衡）
2. 重新编写 api.ts（263行），在原始游戏 API 基础上添加：
   - `authApi`：fetch 版本的登录/注册/验证/登出 API
   - `adminApi`：管理后台所需的数据查询 API
   - `setAuthToken` / `getAuthToken`：JWT token 管理
3. `supabase.ts` 已被改造成兼容层（从 `./api` 导入 authApi/adminApi/getAuthToken/setAuthToken），无需修改
4. RouteGuard.tsx 和 LoginPage.tsx 在上一轮已修改完成（管理员跳过设备绑定检查）

## 最终文件状态

- `src/db/api.ts` → 263行，depth=0 ✅，导出 authApi/adminApi/setAuthToken/getAuthToken/api
- `src/db/supabase.ts` → 兼容层，import 上面四个导出，暴露 supabase 对象
- `src/components/common/RouteGuard.tsx` → admin 跳过设备绑定，访问/重定向到/admin
- `src/pages/LoginPage.tsx` → admin 登录后跳转到/admin
- `src/context/AuthContext.tsx` → 使用 authApi 进行认证

## 构建结果

- vite build 成功：1944 modules transformed, 3.74s
- 输出：index.html + assets/ (576KB JS, 65KB CSS)
- 部署路径：/var/www/iot-ai-doll/frontend/
- HTTP 状态：200 ✅

## 注意事项

- GamePage/InventoryPage/GalleryPage/AdminMBTI 仍使用原始 `api` 对象（通过 supabase 兼容层）
- 部分管理页面（EnhancedStoryFlowEditor, systemConfig）仍直接导入 supabase，尚未完全迁移到 adminApi
- 这些页面通过 supabase.ts 兼容层可以正常工作（底层调用自建后端）
