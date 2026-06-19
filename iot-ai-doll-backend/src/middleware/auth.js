/**
 * JWT Authentication Middleware
 * Extracts userId from Authorization: Bearer <token> header
 * Sets req.user = { userId, username }
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export function jwtAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，缺少 Token' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, username: decoded.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
}

export default jwtAuth;