/**
 * 宠物实体管理 - E-Pet 1 实体 (entity) 状态管理
 * 路径: /admin/pets
 *
 * 数据源: /api/admin/pets (后端改读 epet1 schema)
 * 布局: 按 model 分组 — 每个 model 卡片下挂该 model 的全部实体
 *
 * 设计原则 (2026-06-19):
 * - model (机伴) = 种类, 性格/提示词/展示图跟随机伴
 * - entity (实体) = 具体一只, nfc_id 唯一, 对话记忆/成长跟实体
 * - 一个用户每个 model 最多 1 只实体
 * - 庭院最多展示 2 只实体, 派遣中的不能展示
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

interface PetInstance {
  id: string;
  user_id: string;
  pet_model_id: number;
  nfc_id: string;
  nickname: string;
  growth_level: number;
  growth_exp: number;
  total_interactions: number;
  total_travels: number;
  total_postcards: number;
  created_at: string;
  updated_at: string;
  user_nickname: string;
  model_name: string;
  model_image: string;
  yard_position: number | null;
  in_yard: boolean | null;
  travel_id: string | null;
  travel_status: 'traveling' | 'returned' | null;
  travel_return_at: string | null;
  travel_dish_rating: number | null;
}

interface PetModel {
  id: number;
  name: string;
  description: string;
  image_url: string;
  rarity: string;
  mbti: string;
  personality_template: string;
  display_order: number;
  is_active: boolean;
}

interface ModelGroup {
  model: PetModel;
  instances: PetInstance[];
}

export default function PetEntities() {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelGroup[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [editingInstance, setEditingInstance] = useState<PetInstance | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>(''); // 按用户筛选

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await client.get('/admin/pets');
      if (res.data.success) {
        setModels(res.data.models || []);
        setSummary(res.data.summary || {});
      }
    } catch (err) {
      console.error('加载宠物失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingInstance) return;
    setSaving(true);
    try {
      await client.put(`/admin/pets/${editingInstance.id}`, {
        nickname: editingInstance.nickname,
        growth_level: editingInstance.growth_level,
        growth_exp: editingInstance.growth_exp,
        total_interactions: editingInstance.total_interactions,
      });
      setEditingInstance(null);
      await loadData();
    } catch (err) {
      console.error('保存失败', err);
      alert('保存失败: ' + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (instance: PetInstance) => {
    if (!confirm(`确定删除实体 #${instance.id} (nfc=${instance.nfc_id})？\n这将同时从庭院移除。`)) return;
    try {
      await client.delete(`/admin/pets/${instance.id}`);
      await loadData();
    } catch (err) {
      console.error('删除失败', err);
      alert('删除失败: ' + (err as any).message);
    }
  };

  const handleDispatchTravel = async (instance: PetInstance) => {
    const duration = prompt('旅行时长 (分钟，默认1分钟测试):', '1');
    if (!duration) return;
    const rating = prompt('料理评级 (1-3，默认3):', '3');
    if (!rating) return;
    try {
      const res = await client.post('/epet1/travel/admin/force-start', {
        pet_instance_id: parseInt(instance.id),
        user_id: parseInt(instance.user_id),
        dish_rating: parseInt(rating) || 3,
        duration_minutes: parseInt(duration) || 1,
      });
      if (res.data.success) {
        alert(`✅ 已派遣 ${instance.nickname || instance.nfc_id} 旅行 ${duration} 分钟`);
        await loadData();
      } else {
        alert('派遣失败: ' + (res.data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('派遣失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredModels = models
    .map((g) => ({
      ...g,
      instances: filter
        ? g.instances.filter(
            (i) => i.user_nickname?.includes(filter) || i.nfc_id.includes(filter)
          )
        : g.instances,
    }))
    .filter((g) => g.model.is_active && (g.instances.length > 0 || !filter));

  if (loading) {
    return <div className="p-6 text-gray-400">加载中...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🐾 实体管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            按机伴（model）分组，每只实体拥有独立的 nfc_id / 对话记忆 / 成长数据
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="🔍 搜索用户/nfc"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          />
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-xs text-blue-600">机伴种类</div>
          <div className="text-2xl font-bold text-blue-700">{summary.totalModels || 0}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-xs text-green-600">实体总数</div>
          <div className="text-2xl font-bold text-green-700">{summary.totalInstances || 0}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-xs text-purple-600">有机伴实例的种类</div>
          <div className="text-2xl font-bold text-purple-700">{summary.modelsWithInstances || 0}</div>
        </div>
      </div>

      {/* Model Groups */}
      <div className="space-y-4">
        {filteredModels.map((group) => (
          <ModelCard
            key={group.model.id}
            group={group}
            onEdit={setEditingInstance}
            onDelete={handleDelete}
            onEditModel={(id) => navigate(`/admin/companions/${id}/edit`)}
            onDispatchTravel={handleDispatchTravel}
          />
        ))}
        {filteredModels.length === 0 && (
          <div className="text-center py-12 text-gray-400">无匹配数据</div>
        )}
      </div>

      {/* Edit Modal */}
      {editingInstance && (
        <EditModal
          instance={editingInstance}
          onChange={setEditingInstance}
          onClose={() => setEditingInstance(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function ModelCard({
  group,
  onEdit,
  onDelete,
  onEditModel,
  onDispatchTravel,
}: {
  group: ModelGroup;
  onEdit: (i: PetInstance) => void;
  onDelete: (i: PetInstance) => void;
  onEditModel: (modelId: number) => void;
  onDispatchTravel: (i: PetInstance) => void;
}) {
  const m = group.model;
  const rarityColor = {
    common: 'bg-gray-100 text-gray-600',
    rare: 'bg-blue-100 text-blue-700',
    epic: 'bg-purple-100 text-purple-700',
    legendary: 'bg-amber-100 text-amber-700',
  }[m.rarity] || 'bg-gray-100 text-gray-600';

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Model Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 flex items-center gap-4 border-b">
        <div className="w-16 h-16 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden">
          {m.image_url ? (
            <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🐾</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800">{m.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${rarityColor}`}>
              {m.rarity}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {m.mbti}
            </span>
            <span className="text-xs text-gray-400">order #{m.display_order}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{m.description || '—'}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-sm">
            <div className="text-gray-500">实体数</div>
            <div className="text-2xl font-bold text-gray-700">{group.instances.length}</div>
          </div>
          <button
            onClick={() => onEditModel(group.model.id)}
            className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1.5 text-xs text-white font-medium hover:from-purple-600 hover:to-pink-600 shadow-sm"
          >
            ✏️ 编辑机伴
          </button>
        </div>
      </div>

      {/* Instances Table */}
      {group.instances.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">该机伴暂无实体</div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">nfc_id</th>
              <th className="text-left px-4 py-2 font-medium">所属用户</th>
              <th className="text-left px-4 py-2 font-medium">昵称</th>
              <th className="text-left px-4 py-2 font-medium">等级</th>
              <th className="text-left px-4 py-2 font-medium">互动</th>
              <th className="text-left px-4 py-2 font-medium">庭院</th>
              <th className="text-left px-4 py-2 font-medium">状态</th>
              <th className="text-left px-4 py-2 font-medium">创建</th>
              <th className="text-right px-4 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {group.instances.map((inst) => (
              <tr key={inst.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                    {inst.nfc_id}
                  </code>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-800">{inst.user_nickname || `user_${inst.user_id}`}</div>
                  <div className="text-xs text-gray-400">id={inst.user_id}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {inst.nickname || <span className="text-gray-400">未命名</span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="font-mono">Lv.{inst.growth_level}</span>
                  <span className="text-xs text-gray-400 ml-1">({inst.growth_exp}xp)</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {inst.total_interactions}
                </td>
                <td className="px-4 py-3 text-sm">
                  {inst.in_yard ? (
                    <span className="text-green-600 font-medium">✅ pos#{inst.yard_position}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {inst.travel_status === 'traveling' ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                      ✈️ 旅行中
                      {inst.travel_return_at && (
                        <span className="text-xs text-amber-500">
                          ({new Date(inst.travel_return_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}归)
                        </span>
                      )}
                    </span>
                  ) : inst.in_yard ? (
                    <span className="text-green-600 font-medium">🏡 庭院</span>
                  ) : (
                    <span className="text-gray-400">待命</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(inst.created_at).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(inst)}
                    className="text-blue-500 hover:text-blue-700 text-sm mr-3"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => onDispatchTravel(inst)}
                    className="text-amber-500 hover:text-amber-700 text-sm mr-3"
                    title="强制派遣旅行 (测试用, 不消耗料理)"
                  >
                    ✈️ 派遣
                  </button>
                  <button
                    onClick={() => onDelete(inst)}
                    className="text-red-500 hover:text-red-700 text-sm"
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

function EditModal({
  instance,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  instance: PetInstance;
  onChange: (i: PetInstance) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">
          编辑实体 #{instance.id} (nfc={instance.nfc_id})
        </h3>
        <div className="space-y-3 text-sm">
          <Field label="昵称">
            <input
              type="text"
              value={instance.nickname || ''}
              onChange={(e) => onChange({ ...instance, nickname: e.target.value })}
              className="w-full border rounded px-2 py-1"
            />
          </Field>
          <Field label="等级">
            <input
              type="number"
              value={instance.growth_level}
              onChange={(e) => onChange({ ...instance, growth_level: Number(e.target.value) })}
              className="w-full border rounded px-2 py-1"
            />
          </Field>
          <Field label="经验值">
            <input
              type="number"
              value={instance.growth_exp}
              onChange={(e) => onChange({ ...instance, growth_exp: Number(e.target.value) })}
              className="w-full border rounded px-2 py-1"
            />
          </Field>
          <Field label="累计互动次数">
            <input
              type="number"
              value={instance.total_interactions}
              onChange={(e) => onChange({ ...instance, total_interactions: Number(e.target.value) })}
              className="w-full border rounded px-2 py-1"
            />
          </Field>
          <div className="text-xs text-gray-500 pt-2 border-t">
            <div>model: <b>{instance.model_name}</b></div>
            <div>user: <b>{instance.user_nickname}</b></div>
            <div>yard: {instance.in_yard ? `pos#${instance.yard_position}` : '不在庭院'}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
