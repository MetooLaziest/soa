# DEVELOPMENT_RULES.md - SOA 项目研发规范

**版本**: v1.0  
**生效日期**: 2026-06-05  
**适用范围**: SOA (iot-ai-doll, E-Pet, 所有相关项目)

---

## 规则1: 本地备份机制 📦

### 1.1 备份触发时机
**必须备份**：
- 每次部署前
- 重大修改前（数据库迁移、重构、删除文件）
- 创建新功能分支前

**无需备份**：
- 用户明确说【封板】
- 小改动（单行修改、文案调整）

### 1.2 备份位置
```
~/.qclaw/workspace/backups/
├── YYYY-MM-DD/           # 按日期归档
│   ├── pre-deploy/       # 部署前备份
│   ├── pre-migration/    # 数据库迁移前
│   └── pre-refactor/     # 重构前
└── LATEST/               # 始终指向最新备份
```

### 1.3 备份内容
- 后端代码：`/var/www/iot-ai-doll/backend/src/`
- 前端构建：`/var/www/iot-ai-doll/frontend/dist/`
- 数据库：自动 `pg_dump`
- 配置文件：Nginx、PM2、环境变量

### 1.4 自动化脚本
```bash
# 执行备份
./scripts/backup.sh

# 恢复备份
./scripts/restore.sh YYYY-MM-DD
```

---

## 规则2: 【封板】流程 🔒

### 2.1 【封板】含义
当用户说【封板】时，意味着：
1. 当前版本已稳定可用
2. 可以清除**此版本之前**的备份文件
3. 但保留：当前版本 + 最近 3 个版本
4. 必须写入 `CHANGELOG.md`

### 2.2 【封板】操作流程
```bash
# 1. 标记当前版本
git tag -a v1.2.3 -m "封板：描述本次稳定版本"

# 2. 写入 CHANGELOG.md
# 自动生成或手动编辑

# 3. 清理旧备份（保留最近3个）
./scripts/cleanup-backups.sh --keep=3

# 4. 推送到 GitHub
git push origin main --tags
```

### 2.3 禁止清除的情况
- 未标记【封板】的版本
- 最近 3 个版本
- 有 `CHANGELOG.md` 记录的版本

---

## 规则3: 版本控制（Git + GitHub）🔧

### 3.1 分支策略（GitHub Flow）
```
main (生产环境)
  ↑
dev (测试环境)
  ↑
feature/xxx (开发分支)
```

**分支命名规范**：
- 新功能：`feature/rag-knowledge-base`
- 修复：`fix/epet-chat-timeout`
- 重构：`refactor/backend-api`
- 热修复：`hotfix/critical-bug`

### 3.2 Commit Message 规范
采用 **Conventional Commits**：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**示例**：
```
feat(epet): 添加 RAG 知识库管理功能

- 新增 RAG 知识库 CRUD API
- 修改聊天接口支持 temperature 参数
- 前端添加 RAG 管理页面

Closes #123
```

**Type 列表**：
- `feat`: 新功能
- `fix`: 修复 bug
- `refactor`: 重构
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `test`: 测试相关
- `chore`: 构建/工具链修改

### 3.3 GitHub 工作流
```bash
# 1. 创建功能分支
git checkout -b feature/rag-knowledge-base

# 2. 开发 + 提交
git add .
git commit -m "feat(epet): 添加 RAG 知识库 API"

# 3. 推送到 GitHub
git push origin feature/rag-knowledge-base

# 4. 创建 Pull Request
# 在 GitHub 上操作

# 5. Code Review + Merge
# 合并到 dev → main

# 6. 打标签（封板时）
git tag -a v1.2.3 -m "封板：v1.2.3"
git push origin --tags
```

---

## 规则4: 部署流程 🚀

### 4.1 标准部署流程
```bash
# 1. 备份（规则1）
./scripts/backup.sh

# 2. 构建前端
cd /path/to/frontend
npm run build

# 3. 上传到服务器
scp -r dist/* root@47.98.103.151:/var/www/iot-ai-doll/frontend/dist/

# 4. 重启后端（如需要）
ssh root@47.98.103.151 "pm2 restart iot-backend"

# 5. 验证
curl -I https://soa.laziestlife.com/

# 6. 如果失败，立即回滚
./scripts/restore.sh YYYY-MM-DD
```

### 4.2 紧急回滚流程
```bash
# 1. 立即停止服务
ssh root@47.98.103.151 "pm2 stop iot-backend"

# 2. 恢复备份
./scripts/restore.sh YYYY-MM-DD

# 3. 重启服务
ssh root@47.98.103.151 "pm2 start iot-backend"

# 4. 通知用户
echo "已回滚到版本 YYYY-MM-DD"
```

---

## 规则5: 代码审查 🔍

### 5.1 自查清单（提交前）
- [ ] 代码能编译/构建通过
- [ ] 核心功能已测试
- [ ] 没有硬编码的密码/Token
- [ ] 敏感信息已用环境变量
- [ ] 添加了必要的注释
- [ ] 更新了相关文档

### 5.2 Code Review 要点
- **安全性**：SQL 注入、XSS、权限验证
- **性能**：数据库查询优化、缓存策略
- **可维护性**：代码可读性、模块化
- **兼容性**：API 向后兼容

---

## 规则6: 数据库管理 🗄️

### 6.1 迁移脚本规范
- 每个迁移必须有 `up` 和 `down` 两个操作
- 迁移前必须备份数据库
- 迁移脚本命名：`YYYYMMDD_description.sql`

**示例**：
```sql
-- 20260605_add_rag_tables.sql

-- up
CREATE TABLE rag_knowledge_bases (...);
CREATE TABLE pet_model_rag_kbs (...);

-- down
DROP TABLE IF EXISTS pet_model_rag_kbs;
DROP TABLE IF EXISTS rag_knowledge_bases;
```

### 6.2 数据备份
```bash
# 自动备份（每天凌晨2点）
0 2 * * * /path/to/scripts/backup-db.sh

# 手动备份
pg_dump -U postgres epet > backups/YYYY-MM-DD/epet.sql
```

---

## 规则7: 环境配置 🔧

### 7.1 环境变量管理
- **禁止**在代码中硬编码密码/Token
- 使用 `.env` 文件（添加到 `.gitignore`）
- 示例：`.env.example`（提交到 Git，但不包含真实值）

### 7.2 多环境配置
```
.env.development   # 开发环境
.env.staging        # 测试环境
.env.production     # 生产环境
```

---

## 规则8: 文档维护 📝

### 8.1 必须更新的文档
- `CHANGELOG.md`：版本变更记录（封板时更新）
- `README.md`：项目概述和快速开始
- `API.md`：API 接口文档
- `DEVELOPMENT_RULES.md`：本文档（规则变更时更新）

### 8.2 文档更新时机
- 新增 API → 更新 `API.md`
- 版本发布 → 更新 `CHANGELOG.md`
- 规则变更 → 更新 `DEVELOPMENT_RULES.md`

---

## 附录A: 常用脚本 📜

### A.1 备份脚本（backup.sh）
见 `scripts/backup.sh`

### A.2 恢复脚本（restore.sh）
见 `scripts/restore.sh`

### A.3 部署脚本（deploy.sh）
见 `scripts/deploy.sh`

---

## 附录B: 紧急情况联系人 🆘

**服务器故障**：
- IP: 47.98.103.151
- 用户名: root
- 密码: (见密码管理器)

**GitHub 仓库**：
- 仓库名: SOA
- URL: https://github.com/<username>/SOA

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-06-05 | 初始版本 | QClaw |

---

**本规则自发布之日起生效，所有团队成员必须遵守。**
