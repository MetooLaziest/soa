/**
 * 商店管理 - 商品CRUD + 背景图配置
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

const SHOP_TABS = [
  { id: 'food', name: '🥘 食材' },
  { id: 'furniture', name: '🪑 家具' },
  { id: 'decoration', name: '✨ 装扮' },
  { id: 'map', name: '🗺️ 地图' },
  { id: 'toy', name: '🎨 潮玩' },
];

interface ShopItem {
  id: number;
  name: string;
  item_type: string;
  item_category: string;
  shop_tab: string;
  price_emotion: number;
  price_real: number;
  image_url: string;
  description: string;
  stock: number;
  is_active: boolean;
}

export default function ShopAdmin() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [bgImage, setBgImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShopItem | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formShopTab, setFormShopTab] = useState('food');
  const [formCategory, setFormCategory] = useState('food');
  const [formPrice, setFormPrice] = useState(0);
  const [formDesc, setFormDesc] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formStock, setFormStock] = useState(-1);

  const load = async () => {
    setLoading(true);
    try {
      const [itemsRes, configRes] = await Promise.all([
        client.get('/epet1/shop2/admin/items'),
        client.get('/epet1/shop2/config'),
      ]);
      setItems(itemsRes.data.items || []);
      setBgImage(configRes.data.config?.background_image || '');
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormName(''); setFormShopTab('food'); setFormCategory('food');
    setFormPrice(0); setFormDesc(''); setFormImageUrl(''); setFormStock(-1);
    setEditing(null); setShowForm(false);
  };

  const openEdit = (item: ShopItem) => {
    setEditing(item);
    setFormName(item.name); setFormShopTab(item.shop_tab);
    setFormCategory(item.item_category); setFormPrice(item.price_emotion);
    setFormDesc(item.description || ''); setFormImageUrl(item.image_url || '');
    setFormStock(item.stock); setShowForm(true);
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

  const uploadBgImage = async (file: File) => {
    setUploadingBg(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', 'game-assets');
      const res = await client.post('/game-assets/upload', form, { timeout: 300000 });
      if (res.data?.asset?.url) {
        const url = res.data.asset.url;
        await client.post('/epet1/shop2/config', { key: 'background_image', value: url });
        setBgImage(url);
      }
    } catch (err: any) {
      alert('上传失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingBg(false);
    }
  };

  const save = async () => {
    if (!formName) return;
    try {
      if (editing) {
        await client.put(`/epet1/shop2/admin/items/${editing.id}`, {
          name: formName, shop_tab: formShopTab, item_category: formCategory,
          price_emotion: formPrice, image_url: formImageUrl,
          description: formDesc, stock: formStock,
        });
      } else {
        await client.post('/epet1/shop2/admin/items', {
          name: formName, item_type: 'virtual', item_category: formCategory,
          shop_tab: formShopTab, price_emotion: formPrice,
          image_url: formImageUrl, description: formDesc, stock: formStock,
        });
      }
      resetForm(); load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm('确认删除？')) return;
    try { await client.delete(`/epet1/shop2/admin/items/${id}`); load(); }
    catch (err: any) { alert('删除失败: ' + err.message); }
  };

  const filtered = activeTab === 'all' ? items : items.filter(i => i.shop_tab === activeTab);

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🛍️ 商店管理</h2>
          <p className="mt-1 text-sm text-gray-500">管理商品和商店背景</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
          + 新增商品
        </button>
      </div>

      {/* 商店背景图 */}
      <div className="mb-6 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">🖼️ 商店背景图</h3>
          <label className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium ${
            uploadingBg ? 'bg-gray-600 text-gray-400' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
            {uploadingBg ? '上传中...' : '上传背景'}
            <input type="file" accept="image/*" className="hidden" disabled={uploadingBg}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadBgImage(f); }} />
          </label>
        </div>
        {bgImage ? (
          <div className="overflow-hidden rounded-lg" style={{ maxHeight: 160 }}>
            <img src={bgImage} alt="商店背景" className="w-full object-cover" style={{ maxHeight: 160 }} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/20 p-8 text-center text-sm text-gray-500">
            未设置背景图，默认使用渐变色
          </div>
        )}
      </div>

      {/* Tab 筛选 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setActiveTab('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${activeTab === 'all' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-white/5 text-gray-400'}`}>
          全部
        </button>
        {SHOP_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${activeTab === t.id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-white/5 text-gray-400'}`}>
            {t.name}
          </button>
        ))}
      </div>

      {/* 商品列表 */}
      {!loading && (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg overflow-hidden">
                  {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : '📦'}
                </div>
                <div>
                  <span className="font-medium text-white text-sm">{item.name}</span>
                  <div className="text-xs text-gray-500">
                    {SHOP_TABS.find(t => t.id === item.shop_tab)?.name || item.shop_tab} · 💛{item.price_emotion}
                    {item.stock >= 0 && ` · 库存:${item.stock}`}
                    {!item.is_active && ' · ❌已下架'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(item)} className="rounded bg-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/20">编辑</button>
                <button onClick={() => deleteItem(item.id)} className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30">删除</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="py-8 text-center text-sm text-gray-500">暂无商品</div>}
        </div>
      )}

      {/* 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={resetForm}>
          <div className="w-full max-w-md rounded-xl bg-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">{editing ? '编辑' : '新增'}商品</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">名称</label>
                <input value={formName} onChange={e => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400">分类Tab</label>
                  <select value={formShopTab} onChange={e => setFormShopTab(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none">
                    {SHOP_TABS.map(t => <option key={t.id} value={t.id} className="bg-slate-800">{t.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400">背包类别</label>
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none">
                    <option value="food" className="bg-slate-800">食材</option>
                    <option value="furniture" className="bg-slate-800">家具</option>
                    <option value="decoration" className="bg-slate-800">装扮</option>
                    <option value="postcard" className="bg-slate-800">明信片</option>
                    <option value="toy" className="bg-slate-800">潮玩</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400">价格(情绪值)</label>
                  <input type="number" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))}
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
                    <label className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-medium ${uploadingImg ? 'bg-gray-600 text-gray-400' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}>
                      {uploadingImg ? '...' : '上传'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingImg}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
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
