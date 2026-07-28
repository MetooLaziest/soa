# momotoy.fun 双域源码

> **域名**: `momotoy.fun` (用户 2026-07-28 注册, 完全替代 `momotoys.tech`)
> **部署目标**: 源服 47.98.103.151, 跟 `soa.laziestlife.com` 共存
> **规划**: 见 `~/.claude/.../memory/13-momotoys-domain-plan.md`

## 目录结构

```
momotoy-fun/
├── www/                  # 官网 (www.momotoy.fun)
│   ├── index.html        # Plan C 着陆页 (当前)
│   ├── css/style.css     # 单文件样式, 零依赖
│   ├── js/main.js        # nav 高亮 / FAQ 互斥 / 埋点
│   └── assets/favicon.svg
├── dw/                   # 后期承接 soa (dw.momotoy.fun, 占位)
│   └── index.html        # 单页 "即将开放"
├── nginx/
│   └── momotoy-fun.conf  # 双域 server block 模板
└── README.md
```

## 阶段路线

| 阶段 | 内容 | 状态 |
|---|---|---|
| Plan C | 纯 HTML 着陆页 (hero + 4-6 section) | ✅ 当前 |
| Plan B | 升 React (Vite), 接 6 表后端 (3001) | ⏳ Phase 2 |
| Plan A | 接入电商 / 支付 / 物流 | ⏳ 商业化后 |

## 部署

- **本地**: `soa/momotoy-fun/`
- **源服**: `/var/www/momotoy-fun/{www,dw}/`
- **nginx**: `/etc/nginx/sites-available/momotoy-fun.conf` → sites-enabled
- **重启**: `nginx -t && systemctl reload nginx`

## 备案期策略

- 80 端口 `server_name _;`, IP 直访命中
- certbot 备案后跑一次: `certbot --nginx -d momotoy.fun -d www.momotoy.fun -d dw.momotoy.fun`
- 切回真实 `server_name` 即可, DNS 自动分流

## 命名约定

- 包名 / 目录 / 部署路径统一 `momotoy-fun` (kebab-case)
- 域名用 `momotoy.fun` (无 s, no plural)
- 品牌中文: "妈妈玩具" / "MomoToys"
- 游戏中文: "艾瑟拉奇幻谭" / "绒绒庭院"
