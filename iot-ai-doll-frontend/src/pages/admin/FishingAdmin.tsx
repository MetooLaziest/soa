/**
 * 钓鱼管理 - 管理鱼类、钓鱼地图和素材
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-300',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
};

const RARITY_BG: Record<string, string> = {
  common: 'bg-gray-500/20 border-gray-500/30',
  rare: 'bg-blue-500/20 border-blue-500/30',
  epic: 'bg-purple-500/20 border-purple-500/30',
  legendary: 'bg-yellow-500/20 border-yellow-500/30',
};

interface FishItem {
  id: number;
  name: string;
  rarity: string;
  description: string;
  image_url: string;
  fishing_map_id: number;
  map_name: string;
  weight: number;
  sort_order: number;
  is_active: boolean;
}

interface FishingMap {
  id: number;
  name: string;
  description: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

export default function FishingAdmin() {
  const [tab, setTab] = useState<'fish' | 'maps'>('fish');
  const [fish, setFish] = useState<FishItem[]>([]);
  const [maps, setMaps] = useState<FishingMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FishItem | FishingMap | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRarity, setFormRarity] = useState('common');
  const [formDesc, setFormDesc] = useState('');
  const [formMapId, setFormMapId] = useState<number>(0);
  const [formWeight, setFormWeight] = useState(10);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formImageUrl, setFormImageUrl] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [fishRes, mapsRes] = await Promise.all([
        client.get('/epet1/fishing/admin/fish'),
        client.get('/epet1/fishing/admin/maps'),
      ]);
      setFish(fishRes.data.fish || []);
      setMaps(mapsRes.data.maps || []);
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormName(''); setFormRarity('common'); setFormDesc('');
    setFormMapId(maps[0]?.id || 0); setFormWeight(10); setFormSortOrder(0);
    setFormImageUrl(''); setEditing(null); setShowForm(false);
  };

  const openEdit = (item: FishItem | FishingMap) => {
    setEditing(item);
    setFormName(item.name);
    setFormDesc(item.description || '');
    setFormImageUrl(item.image_url || '');
    setFormSortOrder(item.sort_order || 0);
    if ('rarity' in item) {
      setFormRarity(item.rarity);
      setFormMapId(item.fishing_map_id);
      setFormWeight(item.weight);
    }
    setShowForm(true);
  };

  const saveFish = async () => {
    if (!formName) return;
    try {
      if (editing && 'rarity' in editing) {
        await client.put(`/epet1/fishing/admin/fish/${editing.id}`, {
          name: formName, rarity: formRarity, description: formDesc,
          image_url: formImageUrl, fishing_map_id: formMapId,
          weight: formWeight, sort_order: formSortOrder,
        });
      } else {
        await client.post('/epet1/fishing/admin/fish', {
          name: formName, rarity: formRarity, description: formDesc,
          image_url: formImageUrl, fishing_map_id: formMapId || maps[0]?.id,
          weight: formWeight, sort_order: formSortOrder,
        });
      }
      resetForm();
      load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const saveMap = async () => {
    if (!formName) return;
    try {
      if (editing && !('rarity' in editing)) {
        await client.put(`/epet1/fishing/admin/maps/${editing.id}`, {
          name: formName, description: formDesc,
          image_url: formImageUrl, sort_order: formSortOrder,
        });
      } else {
        await client.post('/epet1/fishing/admin/maps', {
          name: formName, description: formDesc,
          image_url: formImageUrl, sort_order: formSortOrder,
        });
      }
      resetForm();
      load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteItem = async (type: 'fish' | 'maps', id: number) => {
    if (!confirm('确认删除？')) return;
    try {
      await client.delete(`/epet1/fishing/admin/${type}/${id}`);
      load();
    } catch (err: any) {
      alert('删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🎣 钓鱼管理</h2>
          <p className="mt-1 text-sm text-gray-500">管理鱼类、钓鱼地图和素材</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
        >
          + 新增{tab === 'fish' ? '鱼类' : '地图'}
        </button>
      </div>

      {/* Tab */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab('fish')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'fish' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          🐟 鱼类管理
        </button>
        <button
          onClick={() => setTab('maps')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'maps' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          🏞️ 地图管理
        </button>
      </div>

      {/* 鱼类列表 */}
      {tab === 'fish' && !loading && (
        <div className="space-y-3">
          {fish.map(f => (
            <div key={f.id} className={`flex items-center justify-between rounded-xl border p-4 ${RARITY_BG[f.rarity] || 'border-white/10 bg-white/5'}`}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-2xl">🐟</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{f.name}</span>
                    <span className={`text-xs ${RARITY_COLORS[f.rarity]}`}>
                      {f.rarity === 'common' ? '普通' : f.rarity === 'rare' ? '稀有' : f.rarity === 'epic' ? '史诗' : '传说'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    地图: {f.map_name || '无'} · 权重: {f.weight} · 排序: {f.sort_order}
                    {!f.is_active && ' · ❌ 已停用'}
                  </div>
                  {f.description && <div className="text-xs text-gray-600 mt-1">{f.description}</div>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(f)} className="rounded bg-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-white/20">编辑</button>
                <button onClick={() => deleteItem('fish', f.id)} className="rounded bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30">删除</button>
              </div>
            </div>
          ))}
          {fish.length === 0 && <div className="py-12 text-center text-sm text-gray-500">暂无鱼类</div>}
        </div>
      )}

      {/* 地图列表 */}
      {tab === 'maps' && !loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {maps.map(m => (
            <div key={m.id} className="overflow-hidden rounded-xl border border-white/10 bg-card">
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-4xl">
                🏞️
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-white">{m.name}</h4>
                <p className="mt-1 text-xs text-gray-500">{m.description}</p>
                <div className="mt-2 text-xs text-gray-600">
                  排序: {m.sort_order} · 鱼: {fish.filter(f => f.fishing_map_id === m.id).length} 种
                  {!m.is_active && ' · ❌ 已停用'}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setTab('maps'); openEdit(m); }} className="rounded bg-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-white/20">编辑</button>
                  <button onClick={() => deleteItem('maps', m.id)} className="rounded bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30">删除</button>
                </div>
              </div>
            </div>
          ))}
          {maps.length === 0 && <div className="py-12 text-center text-sm text-gray-500">暂无地图</div>}
        </div>
      )}

      {/* 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => resetForm()}>
          <div className="w-full max-w-md rounded-xl bg-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">
              {editing ? '编辑' : '新增'}{tab === 'fish' ? '鱼类' : '地图'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">名称</label>
                <input value={formName} onChange={e => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="输入名称" />
              </div>

              {tab === 'fish' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400">稀有度</label>
                    <select value={formRarity} onChange={e => setFormRarity(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none">
                      <option value="common" className="bg-slate-800">普通</option>
                      <option value="rare" className="bg-slate-800">稀有</option>
                      <option value="epic" className="bg-slate-800">史诗</option>
                      <option value="legendary" className="bg-slate-800">传说</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">所属地图</label>
                    <select value={formMapId} onChange={e => setFormMapId(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none">
                      {maps.map(m => <option key={m.id} value={m.id} className="bg-slate-800">{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">权重（越大越容易钓到）</label>
                    <input type="number" value={formWeight} onChange={e => setFormWeight(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-gray-400">描述</label>
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="输入描述" />
              </div>

              <div>
                <label className="text-xs text-gray-400">图片 URL</label>
                <input value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="/epet/static/fishing/xxx.png" />
              </div>

              <div>
                <label className="text-xs text-gray-400">排序</label>
                <input type="number" value={formSortOrder} onChange={e => setFormSortOrder(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={resetForm} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/20">取消</button>
              <button
                onClick={tab === 'fish' ? saveFish : saveMap}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="py-12 text-center text-sm text-gray-400">加载中...</div>}
    </div>
  );
}
