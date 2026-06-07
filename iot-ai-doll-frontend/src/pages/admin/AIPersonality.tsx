/**
 * AI 对话风格设定
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface PersonalityStyle {
  id: string;
  name: string;
  description: string;
  tone: string;
  example_dialogue?: string;
  traits: string[];
  created_at: string;
}

export default function AIPersonality() {
  const [styles, setStyles] = useState<PersonalityStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PersonalityStyle>>({});
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadStyles();
  }, []);

  const loadStyles = async () => {
    try {
      const res = await client.get('/db/personality-styles');
      setStyles(res.data.styles || []);
    } catch (err) {
      console.error('加载对话风格失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await client.put(`/admin/personality-styles/${editingId}`, form);
      } else {
        await client.post('/admin/personality-styles', form);
      }
      await loadStyles();
      setEditingId(null);
      setForm({});
      setShowAddModal(false);
    } catch (err) {
      console.error('保存失败:', err);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此对话风格吗？')) return;
    try {
      await client.delete(`/admin/personality-styles/${id}`);
      await loadStyles();
    } catch (err) {
      alert('删除失败');
    }
  };

  const startEdit = (style: PersonalityStyle) => {
    setEditingId(style.id);
    setForm(style);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm({ name: '', description: '', tone: '', traits: [], example_dialogue: '' });
    setShowAddModal(true);
  };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">AI 对话风格设定</h2>
        <button
          onClick={startAdd}
          className="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600"
        >
          + 添加风格
        </button>
      </div>

      <div className="grid gap-4">
        {styles.map(style => (
          <div key={style.id} className="rounded-xl border border-white/10 bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-white">{style.name}</h3>
                <p className="mt-1 text-sm text-gray-400">{style.description}</p>
                
                <div className="mt-3 flex flex-wrap gap-2">
                  {style.traits?.map((trait, i) => (
                    <span key={i} className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
                      {trait}
                    </span>
                  ))}
                </div>

                {style.example_dialogue && (
                  <div className="mt-3 rounded-lg bg-white/5 p-3">
                    <div className="text-xs text-gray-500 mb-1">示例对话</div>
                    <div className="text-sm text-gray-300 italic">"{style.example_dialogue}"</div>
                  </div>
                )}

                <div className="mt-2 text-xs text-gray-500">
                  语调：<span className="text-gray-400">{style.tone}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(style)}
                  className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(style.id)}
                  className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {styles.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">暂无对话风格设定</div>
      )}

      {/* 编辑/添加弹窗 */}
      {(showAddModal || editingId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowAddModal(false); setEditingId(null); }}>
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-slate-900 p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editingId ? '编辑风格' : '添加风格'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">风格名称</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                  placeholder="如：温柔治愈型"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">描述</label>
                <textarea
                  value={form.description || ''}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="h-20 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                  placeholder="描述这种对话风格的特点..."
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">语调</label>
                <input
                  type="text"
                  value={form.tone || ''}
                  onChange={e => setForm({ ...form, tone: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                  placeholder="如：温和、亲切、略带神秘感"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">性格特质（逗号分隔）</label>
                <input
                  type="text"
                  value={form.traits?.join(', ') || ''}
                  onChange={e => setForm({ ...form, traits: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                  placeholder="如：敏感, 随和, 关注美感"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">示例对话</label>
                <textarea
                  value={form.example_dialogue || ''}
                  onChange={e => setForm({ ...form, example_dialogue: e.target.value })}
                  className="h-24 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                  placeholder="输入一段示例对话..."
                />
              </div>

              <button
                onClick={handleSave}
                className="w-full rounded-lg bg-purple-500 py-2 text-sm text-white hover:bg-purple-600"
              >
                {editingId ? '保存修改' : '添加风格'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
