/**
 * 着陆页 + 站点配置路由 (Plan C)
 * - GET /api/landing  → 返回自包含 HTML 着陆页
 * - GET /api/site-config → 获取站点配置（公开）
 * - POST /api/admin/site-config → 保存站点配置（需 admin）
 *
 * site_config 表 (iot_doll 库, key-value):
 *   key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ
 */
import express from 'express';
import { query } from '../db/pool.js';
import jwtAuth from '../middleware/auth.js';

const router = express.Router();

// ── 默认配置（数据库无记录时的 fallback）──
const DEFAULTS = {
  brand_name: '艾瑟拉奇幻谭',
  title: '欢迎来到艾瑟拉奇幻谭',
  subtitle: '探索奇妙的宠物世界，开启你的冒险之旅',
  bg_image_url: '',
  logo_url: '/favicon.svg',
  epet_button_text: '进入绒绒庭院',
  epet_button_url: '/epet/',
  admin_button_text: '管理后台',
  admin_button_url: '/admin/',
  footer_text: '© 2026 艾瑟拉奇幻谭',
  accent_color: '#6c5ce7',
};

// ── 辅助: 读取配置 ──
async function loadConfig() {
  try {
    const { rows } = await query('SELECT key, value FROM site_config');
    const config = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return { ...DEFAULTS, ...config };
  } catch {
    // 表可能尚未创建
    return { ...DEFAULTS };
  }
}

// ── GET /api/site-config — 获取站点配置 ──
router.get('/site-config', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json({ ok: true, config });
  } catch (error) {
    console.error('loadConfig error:', error);
    res.json({ ok: true, config: DEFAULTS });
  }
});

// ── POST /api/admin/site-config — 保存站点配置 ──
router.post('/admin/site-config', jwtAuth, async (req, res) => {
  try {
    // 校验 admin 权限
    const { rows } = await query('SELECT role FROM profiles WHERE id = $1', [req.user.userId]);
    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: '配置数据无效' });
    }

    // 只允许更新已知 key
    const allowedKeys = Object.keys(DEFAULTS);
    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) continue;
      await query(
        `INSERT INTO site_config (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(value)]
      );
    }

    const config = await loadConfig();
    res.json({ ok: true, config });
  } catch (error) {
    console.error('saveConfig error:', error);
    res.status(500).json({ error: '保存失败' });
  }
});

// ── GET /api/landing — 返回自包含 HTML 着陆页 ──
router.get('/landing', async (req, res) => {
  try {
    const config = await loadConfig();
    const html = renderLandingPage(config);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(html);
  } catch (error) {
    console.error('landing error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ── HTML 渲染 ──
function renderLandingPage(c) {
  const bgStyle = c.bg_image_url
    ? `background-image: url('${escapeAttr(c.bg_image_url)}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(c.brand_name)}</title>
<link rel="icon" type="image/svg+xml" href="${escapeAttr(c.logo_url)}">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
    ${bgStyle} color:#fff;overflow:hidden}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:0}
  .container{position:relative;z-index:1;text-align:center;padding:2rem;max-width:480px;width:100%}
  .logo{width:80px;height:80px;margin:0 auto 1rem;border-radius:50%;background:rgba(255,255,255,0.15);
    backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;font-size:2rem}
  h1{font-size:1.8rem;margin-bottom:0.5rem;text-shadow:0 2px 8px rgba(0,0,0,0.3)}
  .subtitle{font-size:1rem;opacity:0.85;margin-bottom:2rem;text-shadow:0 1px 4px rgba(0,0,0,0.3)}
  .btn{display:block;width:100%;padding:0.85rem 1.5rem;margin:0.6rem 0;border:none;border-radius:12px;
    font-size:1rem;font-weight:600;cursor:pointer;transition:all 0.2s;text-decoration:none;color:#fff}
  .btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.3)}
  .btn:active{transform:translateY(0)}
  .btn-primary{background:${escapeAttr(c.accent_color)}}
  .btn-admin{background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.25)}
  .btn-admin:hover{background:rgba(255,255,255,0.25)}
  .btn-logout{background:rgba(255,255,255,0.08);font-size:0.85rem;padding:0.6rem 1rem;margin-top:1rem}
  .user-info{font-size:0.9rem;opacity:0.8;margin-bottom:1rem}
  .user-info span{color:#ffd700;font-weight:600}
  .login-form{margin-top:1rem}
  .login-form input{display:block;width:100%;padding:0.75rem 1rem;margin:0.4rem 0;border:1px solid rgba(255,255,255,0.25);
    border-radius:10px;background:rgba(255,255,255,0.1);color:#fff;font-size:0.95rem;outline:none;
    backdrop-filter:blur(4px)}
  .login-form input::placeholder{color:rgba(255,255,255,0.5)}
  .login-form input:focus{border-color:${escapeAttr(c.accent_color)};background:rgba(255,255,255,0.15)}
  .error-msg{color:#ff6b6b;font-size:0.85rem;margin:0.5rem 0;min-height:1.2em}
  .footer{position:fixed;bottom:1rem;font-size:0.75rem;opacity:0.5}
  .hidden{display:none!important}
  .loading{opacity:0.6;pointer-events:none}
</style>
</head>
<body>
<div class="overlay"></div>
<div class="container">
  <div class="logo">✨</div>
  <h1>${escapeHtml(c.title)}</h1>
  <p class="subtitle">${escapeHtml(c.subtitle)}</p>

  <!-- 未登录状态 -->
  <div id="guest-view">
    <button class="btn btn-primary" onclick="showLogin()">🔐 登录账号</button>
    <div id="login-form" class="login-form hidden">
      <input type="text" id="username" placeholder="用户名" autocomplete="username">
      <input type="password" id="password" placeholder="密码" autocomplete="current-password">
      <div class="error-msg" id="login-error"></div>
      <button class="btn btn-primary" id="login-btn" onclick="doLogin()">登录</button>
    </div>
    <a href="${escapeAttr(c.epet_button_url)}" class="btn btn-admin" style="margin-top:0.6rem">🎮 ${escapeHtml(c.epet_button_text)}</a>
  </div>

  <!-- 已登录状态 -->
  <div id="user-view" class="hidden">
    <div class="user-info">👋 <span id="display-name"></span></div>
    <a href="${escapeAttr(c.epet_button_url)}" class="btn btn-primary">🎮 ${escapeHtml(c.epet_button_text)}</a>
    <a href="${escapeAttr(c.admin_button_url)}" class="btn btn-admin hidden" id="admin-btn">⚙️ ${escapeHtml(c.admin_button_text)}</a>
    <button class="btn btn-logout" onclick="doLogout()">退出登录</button>
  </div>
</div>
<div class="footer">${escapeHtml(c.footer_text)}</div>

<script>
(function(){
  const API = '/api';
  let currentUser = null;

  // 检查登录状态
  async function checkAuth() {
    const token = localStorage.getItem('landing_token');
    if (!token) return showGuest();
    try {
      const r = await fetch(API + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
      if (!r.ok) throw 0;
      const d = await r.json();
      currentUser = d.user;
      showUser(d.user);
    } catch { localStorage.removeItem('landing_token'); showGuest(); }
  }

  function showGuest() {
    document.getElementById('guest-view').classList.remove('hidden');
    document.getElementById('user-view').classList.add('hidden');
  }

  function showUser(user) {
    document.getElementById('guest-view').classList.add('hidden');
    document.getElementById('user-view').classList.remove('hidden');
    document.getElementById('display-name').textContent = user.username;
    if (user.role === 'admin') document.getElementById('admin-btn').classList.remove('hidden');
  }

  window.showLogin = function() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('username').focus();
  };

  window.doLogin = async function() {
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;
    if (!u || !p) { err.textContent = '请输入用户名和密码'; return; }
    btn.classList.add('loading'); btn.textContent = '登录中...'; err.textContent = '';
    try {
      const r = await fetch(API + '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '登录失败');
      localStorage.setItem('landing_token', d.token);
      currentUser = d.user;
      showUser(d.user);
    } catch(e) { err.textContent = e.message; }
    finally { btn.classList.remove('loading'); btn.textContent = '登录'; }
  };

  window.doLogout = function() {
    localStorage.removeItem('landing_token');
    currentUser = null;
    showGuest();
  };

  // Enter 键提交
  document.getElementById('password').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') window.doLogin();
  });

  checkAuth();
})();
</script>
</body>
</html>`;
}

// ── HTML 转义 ──
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export default router;
