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
    // 路径 A: URL 带 ?demo=9527 / ?id=9527 → 直接进 demo
    if (demoToken) {
      // 2026-07-30: 防御性清掉残留的 epet1_token。
      // 之前不清 → 切回 / 路由重 mount → initAuth() 无参 → getMe(旧 token) 成功
      //   → 覆盖 demo 状态成 userId=10 → 9527 宠物查不到 → "出错"
      localStorage.removeItem(TOKEN_KEY);
      localStorage.setItem(DEMO_KEY, '1');
      set({ isDemo: true, userId: 2, isAuthenticated: true, loading: false });
      return;
    }

    // 路径 B (2026-07-30 加): iOS PWA standalone 从主屏幕启动会丢 query string
    //   → 上次 ?id=9527 写入的 DEMO_KEY 还在 → 直接恢复 demo 模式
    // 真实用户登出/登录在 _setAuth / logout 中已经清掉 DEMO_KEY, 不会误判
    if (localStorage.getItem(DEMO_KEY) === '1') {
      set({ isDemo: true, userId: 2, isAuthenticated: true, loading: false });
      return;
    }

    // 路径 C: 真实用户 token 流程
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
