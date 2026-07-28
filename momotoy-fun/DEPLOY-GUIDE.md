# momotoy.fun 上线操作指南 (4 步)

> **前置条件**: Plan C 着陆页已部署到源服 (curl 47.98.103.151 返回 10702 bytes ✓)
> **预计总时长**: 3-10 个工作日 (其中 备案 是 7-20 天审核期)

---

## 第 1 步 · DNS 解析 (5 分钟)

登录你的域名注册商 (阿里云 / 腾讯云 / Cloudflare 等), 给 `momotoy.fun` 添加 3 条 A 记录:

| 主机记录 | 记录类型 | 记录值 | TTL |
|---------|---------|-------|-----|
| `@`     | A       | `47.98.103.151` | 600 |
| `www`   | A       | `47.98.103.151` | 600 |
| `dw`    | A       | `47.98.103.151` | 600 |

> 备案期未通过也能解析, 解析 ≠ 备案. 备案前访问 80 端口不会 80→443 重定向, 浏览器地址栏会显示"不安全".

### 验证 (DNS 生效后)
```bash
dig +short momotoy.fun A
dig +short www.momotoy.fun A
dig +short dw.momotoy.fun A
# 期望: 三条都返回 47.98.103.151
```

国内 DNS 生效通常 10-30 分钟, 海外 5 分钟.

---

## 第 2 步 · ICP 备案 (7-20 工作日, .fun 域名)

`.fun` 属于境外注册商 (Namesilo / Porkbun / GoDaddy 等常见), 国内访问需要 ICP 备案才能接入. 流程:

### 2.1 备案服务商选择
- **腾讯云备案**: <https://console.cloud.tencent.com/beian>
- **阿里云备案**: <https://beian.aliyun.com/>
- 选你域名注册时常用的国内云 (有现成账号优先)

### 2.2 备案材料
- 主体: 个人 (身份证正反面 + 人脸核验) 或 企业 (营业执照 + 法人身份证)
- 域名证书: 注册商处下载 PDF (.fun 注册商 Namesilo 的证书获取路径: Account → My Domains → momotoy.fun → 证书)
- 网站用途说明: "个人作品展示 / 品牌官网 / 游戏产品宣传" (通用措辞, 别写游戏运营/支付/交易, 避免触发额外审批)
- 备案服务号: 源服 47.98.103.151 是腾讯云轻量应用服务器, 在控制台 "备案管理" 申请服务号

### 2.3 提交 + 审核
- 提交后 1-2 天腾讯云初审, 通过后短信核验
- 管局审核 7-20 天 (各省不一, 广东 7-10 天常见)
- 通过后备案号格式: 粤ICP备XXXXXXXX号-X

### 2.4 备案号悬挂 (强条)
备案通过后, 网站所有页面底部必须加备案号 + 链接到工信部首页:
```html
<a href="https://beian.miit.gov.cn/" target="_blank">粤ICP备XXXXXXXX号-X</a>
```

当前 `soa/momotoy-fun/www/index.html` 还没加, 备案下来后 **必须补一个 commit** (footer 加一段).

---

## 第 3 步 · SSL 证书 (备案后, 5 分钟)

备案通过后, 用 certbot 一次性签 3 域 SAN 证书:

```bash
# 在源服 47.98.103.151 上
certbot --nginx \
  -d momotoy.fun \
  -d www.momotoy.fun \
  -d dw.momotoy.fun \
  --email you@example.com \
  --agree-tos \
  --no-eff-email
```

certbot 会自动:
1. 校验 DNS (A 记录已生效)
2. 在 `/etc/letsencrypt/live/momotoy.fun-1/` 放证书
3. 修改 `/etc/nginx/sites-available/momotoy-fun.conf`, 加 443 server block + 80→443 重定向
4. 配置自动续期 (systemd timer)

### 验证
```bash
curl -I https://www.momotoy.fun
# 期望: HTTP/2 200, 证书 issuer = Let's Encrypt

# certbot 续期测试
certbot renew --dry-run
```

### 自动续期
certbot 默认装好后会在 `/etc/cron.d/certbot` + systemd timer 跑, 不用手动管. 但建议每季度 `certbot renew --dry-run` 一次确认.

---

## 第 4 步 · nginx 备案后切换 (5 分钟)

备案 + 证书都到位后, 需要把 `momotoy-fun.conf` 从 备案期 (`server_name _;`) 切到 正式态 (`server_name www.momotoy.fun dw.momotoy.fun;`).

**注意**: 如果你用 `certbot --nginx` 跑过, 它已经帮你加好了 443 block + 80→443 跳转. 此时你只需要修一处:

```nginx
# 80 server block 里:
# 旧: server_name _;
# 新:
server_name www.momotoy.fun dw.momotoy.fun;

# 取消 80→443 重定向 (如果想让 80 直通, 也可保留, 看运营需要)
# 一般推荐保留: 浏览器输 http 自动跳 https
```

把 `soa/momotoy-fun/nginx/momotoy-fun.conf` 改完本地提交:
```bash
cd soa
git add momotoy-fun/nginx/momotoy-fun.conf
git commit -m "切 server_name 备案后真实值 + 启用 80→443"
git push origin main
git tag -a "v2026-XX-XX-momotoy-fun-https-active" -m "momotoy.fun 备案后 HTTPS 启用"
```

然后 bridge 同步到源服:
```bash
# 把新 conf 推到源服
bridge "cat > /etc/nginx/sites-available/momotoy-fun.conf" < momotoy-fun.conf
bridge "nginx -t && systemctl reload nginx"
```

### 最终验收
```bash
curl -I https://www.momotoy.fun       # 200
curl -I https://dw.momotoy.fun        # 200
curl -I https://momotoy.fun           # 200 (certbot 自动加的根域跳转)
curl -I http://www.momotoy.fun        # 301 → https
```

---

## 风险与回滚

### 备案期用户访问 .fun 域名
- 浏览器输 `http://www.momotoy.fun` → 80 直通, 显示 Plan C 页面 (有 "不安全" 提示)
- 这不影响源服其他业务 (47.98.103.151 的 IP 直访也命中同一页面)

### 备案驳回常见原因
1. 网站名称包含 "游戏" "交易" 等敏感词 → 改成 "MomoToys 品牌" / "艾瑟拉奇幻谭官网"
2. 主体负责人手机号与注册人手机号不一致 → 同步
3. 域名所有人跟备案主体不一致 → 注册商处把域名过户到自己名下再备

### 备案通过前 SSL 不可用
- Let's Encrypt 校验 HTTP-01 challenge 需要 80 端口可访问
- 备案期 80 端口虽然能开, 但审核员发现没备案会要求你停站
- **建议**: 备案前不开 HTTPS (也不要在 certbot 跑), 备案通过 + 拿到备案号 + 悬挂再开

---

## 时间线预估 (用户视角)

| 步骤 | 耗时 | 你要做的 |
|------|------|---------|
| DNS 解析 | 10-30 分钟 | 登录域名商加 3 条 A 记录 |
| 备案材料准备 | 1-2 小时 | 身份证 / 营业执照 / 域名证书 |
| 腾讯云初审 | 1-2 天 | 等短信核验 |
| 管局审核 | 7-20 天 | 干等 |
| certbot 签 SSL | 5 分钟 | `certbot --nginx -d ...` |
| 切 server_name | 5 分钟 | git commit + bridge reload |
| footer 加备案号 | 5 分钟 | index.html footer 改 + commit |
| **合计** | **8-23 天** | 大头是管局 |

---

## 验收清单 (备案 + HTTPS 全部完成后打勾)

- [ ] `dig +short www.momotoy.fun` → 47.98.103.151
- [ ] `curl -I https://www.momotoy.fun` → 200, issuer=Let's Encrypt
- [ ] 浏览器输 www.momotoy.fun 自动 https + 锁图标
- [ ] footer 出现 "粤ICP备XXXXXXXX号-X" + 链到 beian.miit.gov.cn
- [ ] `certbot renew --dry-run` → success
- [ ] `https://soa.laziestlife.com` → 200 (确认没改坏 soa)
- [ ] `http://47.98.103.151` IP 直访 → 仍是 Plan C 着陆页 (或 301 到 https)

---

**注**: 上面所有命令都假定源服 = 47.98.103.151, 系统 = Ubuntu/Debian nginx 1.18+. 如系统或 nginx 路径不同, 自行调整.
