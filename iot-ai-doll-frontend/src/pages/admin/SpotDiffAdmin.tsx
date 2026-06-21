/**
 * 找不同管理 - 关卡CRUD + 双图上传 + 点击标记不同点
 */
import { useState, useEffect, useRef } from 'react';
import client from '../../api/client';

interface DiffSpot {
  x: number;  // 百分比 0-100
  y: number;
  radius: number;
  label: string;
}

interface Level {
  id: number;
  name: string;
  image_a_url: string;
  image_b_url: string;
  diff_spots: DiffSpot[];
  is_active: boolean;
  sort_order: number;
}

export default function SpotDiffAdmin() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Level | null>(null);
  const [uploading, setUploading] = useState<'a' | 'b' | null>(null);

  // Form
  const [formName, setFormName] = useState('');
  const [formImgA, setFormImgA] = useState('');
  const [formImgB, setFormImgB] = useState('');
  const [formSpots, setFormSpots] = useState<DiffSpot[]>([]);
  const [formSort, setFormSort] = useState(0);
  const [editOnImage, setEditOnImage] = useState<'a' | 'b'>('a');
  const [newLabel, setNewLabel] = useState('');
  const imgRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/epet1/spotdiff/admin/levels');
      setLevels(res.data.levels || []);
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormName(''); setFormImgA(''); setFormImgB('');
    setFormSpots([]); setFormSort(0); setEditing(null);
    setShowForm(false); setNewLabel('');
  };

  const openEdit = (level: Level) => {
    setEditing(level);
    setFormName(level.name); setFormImgA(level.image_a_url);
    setFormImgB(level.image_b_url);
    setFormSpots(Array.isArray(level.diff_spots) ? level.diff_spots : []);
    setFormSort(level.sort_order); setShowForm(true);
  };

  const uploadImage = async (file: File, which: 'a' | 'b') => {
    setUploading(which);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', 'game-assets');
      const res = await client.post('/game-assets/upload', form, { timeout: 300000 });
      if (res.data?.asset?.url) {
        if (which === 'a') setFormImgA(res.data.asset.url);
        else setFormImgB(res.data.asset.url);
      }
    } catch (err: any) {
      alert('上传失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(null);
    }
  };

  // 点击图片添加不同点
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!newLabel.trim()) {
      alert('请先输入标记名称（如"窗户""花瓶"）再点击图片');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100 * 10) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100 * 10) / 10;
    setFormSpots(prev => [...prev, { x, y, radius: 20, label: newLabel.trim() }]);
    setNewLabel('');
  };

  const removeSpot = (idx: number) => {
    setFormSpots(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!formName) return alert('请输入关卡名称');
    try {
      if (editing) {
        await client.put(`/epet1/spotdiff/admin/levels/${editing.id}`, {
          name: formName, image_a_url: formImgA, image_b_url: formImgB,
          diff_spots: formSpots, sort_order: formSort,
        });
      } else {
        await client.post('/epet1/spotdiff/admin/levels', {
          name: formName, image_a_url: formImgA, image_b_url: formImgB,
          diff_spots: formSpots, sort_order: formSort,
        });
      }
      resetForm(); load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteLevel = async (id: number) => {
    if (!confirm('确认删除？')) return;
    try { await client.delete(`/epet1/spotdiff/admin/levels/${id}`); load(); }
    catch (err: any) { alert('删除失败: ' + err.message); }
  };

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🔍 找不同管理</h2>
          <p className="mt-1 text-sm text-gray-500">管理关卡、上传双图、标记不同点</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
          + 新增关卡
        </button>
      </div>

      {/* 关卡列表 */}
      {!loading && (
        <div className="space-y-2">
          {levels.map(level => (
            <div key={level.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {level.image_a_url ? (
                    <img src={level.image_a_url} alt="" className="h-10 w-14 rounded object-cover border border-white/10" />
                  ) : (
                    <div className="flex h-10 w-14 items-center justify-center rounded bg-white/10 text-xs text-gray-500">无图A</div>
                  )}
                  {level.image_b_url ? (
                    <img src={level.image_b_url} alt="" className="h-10 w-14 rounded object-cover border border-white/10" />
                  ) : (
                    <div className="flex h-10 w-14 items-center justify-center rounded bg-white/10 text-xs text-gray-500">无图B</div>
                  )}
                </div>
                <div>
                  <span className="font-medium text-white text-sm">{level.name}</span>
                  <div className="text-xs text-gray-500">
                    {Array.isArray(level.diff_spots) ? level.diff_spots.length : 0} 个不同点
                    {!level.is_active && ' · ❌已禁用'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(level)} className="rounded bg-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/20">编辑</button>
                <button onClick={() => deleteLevel(level.id)} className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30">删除</button>
              </div>
            </div>
          ))}
          {levels.length === 0 && <div className="py-8 text-center text-sm text-gray-500">暂无关卡</div>}
        </div>
      )}

      {/* 编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm pt-8 pb-8" onClick={resetForm}>
          <div className="w-full max-w-2xl rounded-xl bg-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">{editing ? '编辑' : '新增'}关卡</h3>

            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400">关卡名称</label>
                  <input value={formName} onChange={e => setFormName(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="如：庭院寻宝" />
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-400">排序</label>
                  <input type="number" value={formSort} onChange={e => setFormSort(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none" />
                </div>
              </div>

              {/* 双图上传 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400">📷 原图 (图A)</label>
                  <div className="mt-1 flex items-center gap-2">
                    {formImgA && <img src={formImgA} alt="" className="h-8 w-12 rounded object-cover border border-white/10" />}
                    <input value={formImgA} onChange={e => setFormImgA(e.target.value)}
                      className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white outline-none" />
                    <label className={`cursor-pointer rounded px-2 py-1.5 text-xs font-medium ${
                      uploading === 'a' ? 'bg-gray-600 text-gray-400' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}>
                      {uploading === 'a' ? '...' : '上传'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploading === 'a'}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'a'); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400">🔎 改动图 (图B)</label>
                  <div className="mt-1 flex items-center gap-2">
                    {formImgB && <img src={formImgB} alt="" className="h-8 w-12 rounded object-cover border border-white/10" />}
                    <input value={formImgB} onChange={e => setFormImgB(e.target.value)}
                      className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white outline-none" />
                    <label className={`cursor-pointer rounded px-2 py-1.5 text-xs font-medium ${
                      uploading === 'b' ? 'bg-gray-600 text-gray-400' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}>
                      {uploading === 'b' ? '...' : '上传'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploading === 'b'}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'b'); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
              </div>

              {/* 不同点标记 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400">
                    🎯 不同点标记（共 {formSpots.length} 个）
                  </label>
                  <div className="flex items-center gap-2">
                    <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                      className="rounded bg-white/10 px-2 py-1 text-xs text-white outline-none w-24"
                      placeholder="标记名称" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); } }} />
                    <span className="text-xs text-gray-500">输入名称后点击下方图片</span>
                  </div>
                </div>

                {/* 图片预览 + 点击标记 */}
                {formImgA && formImgB ? (
                  <div className="flex gap-2">
                    {(['a', 'b'] as const).map(which => {
                      const url = which === 'a' ? formImgA : formImgB;
                      return (
                        <div key={which} className="flex-1">
                          <div className="mb-1 text-center text-xs text-gray-500">
                            {which === 'a' ? '📷 原图' : '🔎 改动图'}
                          </div>
                          <div
                            ref={which === editOnImage ? imgRef : undefined}
                            onClick={which === editOnImage ? handleImageClick : undefined}
                            style={{ cursor: which === editOnImage ? 'crosshair' : 'default' }}
                            className="relative rounded-lg border-2 overflow-hidden"
                            onMouseEnter={() => setEditOnImage(which)}
                          >
                            <img src={url} alt="" className="w-full" style={{ maxHeight: 240, objectFit: 'contain' }} />
                            {/* 标记点 */}
                            {formSpots.map((spot, i) => (
                              <div key={i} style={{
                                position: 'absolute',
                                left: `${spot.x}%`, top: `${spot.y}%`,
                                transform: 'translate(-50%, -50%)',
                              }}>
                                <div style={{
                                  width: spot.radius * 2.5, height: spot.radius * 2.5,
                                  border: '2px solid #FF6B6B', borderRadius: '50%',
                                  background: 'rgba(255,107,107,0.15)',
                                  pointerEvents: 'auto', cursor: 'pointer',
                                }} onClick={(e) => { e.stopPropagation(); removeSpot(i); }} title="点击删除" />
                                <div style={{
                                  position: 'absolute', top: '100%', left: '50%',
                                  transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                                  fontSize: 10, color: '#FF6B6B', marginTop: 2,
                                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                }}>{spot.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/20 p-6 text-center text-sm text-gray-500">
                    请先上传两张图片，然后可以在图片上点击标记不同点
                  </div>
                )}

                {/* 不同点列表 */}
                {formSpots.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {formSpots.map((spot, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                        {spot.label} ({spot.x}%,{spot.y}%)
                        <button onClick={() => removeSpot(i)} className="text-red-400 hover:text-red-200">×</button>
                      </span>
                    ))}
                  </div>
                )}
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
