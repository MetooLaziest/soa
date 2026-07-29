/**
 * JWT Authentication Middleware
 * Extracts userId from Authorization: Bearer <token> header
 * Sets req.user = { userId, username/phone, isDemo }
 *
 * Demo bypass: ?demo=9527 → req.user = { userId: 2, isDemo: true }
 */
import jwt from 'jsonwebtoken';

// ⚠️ 必须 lazy 读 process.env.JWT_SECRET!
// ES Module 静态 import 是 hoisted, 此模块在 import 阶段就被加载,
// 早于 index.js 的 dotenv.config(), 所以模块顶层读 JWT_SECRET 还是 undefined.
// 改成函数内 lazy 读, 每次请求时 dotenv 已加载完, 拿到真 secret.
const DEMO_KEY = process.env.DEMO_KEY || '9527';

export function jwtAuth(req, res, next) {
  // 1) 优先验证 Authorization header（真实账号路径）
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // lazy 读, 拿到 dotenv 加载后的真 secret
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { userId: decoded.userId, username: decoded.username, phone: decoded.phone, isDemo: false };
      // 忽略 query.demo（即便带 ?demo=9527），以 token 为准
      delete req.query.demo;
      return next();
    } catch {
      // token 无效 → 401，不要 fallback 到 demo
      return res.status(401).json({ error: 'Token 无效或已过期' });
    }
  }

  // 2) 无 token 时，demo 仅作为开发回退（必须 URL 带 ?demo=9527）
  if (req.query.demo === DEMO_KEY) {
    req.user = { userId: 2, isDemo: true };
    return next();
  }

  // 3) 既无 token 也无 demo → 401
  return res.status(401).json({ error: '未授权，缺少 Token' });
}

export default jwtAuth;