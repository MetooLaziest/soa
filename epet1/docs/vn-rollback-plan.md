# vn.laziestlife.com 回滚预案

> **目的**: 满足 [[feedback-nfc-must-stay-on-soa]] + 用户的"绝对保证遇到问题有办法回滚"
> **范围**: vn.laziestlife.com 越南语 PoC 部署 (Phase 0-7 已完成)
> **生效日期**: 2026-08-02
> **目标读者**: 7x24 应急 on-call 工程师 (代号: "羊驼")

---

## 1. 现状速查 (Phase 7 E2E 验证后, 2026-08-02 11:33)

| 维度 | 状态 | 关键指纹/路径 |
|---|---|---|
| **soa dist** | ✅ 在线, 16KB+ 完整 | `/var/www/iot-ai-doll/frontend/dist/epet/` |
| **soa 备份 (灾难兜底)** | ✅ 完整 MD5 指纹 | `/var/www/iot-ai-doll/frontend/dist.soa.backup.20260801/` + `.MD5` |
| **vn dist** | ✅ 6 文件 (1.8KB index + assets/ + icons.svg) | `/var/www/iot-ai-doll/frontend/dist.vn/` |
| **vn nginx config** | ✅ enabled | `/etc/nginx/sites-enabled/vn.laziestlife.com.conf` (md5: `adb0f4dfbdefeadafba43395573785d2`) |
| **vn 证书** | ✅ valid 89 天 | `/etc/letsencrypt/live/vn.laziestlife.com/` (exp 2026-10-31) |
| **DNS** | ✅ 47.98.103.151 | `getent hosts vn.laziestlife.com` ✅ |
| **后端** | ✅ PM2 iot-backend online | pid 250393, 3D uptime, 6 restarts, 171MB |
| **soa NFC `?id=9527`** | ✅ 0 风险 | 走 soa.laziestlife.com, 跟 vn 物理隔离 |
| **git HEAD** | a12ff55 (2 commits 领先 origin/main) | 7b71c6b (vite env) → a12ff55 (?code=9527 demo) |
| **i18n 源** | ✅ 3 文件就位 | `src/i18n/{index.ts, useT.ts, locales/{zh,vi}.json}` |

---

## 2. 三档回滚方案 (按紧急程度选)

### 🚨 方案 A: 单 commit 回滚 (粒度最细, 推荐首选)

**适用场景**: Phase 2 批 1/2/3/4 的某个 commit 改坏 soa 业务, 已知具体 commit sha

**预计耗时**: 3-5 分钟

**前置**: 已 `git log` 确认要 revert 的 commit sha (例如 `a12ff55` 或 `7b71c6b`)

#### 步骤

```bash
# 0. 桥接到源服 (47.98.103.151, 见 [[44-bridge-server-architecture]])
source /tmp/bridge.sh

# 1. git revert 单 commit (--no-commit 保留手动审查)
bridge "cd /var/www/iot-ai-doll/repo/epet1 && git revert --no-commit a12ff55 2>&1; echo EXIT=\$?"
# 审查冲突 → 编辑修复 → git commit

# 2. 重 build soa dist (用 reverted 源码)
bridge "cd /var/www/iot-ai-doll/repo/epet1 && export PATH=/usr/local/lib/node20/bin:\$PATH && VITE_LOCALE=zh npm run build -- --outDir dist 2>&1 | tail -20; echo EXIT=\$?"
# 注: dist/ 是 soa 域主用, 覆盖前会先备份 (见步骤 3)

# 3. 部署前先备份当前 dist (兜底 + 可再次回滚)
bridge "cp -a /var/www/iot-ai-doll/frontend/dist /var/www/iot-ai-doll/frontend/dist.epet.backup.pre_revert_\$(date +%Y%m%d_%H%M%S) 2>&1; echo EXIT=\$?"

# 4. 复制新 dist 到 nginx 路径 (soa 域直接读 dist/epet/)
#    Vite build --outDir dist 输出到 repo/epet1/dist/, cp 到 frontend/dist/
bridge "rm -rf /var/www/iot-ai-doll/frontend/dist && cp -a /var/www/iot-ai-doll/repo/epet1/dist /var/www/iot-ai-doll/frontend/ 2>&1; echo EXIT=\$?"

# 5. 字节级验证 (跟 dist.soa.backup.20260801.MD5 对比)
bridge "cd /var/www/iot-ai-doll && find frontend/dist -type f -exec md5sum {} \; | sort > /tmp/dist_post_revert.md5 && diff frontend/dist.soa.backup.20260801.MD5 /tmp/dist_post_revert.md5 2>&1 | head -30; echo EXIT=\$?"
# ↑ diff 应只显示构建 hash 差异 (例如 index-XXXX.js → index-YYYY.js),
#   业务代码文件 index.html / sw.js / manifest.webmanifest 应字节级一致

# 6. 烟测 soa NFC 演示 (必须 200 + 庭院渲染)
curl -sI https://soa.laziestlife.com/?id=9527 | head -3  # 必须 200
# 浏览器烟测 (见 §5 5分钟检查清单)

# 7. git push revert commit (让 origin/main 跟远端对齐)
bridge "cd /var/www/iot-ai-doll/repo/epet1 && git push origin main 2>&1; echo EXIT=\$?"
```

**回滚对 vn 的影响**: **0**
- vn 域独立 build 产物在 `dist.vn/`, 跟 `dist/` (soa) 物理隔离
- vn nginx config 跟 soa 走不同 server block
- revert 改的是 `src/` 源码, 不影响 `dist.vn/` 现有产物
- **唯一副作用**: 如果 revert 的 commit 改了 i18n keys, 下次 `npm run build` vn 时, vi.json 缺 key 会触发 useT fallback 显示中文 (符合预期)

---

### 🔥 方案 B: vn 域全拆 (中等粒度, 适用于 vn 域问题)

**适用场景**: vn 域上线后有重大 bug (例如演示时崩溃, 翻译严重错误, 证书异常), 但 soa 完全正常

**预计耗时**: 2-3 分钟

**核心思路**: vn 域物理隔离, 拆掉 nginx 即可, soa 0 感知

#### 步骤

```bash
source /tmp/bridge.sh

# 1. 禁用 vn 域 nginx (soa 仍正常)
bridge "rm /etc/nginx/sites-enabled/vn.laziestlife.com.conf && nginx -t 2>&1 && nginx -s reload 2>&1; echo EXIT=\$?"

# 2. 验证: vn 域 404/不可达, soa 域正常
curl -sI https://soa.laziestlife.com/?id=9527 2>&1 | head -3  # 必须 200
curl -sI https://vn.laziestlife.com 2>&1 | head -3             # 必须 connection refused / cert error
# ↑ 客户端看到 "无法连接" 比 "看到 500" 更安全

# 3. (可选) 保留 dist.vn/ 给后续排查, 不要立刻删
#    想彻底清: rm -rf /var/www/iot-ai-doll/frontend/dist.vn

# 4. (可选) 撤销 cert
#    certbot delete --cert-name vn.laziestlife.com

# 5. 修复后重建:
#    - 改源码 → git commit → git push
#    - VITE_LOCALE=vi VITE_DEMO_BY_CODE=true VITE_BASE=/ npm run build -- --outDir dist-vn
#    - cp -a repo/epet1/dist-vn /var/www/iot-ai-doll/frontend/dist.vn
#    - ln -sf /etc/nginx/sites-available/vn.laziestlife.com.conf /etc/nginx/sites-enabled/
#    - nginx -s reload
```

**回滚对 soa 的影响**: **绝对 0**
- 物理目录分离: `dist/` (soa) / `dist.vn/` (vn) 互不干扰
- nginx config: vn server block disable 不影响 soa server block
- cert: vn 独立 cert, 跟 soa cert 无关
- DNS: 即使 DNS 还指向 47.98.103.151, 没有 nginx server block 就直接 connection refused

---

### 💣 方案 C: 灾难兜底 (最后手段, 全部推平重来)

**适用场景**: 服务器被破坏 / 数据中心迁移 / 团队决定完全废弃 vn PoC

**预计耗时**: 5-10 分钟

#### 步骤

```bash
source /tmp/bridge.sh

# 1. 禁用 vn 域 (跟方案 B 步骤 1 一样)
bridge "rm /etc/nginx/sites-enabled/vn.laziestlife.com.conf && nginx -s reload 2>&1"

# 2. 删 vn 域所有痕迹
bridge "
  rm -rf /var/www/iot-ai-doll/frontend/dist.vn
  rm -f /etc/nginx/sites-available/vn.laziestlife.com.conf
  certbot delete --cert-name vn.laziestlife.com --non-interactive
  echo 'vn artifacts purged'
"

# 3. 恢复 soa dist (从 7/30 备份 dist.soa.backup.20260801)
bridge "
  rm -rf /var/www/iot-ai-doll/frontend/dist
  cp -a /var/www/iot-ai-doll/frontend/dist.soa.backup.20260801 /var/www/iot-ai-doll/frontend/dist
  echo 'soa dist restored from 20260801 backup'
"

# 4. 字节级验证 soa 跟原始 Phase 0 备份一致
bridge "
  cd /var/www/iot-ai-doll
  find frontend/dist -type f -exec md5sum {} \; | sort > /tmp/dist_disaster.md5
  diff frontend/dist.soa.backup.20260801.MD5 /tmp/dist_disaster.md5
  # ↑ 应为 0 差异 (完全字节级一致)
"

# 5. 烟测 soa
curl -sI https://soa.laziestlife.com | head -3  # 200
curl -sI 'https://soa.laziestlife.com/?id=9527' | head -3  # 200

# 6. (可选) git revert 所有 vn 相关 commits
bridge "cd /var/www/iot-ai-doll/repo/epet1 && git revert --no-commit a12ff55 7b71c6b 2>&1; git commit -m 'revert: 全部 vn PoC 改动' 2>&1; git push origin main 2>&1"
```

**回滚后状态**:
- soa 域: 100% Phase 0 状态 (字节级一致, 跟 8/1 备份相同)
- vn 域: 完全消失, DNS 仍指向 47.98.103.151 但 nginx 无 server block → connection refused
- git: HEAD 跟 origin/main 对齐, 所有 vn 相关 commit 都被 revert

---

## 3. MD5 字节级验证命令 (一键脚本)

**写一个回滚用 MD5 对比脚本到容器** (羊驼 7x24 应急用):

```bash
cat > /tmp/verify_soa_byte_level.sh <<'EOF'
#!/bin/bash
# 字节级验证 soa dist 跟 20260801 备份一致
set +e
SRC=/var/www/iot-ai-doll/frontend/dist
REF=/var/www/iot-ai-doll/frontend/dist.soa.backup.20260801
MD5_REF=/var/www/iot-ai-doll/frontend/dist.soa.backup.20260801.MD5

echo "=== Step 1: 文件数对比 ==="
echo "current: $(find $SRC -type f | wc -l) files"
echo "backup:  $(find $REF -type f | wc -l) files"

echo ""
echo "=== Step 2: MD5 指纹对比 (按文件名归一化) ==="
(cd $SRC && find . -type f -exec md5sum {} \; | sed 's| \./|  |' | sort -k2) > /tmp/cur.md5
(cd $REF && find . -type f -exec md5sum {} \; | sed 's| \./|  |' | sort -k2) > /tmp/ref.md5
diff /tmp/cur.md5 /tmp/ref.md5
echo "diff_exit=$?"

echo ""
echo "=== Step 3: 业务关键文件字节级验证 ==="
for f in index.html manifest.webmanifest sw.js; do
  if [ -f "$SRC/$f" ]; then
    md5sum "$SRC/$f" "$REF/$f" 2>/dev/null
  else
    echo "WARN: $f not found in current dist"
  fi
done

echo ""
echo "=== Step 4: 反混淆 spot check (业务关键字符串) ==="
grep -l "扫描 NFC 激活" "$SRC"/epet/assets/*.js 2>&1 | head -3
grep -l "MoMo庭院" "$SRC"/epet/assets/*.js 2>&1 | head -3
echo "spot_check_exit=$?"
EOF
chmod +x /tmp/verify_soa_byte_level.sh
```

**使用**:

```bash
source /tmp/bridge.sh
bridge "bash -s < /tmp/verify_soa_byte_level.sh"
```

**预期输出**:
- Step 1: 文件数一致 (一般 30-50 个, 含 assets/ 里的 index-XXXX.js 等)
- Step 2: diff 0 差异 OR 只显示构建 hash 文件名变更 (index-AbCdE.js → index-XyZwF.js), 业务文件 index.html / sw.js / manifest.webmanifest **必须 0 差异**
- Step 3: 关键文件 md5 一致
- Step 4: 业务字符串存在 (说明 vite 没意外 minify 掉)

---

## 4. 5 分钟烟测清单 (回滚后必跑)

```bash
source /tmp/bridge.sh

echo "=== 1. soa HTTPS root 200 ==="
curl -sI https://soa.laziestlife.com/ | head -3
# 期望: HTTP/2 200

echo "=== 2. soa NFC 演示 ?id=9527 ==="
curl -sI 'https://soa.laziestlife.com/?id=9527' | head -3
# 期望: HTTP/2 200, 含 "MoMo庭院" 字符串

echo "=== 3. soa 业务字符串 spot check ==="
curl -s 'https://soa.laziestlife.com/?id=9527' | grep -oE 'MoMo庭院|绒绒庭院|扫描 NFC 激活' | head -3
# 期望: 输出 "MoMo庭院" 和 "扫描 NFC 激活", 不应有 "绒绒庭院"

echo "=== 4. soa 静态资源 (一个 assets 文件) ==="
curl -sI https://soa.laziestlife.com/epet/assets/index.html 2>&1 | head -3
# 期望: 200 或合理 (具体看 vite 产物)

echo "=== 5. soa API 走 soa 后端 ==="
curl -s https://soa.laziestlife.com/api/health | head -1
# 期望: {"status":"ok","time":"..."}

echo "=== 6. vn 域 (如果方案 B 后) ==="
if [ -f /etc/nginx/sites-enabled/vn.laziestlife.com.conf ]; then
  curl -sI https://vn.laziestlife.com/ | head -3
  curl -sI 'https://vn.laziestlife.com/?code=9527' | head -3
  # 期望: 200, 1812 字节
else
  echo "vn 已禁用, 跳过"
fi

echo "=== 7. 后端 PM2 状态 ==="
pm2 jlist 2>&1 | grep -E '"name"|"status"' | head -5
# 期望: iot-backend online
```

**Playwright 烟测 (高级)**:

```bash
# 启动 browser, 打开 soa NFC 演示页
agent-browser open "https://soa.laziestlife.com/?id=9527" --annotate
# 验证: 庭院渲染 + 宠物激活 + 0 [missing] 字样
agent-browser snapshot -i | head -20  # 检查庭院 UI 元素
```

---

## 5. 紧急联系人 + 升级路径

| 级别 | 场景 | 响应人 | 时限 |
|---|---|---|---|
| **L1** | 单个 commit 业务回滚 (方案 A) | on-call 羊驼 | 5 分钟 |
| **L2** | vn 域拆掉 (方案 B) | on-call 羊驼 | 3 分钟 |
| **L3** | 灾难兜底 (方案 C) | on-call 羊驼 + 项目负责人 | 15 分钟 |
| **L4** | 服务器物理损坏 | 阿里云工单 + 备案服务器备件 | 1-4 小时 |

**L1/L2 自助处理**:
- on-call 羊驼已有 `/tmp/bridge.sh` + `/tmp/verify_soa_byte_level.sh`
- 必跑 §4 5 分钟烟测清单
- 完成 30 分钟内写 memory 记录事件

**L3 触发条件**:
- 服务器 `pm2 jlist` 返回空 / `nginx -t` 报错
- soa 主流程 (登录/激活/庭院) 3 个以上核心功能同时坏
- 数据库连接失败 (PG 不可达)

**L4 触发条件**:
- 服务器 SSH 完全不可达 + 控制台无响应
- 阿里云控制台显示 ECS 停止 / 故障

---

## 6. 关键文件清单 (回滚时定位用)

### 服务器路径
```
/var/www/iot-ai-doll/
├── repo/epet1/                           # 源码仓
│   ├── src/i18n/                         # i18n 配置 (index.ts + useT.ts + locales/)
│   ├── src/App.tsx                       # 2943 行大文件
│   ├── src/store/authStore.ts            # VITE_DEMO_BY_ID/SOA_BY_CODE 分支
│   ├── package.json                      # i18next 23.16.8 + react-i18next 14.1.3
│   └── vite.config.ts                    # env-aware (VITE_BASE/VITE_OUT_DIR)
├── frontend/
│   ├── dist/                             # soa 域主用, vite build 直接覆盖
│   ├── dist.vn/                          # vn 域主用, 独立 build 产物
│   ├── dist.soa.backup.20260801/         # 7/30 Phase 0 备份
│   ├── dist.soa.backup.20260801.MD5      # 备份指纹
│   ├── dist.epet.backup.20260802_112648/ # Phase 6 备份
│   └── dist.epet.backup.20260802_phase6/ # Phase 6 备份 (不同时间戳)
└── backend/                              # 共享后端, vn 走 127.0.0.1:3000

/etc/nginx/sites-available/
├── momotoy-fun.conf                      # soa + op + admin 主配置
└── vn.laziestlife.com.conf               # vn 域独立 config (md5: adb0f4dfbdefeadafba43395573785d2)

/etc/letsencrypt/live/
├── soa.laziestlife.com/                  # soa 证书
├── op.laziestlife.com/                   # op 内部 admin 证书
└── vn.laziestlife.com/                   # vn 证书 (exp 2026-10-31)
```

### 容器路径 (回滚工具)
```
/tmp/bridge.sh                             # 桥接 wrapper (X-Signature 头)
/tmp/verify_soa_byte_level.sh              # 字节级验证脚本
/tmp/phase7_e2e.sh                         # E2E 7 项验收
/tmp/phase8_rollback.md                    # 本文档
/tmp/inventory_for_phase8.sh                # 状态盘点 (本 doc 起草用)
```

### git 关键 commits
```
a12ff55  feat(vn): add ?code=9527 demo entry (VITE_DEMO_BY_CODE gated, soa 0 变化)
7b71c6b  build(vn): vite.config.ts env-aware (default = soa 行为零变化)
<前一个>  i18n 批 4d (App.tsx 2001-2943 行)
<前一个>  i18n 批 4c (App.tsx 1001-2000 行)
<前一个>  i18n 批 4b (App.tsx 1-1000 行)
<前一个>  i18n 批 4a (LivePage.tsx)
<前一个>  i18n 批 3 (IntroVideoPlayer + LoginOverlay)
<前一个>  i18n 批 2 (OutfitPanel/PetAction/FishingResult/FishingProgress)
<前一个>  i18n 批 1 (PwaInstallHint/SettingsModal/HUD/IconImg)
58e051b  baseline (iOS PWA query strip)
```

---

## 7. 已知陷阱 (回滚时避开)

### 坑 1: bridge forbidden (X-Signature 头)
**症状**: `bridge` 命令返回 `{"error":"forbidden"}`
**根因**: 用了 `X-Coze-Bridge-Signature` 或 `X-Bridge-Signature` 头
**修法**: 必须用 `X-Signature` 头 (HMAC-SHA256 of body), 见 [[44-bridge-server-architecture]]

### 坑 2: bridge 60s timeout
**症状**: 长时间命令 (例如 `npm run build`) 5 分钟后被强杀
**根因**: bridge 有 60s 内部 timeout
**修法**: 写脚本到磁盘 + 短 cmd 调起 (见 [[33-bridge-cmd-length-threshold]] 双 b64 配方)
**示例**:
```bash
# 错: 直接传长 cmd
bridge "cd repo && npm install && npm run build && cp ..."  # timeout

# 对: 写脚本到磁盘
bridge "cat > /tmp/build_vn.sh << 'EOF'
#!/bin/bash
cd /var/www/iot-ai-doll/repo/epet1
export PATH=/usr/local/lib/node20/bin:$PATH
VITE_LOCALE=vi VITE_DEMO_BY_CODE=true npm run build -- --outDir dist-vn
cp -a dist-vn /var/www/iot-ai-doll/frontend/dist.vn
EOF
chmod +x /tmp/build_vn.sh && nohup /tmp/build_vn.sh > /tmp/build_vn.log 2>&1 &"
# ↑ 不等返回, 后台跑
```

### 坑 3: 非零 exit 误判失败
**症状**: bridge 返回 `Command failed` 但实际成功
**根因**: [[33-bridge-cmd-length-threshold]] 提到非零 exit code 会被算失败
**修法**: 末尾加 `; echo EXIT=$?` 让 exit 始终是 0 (但只对 last cmd 有效)

### 坑 4: try_files $uri/ 触发 403
**症状**: `/admin/` 返回 403 而不是 404
**根因**: nginx `$uri/` 触发空目录列表
**修法**: 改为 `try_files $uri /index.html;` (去掉 `$uri/`)
**vn config 已修**: 验证 md5 `adb0f4dfbdefeadafba43395573785d2` 的 config 文件已无此坑

### 坑 5: 容器 Write ≠ 服务器落盘
**症状**: 在容器里 Write/Edit 文件后, 服务器上找不到
**根因**: [[39-ssh-only-write-server-paths]] 容器 CWD 跟服务器物理隔离
**修法**: 写脚本到 `/tmp/`, 然后 `bridge` 上传到服务器, 绝对不要用 `Write` 写 `/var/www/...` 路径

### 坑 6: i18next fallback 误判
**症状**: vi 域没翻译, 但 UI 显示中文 (不是越南语)
**根因**: useT hook 的 `v === key ? defaultText : v` 逻辑 - 没翻译时返回原文
**修法**: 补 vi.json keys (AI 翻译) 或临时接受 fallback (演示场景可接受)

---

## 8. 后续 (1 个月后 vn 域转 C 端化)

**回滚预案之外** - 1 个月后 vn 域计划转正式 C 端, 需要做:

1. **添加更多语言** (th 泰语 / id 印尼语)
   - 加 `src/i18n/locales/th.json` + `id.json`
   - 修改 `src/i18n/index.ts` 支持多语言构建 (`VITE_LOCALE=th|id|vi|zh`)

2. **vn 域加 `?code=9527` C 端化**
   - 激活码体系复用 (见 [[21-activation-code-naming]])
   - 走 `/api/auth/verify-code` 而不是 demo 路径

3. **DNS 扩展**
   - 加 `th.laziestlife.com` / `id.laziestlife.com` 解析
   - 跟 vn 走同流程: 80 block → certbot → 443 block

4. **重复 Phase 5 nginx + 证书流程**

**回滚预案仍然适用** - 1 个月后新语言上线时, 本文档 §2 三档回滚方案继续生效, 物理隔离架构不变

---

## 9. 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-08-02 | 初稿, Phase 7 E2E 完成后, vn PoC 部署就绪 |

**本文档随每次 vn PoC 重大变更同步更新** - 改了 nginx config / 新增 dist 备份 / i18n 基础设施变动, 都需更新本文档
