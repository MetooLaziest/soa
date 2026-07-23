/**
 * 装扮管理 - Admin CRUD + 机伴兼容绑定 + 动画帧上传
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

const EQUIP_SLOTS = [
  { id: 'hat', name: '🎩 头饰' },
  { id: 'accessory', name: '💍 配饰' },
  { id: 'back', name: '🦋 背饰' },
  { id: 'body', name: '👗 身体' },
];

const ANIM_STATES = ['idle', 'walk', 'eat', 'shake', 'sleep', 'work'];

interface OutfitItem {
  id: number;
  name: string;
  description: string;
  image_url: string;
  equip_slot: string;
  price_emotion: number;
  price_real: number;
  shop_tab: string;
  stock: number;
  is_active: boolean;
  compatible_model_count: number;
  model_names: string;
}

interface PetModel {
  id: number;
  name: string;
  is_active: boolean;
}

interface ModelAssignment {
  id: number;
  outfit_shop_item_id: number;
  pet_model_id: number;
  animations: Record<string, string[]>;
  anchor_override: Record<string, number[]> | null;
  model_name?: string;
}

export default function OutfitAdmin() {
  const [outfits, setOutfits] = useState<OutfitItem[]>([]);
  const [petModels, setPetModels] = useState<PetModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OutfitItem | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Detail view state
  const [detailOutfit, setDetailOutfit] = useState<OutfitItem | null>(null);
  const [assignments, setAssignments] = useState<ModelAssignment[]>([]);
  const [assignModelId, setAssignModelId] = useState('');
  const [uploadingFrame, setUploadingFrame] = useState(false);
  const [editingAnchor, setEditingAnchor] = useState<string>(''); // JSON string

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSlot, setFormSlot] = useState('hat');
  const [formPrice, setFormPrice] = useState(0);
  const [formEmotionPrice, setFormEmotionPrice] = useState(0);
  const [formStock, setFormStock] = useState(-1);

  const load = async () => {
    setLoading(true);
    try {
      const [outfitRes, modelRes] = await Promise.all([
        client.get('/admin/outfits'),
        client.get('/admin/companions'),
      ]);
      setOutfits(outfitRes.data.outfits || []);
      setPetModels((modelRes.data.models || modelRes.data || []).map((m: any) => ({
        id: m.id, name: m.name, is_active: m.is_active,
      })));
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormName(''); setFormDesc(''); setFormImageUrl('');
    setFormSlot('hat'); setFormPrice(0); setFormEmotionPrice(0); setFormStock(-1);
    setEditing(null); setShowForm(false);
  };

  const openEdit = (item: OutfitItem) => {
    setEditing(item);
    setFormName(item.name); setFormDesc(item.description || '');
    setFormImageUrl(item.image_url || ''); setFormSlot(item.equip_slot);
    setFormPrice(item.price_emotion); setFormEmotionPrice(item.price_real);
    setFormStock(item.stock);
    setShowForm(true);
  };

  const openDetail = async (item: OutfitItem) => {
    setDetailOutfit(item);
    setEditingAnchor('');
    try {
      const res = await client.get(`/admin/outfits/${item.id}/assignments`);
      // Enrich with model names
      const enriched = (res.data.assignments || []).map((a: any) => {
        const model = petModels.find(m => m.id === a.pet_model_id);
        return { ...a, model_name: model?.name || `Model#${a.pet_model_id}` };
      });
      setAssignments(enriched);
    } catch (err) {
      console.error('加载绑定失败:', err);
      setAssignments([]);
    }
  };

  const uploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', 'game-assets');
      const res = await client.post('/game-assets/upload', form, { timeout: 300000 });
      if (res.data?.asset?.url) setFormImageUrl(res.data.asset.url);
    } catch (err: any) {
      alert('上传失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingImg(false);
    }
  };

  const save = async () => {
    if (!formName || !formSlot) return;
    try {
      if (editing) {
        await client.put(`/admin/outfits/${editing.id}`, {
          name: formName, description: formDesc, image_url: formImageUrl,
          equip_slot: formSlot, price_emotion: formPrice, price_real: formEmotionPrice,
          stock: formStock,
        });
      } else {
        await client.post('/admin/outfits', {
          name: formName, description: formDesc, image_url: formImageUrl,
          equip_slot: formSlot, price_emotion: formPrice, price_real: formEmotionPrice,
          stock: formStock, shop_tab: 'outfit',
        });
      }
      resetForm(); load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteOutfit = async (id: number) => {
    if (!confirm('确认删除此装扮？相关绑定和装备记录将一并清理。')) return;
    try { await client.delete(`/admin/outfits/${id}`); load(); }
    catch (err: any) { alert('删除失败: ' + err.message); }
  };

  const assignModel = async () => {
    if (!detailOutfit || !assignModelId) return;
    try {
      await client.post(`/admin/outfits/${detailOutfit.id}/assign-model`, {
        pet_model_id: Number(assignModelId),
      });
      setAssignModelId('');
      openDetail(detailOutfit);
    } catch (err: any) {
      alert('绑定失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const unassignModel = async (petModelId: number) => {
    if (!detailOutfit) return;
    if (!confirm('确认解绑？该机伴的动画帧数据将一并删除。')) return;
    try {
      await client.delete(`/admin/outfits/${detailOutfit.id}/assign-model/${petModelId}`);
      openDetail(detailOutfit);
    } catch (err: any) {
      alert('解绑失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const uploadFrame = async (petModelId: number, type: string, file: File) => {
    if (!detailOutfit) return;
    setUploadingFrame(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', type);
      await client.post(`/admin/outfits/${detailOutfit.id}/upload-frame/${petModelId}`, form);
      openDetail(detailOutfit);
    } catch (err: any) {
      alert('上传帧失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingFrame(false);
    }
  };

  const removeFrame = async (petModelId: number, type: string, frameIndex: number) => {
    if (!detailOutfit) return;
    const assign = assignments.find(a => a.pet_model_id === petModelId);
    if (!assign) return;
    const updated = { ...assign.animations };
    const frames = [...(updated[type] || [])];
    frames.splice(frameIndex, 1);
    if (frames.length === 0) delete updated[type]; else updated[type] = frames;
    try {
      await client.put(`/admin/outfits/${detailOutfit.id}/animations/${petModelId}`, {
        animations: updated,
      });
      openDetail(detailOutfit);
    } catch (err: any) {
      alert('删除帧失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const saveAnchor = async (petModelId: number) => {
    if (!detailOutfit) return;
    try {
      const anchor = editingAnchor ? JSON.parse(editingAnchor) : null;
      await client.put(`/admin/outfits/${detailOutfit.id}/anchor-override/${petModelId}`, {
        anchor_override: anchor,
      });
      openDetail(detailOutfit);
    } catch (err: any) {
      alert('保存锚点失败: ' + (err instanceof SyntaxError ? 'JSON 格式错误' : err.response?.data?.error || err.message));
    }
  };

  // ─── Detail view ───
  if (detailOutfit) {
    const assignedModelIds = new Set(assignments.map(a => a.pet_model_id));
    const availableModels = petModels.filter(m => !assignedModelIds.has(m.id));

    return (
      <div className="p-6 animate-fade-in-up">
        <button onClick={() => setDetailOutfit(null)}
          className="mb-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/20">
          ← 返回列表
        </button>
        <h2 className="text-xl font-bold text-white mb-1">👔 {detailOutfit.name}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {EQUIP_SLOTS.find(s => s.id === detailOutfit.equip_slot)?.name || detailOutfit.equip_slot}
          {detailOutfit.model_names && ` · 兼容: ${detailOutfit.model_names}`}
        </p>

        {/* Assign model */}
        <div className="mb-6 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <h3 className="text-sm font-semibold text-purple-300 mb-3">🔗 绑定机伴型号</h3>
          <div className="flex gap-2">
            <select value={assignModelId} onChange={e => setAssignModelId(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none">
              <option value="" className="bg-slate-800">选择机伴型号...</option>
              {availableModels.map(m => (
                <option key={m.id} value={m.id} className="bg-slate-800">{m.name}</option>
              ))}
            </select>
            <button onClick={assignModel} disabled={!assignModelId}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
              绑定
            </button>
          </div>
        </div>

        {/* Assigned models with animation frames */}
        {assignments.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-gray-500">
            尚未绑定任何机伴型号，请先绑定以配置动画帧
          </div>
        )}
        {assignments.map(assign => (
          <div key={assign.id} className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white">🐾 {assign.model_name}</h4>
              <button onClick={() => unassignModel(assign.pet_model_id)}
                className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30">
                解绑
              </button>
            </div>

            {/* Animation frames per state */}
            <div className="space-y-3">
              {ANIM_STATES.map(state => {
                const frames = assign.animations?.[state] || [];
                return (
                  <div key={state} className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-300">{state}</span>
                      <label className={`cursor-pointer rounded px-2 py-1 text-xs ${
                        uploadingFrame ? 'bg-gray-600 text-gray-400' : 'bg-cyan-600/80 text-white hover:bg-cyan-600'
                      }`}>
                        {uploadingFrame ? '...' : '+ 帧图'}
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingFrame}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadFrame(assign.pet_model_id, state, f); e.target.value = ''; }} />
                      </label>
                    </div>
                    {frames.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {frames.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img src={url} alt={`${state}-${idx}`} className="h-12 w-12 rounded border border-white/10 object-contain bg-black/30" />
                            <button onClick={() => removeFrame(assign.pet_model_id, state, idx)}
                              className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600">暂无帧</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Anchor override editor */}
            <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
              <div className="text-xs font-semibold text-yellow-300 mb-2">⚓ anchor_override (JSON)</div>
              <textarea
                value={editingAnchor || JSON.stringify(assign.anchor_override || {}, null, 2)}
                onChange={e => setEditingAnchor(e.target.value)}
                rows={3}
                className="w-full rounded bg-white/10 px-2 py-1 text-xs text-white font-mono outline-none"
                placeholder='{"hat": [0.5, 0.3]}'
              />
              <button onClick={() => saveAnchor(assign.pet_model_id)}
                className="mt-1 rounded bg-yellow-600/80 px-3 py-1 text-xs text-white hover:bg-yellow-600">
                保存锚点
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── List view ───
  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">👔 装扮管理</h2>
          <p className="mt-1 text-sm text-gray-500">管理装扮物品、机伴兼容与动画帧</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
          + 新增装扮
        </button>
      </div>

      {/* Outfit list */}
      {!loading && (
        <div className="space-y-2">
          {outfits.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/8 transition">
              <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => openDetail(item)}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg overflow-hidden">
                  {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : '👔'}
                </div>
                <div>
                  <span className="font-medium text-white text-sm">{item.name}</span>
                  <div className="text-xs text-gray-500">
                    {EQUIP_SLOTS.find(s => s.id === item.equip_slot)?.name || item.equip_slot}
                    {' · '}💛{item.price_emotion}
                    {item.stock >= 0 && ` · 库存:${item.stock}`}
                    {item.compatible_model_count > 0 && ` · 兼容${item.compatible_model_count}个型号`}
                    {!item.is_active && ' · ❌已下架'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openDetail(item)}
                  className="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300 hover:bg-purple-500/30">
                  详情
                </button>
                <button onClick={() => openEdit(item)} className="rounded bg-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/20">编辑</button>
                <button onClick={() => deleteOutfit(item.id)} className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30">删除</button>
              </div>
            </div>
          ))}
          {outfits.length === 0 && <div className="py-8 text-center text-sm text-gray-500">暂无装扮</div>}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={resetForm}>
          <div className="w-full max-w-md rounded-xl bg-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">{editing ? '编辑' : '新增'}装扮</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">名称</label>
                <input value={formName} onChange={e => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">装备槽位</label>
                <select value={formSlot} onChange={e => setFormSlot(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none">
                  {EQUIP_SLOTS.map(s => <option key={s.id} value={s.id} className="bg-slate-800">{s.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400">价格(情绪值)</label>
                  <input type="number" value={formEmotionPrice} onChange={e => setFormEmotionPrice(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400">库存(-1无限)</label>
                  <input type="number" value={formStock} onChange={e => setFormStock(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">描述</label>
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">图片素材</label>
                <div className="mt-1 flex items-center gap-3">
                  {formImageUrl && <img src={formImageUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-white/20" />}
                  <div className="flex flex-1 items-center gap-2">
                    <input value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)}
                      className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none" placeholder="路径或上传" />
                    <label className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-medium ${
                      uploadingImg ? 'bg-gray-600 text-gray-400' : 'bg-cyan-600 text-white hover:bg-cyan-700'
                    }`}>
                      {uploadingImg ? '...' : '上传'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingImg}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                item_category 和 shop_tab 自动设为 'outfit'
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={resetForm} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/20">取消</button>
              <button onClick={save} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">保存</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="py-8 text-center text-sm text-gray-400">加载中...</div>}
    </div>
  );
}
