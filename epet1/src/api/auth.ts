/**
 * Auth API 客户端
 * 对接后端 /api/epet1/auth/* 路由
 */

const BASE = '/api/epet1/auth';

// ─── 类型 ────────────────────────────────────────────────────

export interface AuthResponse {
  ok: boolean;
  token?: string;
  user?: { userId: number; phone: string };
  error?: string;
}

export interface MeResponse {
  userId: number;
  phone: string;
  isDemo: boolean;
}

// ─── API 函数 ────────────────────────────────────────────────

/** 发送验证码 */
export async function sendCode(phone: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

/** 注册（手机号 + 验证码 + 密码） */
export async function register(phone: string, code: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, password }),
  });
  return res.json();
}

/** 登录（手机号 + 密码） */
export async function login(phone: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  return res.json();
}

/** 验证 token 是否有效 */
export async function verifyToken(token: string): Promise<{ valid: boolean; userId?: number; phone?: string }> {
  const res = await fetch(`${BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return res.json();
}

/** 获取当前用户信息（需 Bearer token） */
export async function getMe(token: string): Promise<MeResponse> {
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`auth/me failed: ${res.status}`);
  return res.json();
}
