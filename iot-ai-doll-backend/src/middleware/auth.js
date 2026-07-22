/**
 * JWT Authentication Middleware
 * Extracts userId from Authorization: Bearer <token> header
 * Sets req.user = { userId, username/phone, isDemo }
 *
 * Demo bypass: ?demo=9527 → req.user = { userId: 2, isDemo: true }
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const DEMO_KEY = process.env.DEMO_KEY || '9527';

export function jwtAuth(req, res, next) {
  // Demo 模式 bypass：URL 带 ?demo=9527 → 直接以 user_id=2 放行
  if (req.query.demo === DEMO_KEY) {
    req.user = { userId: 2, isDemo: true };
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，缺少 Token' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, username: decoded.username, phone: decoded.phone, isDemo: false };
    next();
  } catch {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
}

export default jwtAuth;