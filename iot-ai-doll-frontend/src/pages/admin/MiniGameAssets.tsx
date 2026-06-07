/**
 * 小游戏素材管理 - 上传/预览/删除游戏贴图
 */
import { useState, useEffect, useRef } from 'react';
import client from '../../api/client';

interface GameAsset {
  name: string;
  url: string;
  size: number;
  sizeFormatted: string;
  modified: string;
}

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
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/game-assets');
      setAssets(res.data.assets || []);
    } catch (err) {
      console.error('加载素材失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 拖拽上传
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await doUpload(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await doUpload(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await client.post('/game-assets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await load();
    } catch (err: any) {
      alert('上传失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确认删除 ${name}？`)) return;
    try {
      await client.delete(`/game-assets/${encodeURIComponent(name)}`);
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
          <h2 className="text-xl font-bold text-white">🎮 小游戏素材管理</h2>
          <p className="mt-1 text-sm text-gray-500">上传、预览和管理小游戏使用的图片素材</p>
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

      {/* 游戏列表概览 */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
        {GAMES.map(g => (
          <div key={g.id} className="flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-card p-3">
            <span className="text-2xl">{g.icon}</span>
            <span className="text-center text-xs text-gray-400 leading-tight">{g.name}</span>
          </div>
        ))}
      </div>

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
        <p className="mt-3 text-sm text-gray-400">拖拽图片到此处，或点击选择文件</p>
        <p className="mt-1 text-xs text-gray-600">支持 PNG / JPG / GIF / WebP / SVG，最大 5MB</p>
      </div>

      {/* 素材网格 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">加载素材列表...</div>
      ) : assets.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">暂无素材，请上传</div>
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
              </div>
              {/* 信息栏 */}
              <div className="p-3">
                <p className="truncate text-xs font-medium text-white" title={asset.name}>{asset.name}</p>
                <p className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>{asset.sizeFormatted}</span>
                  <button
                    onClick={() => handleDelete(asset.name)}
                    className="text-red-400 hover:text-red-300 transition"
                  >
                    🗑️ 删除
                  </button>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 统计 */}
      {!loading && assets.length > 0 && (
        <div className="mt-6 text-center text-xs text-gray-600">
          共 {assets.length} 个素材 · 总大小 {(assets.reduce((sum, a) => sum + a.size, 0) / 1024).toFixed(1)} KB
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
