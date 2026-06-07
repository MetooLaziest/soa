/**
 * 设备绑定页 - 输入 SN 码绑定 IoT 机伴
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeviceStore } from '../stores/deviceStore';

export default function DeviceBind() {
  const [sn, setSn] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const bind = useDeviceStore((s) => s.bind);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await bind(sn.trim(), name.trim());
      setSuccess(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '绑定失败';
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-card p-8 shadow-2xl"
      >
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          绑定机伴
        </h1>
        <p className="mb-6 text-center text-sm text-gray-400">
          输入设备 SN 码连接你的 AI 伙伴
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
            绑定成功！正在跳转...
          </div>
        )}

        <label className="mb-1 block text-sm text-gray-300">设备 SN 码</label>
        <input
          className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-white outline-none transition focus:border-purple-500"
          placeholder="如：DOLL-XXXX-XXXX"
          value={sn}
          onChange={(e) => setSn(e.target.value)}
          required
        />

        <label className="mb-1 block text-sm text-gray-300">机伴昵称</label>
        <input
          className="mb-6 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition focus:border-purple-500"
          placeholder="给你的伙伴起个名字"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 py-2.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          连接机伴
        </button>
      </form>
    </div>
  );
}
