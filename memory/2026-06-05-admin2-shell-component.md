# Admin2 "页面加载中..." 根因修复 (00:04-00:07)

## 问题
Admin2 页面显示"页面加载中..."，数据不显示。Console 无报错。

## 根因（两层问题）

### 第1层：App.tsx 使用硬编码空壳组件
```tsx
// App.tsx 原代码
const CompanionsPage: React.FC = () => 
  <div><h1>宠物型号管理</h1><p>页面加载中...</p></div>;
```
**根本没有 import 真正的 CompanionList.tsx 组件！** 之前修改 CompanionList.tsx 的 API 路径完全无效，因为根没有被引用。

### 第2层：API 路径不匹配（次要）
CompanionList.tsx 中 `/api/admin/models` → 应为 `/api/epet/models`

### 第3层：RAGList.tsx import 报错
`RAGKnowledgeBase` interface 从 rag.ts import 时 Vite/Rolldown 报 MISSING_EXPORT 错误（可能是 rolldown 对 interface export 的 bug）。解决方案：将 interface 内联到 RAGList.tsx。

## 修复操作
1. **App.tsx**：删除硬编码空壳组件，改为 import 真正的页面组件：
   ```tsx
   import CompanionList from './pages/companions/CompanionList';
   import RAGList from './pages/rag/RAGList';
   ```
2. **CompanionList.tsx**：API 路径 `/api/admin/models` → `/api/epet/models`
3. **RAGList.tsx**：interface RAGKnowledgeBase 内联定义，不再从 rag.ts import
4. **删除 api/index.ts**：旧的重复 API 文件

## 验证
- 新 JS 文件名: `index-B9lBmn4-.js`（旧版 `index-BIaaBC89.js`）
- JS 中包含 `api/epet/models` 字符串 ✅
- 部署到服务器成功

## 经验教训
1. **修改源码后一定要检查是否被实际引用** — 空壳组件是最难发现的 bug
2. **Vite content hash 变化 = 代码确实更新了** — 如果 hash 不变说明修改没进入构建
3. **Rolldown (Vite 新打包器) 可能有 interface export 的 bug** — 遇到 MISSING_EXPORT 可尝试内联 type
