/**
 * 模板 RAG 关联管理（操作 models 表的 model_rag_kbs）
 * 路径: /admin/companions/:id/rag
 * 此关联在模板级别，所有基于此模板的实体共享
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../api/client';

export default function CompanionRAG() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [model, setModel] = useState<any>(null);
  const [ragList, setRagList] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [ragRes, modelRes] = await Promise.all([
        client.get('/admin/rag-kbs').catch(() => ({ data: { data: [] } })),
        client.get(`/admin/models/${id}`).catch(() => ({ data: { success: false } }))
      ]);

      setRagList(ragRes.data?.data || []);
      if (modelRes.data?.success) {
        setModel(modelRes.data.data);
        setSelected(modelRes.data.data?.rag_kb_ids || []);
      }
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.put(`/admin/models/${id}`, {
        rag_kb_ids: selected
      });
      alert('保存成功');
      navigate('/admin/companions');
    } catch (err: any) {
      alert(err?.response?.data?.message || '保存失败');
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
          onClick={() => navigate('/admin/companions')}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-slate-600"
        >
          ← 返回
        </button>
        <div>
          <h2 className="text-base font-semibold text-white">
            RAG 知识库关联 — {model?.name || `模板${id}`}
          </h2>
          <p className="text-xs text-gray-500">
            模板ID: {id} · 此关联在模板级别，所有基于此模板的实体共享
          </p>
        </div>
      </div>

      {/* 说明 */}
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
        <p className="text-sm text-gray-400">
          关联知识库后，AI 在对话时会根据对话内容自动判断是否检索这些知识库，为回复补充背景信息。
          此关联在模板级别，所有基于此模板的宠物实体都会共享相同的知识库配置。
        </p>
      </div>

      {/* RAG 列表 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">
          知识库列表（{ragList.length} 个，已选 {selected.length} 个）
        </h3>

        {ragList.length === 0 ? (
          <div className="rounded-lg bg-white/5 p-6 text-center text-gray-500 text-sm">
            暂无知识库，请先去「RAG 知识库管理」创建
          </div>
        ) : (
          ragList.map(rag => (
            <label
              key={rag.id}
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all ${
                selected.includes(rag.id)
                  ? 'border-purple-500/50 bg-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(rag.id)}
                onChange={() => {
                  setSelected(prev =>
                    prev.includes(rag.id) ? prev.filter(x => x !== rag.id) : [...prev, rag.id]
                  );
                }}
                className="mt-0.5 accent-purple-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{rag.name}</div>
                {rag.description && (
                  <div className="text-xs text-gray-500 mt-0.5">{rag.description}</div>
                )}
              </div>
              {selected.includes(rag.id) && (
                <span className="rounded-full bg-purple-500/30 px-2 py-0.5 text-xs text-purple-300">
                  已选
                </span>
              )}
            </label>
          ))
        )}
      </div>

      {/* 保存 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate('/admin/companions')}
          className="rounded-lg bg-slate-700 px-5 py-2 text-sm text-gray-300 hover:bg-slate-600"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-purple-500 px-6 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存关联'}
        </button>
      </div>
    </div>
  );
}
