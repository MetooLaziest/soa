## 任务背景
将 admin-frontend 的 E-Pet 管理功能（宠物实体/RAG/人设编辑器）合并到旧项目 iot-ai-doll-frontend 中，同时保留全部旧管理页面。

## 执行过程
1. 备份旧项目并检查源码完整性
2. 分析旧项目 UI 风格（Tailwind 暗色风）
3. 将 E-Pet 页面源码拷贝并适配旧 UI
4. 新增路由和菜单项
5. 修复后端缺失表
6. 构建部署并验证

## 关键结果
- 新增 5 个页面：宠物实体管理、4层人设编辑器、RAG关联管理、RAG知识库列表、RAG编辑
- 旧项目 12 项菜单完整保留，新增 🐾宠物实体管理与 📚RAG知识库管理
- 后端修复 pet_model_rag_kbs 表，构建部署成功
- 源码已 git push

## 结论建议
功能已上线可访问 https://soa.laziestlife.com/admin/。后续可扩展更多宠物管理功能。