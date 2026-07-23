/**
 * Auth Store — 管理用户认证状态
 * Zustand + localStorage 持久化 token
 */
import { create } from 'zustand';
import * as authApi from '../api/auth';

const TOKEN_KEY = 'epet1_token';
const DEMO_KEY = 'epet1_demo';

interface AuthState {
  token: string | null;
  userId: number | null;
  phone: string | null;
  isDemo: boolean;
  isAuthenticated: boolean;
  loading: boolean;

  /** 初始化：从 localStorage 恢复 token 并验证 */
  initAuth: (demoToken?: string) => Promise<void>;
  /** 发送验证码 */
  sendCode: (phone: string) => Promise<{ ok: boolean; error?: string }>;
  /** 注册 */
  register: (phone: string, code: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  /** 登录 */
  login: (phone: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  /** 登出 */
  logout: () => void;
  /** 内部：保存 token 并设置状态 */
  _setAuth: (token: string, userId: number, phone: string, isDemo?: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  userId: null,
  phone: null,
  isDemo: false,
  isAuthenticated: false,
  loading: true,

  initAuth: async (demoToken?: string) => {
    // Demo 模式：URL 带 ?id=9527 → 不需要真实 token
    if (demoToken) {
      localStorage.setItem(DEMO_KEY, '1');
      set({ isDemo: true, userId: 2, isAuthenticated: true, loading: false });
      return;
    }

    // 非演示模式：清除可能残留的 demo 标记，防止 authParams() 误走 demo bypass
    localStorage.removeItem(DEMO_KEY);

    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      set({ loading: false });
      return;
    }

    try {
      const me = await authApi.getMe(saved);
      set({
        token: saved,
        userId: me.userId,
        phone: me.phone,
        isDemo: me.isDemo,
        isAuthenticated: true,
        loading: false,
      });
    } catch {
      // token 无效或过期
      localStorage.removeItem(TOKEN_KEY);
      set({ loading: false });
    }
  },

  sendCode: async (phone) => {
    return authApi.sendCode(phone);
  },

  register: async (phone, code, password) => {
    const res = await authApi.register(phone, code, password);
    if (res.ok && res.token && res.user) {
      get()._setAuth(res.token, res.user.userId, res.user.phone);
      return { ok: true };
    }
    return { ok: false, error: res.error || '注册失败' };
  },

  login: async (phone, password) => {
    const res = await authApi.login(phone, password);
    if (res.ok && res.token && res.user) {
      get()._setAuth(res.token, res.user.userId, res.user.phone);
      return { ok: true };
    }
    return { ok: false, error: res.error || '登录失败' };
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(DEMO_KEY);
    set({ token: null, userId: null, phone: null, isDemo: false, isAuthenticated: false });
  },

  _setAuth: (token, userId, phone, isDemo = false) => {
    localStorage.setItem(TOKEN_KEY, token);
    // 真实用户登录/注册时，清除可能残留的 demo 标记
    if (!isDemo) localStorage.removeItem(DEMO_KEY);
    set({ token, userId, phone, isDemo, isAuthenticated: true });
  },
}));
