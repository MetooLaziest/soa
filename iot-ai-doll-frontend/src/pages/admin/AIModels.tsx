/**
 * AI 模型配置管理 - 维护外部 API 接口和查看 token 消耗
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  api_key?: string;
  api_endpoint?: string;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
  created_at: string;
}

interface TokenUsage {
  model_id: string;
  model_name: string;
  total_tokens: number;
  total_cost: number;
  request_count: number;
}

export default function AIModels() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [usage, setUsage] = useState<TokenUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<AIModel>>({
    name: '',
    provider: '阿里Qwen',
    model_id: '',
    api_key: '',
    api_endpoint: '',
    max_tokens: 4096,
    temperature: 0.7,
    is_active: true,
  });

  useEffect(() => {
    loadModels();
    loadUsage();
  }, []);

  const loadModels = async () => {
    try {
      const res = await client.get('/db/ai-models');
      setModels(res.data.models || []);
    } catch (err) {
      console.error('加载 AI 模型失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsage = async () => {
    try {
      const res = await client.get('/admin/ai-usage');
      setUsage(res.data.usage || []);
    } catch (err) {
      console.error('加载 token 用量失败:', err);
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim() || !form.model_id?.trim()) {
      alert('模型名称和模型ID必填');
      return;
    }
    try {
      if (editingId) {
        await client.put(`/db/ai-models/${editingId}`, form);
      } else {
        await client.post('/db/ai-models', form);
      }
      await loadModels();
      closeModal();
    } catch (err: any) {
      console.error('保存失败:', err);
      alert(err.response?.data?.error || '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此模型配置吗？')) return;
    try {
      await client.post('/admin/delete', {
        table: 'ai_models',
        filters: { id },
      });
      await loadModels();
    } catch (err: any) {
      alert(err.response?.data?.error || '删除失败');
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({
      name: '阿里Qwen',
      provider: '阿里Qwen',
      model_id: '3487187',
      api_key: '',
      api_endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      max_tokens: 4096,
      temperature: 0.7,
      is_active: true,
    });
    setShowModal(true);
  };

  const openEdit = (model: AIModel) => {
    setEditingId(model.id);
    setForm({
      name: model.name,
      provider: model.provider,
      model_id: model.model_id,
      api_key: model.api_key || '',
      api_endpoint: model.api_endpoint || '',
      max_tokens: model.max_tokens,
      temperature: model.temperature,
      is_active: model.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({
      name: '',
      provider: '阿里Qwen',
      model_id: '',
      api_key: '',
      api_endpoint: '',
      max_tokens: 4096,
      temperature: 0.7,
      is_active: true,
    });
  };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">AI 模型配置</h2>
        <button
          onClick={openAdd}
          className="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600"
        >
          + 新增模型
        </button>
      </div>

      {/* Token 消耗统计 */}
      {usage.length > 0 && (
        <div className="mb-6 rounded-xl border border-white/10 bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-400">Token 消耗统计</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usage.map((u, i) => (
              <div key={i} className="rounded-lg bg-white/5 p-4">
                <div className="mb-2 font-medium text-white">{u.model_name}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Tokens：</span>
                    <span className="text-white">{u.total_tokens.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">费用：</span>
                    <span className="text-yellow-400">¥{u.total_cost.toFixed(4)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">请求次数：</span>
                    <span className="text-white">{u.request_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 模型列表 */}
      <div className="space-y-4">
        {models.map(model => (
          <div key={model.id} className="rounded-xl border border-white/10 bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="font-semibold text-white">{model.name}</h3>
                  {model.is_active && (
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                      启用中
                    </span>
                  )}
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
                    {model.provider}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
                  <div>
                    <span className="text-gray-500">模型 ID：</span>
                    <span className="font-mono text-xs text-gray-300">{model.model_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Temperature：</span>
                    <span className="text-white">{model.temperature}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Max Tokens：</span>
                    <span className="text-white">{model.max_tokens}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Endpoint：</span>
                    <span className="font-mono text-xs text-gray-400 truncate block">
                      {model.api_endpoint || '默认'}
                    </span>
                  </div>
                </div>
                {model.api_key && (
                  <div className="mt-2 text-xs text-gray-500">
                    API Key：{model.api_key.slice(0, 10)}...{model.api_key.slice(-4)}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEdit(model)}
                  className="rounded-lg bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                  title="编辑"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(model.id)}
                  className="rounded-lg bg-white/5 p-2 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {models.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-card py-12 text-center">
          <div className="mb-3 text-4xl">🤖</div>
          <p className="text-sm text-gray-500">暂无 AI 模型配置，点击上方按钮添加</p>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
          <div
            className="w-full max-w-2xl rounded-xl border border-white/10 bg-slate-900 p-6"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingId ? '编辑模型' : '新增模型'}
              </h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-white text-xl">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">模型名称 *</label>
                  <input
                    type="text"
                    value={form.name || ''}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="form-input"
                    placeholder="如：阿里Qwen"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">提供商 *</label>
                  <input
                    type="text"
                    value={form.provider || ''}
                    onChange={e => setForm({ ...form, provider: e.target.value })}
                    className="form-input"
                    placeholder="如：阿里Qwen"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">模型 ID *</label>
                  <input
                    type="text"
                    value={form.model_id || ''}
                    onChange={e => setForm({ ...form, model_id: e.target.value })}
                    className="form-input font-mono text-xs"
                    placeholder="如：3487187"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">API Key *</label>
                  <input
                    type="password"
                    value={form.api_key || ''}
                    onChange={e => setForm({ ...form, api_key: e.target.value })}
                    className="form-input font-mono text-xs"
                    placeholder="sk-..."
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">API Endpoint</label>
                <input
                  type="text"
                  value={form.api_endpoint || ''}
                  onChange={e => setForm({ ...form, api_endpoint: e.target.value })}
                  className="form-input font-mono text-xs"
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={form.temperature ?? 0.7}
                    onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Max Tokens</label>
                  <input
                    type="number"
                    value={form.max_tokens ?? 4096}
                    onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active ?? true}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-white/20 bg-slate-800"
                />
                <label className="text-sm text-gray-300">启用此模型</label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-gray-300 hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-purple-500 px-6 py-2 text-sm text-white hover:bg-purple-600"
              >
                {editingId ? '保存修改' : '添加模型'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
