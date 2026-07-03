/**
 * IconAssets — Admin page for managing uploadable icon assets
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

const DEFAULT_ICONS = [
  { icon_key: 'icon-collection', label: '藏品库' },
  { icon_key: 'icon-minigame', label: '小游戏' },
  { icon_key: 'icon-shop', label: '商店' },
  { icon_key: 'icon-backpack', label: '背包' },
  { icon_key: 'icon-travel', label: '旅行' },
  { icon_key: 'icon-driftbottle', label: '漂流瓶' },
  { icon_key: 'icon-chat', label: '聊天' },
  { icon_key: 'icon-feed', label: '喂食' },
  { icon_key: 'icon-clean', label: '清理' },
  { icon_key: 'icon-place', label: '布置' },
  { icon_key: 'icon-recycle', label: '回收' },
  { icon_key: 'icon-dawn', label: '清晨' },
  { icon_key: 'icon-day', label: '白天' },
  { icon_key: 'icon-night', label: '夜晚' },
  { icon_key: 'icon-map', label: '区域导航' },
];

interface IconItem {
  id: number;
  icon_key: string;
  label: string;
  image_url: string;
  width: number;
  height: number;
}

export default function IconAssets() {
  const [icons, setIcons] = useState<IconItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/admin/icons');
      setIcons(res.data.icons || []);
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const initDefaults = async () => {
    try {
      const res = await client.post('/admin/icons/init-defaults');
      alert(`已初始化 ${res.data.created} 个新图标，共 ${res.data.total} 个默认图标`);
      load();
    } catch (err: any) {
      alert('初始化失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const uploadIcon = async (iconKey: string, file: File) => {
    setUploadingKey(iconKey);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const image_data = ev.target?.result as string;
        await client.post('/admin/icons/upload', { icon_key: iconKey, image_data });
        load();
        setUploadingKey(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('上传失败: ' + (err.response?.data?.error || err.message));
      setUploadingKey(null);
    }
  };

  const addIcon = async () => {
    if (!newKey) return;
    try {
      await client.post('/admin/icons', { icon_key: newKey, label: newLabel || newKey });
      setNewKey(''); setNewLabel(''); setShowAdd(false);
      load();
    } catch (err: any) {
      alert('添加失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteIcon = async (iconKey: string) => {
    if (!confirm(`确定删除图标 ${iconKey}？`)) return;
    try {
      await client.delete(`/admin/icons/${iconKey}`);
      load();
    } catch (err: any) {
      alert('删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  // Merge DB icons with default list for display
  const iconMap = new Map(icons.map(i => [i.icon_key, i]));
  const displayIcons = DEFAULT_ICONS.map(d => {
    const db = iconMap.get(d.icon_key);
    return db || { id: 0, icon_key: d.icon_key, label: d.label, image_url: '', width: 64, height: 64 };
  });
  // Add any extra icons not in defaults
  for (const i of icons) {
    if (!DEFAULT_ICONS.find(d => d.icon_key === i.icon_key)) {
      displayIcons.push(i);
    }
  }

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🎨 图标素材管理</h2>
          <p className="mt-1 text-sm text-gray-500">上传和管理庭院 UI 图标，替换默认 Emoji</p>
        </div>
        <div className="flex gap-2">
          <button onClick={initDefaults}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/20">
            🔄 初始化默认图标
          </button>
          <button onClick={() => setShowAdd(true)}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
            + 自定义图标
          </button>
        </div>
      </div>

      {/* Icon grid */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {displayIcons.map(icon => {
            const isUploading = uploadingKey === icon.icon_key;
            const hasImage = !!icon.image_url;
            return (
              <div key={icon.icon_key} className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col items-center">
                {/* Preview */}
                <div className="w-16 h-16 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center mb-2 overflow-hidden"
                  style={hasImage ? {} : { background: 'linear-gradient(135deg, rgba(139,105,20,0.2), rgba(107,142,35,0.2))' }}>
                  {hasImage ? (
                    <img src={icon.image_url} alt={icon.label} className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-2xl opacity-30">?</span>
                  )}
                </div>

                {/* Label */}
                <div className="text-xs text-white font-medium mb-0.5 text-center truncate w-full">{icon.label}</div>
                <div className="text-[10px] text-gray-500 font-mono mb-2">{icon.icon_key}</div>

                {/* Status */}
                <div className="flex items-center gap-1 mb-2">
                  {hasImage ? (
                    <span className="text-[10px] text-green-400">✅ 已上传</span>
                  ) : (
                    <span className="text-[10px] text-gray-500">⬜ 待上传</span>
                  )}
                </div>

                {/* Upload button */}
                <label className={`cursor-pointer w-full text-center rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isUploading ? 'bg-gray-600 text-gray-400' : 'bg-purple-600/30 text-purple-300 hover:bg-purple-600/50'}`}>
                  {isUploading ? '⏳ 上传中...' : '📤 上传图片'}
                  <input type="file" accept="image/png,image/svg+xml,image/webp" className="hidden" disabled={isUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadIcon(icon.icon_key, f); e.target.value = ''; }} />
                </label>

                {/* Delete (only for non-default icons) */}
                {!DEFAULT_ICONS.find(d => d.icon_key === icon.icon_key) && (
                  <button onClick={() => deleteIcon(icon.icon_key)}
                    className="mt-2 text-[10px] text-red-400 hover:text-red-300">
                    🗑️ 删除
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Preview section */}
      {!loading && icons.some(i => i.image_url) && (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">👁️ 预览效果</h3>
          <div className="flex flex-wrap gap-4">
            {/* Dark bg preview */}
            <div className="rounded-lg bg-slate-900 p-4 border border-white/10">
              <div className="text-[10px] text-gray-500 mb-2">深色背景</div>
              <div className="flex gap-3">
                {icons.filter(i => i.image_url).slice(0, 6).map(i => (
                  <img key={i.icon_key} src={i.image_url} alt={i.label} className="w-8 h-8 object-contain" />
                ))}
              </div>
            </div>
            {/* Light bg preview */}
            <div className="rounded-lg bg-amber-50 p-4 border border-white/10">
              <div className="text-[10px] text-gray-600 mb-2">浅色背景</div>
              <div className="flex gap-3">
                {icons.filter(i => i.image_url).slice(0, 6).map(i => (
                  <img key={i.icon_key} src={i.image_url} alt={i.label} className="w-8 h-8 object-contain" />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add custom icon modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">添加自定义图标</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">图标 Key（英文，如 icon-custom-xxx）</label>
                <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="icon-custom-xxx"
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white font-mono outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">显示名称</label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="自定义图标"
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/20">取消</button>
              <button onClick={addIcon} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">添加</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="py-8 text-center text-sm text-gray-400">加载中...</div>}
    </div>
  );
}
