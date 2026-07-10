import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PetEntity {
  nfc: string;
  model_id: number;
  display_name: string;
  monster_type: string;
  model_name: string;
  system_prompt: string | null;
  temperature: number;
}

const CompaniorList: React.FC = () => {
  const [pets, setPets] = useState<PetEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadPets();
  }, []);

  const loadPets = async () => {
    try {
      setLoading(true);
      // 通过 admin pets API 加载（包含 system_prompt）
      const res = await fetch('/api/admin/pets');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '加载失败');

      const sortedPets = (data.pets || []).sort((a: PetEntity, b: PetEntity) =>
        parseInt(a.nfc) - parseInt(b.nfc)
      );
      setPets(sortedPets);
      setError('');
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>加载中...</div>;
  if (error) return <div style={{ color: 'red' }}>错误：{error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>宠物模板管理</h2>
        <span style={{ marginLeft: '12px', color: '#666', fontSize: '13px' }}>
          管理宠物的身份、性格、行为准则和知识库配置
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <thead>
          <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #eee' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>NFC ID</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>昵称</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>模板型号</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>提示词</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>Temperature</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {pets.map(pet => (
            <tr key={pet.nfc} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px' }}>{pet.nfc}</td>
              <td style={{ padding: '12px 16px' }}>{pet.display_name || '未命名'}</td>
              <td style={{ padding: '12px 16px' }}>{pet.model_name || `型号${pet.model_id}`}</td>
              <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                {pet.system_prompt ? (
                  <span style={{ fontSize: '12px', color: '#52c41a' }}>✓ 自定义提示词</span>
                ) : (
                  <span style={{ fontSize: '12px', color: '#999' }}>使用型号默认</span>
                )}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'center' }}>{pet.temperature || 0.3}</td>
              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                <button
                  onClick={() => navigate(`/companions/${pet.nfc}/edit`)}
                  style={{
                    marginRight: '8px',
                    padding: '4px 12px',
                    backgroundColor: '#1890ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  编辑
                </button>
                <button
                  onClick={() => navigate(`/companions/${pet.nfc}/rag`)}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#52c41a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  管理RAG
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pets.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          暂无宠物数据
        </div>
      )}
    </div>
  );
};

export default CompaniorList;