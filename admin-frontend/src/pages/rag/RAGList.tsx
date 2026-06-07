import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface RAGKnowledgeBase {
  id: number;
  name: string;
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const RAGList: React.FC = () => {
  const navigate = useNavigate();
  const [rags, setRAGs] = useState<RAGKnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRAGs();
  }, []);

  const loadRAGs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/rag-kbs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data;
      try {
        data = await res.json();
      } catch {
        data = [];
      }
      setRAGs(data.data || data || []);
      setError('');
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除 RAG 知识库「${name}」吗？`)) return;

    try {
      await fetch(`/api/admin/rag-kbs/${id}`, { method: 'DELETE' });
      alert('删除成功');
      loadRAGs();
    } catch (err: any) {
      alert('删除失败：' + err.message);
    }
  };

  if (loading) return <div>RAGList 加载中...</div>;
  if (error) return <div style={{ color: 'red' }}>错误：{error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>RAG 知识库管理</h2>
        <button
          onClick={() => navigate('/rag/new')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          新增知识库
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e8e8e8' }}>ID</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e8e8e8' }}>名称</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e8e8e8' }}>描述</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e8e8e8' }}>创建时间</th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e8e8e8' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rags.map(rag => (
            <tr key={rag.id} style={{ borderBottom: '1px solid #e8e8e8' }}>
              <td style={{ padding: '12px' }}>{rag.id}</td>
              <td style={{ padding: '12px' }}>{rag.name}</td>
              <td style={{ padding: '12px' }}>{rag.description}</td>
              <td style={{ padding: '12px' }}>{new Date(rag.created_at).toLocaleString()}</td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <button
                  onClick={() => navigate(`/rag/${rag.id}/edit`)}
                  style={{
                    marginRight: '8px',
                    padding: '4px 12px',
                    backgroundColor: '#52c41a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(rag.id, rag.name)}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#ff4d4f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rags.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          暂无 RAG 知识库，点击"新增知识库"创建
        </div>
      )}
    </div>
  );
};

export default RAGList;
