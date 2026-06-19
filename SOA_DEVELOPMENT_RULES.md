# SOA 开发规范 (v1.0)

> 每次代码变更后部署前，必须先 sync 到 git，再运行 deploy.sh

---

## ⚠️ 部署前必检查清单

```bash
cd /var/www/iot-ai-doll/repo

# 1. 确认没有未提交的更改（否则 stash → pull → stash pop）
git status

# 2. 有更改时：
git stash && git pull --rebase && git stash pop

# 3. 然后运行部署
bash deploy.sh
```

---

## 📁 目录结构

```
/var/www/iot-ai-doll/
├── repo/                    # Git 仓库（主代码）
│   ├── deploy.sh            # 统一部署脚本 (v7.1)
│   ├── iot-ai-doll-frontend/  # 前台 + 管理后台
│   ├── epet1/               # 绒绒庭院游戏
│   └── iot-sql/             # 测试页面
├── frontend/
│   └── dist/                # 构建输出（不要直接修改）
│       ├── index.html       # 根首页 → 艾瑟拉冒险
│       ├── admin/           # 管理后台
│       └── epet/            # 绒绒庭院
├── backend/                 # Node.js 后端
│   └── src/index.js
└── uploads/                 # 用户上传文件（不在 git 内）
```

---

## 🔑 各项目 base 路径

| 项目 | base | 构建命令 |
|------|------|---------|
| 根首页 (艾瑟拉冒险) | `/` | `base: "/"` |
| 管理后台 | `/admin/` | `base: "/admin/"` |
| 绒绒庭院 | `/epet/` | `base: "/epet/"` |

---

## 🚀 常见操作

### 首次部署（或故障后）
```bash
# 检查 Node 版本
node --version  # 需要 v20+

# 检查 PM2 进程
pm2 list

# 重启后端
pm2 restart epet1-backend
pm2 restart iot-backend
```

### 修改代码后部署
```bash
cd /var/www/iot-ai-doll/repo
git stash              # 先暂存本地更改
git pull --rebase      # 拉取最新代码
git stash pop          # 恢复本地更改
bash deploy.sh          # 部署
```

### 查看部署日志
```bash
ls /var/www/iot-ai-doll/repo/.deploy-logs/
cat /var/www/iot-ai-doll/repo/.deploy-logs/deploy_最近.log
```

### 回滚到上一个备份
```bash
# 找到上一个备份
ls /var/www/iot-ai-doll/frontend/dist.backup_*/

# 恢复
cp -r /var/www/iot-ai-doll/frontend/dist.backup_xxx/* /var/www/iot-ai-doll/frontend/dist/
```

---

## 🔐 Git 使用规范

### Commit 消息格式
```
<type>(<scope>): <subject>

type: feat | fix | docs | style | refactor | test | chore
scope: deploy | admin | epet | backend
```

### 推送（需要 GitHub token）
```bash
git push origin main
```

---

## 📝 重要文件路径

- 管理后台入口: https://soa.laziestlife.com/admin/
- 绒绒庭院: https://soa.laziestlife.com/epet/
- 素材管理: 管理后台 → 左侧菜单
- 机伴管理 5 层提示词: 管理后台 → 机伴管理 → 编辑 → 提示词版本

---

## 🐛 已知问题

1. **vite.config.ts 污染**：构建时动态写入，构建完后可能残留硬编码路径，下次构建前确保 vite.config.ts 是干净的
2. **上传素材路径**：用户上传的素材存储在 `dist/epet/assets/`——未来需要迁移到 `/var/www/iot-ai-doll/uploads/` 以避免部署覆盖
3. **deploy.sh v6 之前版本有 glob 展开 bug**：使用 v7.1+，确保 `cp -r "$TEMP_BUILD/root/."` 使用 `/.` 语法
