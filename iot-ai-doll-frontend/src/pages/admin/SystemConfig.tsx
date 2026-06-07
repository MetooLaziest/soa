/**
 * 系统配置管理
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface SysConfig {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

export default function SystemConfig() {
  const [configs, setConfigs] = useState<SysConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const res = await client.get('/db/sys-configs');
      setConfigs(res.data.configs || []);
    } catch (err) {
      console.error('加载系统配置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    try {
      await client.put(`/admin/sys-configs/${key}`, { value: editValue });
      await loadConfigs();
      setEditingKey(null);
      setEditValue('');
    } catch (err) {
      console.error('保存失败:', err);
      alert('保存失败');
    }
  };

  const handleAdd = async () => {
    const key = prompt('请输入配置键名：');
    if (!key) return;
    const value = prompt('请输入配置值：');
    if (value === null) return;
    
    try {
      await client.post('/admin/sys-configs', { key, value });
      await loadConfigs();
    } catch (err) {
      console.error('添加失败:', err);
      alert('添加失败');
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`确定删除配置 "${key}" 吗？`)) return;
    try {
      await client.delete(`/admin/sys-configs/${key}`);
      await loadConfigs();
    } catch (err) {
      console.error('删除失败:', err);
      alert('删除失败');
    }
  };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">系统配置管理</h2>
        <button
          onClick={handleAdd}
          className="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600"
        >
          + 添加配置
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">配置键</th>
              <th className="px-4 py-3">配置值</th>
              <th className="px-4 py-3">描述</th>
              <th className="px-4 py-3">更新时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(config => (
              <tr key={config.key} className="border-b border-white/5 transition hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-sm text-purple-300">{config.key}</td>
                <td className="px-4 py-3">
                  {editingKey === config.key ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-full rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm text-white"
                      autoFocus
                    />
                  ) : (
                    <span className="font-mono text-xs text-gray-300">{config.value}</span>
                  )}
                </td>
                <td className="max-w-[200px] px-4 py-3 truncate text-gray-400">{config.description || '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(config.updated_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {editingKey === config.key ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(config.key)}
                        className="text-green-400 hover:text-green-300"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => { setEditingKey(null); setEditValue(''); }}
                        className="text-gray-500 hover:text-gray-400"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setEditingKey(config.key); setEditValue(config.value); }}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(config.key)}
                        className="text-red-400 hover:text-red-300"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {configs.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">暂无系统配置</div>
      )}
    </div>
  );
}
