import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';

const router = express.Router();
// ⚠️ 必须 lazy 读 process.env.JWT_SECRET!
// ES Module 静态 import 是 hoisted, 此模块在 import 阶段就被加载,
// 早于 index.js 的 dotenv.config(), 所以模块顶层 const JWT_SECRET 永远拿到 fallback.
// 而 jwtAuth (middleware/auth.js) 是 lazy 读 → 拿到 .env 真值 → 签名/校验不一致 → 401
// 表现为: /api/auth/* (login/verify/me) 用 fallback 自洽, /api/db/* 和 /api/epet1/* 用真值 → 校验失败
// 见 [[28-esm-import-hoisting-dotenv]]
const getJwtSecret = () => process.env.JWT_SECRET || 'dev-secret-change-in-production';

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }

    // 检查用户是否存在
    const existing = await query('SELECT id FROM profiles WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO profiles (id, username, password_hash, role)
       VALUES (gen_random_uuid(), $1, $2, 'user')
       RETURNING id, username, role`,
      [username, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, getJwtSecret(), { expiresIn: '30d' });

    res.json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const result = await query(
      'SELECT id, username, password_hash, role FROM profiles WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, getJwtSecret(), { expiresIn: '30d' });

    res.json({ user: { id: user.id, username: user.username, role: user.role }, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 验证 token
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());
    const result = await query('SELECT id, username, role FROM profiles WHERE id = $1', [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }

    res.json({ user: result.rows[0], valid: true });
  } catch (error) {
    res.status(401).json({ error: 'Token 无效或已过期' });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());
    const result = await query('SELECT id, username, role, created_at FROM profiles WHERE id = $1', [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(401).json({ error: 'Token 无效或已过期' });
  }
});

export default router;