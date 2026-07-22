/**
 * EPET1 用户认证路由（手机号注册/登录）
 * POST /api/epet1/auth/register    - 手机号+密码+验证码注册
 * POST /api/epet1/auth/login       - 手机号+密码登录
 * POST /api/epet1/auth/send-code   - 发送短信验证码
 * GET  /api/epet1/auth/verify      - 验证 Token 有效性
 * GET  /api/epet1/auth/me          - 获取当前用户信息
 */
module.exports = (pool) => {
  const router = require('express').Router();
  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcryptjs');

  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  const DEMO_KEY = process.env.DEMO_KEY || '9527';
  const SMS_EXPIRY_MINUTES = 5;

  // ─── 发送验证码 ─────────────────────────────────────────
  router.post('/send-code', async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || !/^1\d{10}$/.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' });
      }

      // 开发环境固定验证码
      const isDev = process.env.NODE_ENV !== 'production';
      const code = isDev ? '123456' : String(Math.floor(100000 + Math.random() * 900000));

      await pool.query(
        `INSERT INTO sms_codes (phone, code) VALUES ($1, $2)`,
        [phone, code]
      );

      if (isDev) {
        console.log(`[DEV] 验证码: phone=${phone}, code=${code}`);
      } else {
        // TODO: 接入腾讯云 SMS SDK 发送真实短信
        console.log(`[SMS] 发送验证码到 ${phone}（生产环境需接入 SMS SDK）`);
      }

      res.json({ success: true, message: isDev ? `验证码: ${code}` : '验证码已发送' });
    } catch (err) {
      console.error('send-code error:', err);
      res.status(500).json({ error: '发送验证码失败' });
    }
  });

  // ─── 验证码校验（内部函数）─────────────────────────────
  async function verifyCode(phone, code) {
    const result = await pool.query(
      `SELECT id FROM sms_codes
       WHERE phone = $1 AND code = $2 AND used = false
       AND created_at > NOW() - INTERVAL '${SMS_EXPIRY_MINUTES} minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [phone, code]
    );
    if (result.rows.length === 0) return false;
    // 标记已使用
    await pool.query('UPDATE sms_codes SET used = true WHERE id = $1', [result.rows[0].id]);
    return true;
  }

  // ─── 注册 ───────────────────────────────────────────────
  router.post('/register', async (req, res) => {
    try {
      const { phone, password, code } = req.body;
      if (!phone || !password || !code) {
        return res.status(400).json({ error: '手机号、密码和验证码不能为空' });
      }
      if (!/^1\d{10}$/.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6位' });
      }

      // 验证码校验
      const codeValid = await verifyCode(phone, code);
      if (!codeValid) {
        return res.status(400).json({ error: '验证码无效或已过期' });
      }

      // 检查手机号是否已注册
      const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: '该手机号已注册' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (openid, phone, password_hash, nickname, role, is_guest)
         VALUES ('phone_' || $1, $1, $2, '玩家', 'user', false)
         RETURNING id, phone, nickname, emotion_points, role`,
        [phone, hashedPassword]
      );

      const user = result.rows[0];
      const token = jwt.sign(
        { userId: user.id, phone: user.phone },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        user: { id: user.id, phone: user.phone, nickname: user.nickname, role: user.role },
        token
      });
    } catch (err) {
      console.error('register error:', err);
      res.status(500).json({ error: '注册失败' });
    }
  });

  // ─── 登录 ───────────────────────────────────────────────
  router.post('/login', async (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ error: '手机号和密码不能为空' });
      }

      const result = await pool.query(
        'SELECT id, phone, password_hash, nickname, emotion_points, role, is_guest FROM users WHERE phone = $1',
        [phone]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: '手机号或密码错误' });
      }

      const user = result.rows[0];
      if (!user.password_hash) {
        return res.status(401).json({ error: '该账号未设置密码，请先注册' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: '手机号或密码错误' });
      }

      // 登录后标记非游客
      if (user.is_guest) {
        await pool.query('UPDATE users SET is_guest = false WHERE id = $1', [user.id]);
      }

      const token = jwt.sign(
        { userId: user.id, phone: user.phone },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        user: { id: user.id, phone: user.phone, nickname: user.nickname, role: user.role },
        token
      });
    } catch (err) {
      console.error('login error:', err);
      res.status(500).json({ error: '登录失败' });
    }
  });

  // ─── 验证 Token ────────────────────────────────────────
  router.get('/verify', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未授权' });
      }
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const result = await pool.query(
        'SELECT id, phone, nickname, role FROM users WHERE id = $1',
        [decoded.userId]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: '用户不存在' });
      }
      res.json({ user: result.rows[0], valid: true });
    } catch (err) {
      res.status(401).json({ error: 'Token 无效或已过期' });
    }
  });

  // ─── 获取当前用户信息 ──────────────────────────────────
  router.get('/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未授权' });
      }
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const result = await pool.query(
        'SELECT id, phone, nickname, avatar_url, emotion_points, role, created_at FROM users WHERE id = $1',
        [decoded.userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      res.json({ user: result.rows[0] });
    } catch (err) {
      res.status(401).json({ error: 'Token 无效或已过期' });
    }
  });

  return router;
};
