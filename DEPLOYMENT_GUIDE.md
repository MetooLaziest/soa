# 部署指南 - 防错手册

## ⚠️ 关键规则

### Admin 后台
- **正确目录**: `iot-ai-doll-frontend/` 
- **构建输出**: `dist/admin/`
- **部署目标**: `/var/www/iot-ai-doll/frontend/dist/admin/`
- **❌ 废弃目录**: `admin-frontend/` (已归档为 `admin-frontend.ARCHIVED_20260710`)

### Epet 前台
- **正确目录**: `epet1/`
- **构建输出**: `dist/epet/`
- **部署目标**: `/var/www/iot-ai-doll/frontend/dist/epet/`

### 艾瑟拉首页
- **正确目录**: `iot-ai-doll-frontend/`
- **构建输出**: `dist/` (根目录)
- **部署目标**: `/var/www/iot-ai-doll/frontend/dist/`

---

## 部署检查清单

### 每次部署前必须确认

1. **我在哪个目录？**
   ```bash
   pwd  # 应该是 /.../iot-ai-doll-frontend 或 /.../epet1
   ```

2. **构建产物是否正确？**
   ```bash
   # Admin
   ls dist/admin/assets/index-*.js
   grep -c "机伴系列" dist/admin/assets/index-*.js  # 应该 > 0
   
   # Epet
   ls dist/epet/assets/index-*.js
   ```

3. **不会覆盖根首页？**
   ```bash
   # 检查 tar 包内容
   tar tzf deploy.tar.gz | grep "^index.html"  # 应该为空或 ./admin/index.html
   ```

---

## 快速部署命令

### Admin 后台
```bash
cd /root/.coze/agents/7652659722348331264/workspace/soa/iot-ai-doll-frontend
npm run build
# 然后使用 deploy.sh 或手动上传 dist/admin/
```

### Epet 前台
```bash
cd /root/.coze/agents/7652659722348331264/workspace/soa/epet1
npm run build
# 然后使用 deploy.sh 或手动上传 dist/epet/
```

---

## 危险信号 🚨

如果出现以下情况，**立即停止部署**：

1. 构建产物只有 200KB+ (正确版本应该 700KB+)
2. `grep "机伴系列" dist/admin/assets/index-*.js` 返回 0
3. 菜单项少于 15 个
4. tar 包包含根目录的 `index.html` 或 `assets/`

---

## 紧急回滚

```bash
# Admin 回滚到备份
cp -r /var/www/iot-ai-doll/frontend/dist.backup_20260618_181636/admin \
      /var/www/iot-ai-doll/frontend/dist/

# 根首页回滚
cp /var/www/iot-ai-doll/frontend/dist.backup_20260618_181636/main/index.html \
   /var/www/iot-ai-doll/frontend/dist/index.html
```

---

## 目录结构备忘

```
soa/
├── iot-ai-doll-frontend/   ← ✅ Admin 后台 + 艾瑟拉首页
├── epet1/                   ← ✅ Epet 绒绒庭院
├── admin-frontend.ARCHIVED/ ← ❌ 废弃，勿用
└── iot-ai-doll-backend/     ← 后端 API
```
