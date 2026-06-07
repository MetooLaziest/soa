/**
 * CG 图鉴管理 - 卡片网格
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface CG { id: string; name: string; description: string; asset_id: string; unlock_condition: string; main_story_id: string; }

export default function CGGallery() {
  const [cgs, setCgs] = useState<CG[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', asset_id: '', unlock_condition: '', main_story_id: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/db/cgs');
      setCgs(res.data.cgs || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await client.put(`/db/cgs/${editingId}`, form);
      } else {
        await client.post('/db/cgs', form);
      }
      setShowForm(false); setForm({ name: '', description: '', asset_id: '', unlock_condition: '', main_story_id: '' }); setEditingId(null);
      load();
    } catch (err: any) {
      alert('操作失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该 CG？')) return;
    await client.delete(`/db/cgs/${id}`);
    load();
  };

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">CG 图鉴管理</h2>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', asset_id: '', unlock_condition: '', main_story_id: '' }); }}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">+ 新增 CG</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-white/10 bg-card p-5 space-y-4">
          <h3 className="font-semibold text-white">{editingId ? '编辑 CG' : '新增 CG'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-sm text-gray-300">名称</label><input value={form.name} onChange={e => setForm({...form,name:e.target.value})}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-purple-500" required /></div>
            <div><label className="mb-1 block text-sm text-gray-300">Asset ID</label><input value={form.asset_id} onChange={e => setForm({...form,asset_id:e.target.value})}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-purple-500" /></div>
          </div>
          <div><label className="mb-1 block text-sm text-gray-300">描述</label><textarea value={form.description} onChange={e => setForm({...form,description:e.target.value})}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-purple-500" rows={3} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-sm text-gray-300">解锁条件</label><input value={form.unlock_condition} onChange={e => setForm({...form,unlock_condition:e.target.value})}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-purple-500" /></div>
            <div><label className="mb-1 block text-sm text-gray-300">主剧情 ID</label><input value={form.main_story_id} onChange={e => setForm({...form,main_story_id:e.target.value})}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-purple-500" /></div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">保存</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10">取消</button>
          </div>
        </form>
      )}

      {loading ? <div className="text-gray-400">加载中...</div> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cgs.map(cg => (
            <div key={cg.id} className="group overflow-hidden rounded-xl border border-white/10 bg-card transition hover:border-cyan-500/30">
              {/* 缩略图占位 */}
              <div className="flex h-36 items-center justify-center bg-gradient-to-br from-purple-500/10 to-cyan-500/10">
                <span className="text-4xl opacity-30 group-hover:opacity-50 transition">🖼️</span>
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-white">{cg.name}</h4>
                <p className="mt-1 line-clamp-2 text-xs text-gray-400">{cg.description || '暂无描述'}</p>
                <div className="mt-3 flex gap-3">
                  <button onClick={() => { setForm({ name: cg.name, description: cg.description, asset_id: cg.asset_id || '', unlock_condition: cg.unlock_condition || '', main_story_id: cg.main_story_id || '' }); setEditingId(cg.id); setShowForm(true); }}
                    className="text-xs text-cyan-400 hover:underline">编辑</button>
                  <button onClick={() => handleDelete(cg.id)}
                    className="text-xs text-red-400 hover:underline">删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && cgs.length === 0 && <div className="py-12 text-center text-sm text-gray-500">暂无 CG 数据</div>}
    </div>
  );
}
