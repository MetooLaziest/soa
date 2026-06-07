/**
 * 认证相关 API
 */
import client from './client';
import type { AuthPayload, AuthResponse, User } from '../types';

/** 注册 */
export function register(payload: AuthPayload) {
  return client.post<AuthResponse>('/auth/register', payload);
}

/** 登录 */
export function login(payload: AuthPayload) {
  return client.post<AuthResponse>('/auth/login', payload);
}

/** 验证 token 有效性 */
export function verifyToken() {
  return client.get<{ valid: boolean }>('/auth/verify');
}

/** 获取当前用户信息 */
export function getMe() {
  return client.get<User>('/auth/me');
}
