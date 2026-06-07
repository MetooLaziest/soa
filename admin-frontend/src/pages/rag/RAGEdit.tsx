import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

interface CreateRAGDto {
  name: string;
  description: string;
  content: string;
}

const RAGEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // 用路径判断 isNew，因为 /rag/new 没有 :id 参数
  const isNew = location.pathname.endsWith('/rag/new');

  const [formData, setFormData] = useState<CreateRAGDto>({
    name: '',
    description: '',
    content: '',
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      loadRAG(parseInt(id));
    }
  }, [id, isNew]);

  const loadRAG = async (ragId: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/rag-kbs/${ragId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('服务器返回了无效的 JSON 响应');
      }
      const item = data.data || data;
      if (item) {
        setFormData({
          name: item.name || '',
          description: item.description || '',
          content: item.content || '',
        });
      }
      setError('');
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreateRAGDto) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('请输入知识库名称');
      return;
    }

    try {
      setSaving(true);
      const url = isNew ? '/api/admin/rag-kbs' : `/api/admin/rag-kbs/${id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errMsg = errData.message || errData.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      alert(isNew ? '创建成功' : '更新成功');
      navigate('/rag');
    } catch (err: any) {
      alert('保存失败：' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>RAGEdit 加载中... [isNew={String(isNew)}, id={id}, path={location.pathname}]</div>;
  if (error) return <div style={{ color: 'red' }}>错误：{error}</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>{isNew ? '新增 RAG 知识库' : '编辑 RAG 知识库'}</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            名称 *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={handleChange('name')}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
            placeholder="请输入知识库名称"
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            描述
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={handleChange('description')}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
            placeholder="请输入知识库描述"
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            内容（支持 Markdown）
          </label>
          <textarea
            value={formData.content}
            onChange={handleChange('content')}
            rows={12}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d9d9d9', fontFamily: 'monospace' }}
            placeholder="请输入知识库内容（支持 Markdown 格式）"
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '8px 24px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/rag')}
            style={{
              padding: '8px 24px',
              backgroundColor: '#f5f5f5',
              color: '#333',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
};

export default RAGEdit;
