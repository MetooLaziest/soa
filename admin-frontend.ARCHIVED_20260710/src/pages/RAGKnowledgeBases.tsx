import { useState, useEffect } from 'react';
import { getRAGKnowledgeBases, deleteRAGKnowledgeBase } from '../api';

interface RAGKnowledgeBase {
  id: number;
  name: string;
  description: string;
  content_length: number;
  created_at: string;
  updated_at: string;
}

export default function RAGKnowledgeBases() {
  const [rags, setRags] = useState<RAGKnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRAGs();
  }, []);

  async function loadRAGs() {
    try {
      setLoading(true);
      const data = await getRAGKnowledgeBases();
      if (data.success) {
        setRags(data.data);
      } else {
        setError(data.error || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '网络错误');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`确定要删除 RAG 知识库「${name}」吗？`)) {
      return;
    }

    try {
      const data = await deleteRAGKnowledgeBase(id.toString());
      if (data.success) {
        alert('删除成功');
        loadRAGs();
      } else {
        alert('删除失败：' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('删除失败：' + err.message);
    }
  }

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return <div className="error">错误：{error}</div>;
  }

  return (
    <div className="rag-knowledge-bases">
      <div className="page-header">
        <h1>RAG 知识库管理</h1>
        <button 
          className="btn-primary"
          onClick={() => window.location.href = '/admin/rag-kbs/new'}
        >
          + 新建知识库
        </button>
      </div>

      {rags.length === 0 ? (
        <div className="empty-state">
          <p>暂无 RAG 知识库</p>
          <p>点击「新建知识库」开始创建</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>描述</th>
              <th>内容长度</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rags.map(rag => (
              <tr key={rag.id}>
                <td>{rag.id}</td>
                <td>{rag.name}</td>
                <td>{rag.description || '-'}</td>
                <td>{rag.content_length} 字符</td>
                <td>{new Date(rag.updated_at).toLocaleString()}</td>
                <td>
                  <button 
                    className="btn-sm btn-edit"
                    onClick={() => window.location.href = `/admin/rag-kbs/${rag.id}`}
                  >
                    编辑
                  </button>
                  <button 
                    className="btn-sm btn-danger"
                    onClick={() => handleDelete(rag.id, rag.name)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
