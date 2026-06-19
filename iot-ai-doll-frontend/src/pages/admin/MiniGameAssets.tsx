/**
 * 素材管理 - 上传/预览/删除 epet 素材（背景/CG/宠物/UI/特效/小游戏）
 */
import { useState, useEffect, useRef } from 'react';
import client from '../../api/client';

interface GameAsset {
  name: string;
  url: string;
  type: string;
  size: number;
  sizeFormatted: string;
  modified: string;
}

const ASSET_TYPES = [
  { id: 'bg', name: '🖼️ 背景图', desc: '庭院、场景背景', color: 'from-blue-500/20 to-cyan-500/20' },
  { id: 'cg', name: '🎨 CG图鉴', desc: '解锁角色立绘', color: 'from-pink-500/20 to-rose-500/20' },
  { id: 'pets', name: '🐾 宠物形象', desc: '各状态宠物立绘', color: 'from-amber-500/20 to-orange-500/20' },
  { id: 'ui', name: '🎯 UI元素', desc: '按钮、图标、弹窗', color: 'from-green-500/20 to-emerald-500/20' },
  { id: 'fx', name: '✨ 特效', desc: '粒子、光效、动画', color: 'from-purple-500/20 to-violet-500/20' },
  { id: 'chat-bgs', name: '💬 互动背景', desc: '聊天互动页背景池(可设当前使用)', color: 'from-rose-500/20 to-pink-500/20' },
  { id: 'game-assets', name: '🎨 美术素材', desc: '小游戏、UI、特效等通用美术素材', color: 'from-indigo-500/20 to-blue-500/20' },
];

const GAMES = [
  { id: '100floor', name: '是男人就下100层', icon: '🏃' },
  { id: 'match3', name: '消消乐', icon: '💎' },
  { id: 'rps', name: '猜拳', icon: '✊' },
  { id: 'memory', name: '记忆卡牌', icon: '🃏' },
  { id: 'flappy', name: 'Flappy Bird', icon: '🐦' },
  { id: 'gifts', name: '天降好礼', icon: '🎁' },
  { id: 'spot', name: '找不同', icon: '🔍' },
  { id: 'fishing', name: '钓鱼', icon: '🎣' },
  { id: 'tower', name: '塔楼建筑', icon: '🏗️' },
  { id: 'platform', name: '平台跳跃', icon: '🦘' },
  { id: 'pacman', name: '吃豆人', icon: '👾' },
  { id: 'cook', name: '煎鱼小游戏', icon: '🐟' },
];

export default function MiniGameAssets() {
  const [assets, setAssets] = useState<GameAsset[]>([]);
  const [activeType, setActiveType] = useState('bg');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [yardBgUrl, setYardBgUrl] = useState<string>('/epet/yard-bg.png');
  const [chatBgUrl, setChatBgUrl] = useState<string>('/epet/chat-bg.png');
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get(`/game-assets?type=${activeType}`);
      setAssets(res.data.assets || []);
    } catch (err) {
      console.error('加载素材失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 刷新当前庭院背景
  const refreshYardBg = () => {
    setYardBgUrl(`/epet/yard-bg.png?t=${Date.now()}`);
  };

  useEffect(() => { load(); }, [activeType]);

  // 拖拽上传
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragRef.current?.classList.remove('border-purple-500');
    const file = e.dataTransfer.files[0];
    if (file) await doUpload(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await doUpload(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const doUpload = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      alert(`文件太大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大 50MB`);
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('type', activeType);
    try {
      // 不设 headers，让 axios 自动生成 boundary
      // 默认 15s 超时不够，client.ts 拦截器已给 FormData 5 分钟
      await client.post('/game-assets/upload', form, {
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 100);
            console.log(`上传中... ${pct}%`);
          }
        },
      });
      await load();
      if (activeType === 'bg') {
        alert('上传成功！如果是庭院背景，可以点击"设为庭院背景"按钮');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      const msg = err.response?.data?.error || err.message;
      alert('上传失败: ' + msg);
    } finally {
      setUploading(false);
    }
  };

  // 设为互动页背景
  const setAsChatBg = async (url: string) => {
    if (!confirm('将此图设为互动页背景?\n(会替换当前的 chat-bg.png)')) return;
    try {
      const filename = url.split('/').pop();
      // 强制 type='chat-bgs', set-chat-bg 期望文件在 assets/chat-bgs/ 下
      await client.post('/game-assets/set-chat-bg', { filename, type: 'chat-bgs' });
      alert('已设为互动页背景! 刷新 epet 互动页即可看到新背景');
      refreshChatBg();
    } catch (err: any) {
      alert('设置失败: ' + (err.response?.data?.error || err.message));
    }
  };

  // 刷新当前互动页背景缩略图
  const refreshChatBg = () => {
    setChatBgUrl(`/epet/chat-bg.png?t=${Date.now()}`);
  };

  // 设为庭院背景
  const setAsYardBg = async (url: string) => {
    if (!confirm('将此图设为庭院背景？\n（会替换当前的 yard-bg.png）')) return;
    try {
      // 提取文件名
      const filename = url.split('/').pop();
      await client.post('/game-assets/set-yard-bg', { filename, type: activeType });
      alert('已设为庭院背景！刷新 epet 页面即可看到新背景');
      refreshYardBg();
    } catch (err: any) {
      alert('设置失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确认删除 ${name}？`)) return;
    try {
      await client.delete(`/game-assets/${activeType}/${encodeURIComponent(name)}`);
      setAssets(prev => prev.filter(a => a.name !== name));
      if (previewUrl && previewUrl.includes(name)) setPreviewUrl(null);
    } catch (err: any) {
      alert('删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="p-6 animate-fade-in-up">
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🎨 素材管理</h2>
          <p className="mt-1 text-sm text-gray-500">上传、预览和管理 epet 各类素材</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {uploading ? '⏳ 上传中...' : '+ 上传素材'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>

      {/* 当前庭院背景预览（仅在背景图标签显示） */}
      {activeType === 'bg' && (
        <div className="mb-6 rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">🏡 当前庭院背景</h3>
            <button 
              onClick={refreshYardBg}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              🔄 刷新预览
            </button>
          </div>
          <div className="relative overflow-hidden rounded-lg" style={{ maxHeight: '200px' }}>
            <img 
              src={yardBgUrl} 
              alt="当前庭院背景"
              className="w-full object-cover object-top"
              style={{ maxHeight: '200px' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/epet/yard-bg.png';
              }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            路径: /epet/yard-bg.png | 上传新背景图后点击"设为庭院背景"即可替换
          </p>
        </div>
      )}

      {/* 互动页背景 - 当前使用预览 (chat-bgs tab 时显示) */}
      {activeType === 'chat-bgs' && (
        <div className="mb-6 rounded-xl border border-rose-500/20 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-rose-300">💬 当前互动页背景</span>
            <span className="text-xs text-gray-500">(用户进入聊天互动页时显示)</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <img
              src={chatBgUrl}
              alt="当前互动页背景"
              className="w-full object-cover object-top"
              style={{ maxHeight: '200px' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/epet/chat-bg.png';
              }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            路径: /epet/chat-bg.png | 上传新互动背景后点击卡片"设为互动背景"即可替换
          </p>
          <p className="mt-1 text-xs text-amber-400/80">
            💡 当前版本仅支持设置 1 个互动背景, 未来可扩展商店购买+切换新背景
          </p>
        </div>
      )}

      {/* 素材类型标签 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {ASSET_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => setActiveType(type.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              activeType === type.id
                ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>{type.name}</span>
            <span className="text-xs opacity-60">{type.desc}</span>
          </button>
        ))}
      </div>

      {/* 小游戏列表（仅在小游戏标签显示） */}
      {activeType === 'game-assets' && (
        <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
          {GAMES.map(g => (
            <div key={g.id} className="flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-card p-3">
              <span className="text-2xl">{g.icon}</span>
              <span className="text-center text-xs text-gray-400 leading-tight">{g.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* 拖拽上传区 */}
      <div
        ref={dragRef}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-purple-500'); }}
        onDragLeave={() => dragRef.current?.classList.remove('border-purple-500')}
        onDrop={handleDrop}
        className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-card p-8 transition hover:border-purple-500/40 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        onClick={() => fileRef.current?.click()}
      >
        <div className="text-5xl opacity-30">📤</div>
        <p className="mt-3 text-sm text-gray-400">
          拖拽图片到此处，或点击选择文件
          <span className="ml-2 rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
            {ASSET_TYPES.find(t => t.id === activeType)?.name}
          </span>
        </p>
        <p className="mt-1 text-xs text-gray-600">支持 PNG / JPG / GIF / WebP / SVG，最大 10MB</p>
      </div>

      {/* 素材网格 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">加载素材列表...</div>
      ) : assets.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          暂无{activeType === 'game-assets' ? '小游戏' : ''}素材，请上传
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {assets.map(asset => (
            <div key={asset.name} className="group overflow-hidden rounded-xl border border-white/10 bg-card transition hover:border-cyan-500/30">
              {/* 预览图 */}
              <div
                className="relative flex h-32 cursor-pointer items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden"
                onClick={() => setPreviewUrl(asset.url)}
              >
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="max-h-full max-w-full object-contain p-2 transition group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {/* 悬浮遮罩 */}
                <div className="absolute inset-0 bg-black/50 opacity-0 transition group-hover:opacity-100 flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">点击预览</span>
                </div>
                {/* 类型标签 */}
                <div className="absolute top-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80">
                  {asset.type}
                </div>
              </div>
              {/* 信息栏 */}
              <div className="p-3">
                <p className="truncate text-xs font-medium text-white" title={asset.name}>{asset.name}</p>
                <p className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>{asset.sizeFormatted}</span>
                </p>
                {/* 操作按钮 */}
                <div className="mt-2 flex gap-2">
                  {activeType === 'bg' && (
                    <button
                      onClick={() => setAsYardBg(asset.url)}
                      className="flex-1 rounded bg-blue-500/20 px-2 py-1 text-[10px] text-blue-300 hover:bg-blue-500/30 transition"
                      title="复制为 yard-bg.png, 庭院背景"
                    >
                      设为庭院背景
                    </button>
                  )}
                  {activeType === 'chat-bgs' && (
                    <button
                      onClick={() => setAsChatBg(asset.url)}
                      className="flex-1 rounded bg-rose-500/20 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-500/30 transition"
                      title="复制为 chat-bg.png, 互动页背景"
                    >
                      设为互动背景
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(asset.name)}
                    className="rounded bg-red-500/20 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/30 transition"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 统计 */}
      {!loading && assets.length > 0 && (
        <div className="mt-6 text-center text-xs text-gray-600">
          共 {assets.length} 个{activeType === 'game-assets' ? '小游戏' : ''}素材 · 总大小 {(assets.reduce((sum, a) => sum + a.size, 0) / 1024).toFixed(1)} KB
        </div>
      )}

      {/* 全屏预览弹窗 */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
            onClick={() => setPreviewUrl(null)}
          >
            ✕ 关闭
          </button>
        </div>
      )}
    </div>
  );
}
