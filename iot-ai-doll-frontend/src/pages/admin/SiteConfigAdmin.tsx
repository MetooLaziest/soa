/**
 * 首页配置管理 — 管理着陆页 (soa.laziestlife.com/) 的内容
 * 后端: GET /api/site-config / POST /api/admin/site-config
 * 配置项来自 site_config 表，key-value 结构
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface SiteConfig {
  brand_name: string;
  title: string;
  subtitle: string;
  bg_image_url: string;
  logo_url: string;
  epet_button_text: string;
  epet_button_url: string;
  admin_button_text: string;
  admin_button_url: string;
  footer_text: string;
  accent_color: string;
}

const FIELD_META: { key: keyof SiteConfig; label: string; type: 'text' | 'url' | 'color'; hint?: string }[] = [
  { key: 'brand_name', label: '品牌名称', type: 'text', hint: '浏览器标签页标题' },
  { key: 'title', label: '主标题', type: 'text', hint: '着陆页大标题' },
  { key: 'subtitle', label: '副标题', type: 'text' },
  { key: 'bg_image_url', label: '背景图片 URL', type: 'url', hint: '留空则使用默认深蓝渐变' },
  { key: 'logo_url', label: 'Logo 图标路径', type: 'url', hint: '默认 /favicon.svg' },
  { key: 'epet_button_text', label: '绒绒庭院按钮文字', type: 'text' },
  { key: 'epet_button_url', label: '绒绒庭院链接', type: 'url' },
  { key: 'admin_button_text', label: '管理后台按钮文字', type: 'text' },
  { key: 'admin_button_url', label: '管理后台链接', type: 'url' },
  { key: 'footer_text', label: '页脚文字', type: 'text' },
  { key: 'accent_color', label: '主题色', type: 'color' },
];

const EMPTY_CONFIG: SiteConfig = {
  brand_name: '', title: '', subtitle: '', bg_image_url: '', logo_url: '',
  epet_button_text: '', epet_button_url: '', admin_button_text: '',
  admin_button_url: '', footer_text: '', accent_color: '#6c5ce7',
};

export default function SiteConfigAdmin() {
  const [config, setConfig] = useState<SiteConfig>(EMPTY_CONFIG);
  const [saved, setSaved] = useState<SiteConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const res = await client.get('/site-config');
      const c = res.data.config || {};
      const filled = { ...EMPTY_CONFIG, ...c };
      setConfig(filled);
      setSaved(filled);
    } catch (err) {
      console.error('加载首页配置失败:', err);
      setMsg('❌ 加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await client.post('/admin/site-config', config);
      const updated = res.data.config || config;
      setConfig(updated);
      setSaved(updated);
      setMsg('✅ 保存成功');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      setMsg('❌ 保存失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(saved);
    setMsg('');
  };

  const handleChange = (key: keyof SiteConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(saved);

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🏠 首页配置</h2>
          <p className="mt-1 text-xs text-gray-500">
            配置 soa.laziestlife.com 根路径着陆页的内容和样式
          </p>
        </div>
        <a
          href="https://soa.laziestlife.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
        >
          👁 预览首页
        </a>
      </div>

      {/* 编辑区 */}
      <div className="space-y-4">
        {/* 文字配置组 */}
        <div className="rounded-xl border border-white/10 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-purple-300">📝 文字内容</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELD_META.filter(f => f.type === 'text').map(f => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-gray-400">
                  {f.label}
                  {f.hint && <span className="ml-1 text-gray-600">({f.hint})</span>}
                </label>
                <input
                  type="text"
                  value={config[f.key]}
                  onChange={e => handleChange(f.key, e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 链接配置组 */}
        <div className="rounded-xl border border-white/10 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-cyan-300">🔗 链接与图片</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELD_META.filter(f => f.type === 'url').map(f => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-gray-400">
                  {f.label}
                  {f.hint && <span className="ml-1 text-gray-600">({f.hint})</span>}
                </label>
                <input
                  type="url"
                  value={config[f.key]}
                  onChange={e => handleChange(f.key, e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>
            ))}
          </div>

          {/* 背景图预览 */}
          {config.bg_image_url && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-gray-500">背景图预览:</p>
              <img
                src={config.bg_image_url}
                alt="背景预览"
                className="h-32 w-full rounded-lg border border-white/10 object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        {/* 主题色 */}
        <div className="rounded-xl border border-white/10 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-green-300">🎨 主题色</h3>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={config.accent_color}
              onChange={e => handleChange('accent_color', e.target.value)}
              className="h-10 w-16 cursor-pointer rounded border border-white/10"
            />
            <input
              type="text"
              value={config.accent_color}
              onChange={e => handleChange('accent_color', e.target.value)}
              className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono text-white outline-none focus:border-purple-500"
            />
            <div
              className="h-10 w-24 rounded-lg"
              style={{ backgroundColor: config.accent_color }}
            />
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      {hasChanges && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <span className="text-sm text-yellow-300">⚠ 有未保存的修改</span>
          <div className="flex-1" />
          <button
            onClick={handleReset}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
          >
            撤销修改
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '💾 保存配置'}
          </button>
        </div>
      )}

      {msg && !hasChanges && (
        <div className={`mt-4 rounded-lg px-4 py-2 text-sm ${msg.startsWith('✅') ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`}>
          {msg}
        </div>
      )}
    </div>
  );
}
