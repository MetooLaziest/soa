/**
 * RAG 知识库管理
 * 路径: /admin/rag
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

export default function RAGList() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await client.get('/admin/rag-kbs');
      setList(res.data?.data || res.data || []);
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该知识库？')) return;
    try {
      await client.delete(`/admin/rag-kbs/${id}`);
      loadData();
    } catch (e) {
      console.error('删除失败', e);
      alert('删除失败');
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center text-gray-400">加载中...</div>
  );

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">RAG 知识库管理</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            管理宠物对话时可检索的知识库，支持创建、编辑、删除
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600"
          >
            🔄 刷新
          </button>
          <button
            onClick={() => navigate('/admin/rag/new')}
            className="rounded-lg bg-purple-500 px-4 py-1.5 text-xs text-white hover:bg-purple-600"
          >
            + 新建知识库
          </button>
        </div>
      </div>

      {/* 列表 */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-gray-500">
          暂无知识库，点击上方「新建知识库」创建
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(rag => (
            <div key={rag.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white">{rag.name}</span>
                  <span className="text-xs text-gray-600 font-mono">ID:{rag.id}</span>
                </div>
                {rag.description && (
                  <p className="text-sm text-gray-400">{rag.description}</p>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  {rag.content?.slice(0, 80)}{rag.content?.length > 80 ? '...' : ''}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  更新于: {rag.updated_at ? new Date(rag.updated_at).toLocaleString('zh-CN') : '-'}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => navigate(`/admin/rag/${rag.id}/edit`)}
                  className="rounded-lg bg-blue-500/20 border border-blue-500/40 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/30"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(rag.id)}
                  className="rounded-lg bg-red-500/20 border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
