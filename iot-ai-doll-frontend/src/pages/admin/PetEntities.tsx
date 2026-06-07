/**
 * 宠物实体管理 - E-Pet 数字生命宠物状态管理
 * 路径: /admin/pets
 * 功能：查看/编辑宠物状态（饱腹度、心情、💩计数）
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

interface PetEntity {
  nfc: string;
  display_name: string;
  monster_type: string;
  model_id: number;
  model_name?: string;
  hunger: number;
  is_visible: boolean;
  display_order: number;
  last_interact_at: string;
  last_feed_at: string;
  total_feeds: number;
  total_pets: number;
  total_poops: number;
  total_cleans: number;
  current_poops: number;
  system_prompt: string;
}

export default function PetEntities() {
  const navigate = useNavigate();
  const [pets, setPets] = useState<PetEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPet, setEditingPet] = useState<PetEntity | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPets();
  }, []);

  const loadPets = async () => {
    try {
      const res = await client.get('/admin/pets');
      if (res.data.success) {
        setPets(res.data.pets || []);
      }
    } catch (err) {
      console.error('加载宠物失败', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (pet: PetEntity) => {
    if (pet.hunger <= 0) return { label: '饥饿', color: 'text-red-400' };
    if (pet.hunger <= 30) return { label: '有点饿', color: 'text-amber-400' };
    if (pet.current_poops > 0) return { label: `💩×${pet.current_poops}`, color: 'text-orange-400' };
    return { label: '健康', color: 'text-green-400' };
  };

  const handleSave = async () => {
    if (!editingPet) return;
    setSaving(true);
    try {
      await client.put(`/admin/pets/${editingPet.nfc}`, {
        display_name: editingPet.display_name,
        hunger: editingPet.hunger,
        is_visible: editingPet.is_visible,
        display_order: editingPet.display_order,
        total_feeds: editingPet.total_feeds,
        total_pets: editingPet.total_pets,
        total_poops: editingPet.total_poops,
        total_cleans: editingPet.total_cleans,
        current_poops: editingPet.current_poops,
      });
      setEditingPet(null);
      loadPets();
    } catch (err) {
      console.error('保存失败', err);
    } finally {
      setSaving(false);
    }
  };

  const statCard = (label: string, value: number, color = 'text-white') => (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`font-mono text-sm font-medium ${color}`}>{value}</span>
    </div>
  );

  if (loading) return (
    <div className="flex h-64 items-center justify-center text-gray-400">
      <span>加载中...</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">宠物实体管理</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            管理 E-Pet 数字宠物的状态。提示词编辑请点「编辑人设」按钮。
          </p>
        </div>
        <button
          onClick={loadPets}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600"
        >
          🔄 刷新
        </button>
      </div>

      {/* 宠物卡片列表 */}
      {pets.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-gray-500">
          暂无宠物数据
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pets.map(pet => {
          const status = getStatus(pet);
          return (
            <div key={pet.nfc} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              {/* 头部 */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-white">{pet.display_name || '未命名'}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    NFC: {pet.nfc} · {pet.model_name || `型号${pet.model_id}`}
                  </div>
                </div>
                <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
              </div>

              {/* 饱腹度条 */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>饱腹度</span>
                  <span className="font-mono">{pet.hunger}/100</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pet.hunger}%`,
                      background: pet.hunger <= 30
                        ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                        : 'linear-gradient(90deg, #22c55e, #86efac)'
                    }}
                  />
                </div>
              </div>

              {/* 统计数据 */}
              <div className="grid grid-cols-3 gap-2">
                {statCard('喂食', pet.total_feeds)}
                {statCard('抚摸', pet.total_pets)}
                {statCard('清理', pet.total_cleans, 'text-blue-400')}
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => navigate(`/admin/companions/${pet.nfc}/rag`)}
                  className="flex-1 rounded-lg bg-purple-500/20 border border-purple-500/40 px-2 py-1.5 text-xs text-purple-300 hover:bg-purple-500/30"
                >
                  RAG关联
                </button>
                <button
                  onClick={() => navigate(`/admin/companions/${pet.nfc}/edit`)}
                  className="flex-1 rounded-lg bg-blue-500/20 border border-blue-500/40 px-2 py-1.5 text-xs text-blue-300 hover:bg-blue-500/30"
                >
                  编辑人设
                </button>
                <button
                  onClick={() => setEditingPet({ ...pet, current_poops: pet.current_poops || 0 })}
                  className="flex-1 rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-slate-600"
                >
                  编辑状态
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 编辑弹窗 */}
      {editingPet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">
              编辑宠物状态 — {editingPet.display_name || editingPet.nfc}
            </h3>

            <Field label="显示名称">
              <input
                className="form-input"
                value={editingPet.display_name}
                onChange={e => setEditingPet({ ...editingPet, display_name: e.target.value })}
              />
            </Field>

            <Field label={`饱腹度: ${editingPet.hunger}`}>
              <input
                type="range" min="0" max="100" step="5"
                value={editingPet.hunger}
                onChange={e => setEditingPet({ ...editingPet, hunger: parseInt(e.target.value) })}
                className="w-full accent-purple-500"
              />
            </Field>

            <Field label="💩 未清理">
              <input
                type="number" min="0" max="99"
                value={editingPet.current_poops}
                onChange={e => setEditingPet({ ...editingPet, current_poops: parseInt(e.target.value) || 0 })}
                className="form-input"
              />
            </Field>

            <Field label="显示中">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingPet.is_visible}
                  onChange={e => setEditingPet({ ...editingPet, is_visible: e.target.checked })}
                  className="accent-purple-500 w-4 h-4"
                />
                <span className="text-sm text-gray-300">在藏品库中展示</span>
              </label>
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingPet(null)}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-gray-300 hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-purple-500 px-5 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-gray-300">{label}</div>
      {children}
    </div>
  );
}
