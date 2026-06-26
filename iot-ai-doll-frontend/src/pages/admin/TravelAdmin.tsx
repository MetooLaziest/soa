import { useState, useEffect } from 'react';
import client from '../../api/client';

const RARITY_OPTIONS = ['N', 'R', 'SR', 'SSR', 'UR'] as const;
const RARITY_COLORS: Record<string, string> = { N: '#aaa', R: '#4CAF50', SR: '#2196F3', SSR: '#FF9800', UR: '#E91E63' };

export default function TravelAdmin() {
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<number | null>(null);
  const [modelPostcards, setModelPostcards] = useState<any[]>([]);
  const [allPostcards, setAllPostcards] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showAddPostcard, setShowAddPostcard] = useState(false);
  const [addForm, setAddForm] = useState({ postcard_id: 0, probability: 10, unlock_shop_item_id: 0 });

  // 加载 models
  useEffect(() => {
    client.get('/epet1/travel/admin/models').then(res => {
      setModels(res.data.models || []);
    }).catch(e => console.error(e));
  }, []);

  // 加载所有明信片 + 商品（用于添加/编辑）
  useEffect(() => {
    client.get('/epet1/travel/admin/all-postcards').then(res => {
      setAllPostcards(res.data.postcards || []);
    }).catch(e => console.error(e));
    client.get('/epet1/shop2/admin/items').then(res => {
      setShopItems(res.data.items || []);
    }).catch(e => console.error(e));
  }, []);

  // 选中 model 时加载其明信片
  useEffect(() => {
    if (!selectedModel) return;
    client.get(`/epet1/travel/admin/models/${selectedModel}/postcards`).then(res => {
      setModelPostcards(res.data.postcards || []);
    }).catch(e => console.error(e));
  }, [selectedModel]);

  // 上传图片/视频
  const uploadFile = async (file: File, _type: 'image' | 'video'): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'postcards');
    const res = await client.post('/game-assets/upload', formData, {
      timeout: 300000,
    });
    return res.data?.asset?.url || '';
  };

  // 添加明信片关联
  const handleAddPostcard = async () => {
    if (!selectedModel || !addForm.postcard_id) return;
    await client.post(`/epet1/travel/admin/models/${selectedModel}/postcards`, {
      postcard_id: addForm.postcard_id,
      probability: addForm.probability,
      unlock_shop_item_id: addForm.unlock_shop_item_id || null,
    });
    setShowAddPostcard(false);
    setAddForm({ postcard_id: 0, probability: 10, unlock_shop_item_id: 0 });
    // 刷新
    const res = await client.get(`/epet1/travel/admin/models/${selectedModel}/postcards`);
    setModelPostcards(res.data.postcards || []);
  };

  // 更新概率/解锁商品
  const handleUpdateAssoc = async (assocId: number, data: { probability?: number; unlock_shop_item_id?: number | null }) => {
    await client.put(`/epet1/travel/admin/postcards/${assocId}`, data);
    if (selectedModel) {
      const res = await client.get(`/epet1/travel/admin/models/${selectedModel}/postcards`);
      setModelPostcards(res.data.postcards || []);
    }
  };

  // 删除关联
  const handleDeleteAssoc = async (assocId: number) => {
    if (!confirm('确定删除此明信片关联？')) return;
    await client.delete(`/epet1/travel/admin/postcards/${assocId}`);
    if (selectedModel) {
      const res = await client.get(`/epet1/travel/admin/models/${selectedModel}/postcards`);
      setModelPostcards(res.data.postcards || []);
    }
  };

  // 更新明信片本身 (图片/视频/名称等)
  const handleUpdatePostcard = async (postcardId: number, data: any) => {
    await client.put(`/epet1/travel/admin/postcards-detail/${postcardId}`, data);
    if (selectedModel) {
      const res = await client.get(`/epet1/travel/admin/models/${selectedModel}/postcards`);
      setModelPostcards(res.data.postcards || []);
    }
    // Also refresh all postcards
    const pcRes = await client.get('/epet1/travel/admin/all-postcards');
    setAllPostcards(pcRes.data.postcards || []);
  };

  // 创建新明信片
  const [newPostcard, setNewPostcard] = useState({ name: '', rarity: 'N', rarity_weight: 10, description: '', display_scene: '' });
  const [showNewPostcard, setShowNewPostcard] = useState(false);

  const handleCreatePostcard = async () => {
    if (!newPostcard.name) return;
    await client.post('/epet1/travel/admin/all-postcards', newPostcard);
    setShowNewPostcard(false);
    setNewPostcard({ name: '', rarity: 'N', rarity_weight: 10, description: '', display_scene: '' });
    const pcRes = await client.get('/epet1/travel/admin/all-postcards');
    setAllPostcards(pcRes.data.postcards || []);
  };

  // 可添加的明信片（排除已有）
  const availablePostcards = allPostcards.filter(
    (pc: any) => !modelPostcards.some((mp: any) => mp.postcard_id === pc.id)
  );

  // 计算"空"概率
  const totalWeight = modelPostcards.reduce((s: number, p: any) => s + parseFloat(p.probability), 0);
  const missWeight = selectedModel ? Math.max(5, 20 - 5) : 0; // 基础15，简化显示

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🧳 旅游管理</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧: pet_models 列表 */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-3 text-white">宠物型号</h2>
          <div className="space-y-2">
            {models.map((m: any) => (
              <div
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedModel === m.id ? 'bg-amber-600/30 border border-amber-500' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                <div className="flex items-center gap-2">
                  {m.image_url && <img src={m.image_url} className="w-8 h-8 object-contain" />}
                  <span className="font-medium text-white">{m.name}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">明信片: {m.postcard_count} 张</div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧: 选中 model 的明信片配置 */}
        <div className="lg:col-span-2 bg-gray-800 rounded-xl p-4">
          {!selectedModel ? (
            <div className="text-center text-gray-400 py-12">← 选择一个宠物型号</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  {models.find(m => m.id === selectedModel)?.name} — 明信片池
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNewPostcard(true)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >+ 新明信片</button>
                  <button
                    onClick={() => setShowAddPostcard(true)}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"
                    disabled={availablePostcards.length === 0}
                  >+ 添加关联</button>
                </div>
              </div>

              {/* 概率概览 */}
              <div className="mb-4 p-3 bg-gray-700 rounded-lg text-sm">
                <div className="text-gray-300">
                  池子权重: {totalWeight} + 空{missWeight} = {totalWeight + missWeight}
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  "空"概率 ≈ {((missWeight / (totalWeight + missWeight)) * 100).toFixed(1)}% (料理评级影响)
                </div>
              </div>

              {/* 明信片列表 */}
              <div className="space-y-3">
                {modelPostcards.map((mp: any) => (
                  <div key={mp.id} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      {/* 明信片图片 */}
                      <div className="w-16 h-12 bg-gray-600 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {mp.image_url ? (
                          <img src={mp.image_url} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">💌</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{mp.name}</span>
                          <span style={{ color: RARITY_COLORS[mp.rarity] }} className="text-xs font-bold">{mp.rarity}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{mp.description}</div>

                        {/* 概率编辑 */}
                        <div className="flex items-center gap-2 mt-2">
                          <label className="text-xs text-gray-400">概率权重:</label>
                          <input
                            type="number" min="0" max="100" step="1"
                            value={mp.probability}
                            onChange={(e) => {
                              setModelPostcards(prev => prev.map(p => p.id === mp.id ? { ...p, probability: e.target.value } : p));
                            }}
                            onBlur={(e) => handleUpdateAssoc(mp.id, { probability: parseFloat(e.target.value) || 10 })}
                            className="w-16 px-2 py-0.5 bg-gray-600 text-white rounded text-sm"
                          />
                        </div>

                        {/* 解锁商品 */}
                        <div className="flex items-center gap-2 mt-1">
                          <label className="text-xs text-gray-400">解锁商品:</label>
                          <select
                            value={mp.unlock_shop_item_id || ''}
                            onChange={(e) => handleUpdateAssoc(mp.id, { unlock_shop_item_id: e.target.value ? parseInt(e.target.value) : null })}
                            className="bg-gray-600 text-white rounded text-xs px-2 py-0.5"
                          >
                            <option value="">无</option>
                            {shopItems.map((si: any) => (
                              <option key={si.id} value={si.id}>{si.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* 图片上传 */}
                        <div className="flex items-center gap-2 mt-2">
                          <label className="text-xs text-gray-400">明信片图:</label>
                          <label className={`cursor-pointer px-2 py-0.5 rounded text-xs ${uploading === `img-${mp.postcard_id}` ? 'bg-gray-600 text-gray-400' : 'bg-cyan-700 text-white hover:bg-cyan-600'}`}>
                            {uploading === `img-${mp.postcard_id}` ? '上传中...' : '上传'}
                            <input type="file" accept="image/*" className="hidden"
                              disabled={uploading === `img-${mp.postcard_id}`}
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                setUploading(`img-${mp.postcard_id}`);
                                try {
                                  const url = await uploadFile(f, 'image');
                                  await handleUpdatePostcard(mp.postcard_id, { image_url: url });
                                } catch (err) { alert('上传失败'); }
                                setUploading(null);
                              }}
                            />
                          </label>
                          {mp.image_url ? <span className="text-xs text-green-400">✅</span> : <span className="text-xs text-gray-500">❌</span>}

                          <label className="text-xs text-gray-400 ml-2">旅游视频:</label>
                          <label className={`cursor-pointer px-2 py-0.5 rounded text-xs ${uploading === `vid-${mp.postcard_id}` ? 'bg-gray-600 text-gray-400' : 'bg-purple-700 text-white hover:bg-purple-600'}`}>
                            {uploading === `vid-${mp.postcard_id}` ? '上传中...' : '上传'}
                            <input type="file" accept="video/*" className="hidden"
                              disabled={uploading === `vid-${mp.postcard_id}`}
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                setUploading(`vid-${mp.postcard_id}`);
                                try {
                                  const url = await uploadFile(f, 'video');
                                  await handleUpdatePostcard(mp.postcard_id, { video_url: url });
                                } catch (err) { alert('上传失败'); }
                                setUploading(null);
                              }}
                            />
                          </label>
                          {mp.video_url ? <span className="text-xs text-green-400">✅已上传</span> : <span className="text-xs text-gray-500">未上传</span>}
                        </div>
                      </div>

                      {/* 删除按钮 */}
                      <button
                        onClick={() => handleDeleteAssoc(mp.id)}
                        className="text-red-400 hover:text-red-300 text-sm flex-shrink-0"
                      >✕</button>
                    </div>
                  </div>
                ))}

                {modelPostcards.length === 0 && (
                  <div className="text-center text-gray-400 py-8">暂无明信片配置，点击上方按钮添加</div>
                )}
              </div>

              {/* 添加关联弹窗 */}
              {showAddPostcard && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddPostcard(false)}>
                  <div className="bg-gray-800 rounded-xl p-6 w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-white mb-4">添加明信片关联</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-gray-400">选择明信片</label>
                        <select
                          value={addForm.postcard_id}
                          onChange={e => setAddForm({ ...addForm, postcard_id: parseInt(e.target.value) })}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-1"
                        >
                          <option value={0}>请选择</option>
                          {availablePostcards.map((pc: any) => (
                            <option key={pc.id} value={pc.id}>{pc.name} ({pc.rarity})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">概率权重</label>
                        <input
                          type="number" min="0" max="100"
                          value={addForm.probability}
                          onChange={e => setAddForm({ ...addForm, probability: parseFloat(e.target.value) || 10 })}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">解锁商品 (可选)</label>
                        <select
                          value={addForm.unlock_shop_item_id}
                          onChange={e => setAddForm({ ...addForm, unlock_shop_item_id: parseInt(e.target.value) || 0 })}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-1"
                        >
                          <option value={0}>无</option>
                          {shopItems.map((si: any) => (
                            <option key={si.id} value={si.id}>{si.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button onClick={() => setShowAddPostcard(false)} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">取消</button>
                      <button onClick={handleAddPostcard} disabled={!addForm.postcard_id} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-500 disabled:opacity-50">添加</button>
                    </div>
                  </div>
                </div>
              )}

              {/* 创建新明信片弹窗 */}
              {showNewPostcard && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowNewPostcard(false)}>
                  <div className="bg-gray-800 rounded-xl p-6 w-96" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-white mb-4">创建新明信片</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-gray-400">名称</label>
                        <input value={newPostcard.name} onChange={e => setNewPostcard({ ...newPostcard, name: e.target.value })}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-1" />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">稀有度</label>
                        <select value={newPostcard.rarity} onChange={e => setNewPostcard({ ...newPostcard, rarity: e.target.value })}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-1">
                          {RARITY_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">稀有度权重</label>
                        <input type="number" value={newPostcard.rarity_weight} onChange={e => setNewPostcard({ ...newPostcard, rarity_weight: parseInt(e.target.value) || 10 })}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-1" />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">描述</label>
                        <textarea value={newPostcard.description} onChange={e => setNewPostcard({ ...newPostcard, description: e.target.value })}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-1" rows={2} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">场景</label>
                        <input value={newPostcard.display_scene} onChange={e => setNewPostcard({ ...newPostcard, display_scene: e.target.value })}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-1" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button onClick={() => setShowNewPostcard(false)} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">取消</button>
                      <button onClick={handleCreatePostcard} disabled={!newPostcard.name} className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50">创建</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
