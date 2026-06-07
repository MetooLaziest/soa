/**
 * 注册页 - 深色主题居中卡片
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('两次密码不一致');
      return;
    }
    try {
      await register(username, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '注册失败';
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-card p-8 shadow-2xl"
      >
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          创建冒险者
        </h1>
        <p className="mb-6 text-center text-sm text-gray-400">注册新账号开始旅程</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <label className="mb-1 block text-sm text-gray-300">用户名</label>
        <input
          className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition focus:border-cyan-500"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label className="mb-1 block text-sm text-gray-300">密码</label>
        <input
          type="password"
          className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition focus:border-cyan-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <label className="mb-1 block text-sm text-gray-300">确认密码</label>
        <input
          type="password"
          className="mb-6 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition focus:border-cyan-500"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 py-2.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          注册
        </button>

        <p className="mt-4 text-center text-sm text-gray-400">
          已有账号？{' '}
          <Link to="/login" className="text-purple-400 hover:underline">
            登录
          </Link>
        </p>
      </form>
    </div>
  );
}
