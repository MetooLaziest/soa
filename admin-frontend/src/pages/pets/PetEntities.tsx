import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface PetEntity {
  nfc: string;
  display_name: string;
  model_id: number;
  model_name: string;
  hunger: number;
  last_interact_at: string;
  last_feed_at: string;
  last_poop_at: string;
  total_feeds: number;
  total_pets: number;
  total_poops: number;
  total_cleans: number;
  current_poops: number;
  is_visible: boolean;
  created_at: string;
}

const PetEntities: React.FC = () => {
  const navigate = useNavigate();
  const [pets, setPets] = useState<PetEntity[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPet, setEditingPet] = useState<PetEntity | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 加载宠物实体
      const petsRes = await fetch('/api/epet/pets');
      const petsData = petsRes.ok ? await petsRes.json() : { pets: [] };

      // 加载模板（宠物型号）
      const modelsRes = await fetch('/api/epet/models');
      const modelsData = modelsRes.ok ? await modelsRes.json() : { models: [] };

      setModels(modelsData.models || []);

      // 合并模板名称
      const petsWithModelNames = (petsData.pets || []).map((pet: any) => {
        const model = (modelsData.models || []).find((m: any) => m.model_id === pet.model_id);
        return { ...pet, model_name: model?.name || `型号${pet.model_id}` };
      });

      setPets(petsWithModelNames);
    } catch (err) {
      console.error('Error loading pets:', err);
    } finally {
      setLoading(false);
    }
  };

  // 计算宠物状态
  const getPetStatus = (pet: PetEntity) => {
    if (pet.hunger <= 0) return { label: '饥饿', color: '#ff4d4f' };
    if (pet.hunger <= 30) return { label: '有点饿', color: '#faad14' };
    if (pet.current_poops > 0) return { label: '需要清理', color: '#fa8c16' };
    return { label: '健康', color: '#52c41a' };
  };

  // 保存宠物实体编辑
  const handleSavePet = async () => {
    if (!editingPet) return;

    try {
      const res = await fetch(`/api/epet/pets/${editingPet.nfc}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: editingPet.display_name,
          hunger: editingPet.hunger,
          total_feeds: editingPet.total_feeds,
          total_pets: editingPet.total_pets,
          total_poops: editingPet.total_poops,
          total_cleans: editingPet.total_cleans,
          current_poops: editingPet.current_poops,
          is_visible: editingPet.is_visible
        })
      });

      if (res.ok) {
        alert('保存成功！');
        setEditingPet(null);
        loadData();
      } else {
        alert('保存失败');
      }
    } catch (err) {
      console.error('Error saving pet:', err);
      alert('保存失败: ' + err);
    }
  };

  // 喂养宠物
  const handleFeed = async (nfc: string) => {
    try {
      const res = await fetch(`/api/epet/${nfc}/feed`, { method: 'POST' });
      if (res.ok) {
        alert('喂食成功！');
        loadData();
      }
    } catch (err) {
      console.error('Error feeding pet:', err);
    }
  };

  // 清理排泄物
  const handleClean = async (nfc: string) => {
    try {
      const res = await fetch(`/api/epet/${nfc}/clean`, { method: 'POST' });
      if (res.ok) {
        alert('清理成功！');
        loadData();
      }
    } catch (err) {
      console.error('Error cleaning pet:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>加载中...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>宠物实体管理</h1>
        <span style={{ marginLeft: '12px', color: '#666', fontSize: '13px' }}>
          管理宠物实例的状态（饥饿值、心情等），模板配置请前往「宠物模板管理」
        </span>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>NFC ID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>昵称</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>模板</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>饱腹度</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>💩</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>互动</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pets.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                  暂无宠物实体数据
                </td>
              </tr>
            ) : (
              pets.map((pet) => {
                const status = getPetStatus(pet);
                return (
                  <tr key={pet.nfc} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px' }}>{pet.nfc}</td>
                    <td style={{ padding: '12px 16px' }}>{pet.display_name || '未命名'}</td>
                    <td style={{ padding: '12px 16px' }}>{pet.model_name}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ width: '60px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pet.hunger}%`, height: '100%', backgroundColor: pet.hunger > 30 ? '#52c41a' : '#ff4d4f' }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#666', minWidth: '35px' }}>{pet.hunger}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#fff',
                        backgroundColor: status.color
                      }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {pet.current_poops > 0 ? (
                        <span style={{ color: '#fa8c16', fontSize: '16px' }}>{pet.current_poops}个💩</span>
                      ) : (
                        <span style={{ color: '#d9d9d9' }}>干净</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                      <div>喂:{pet.total_feeds}</div>
                      <div>撸:{pet.total_pets}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleFeed(pet.nfc)}
                        style={{ marginRight: '8px', padding: '4px 12px', backgroundColor: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        喂食
                      </button>
                      <button
                        onClick={() => handleClean(pet.nfc)}
                        style={{ marginRight: '8px', padding: '4px 12px', backgroundColor: '#fa8c16', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        清理
                      </button>
                      <button
                        onClick={() => setEditingPet(pet)}
                        style={{ padding: '4px 12px', backgroundColor: '#fff', color: '#1890ff', border: '1px solid #1890ff', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 编辑弹窗 */}
      {editingPet && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', width: '400px', maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>编辑宠物实体</h2>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
              NFC: {editingPet.nfc} | 模板: {editingPet.model_name}
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>昵称</label>
              <input
                type="text"
                value={editingPet.display_name}
                onChange={(e) => setEditingPet({ ...editingPet, display_name: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                饱腹度: {editingPet.hunger}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={editingPet.hunger}
                onChange={(e) => setEditingPet({ ...editingPet, hunger: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={editingPet.is_visible}
                  onChange={(e) => setEditingPet({ ...editingPet, is_visible: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                显示中
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingPet(null)}
                style={{ padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}
              >
                取消
              </button>
              <button
                onClick={handleSavePet}
                style={{ padding: '8px 16px', backgroundColor: '#52c41a', color: '#fff', border: 'none', borderRadius: '4px' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PetEntities;