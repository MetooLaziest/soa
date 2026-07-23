/**
 * 管理后台 - 仪表盘（接真实 API）
 */
import { useEffect, useState } from 'react';
import client from '../../api/client';

interface Stats {
  petModels: number;
  users: number;
  shopItems: number;
  petInstances: number;
  scenes: number;
  zones: number;
}

interface System {
  db: string;
  backend: string;
  ai: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [system, setSystem] = useState<System | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get<{ ok: boolean; stats: Stats; system: System }>('/admin/epet-stats')
      .then((res) => {
        const data = res.data;
        setStats(data.stats);
        setSystem(data.system);
      })
      .catch((err) => setError(err.message || '获取统计失败'))
      .finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: '宠物模型', value: String(stats.petModels), icon: '🐱', color: 'from-purple-600 to-purple-400' },
    { label: '注册用户', value: String(stats.users), icon: '👥', color: 'from-cyan-600 to-cyan-400' },
    { label: '宠物实例', value: String(stats.petInstances), icon: '🐾', color: 'from-green-600 to-green-400' },
    { label: '商品道具', value: String(stats.shopItems), icon: '🎒', color: 'from-orange-600 to-orange-400' },
  ] : [];

  return (
    <div className="p-6 animate-fade-in-up">
      <h2 className="mb-6 text-xl font-bold text-white">仪表盘</h2>

      {loading && <p className="text-gray-400">加载中...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(card => (
              <div key={card.label} className="rounded-xl border border-white/10 bg-card p-5">
                <div className="mb-2 text-2xl">{card.icon}</div>
                <div className={`text-3xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                  {card.value}
                </div>
                <div className="mt-1 text-sm text-gray-400">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-card p-6">
            <h3 className="mb-3 font-semibold text-white">系统状态</h3>
            <p className="text-sm text-gray-400">
              后端服务 · <span className="text-green-400">{system?.backend ?? '—'}</span>
              {' · '}数据库 · <span className={system?.db === '正常' ? 'text-green-400' : 'text-red-400'}>{system?.db ?? '—'}</span>
              {' · '}AI 对话 · <span className="text-green-400">{system?.ai ?? '—'}</span>
            </p>
            <div className="mt-3 flex gap-4 text-xs text-gray-500">
              <span>场景: {stats.scenes}</span>
              <span>区域: {stats.zones}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
