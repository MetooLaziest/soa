/**
 * 登录页 - 深色主题居中卡片
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败';
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark px-4">
      {/* 背景光效 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-card p-8 shadow-2xl"
      >
        {/* 标题 */}
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          艾瑟拉奇幻谭
        </h1>
        <p className="mb-6 text-center text-sm text-gray-400">登录你的冒险账号</p>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* 用户名 */}
        <label className="mb-1 block text-sm text-gray-300">用户名</label>
        <input
          className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition focus:border-purple-500"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
        />

        {/* 密码 */}
        <label className="mb-1 block text-sm text-gray-300">密码</label>
        <input
          type="password"
          className="mb-6 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition focus:border-purple-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {/* 登录按钮 */}
        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 py-2.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          进入艾瑟拉
        </button>

        {/* 注册链接 */}
        <p className="mt-4 text-center text-sm text-gray-400">
          还没有账号？{' '}
          <Link to="/register" className="text-cyan-400 hover:underline">
            注册
          </Link>
        </p>
      </form>
    </div>
  );
}
