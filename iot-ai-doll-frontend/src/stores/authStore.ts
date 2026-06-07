/**
 * 认证状态管理 - Zustand
 */
import { create } from 'zustand';
import type { User } from '../types';
import { login as apiLogin, register as apiRegister, getMe, verifyToken } from '../api/auth';

interface AuthState {
  /** 当前用户 */
  user: User | null;
  /** JWT token */
  token: string | null;
  /** 是否已认证 */
  isAuthenticated: boolean;
  /** 加载中 */
  loading: boolean;

  /** 初始化：从 localStorage 恢复并验证 */
  init: () => Promise<void>;
  /** 登录 */
  login: (username: string, password: string) => Promise<void>;
  /** 注册 */
  register: (username: string, password: string) => Promise<void>;
  /** 登出 */
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      await verifyToken();
      const res = await getMe();
      set({ user: res.data, token, isAuthenticated: true, loading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, loading: false });
    }
  },

  login: async (username, password) => {
    const res = await apiLogin({ username, password });
    const { user, token } = res.data;
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true, loading: false });
  },

  register: async (username, password) => {
    const res = await apiRegister({ username, password });
    const { user, token } = res.data;
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true, loading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
