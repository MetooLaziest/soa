import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface RAGKnowledgeBase {
  id: number;
  name: string;
  description: string;
}

const CompanionRAG: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [linkedRAGs, setLinkedRAGs] = useState<RAGKnowledgeBase[]>([]);
  const [availableRAGs, setAvailableRAGs] = useState<RAGKnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [linkedRes, allRes] = await Promise.all([
        fetch(`/api/admin/pets/${id}/rags`),
        fetch(`/api/admin/rag-kbs`),
      ]);
      const linkedData = await linkedRes.json();
      const allData = await allRes.json();

      setLinkedRAGs(linkedData.data || linkedData || []);
      setAvailableRAGs(allData.data || allData || []);
    } catch (error) {
      console.error('Error loading RAG data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (ragId: number) => {
    try {
      await fetch(`/api/admin/pets/${id}/rags/${ragId}`, { method: 'POST' });
      loadData();
    } catch (error) {
      console.error('Error linking RAG:', error);
    }
  };

  const handleUnlink = async (ragId: number) => {
    try {
      await fetch(`/api/admin/pets/${id}/rags/${ragId}`, { method: 'DELETE' });
      loadData();
    } catch (error) {
      console.error('Error unlinking RAG:', error);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>加载中...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/companions')}
          style={{ marginRight: '12px', padding: '4px 12px', backgroundColor: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' }}
        >
          ← 返回
        </button>
        <h2 style={{ margin: 0 }}>RAG 知识库关联</h2>
        <span style={{ marginLeft: '12px', color: '#666', fontSize: '13px' }}>
          宠物 NFC={id}
        </span>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>已关联知识库</h3>
        {linkedRAGs.length === 0 ? (
          <div style={{ color: '#999', fontSize: '13px' }}>暂无关联知识库</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {linkedRAGs.map(rag => (
              <div key={rag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                <div>
                  <strong>{rag.name}</strong>
                  <div style={{ fontSize: '12px', color: '#666' }}>{rag.description}</div>
                </div>
                <button
                  onClick={() => handleUnlink(rag.id)}
                  style={{ padding: '4px 12px', backgroundColor: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  取消关联
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>可选知识库</h3>
        {availableRAGs.length === 0 ? (
          <div style={{ color: '#999', fontSize: '13px' }}>暂无知识库，请先去「RAG 知识库管理」创建</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableRAGs
              .filter(rag => !linkedRAGs.find(l => l.id === rag.id))
              .map(rag => (
                <div key={rag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fafafa', borderRadius: '4px', border: '1px solid #f0f0f0' }}>
                  <div>
                    <strong>{rag.name}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>{rag.description}</div>
                  </div>
                  <button
                    onClick={() => handleLink(rag.id)}
                    style={{ padding: '4px 12px', backgroundColor: '#52c41a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    关联
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanionRAG;