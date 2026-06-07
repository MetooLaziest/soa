/**
 * RAG 知识库编辑页
 * 路径: /admin/rag/new | /admin/rag/:id/edit
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import client from '../../api/client';

export default function RAGEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname.endsWith('/rag/new');

  const [form, setForm] = useState({ name: '', description: '', content: '' });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNew && id) loadKB();
  }, [id]);

  const loadKB = async () => {
    try {
      const res = await client.get(`/admin/rag-kbs/${id}`);
      if (res.data) {
        setForm({
          name: res.data.name || '',
          description: res.data.description || '',
          content: res.data.content || ''
        });
      }
    } catch (e) {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('名称不能为空'); return; }
    if (!form.content.trim()) { alert('内容不能为空'); return; }
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await client.post('/admin/rag-kbs', form);
      } else {
        await client.put(`/admin/rag-kbs/${id}`, form);
      }
      alert('保存成功');
      navigate('/admin/rag');
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center text-gray-400">加载中...</div>
  );

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/rag')}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-slate-600"
        >
          ← 返回
        </button>
        <h2 className="text-base font-semibold text-white">
          {isNew ? '新建知识库' : `编辑知识库 #${id}`}
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">名称 *</label>
          <input
            className="form-input"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="如：绒绒谷世界背景"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">描述</label>
          <input
            className="form-input"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="简单描述这个知识库的用途"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">内容 *</label>
          <p className="text-xs text-gray-500 mb-2">
            知识库正文内容，AI 会根据对话内容检索相关段落。内容越详细、准确，检索效果越好。
          </p>
          <textarea
            className="form-input font-mono text-xs resize-y"
            rows={16}
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder={"请输入知识库内容...\n\n例如：\n绒绒谷是宠物们生活的世界，四季分明...\n宠物们的主要食物是能量果...\n宠物之间用特殊的方式交流..."}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/admin/rag')}
            className="rounded-lg bg-slate-700 px-5 py-2 text-sm text-gray-300 hover:bg-slate-600"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-purple-500 px-6 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
