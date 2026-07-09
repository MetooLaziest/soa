import { useState, useEffect } from 'react';
import client from '../../api/client';

/**
 * 素材管理 — 管理员上传/预览/删除 epet 静态素材
 * 文件存储在 /var/www/iot-ai-doll/epet-assets/ (nginx /epet/static/ 代理)
 */
export default function AssetManager() {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await client.get('/admin/epet-assets');
      setFiles(res.data.files || []);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('filename', file.name);
      await client.post('/admin/epet-assets', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadFiles();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`确认删除 ${filename}？`)) return;
    try {
      await client.delete(`/admin/epet-assets/${encodeURIComponent(filename)}`);
      await loadFiles();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const getFileType = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'webm'].includes(ext)) return 'video';
    return 'other';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">📁 素材管理</h2>
          <p className="text-sm text-gray-400 mt-1">
            管理 /epet/static/ 下的静态素材，上传后可通过 <code className="text-yellow-300">/epet/static/文件名</code> 访问
          </p>
        </div>
        <label className={`rounded-lg px-4 py-2 text-sm font-semibold text-white cursor-pointer transition
          ${uploading ? 'bg-gray-600 opacity-50' : 'bg-blue-600 hover:bg-blue-500'}`}>
          {uploading ? '上传中...' : '📤 上传素材'}
          <input type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-400 text-center py-12">加载中...</div>
      ) : files.length === 0 ? (
        <div className="text-gray-500 text-center py-12">暂无素材，点击上方按钮上传</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {files.map(name => {
            const type = getFileType(name);
            const url = `/epet/static/${name}`;
            return (
              <div key={name} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 group hover:border-blue-500/30 transition">
                <div className="aspect-square rounded-lg bg-black/30 overflow-hidden flex items-center justify-center">
                  {type === 'image' ? (
                    <img src={url} alt={name} className="w-full h-full object-contain" />
                  ) : type === 'video' ? (
                    <video src={url} className="w-full h-full object-contain" muted />
                  ) : (
                    <span className="text-3xl opacity-50">📄</span>
                  )}
                </div>
                <div className="text-xs text-gray-300 truncate" title={name}>{name}</div>
                <div className="text-[10px] text-gray-500 font-mono truncate select-all">{url}</div>
                <div className="flex gap-1">
                  <a href={url} target="_blank" rel="noopener"
                     className="flex-1 rounded bg-white/5 px-2 py-1 text-[10px] text-center text-gray-400 hover:bg-white/10 hover:text-white">
                    🔗 打开
                  </a>
                  <button onClick={() => handleDelete(name)}
                          className="rounded bg-white/5 px-2 py-1 text-[10px] text-gray-400 hover:bg-red-500/20 hover:text-red-400">
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
