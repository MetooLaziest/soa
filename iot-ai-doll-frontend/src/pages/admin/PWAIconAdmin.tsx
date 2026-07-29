/**
 * PWA 图标管理 — 一键上传新图标, 自动生成 32/180/192/512/1024 五种尺寸
 * 后端: GET /api/admin/pwa-icon, POST /api/admin/pwa-icon, GET /api/admin/pwa-icon/export
 * 直接写文件到 frontend/dist/epet/, 同步更新 index.html / manifest.webmanifest / sw.js
 */
import { useState, useEffect, useRef } from 'react';
import client from '../../api/client';

interface SizeInfo {
  url: string;
  size: number;
  mtime: string;
}

interface IconState {
  lastUpdate: string | null;
  sizes: Record<string, SizeInfo | null>;
}

const SIZE_PREVIEWS = [
  { key: 32,   label: 'favicon 32x32',       sub: '浏览器标签页' },
  { key: 180,  label: 'apple-touch 180x180', sub: 'iOS 主屏图标' },
  { key: 192,  label: 'android 192x192',    sub: 'Chrome 安装' },
  { key: 512,  label: 'android 512x512',    sub: 'Splash 启动' },
  { key: 1024, label: 'HD 1024x1024',       sub: '高 DPI 备用' },
];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function PWAIconAdmin() {
  const [state, setState] = useState<IconState>({ lastUpdate: null, sizes: {} });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/admin/pwa-icon');
      setState(res.data);
    } catch (err: any) {
      setMsg({ kind: 'err', text: '加载状态失败: ' + (err.response?.data?.error || err.message) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMsg({ kind: 'err', text: '请选择图片文件 (PNG/JPG/SVG/WebP)' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ kind: 'err', text: '文件超过 5MB' });
      return;
    }
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewFile(e.target?.result as string);
    reader.readAsDataURL(file);
    setMsg(null);
  };

  const onUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('icon', pendingFile);
      const res = await client.post('/admin/pwa-icon', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMsg({ kind: 'ok', text: `已生成 ${res.data.files.length} 个尺寸 (${res.data.cacheName || '缓存已刷新'})` });
      setPendingFile(null);
      setPreviewFile(null);
      await load();
    } catch (err: any) {
      setMsg({ kind: 'err', text: '上传失败: ' + (err.response?.data?.error || err.message) });
    } finally {
      setUploading(false);
    }
  };

  const onReset = () => {
    setPendingFile(null);
    setPreviewFile(null);
    setMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onExport = () => {
    window.open('/api/admin/pwa-icon/export?size=1024', '_blank');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">PWA 图标管理</h1>
        <p className="text-sm text-gray-400">
          上传一张正方形源图 (PNG/JPG/SVG/WebP, &le; 5MB), 自动生成 5 个尺寸并写进 C 端 dist。
        </p>
        <p className="text-xs text-gray-500 mt-1">
          上次更新: <span className="text-purple-300">{formatTime(state.lastUpdate)}</span>
        </p>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded border ${msg.kind === 'ok' ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-white/10 rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white mb-3">当前图标</h2>
          <div className="flex flex-col items-center gap-3">
            <div className="w-44 h-44 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center overflow-hidden">
              {state.sizes['180'] ? (
                <img
                  src={state.sizes['180'].url + '?t=' + new Date(state.sizes['180'].mtime).getTime()}
                  alt="apple-touch-icon"
                  className="w-44 h-44 object-cover"
                />
              ) : (
                <div className="text-gray-500 text-sm text-center px-4">
                  尚未上传图标<br />
                  <span className="text-xs">SVG 旧版在用</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 text-center">
              apple-touch-icon 180x180 · iOS 主屏使用
            </div>
            <button
              onClick={onExport}
              disabled={!state.sizes['1024']}
              className="text-xs px-3 py-1.5 rounded bg-white/5 border border-white/10 text-purple-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              导出当前 1024x1024
            </button>
          </div>
        </div>

        <div className="bg-card border border-white/10 rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white mb-3">上传新图标</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) onSelect(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 transition-colors min-h-[180px] ${
              dragging ? 'border-purple-400 bg-purple-500/10' : 'border-white/15 bg-white/5 hover:border-white/30'
            }`}
          >
            {previewFile ? (
              <img src={previewFile} alt="preview" className="w-32 h-32 object-cover rounded-lg" />
            ) : (
              <>
                <div className="text-4xl">+</div>
                <div className="text-sm text-gray-300">点击选择 或 拖拽图片到此处</div>
                <div className="text-xs text-gray-500">PNG / JPG / SVG / WebP · &le; 5MB</div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSelect(f);
              }}
            />
          </div>
          {pendingFile && (
            <div className="mt-3 text-xs text-gray-400 flex items-center justify-between">
              <span>已选: <span className="text-white">{pendingFile.name}</span> · {formatBytes(pendingFile.size)}</span>
              <button onClick={onReset} className="text-gray-500 hover:text-red-300">取消</button>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={onUpload}
              disabled={!pendingFile || uploading}
              className="flex-1 px-4 py-2 rounded bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading ? '生成中...' : '应用并部署'}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 rounded bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-40"
            >
              刷新
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-white/10 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white mb-3">5 个尺寸状态</h2>
        {loading ? (
          <div className="text-gray-400 text-sm py-4 text-center">加载中...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {SIZE_PREVIEWS.map((p) => {
              const info = state.sizes[String(p.key)];
              return (
                <div key={p.key} className="rounded-lg border border-white/10 bg-white/5 p-3 flex flex-col items-center">
                  <div className="w-16 h-16 rounded bg-slate-800 flex items-center justify-center overflow-hidden mb-2">
                    {info ? (
                      <img src={info.url + '?t=' + new Date(info.mtime).getTime()} alt={p.label} className="w-16 h-16 object-cover" />
                    ) : (
                      <span className="text-gray-600 text-xs">N/A</span>
                    )}
                  </div>
                  <div className="text-xs text-white text-center font-medium">{p.label}</div>
                  <div className="text-[10px] text-gray-500 text-center mt-0.5">{p.sub}</div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {info ? formatBytes(info.size) : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs text-yellow-200/80">
        <strong>注意:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside text-yellow-200/70">
          <li>浏览器/PWA 用户需要刷新或清缓存才能看到新图标</li>
          <li>iOS 用户如果已添加到主屏, 必须先删除再重新添加 (iOS 在安装时锁定 apple-touch-icon)</li>
          <li>Android Chrome 安装时也会捕获图标, 需重新触发安装流程</li>
        </ul>
      </div>
    </div>
  );
}
