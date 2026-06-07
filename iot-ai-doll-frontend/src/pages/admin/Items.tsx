/**
 * 道具管理 - 卡片网格
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface Item { id: string; name: string; description: string; icon_asset_id: string; }

export default function Items() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon_asset_id: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/db/items');
      setItems(res.data.items || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await client.put(`/db/items/${editingId}`, form);
      } else {
        await client.post('/db/items', form);
      }
      setShowForm(false); setForm({ name: '', description: '', icon_asset_id: '' }); setEditingId(null);
      load();
    } catch (err: any) {
      alert('操作失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该道具？')) return;
    await client.delete(`/db/items/${id}`);
    load();
  };

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">道具管理</h2>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', icon_asset_id: '' }); }}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">+ 新增道具</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-white/10 bg-card p-5 space-y-4">
          <h3 className="font-semibold text-white">{editingId ? '编辑道具' : '新增道具'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-300">名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-purple-500" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">图标 Asset ID</label>
              <input value={form.icon_asset_id} onChange={e => setForm({ ...form, icon_asset_id: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-purple-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">描述</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-purple-500" rows={3} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">保存</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10">取消</button>
          </div>
        </form>
      )}

      {loading ? <div className="text-gray-400">加载中...</div> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map(item => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-card p-5 hover:border-purple-500/30 transition">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10 text-2xl">🎒</div>
              <h4 className="mb-1 font-semibold text-white">{item.name}</h4>
              <p className="mb-4 line-clamp-2 text-xs text-gray-400">{item.description || '暂无描述'}</p>
              <div className="flex gap-3">
                <button onClick={() => { setForm({ name: item.name, description: item.description, icon_asset_id: item.icon_asset_id }); setEditingId(item.id); setShowForm(true); }}
                  className="text-xs text-cyan-400 hover:underline">编辑</button>
                <button onClick={() => handleDelete(item.id)}
                  className="text-xs text-red-400 hover:underline">删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && items.length === 0 && <div className="py-12 text-center text-sm text-gray-500">暂无道具数据</div>}
    </div>
  );
}
