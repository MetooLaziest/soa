/**
 * 宠物 RAG 关联管理
 * 路径: /admin/companions/:id/rag
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../api/client';

export default function CompanionRAG() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pet, setPet] = useState<any>(null);
  const [ragList, setRagList] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [ragRes, petRes] = await Promise.all([
        client.get('/admin/rag-kbs').catch(() => ({ data: { data: [] } })),
        client.get(`/admin/pets/${id}`).catch(() => ({ data: { success: false } }))
      ]);

      setRagList(ragRes.data?.data || []);
      if (petRes.data?.success) {
        setPet(petRes.data.pet);
        setSelected(petRes.data.pet?.rag_kb_ids || []);
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
      await client.post(`/admin/pets/${id}/rags`, { rag_ids: selected });
      alert('保存成功');
      navigate('/admin/pets');
    } catch (err) {
      console.error('保存失败', err);
      alert('保存失败');
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
          onClick={() => navigate('/admin/pets')}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-slate-600"
        >
          ← 返回
        </button>
        <div>
          <h2 className="text-base font-semibold text-white">
            RAG 知识库关联 — {pet?.display_name || id}
          </h2>
          <p className="text-xs text-gray-500">
            NFC: {id} · 选择该宠物对话时可检索的知识库
          </p>
        </div>
      </div>

      {/* 说明 */}
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
        <p className="text-sm text-gray-400">
          关联知识库后，AI 在对话时会根据对话内容自动判断是否检索这些知识库，为回复补充宠物相关背景信息。
          可关联多个知识库，AI 会综合多个知识库的内容生成更丰富的回答。
        </p>
      </div>

      {/* RAG 列表 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">
          知识库列表（{ragList.length} 个）
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

      {/* 已选统计 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          已选择 <span className="text-purple-400 font-medium">{selected.length}</span> 个知识库
        </span>
      </div>

      {/* 保存 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate('/admin/pets')}
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
