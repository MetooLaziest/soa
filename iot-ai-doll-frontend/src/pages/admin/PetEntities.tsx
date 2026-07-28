/**
 * 宠物实体管理 - E-Pet 1 实体 (entity) 状态管理
 * 路径: /admin/pets
 *
 * 数据源: /api/admin/pets (后端改读 epet1 schema)
 * 布局: 按 model 分组 — 每个 model 卡片下挂该 model 的全部实体
 *
 * 导出功能 (2026-07-28):
 * - 工具栏「📥 导出全部」「📥 导出未认领」按钮, 生成 UTF-8 BOM CSV
 * - URL 前缀从 VITE_CLAIM_URL_BASE 读 (默认 soa.laziestlife.com)
 * - 迁移到 dw.momotoys.tech 后, 只改 .env.production 一行
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import client from '../../api/client';

// 认领 URL 前缀 (H5 入口)
// 切换域名改 .env.production 里 VITE_CLAIM_URL_BASE 这一行即可
// query 参数: ?code=<activation_code> (2026-07-28 起由 id 改为 code, 避免跟 demo/pets 等 id 含义冲突)
const CLAIM_URL_BASE =
  (import.meta.env.VITE_CLAIM_URL_BASE as string) ||
  'https://soa.laziestlife.com/epet/?code=';

interface PetInstance {
  id: string;
  user_id: string;
  pet_model_id: number;
  nfc_id: string;
  activation_code: string | null;
  status: string;
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
  // NFC 烧录追踪 (memory #24, 工厂回灌 CSV 后填)
  nfc_burned_at: string | null;
  nfc_burn_batch: string | null;
  nfc_burn_device: string | null;
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
  const [qrCodes, setQrCodes] = useState<{ code: string; nfcId: string; modelName: string }[] | null>(null);
  const [showUploadBurned, setShowUploadBurned] = useState(false); // CSV 上传烧录清单 modal (memory #24)

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

  const handleForceReturn = async (instance: PetInstance) => {
    if (!instance.travel_id) return alert('无旅行记录');
    if (!confirm(`确认让 ${instance.nickname || instance.nfc_id} 提前归来？`)) return;
    try {
      const res = await client.post('/epet1/travel/admin/force-return', {
        travel_record_id: parseInt(instance.travel_id),
      });
      if (res.data.success || res.data.ok) {
        alert(`✅ ${instance.nickname || instance.nfc_id} 已归来！`);
        await loadData();
      } else {
        alert('归来失败: ' + (res.data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('归来失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleGenerateCodes = async (petModelId: number, modelName: string) => {
    const count = prompt(`为 ${modelName} 批量生成激活码 (1-100):`, '5');
    if (!count) return;
    const n = parseInt(count);
    if (isNaN(n) || n < 1 || n > 100) {
      alert('数量范围 1-100');
      return;
    }
    try {
      const res = await client.post('/admin/pets/generate-codes', {
        pet_model_id: petModelId,
        count: n,
      });
      if (res.data.success) {
        const codes: { code: string; nfcId: string; modelName: string }[] = res.data.generated.map((c: any) => ({
          code: c.activation_code,
          nfcId: String(c.nfc_id),
          modelName,
        }));
        setQrCodes(codes);
        await loadData();
      } else {
        alert('生成失败: ' + (res.data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('生成失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRegenerateCode = async (instance: PetInstance) => {
    if (!confirm(`重新生成 #${instance.id} 的激活码？旧码将失效。`)) return;
    try {
      const res = await client.post(`/admin/pets/${instance.id}/regenerate-code`);
      if (res.data.success) {
        alert(`✅ 新激活码: ${res.data.instance.activation_code}`);
        await loadData();
      } else {
        alert('生成失败: ' + (res.data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('生成失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => { /* copied */ },
      () => { /* fallback: ignore */ }
    );
  };

  // ─── 导出 CSV ─────────────────────────────────
  // 用 BOM 头 (﻿) 让 Excel 正确识别 UTF-8 中文, 不然乱码
  // 文件后缀 .csv (不是 .xlsx), 供应商电脑没装 Office 也能用 WPS / 记事本打开
  const exportToCsv = (
    rows: PetInstance[],
    filename: string,
    filterFn: (i: PetInstance) => boolean
  ) => {
    const filtered = rows.filter(filterFn);
    if (filtered.length === 0) {
      alert('没有符合条件的实体可导出');
      return;
    }
    const statusLabel = (s: string) =>
      s === 'claimed' ? '已认领' : s === 'unclaimed' ? '未认领' : s || '未知';
    const headers = [
      'nfc_id',
      'activation_code',
      '机伴名',
      '稀有度',
      '状态',
      '完整认领URL',
      '所属用户',
      '创建时间',
      '烧录状态',
      '烧录时间',
    ];
    const csvRows = [headers];
    for (const inst of filtered) {
      const url = inst.activation_code
        ? `${CLAIM_URL_BASE}${inst.activation_code}`
        : '';
      csvRows.push([
        inst.nfc_id,
        inst.activation_code || '',
        inst.model_name,
        (inst as any).model_rarity || '',
        statusLabel(inst.status),
        url,
        inst.user_nickname ? `${inst.user_nickname}(id=${inst.user_id})` : '',
        new Date(inst.created_at).toLocaleString('zh-CN'),
        inst.nfc_burned_at ? '已烧录' : '未烧录',
        inst.nfc_burned_at
          ? `${new Date(inst.nfc_burned_at).toLocaleString('zh-CN')} [${inst.nfc_burn_batch || '-'}#${inst.nfc_burn_device || '-'}]`
          : '',
      ]);
    }
    // CSV 字段内含逗号/引号/换行的需要双引号包裹 + 引号转义
    const escape = (v: string) => {
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const csvContent =
      '﻿' +
      csvRows.map((row) => row.map((c) => escape(String(c ?? ''))).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    // 用 a 标签触发下载
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    alert(`✅ 已导出 ${filtered.length} 条记录到 ${filename}`);
  };

  // 收集所有 instance (扁平, 跨 model 卡片)
  const allInstances = models.flatMap((g) => g.instances);

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
          <button
            onClick={() => {
              const ts = new Date().toISOString().slice(0, 10);
              exportToCsv(allInstances, `epet-pets-all-${ts}.csv`, () => true);
            }}
            className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600"
            title="导出全部实体为 CSV (含认领 URL, 供应商可对照印刷)"
          >
            📥 导出全部
          </button>
          <button
            onClick={() => {
              const ts = new Date().toISOString().slice(0, 10);
              exportToCsv(
                allInstances,
                `epet-pets-unclaimed-${ts}.csv`,
                (i) => i.status === 'unclaimed'
              );
            }}
            className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
            title="只导未认领实体 (适合工厂分批印刷)"
          >
            📥 导出未认领
          </button>
          <button
            onClick={() => setShowUploadBurned(true)}
            className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600"
            title="上传工厂回灌的烧录清单 CSV, 批量标记已烧录 (memory #24)"
          >
            📤 导入烧录清单
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
            onForceReturn={handleForceReturn}
            onGenerateCodes={handleGenerateCodes}
            onRegenerateCode={handleRegenerateCode}
            onCopy={copyToClipboard}
            onShowQr={(code, nfcId, modelName) => setQrCodes([{ code, nfcId, modelName }])}
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

      {/* QR Codes Modal */}
      {qrCodes && (
        <QRCodesModal codes={qrCodes} onClose={() => setQrCodes(null)} />
      )}

      {/* Upload Burned Modal (memory #24 — 工厂回灌 CSV 批量标已烧录) */}
      {showUploadBurned && (
        <UploadBurnedModal
          onClose={() => setShowUploadBurned(false)}
          onImported={loadData}
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
  onForceReturn,
  onGenerateCodes,
  onRegenerateCode,
  onCopy,
  onShowQr,
}: {
  group: ModelGroup;
  onEdit: (i: PetInstance) => void;
  onDelete: (i: PetInstance) => void;
  onEditModel: (modelId: number) => void;
  onDispatchTravel: (i: PetInstance) => void;
  onForceReturn: (i: PetInstance) => void;
  onGenerateCodes: (petModelId: number, modelName: string) => void;
  onRegenerateCode: (i: PetInstance) => void;
  onCopy: (text: string) => void;
  onShowQr: (code: string, nfcId: string, modelName: string) => void;
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
            onClick={() => onGenerateCodes(group.model.id, group.model.name)}
            className="rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1.5 text-xs text-white font-medium hover:from-green-600 hover:to-emerald-600 shadow-sm"
          >
            🔑 批量生成激活码
          </button>
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
              <th className="text-left px-4 py-2 font-medium">激活码 / 状态</th>
              <th className="text-left px-4 py-2 font-medium">所属用户</th>
              <th className="text-left px-4 py-2 font-medium">昵称</th>
              <th className="text-left px-4 py-2 font-medium">等级</th>
              <th className="text-left px-4 py-2 font-medium">互动</th>
              <th className="text-left px-4 py-2 font-medium">庭院</th>
              <th className="text-left px-4 py-2 font-medium">状态</th>
              <th className="text-left px-4 py-2 font-medium">🔥 烧录</th>
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
                <td className="px-4 py-3">
                  {inst.activation_code ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <code
                          className="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded cursor-pointer hover:bg-amber-100 font-mono"
                          onClick={() => onCopy(inst.activation_code!)}
                          title="点击复制"
                        >
                          🔑 {inst.activation_code}
                        </code>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        inst.status === 'claimed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {inst.status === 'claimed' ? '🟢 已认领' : '⚪ 未认领'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {inst.user_id ? (
                    <>
                      <div className="font-medium text-gray-800">{inst.user_nickname || `user_${inst.user_id}`}</div>
                      <div className="text-xs text-gray-400">id={inst.user_id}</div>
                    </>
                  ) : (
                    <span className="text-gray-400 italic">待认领</span>
                  )}
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
                <td className="px-4 py-3 text-xs">
                  {inst.nfc_burned_at ? (
                    <div className="flex flex-col gap-0.5" title={inst.nfc_burn_batch ? `批次 ${inst.nfc_burn_batch}${inst.nfc_burn_device ? ' / 设备 ' + inst.nfc_burn_device : ''}` : ''}>
                      <span className="text-orange-600 font-medium">🔥 已烧</span>
                      <span className="text-gray-500 text-[10px]">
                        {new Date(inst.nfc_burned_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">⚪ 未烧</span>
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
                  {inst.travel_status === 'traveling' ? (
                    <button
                      onClick={() => onForceReturn(inst)}
                      className="text-green-600 hover:text-green-700 text-sm mr-3 font-medium"
                      title="强制提前归来 (测试用)"
                    >
                      🏠 归来
                    </button>
                  ) : (
                    <button
                      onClick={() => onDispatchTravel(inst)}
                      className="text-amber-500 hover:text-amber-700 text-sm mr-3"
                      title="强制派遣旅行 (测试用, 不消耗料理)"
                    >
                      ✈️ 派遣
                    </button>
                  )}
                  <button
                    onClick={() => onRegenerateCode(inst)}
                    className="text-amber-600 hover:text-amber-800 text-sm mr-3"
                    title="重新生成激活码 (如码泄露)"
                  >
                    🔄 换码
                  </button>
                  {inst.activation_code && inst.status === 'unclaimed' && (
                    <button
                      onClick={() => onShowQr(inst.activation_code!, inst.nfc_id, inst.model_name)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                      title="显示 QR 码"
                    >
                      📱 QR
                    </button>
                  )}
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
          <div className="text-xs text-gray-500 pt-2 border-t space-y-1">
            <div>model: <b>{instance.model_name}</b></div>
            <div>user: <b>{instance.user_nickname}</b></div>
            <div>yard: {instance.in_yard ? `pos#${instance.yard_position}` : '不在庭院'}</div>
            <div className="flex items-center gap-2">
              激活码:
              {instance.activation_code ? (
                <code
                  className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-mono cursor-pointer hover:bg-amber-100"
                  onClick={() => navigator.clipboard.writeText(instance.activation_code!)}
                  title="点击复制"
                >
                  {instance.activation_code}
                </code>
              ) : (
                <span className="text-gray-400">无</span>
              )}
            </div>
            <div>
              状态:
              <span className={`ml-1 px-1.5 py-0.5 rounded-full ${
                instance.status === 'claimed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {instance.status === 'claimed' ? '🟢 已认领' : '⚪ 未认领'}
              </span>
            </div>
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

function QRCodesModal({
  codes,
  onClose,
}: {
  codes: { code: string; nfcId: string; modelName: string }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">📱 激活码 QR 码</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {codes.length === 1 ? (
          /* 单个 QR 码：大图展示 */
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 border-2 border-gray-200 rounded-xl">
              <QRCodeSVG
                value={`${CLAIM_URL_BASE}${codes[0].code}`}
                size={256}
                level="M"
                includeMargin
              />
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-800">{codes[0].modelName}</div>
              <div className="text-xs text-gray-400 mb-1">nfc={codes[0].nfcId}</div>
              <code
                className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded font-mono cursor-pointer hover:bg-amber-100"
                onClick={() => navigator.clipboard.writeText(codes[0].code)}
                title="点击复制"
              >
                🔑 {codes[0].code}
              </code>
            </div>
          </div>
        ) : (
          /* 批量 QR 码：网格展示 */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {codes.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <QRCodeSVG
                  value={`${CLAIM_URL_BASE}${c.code}`}
                  size={140}
                  level="M"
                  includeMargin
                />
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-700">{c.modelName}</div>
                  <div className="text-[10px] text-gray-400">nfc={c.nfcId}</div>
                  <code
                    className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-amber-100 block mt-1 max-w-[140px] truncate"
                    onClick={() => navigator.clipboard.writeText(c.code)}
                    title={`点击复制: ${c.code}`}
                  >
                    {c.code}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t text-center">
          <p className="text-xs text-gray-400">
            扫码跳转认领页面: {CLAIM_URL_BASE}&lt;激活码&gt;
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── 导入烧录清单 (工厂回灌 CSV, 批量标"已烧录") ───
// 跟 memory #24 闭环: admin 导出 CSV (第 6 列是烧录 URL) → 工厂烧 NFC → 工厂回灌此 Modal
// → 后端 POST /admin/pets/import-burned 事务批量 UPDATE → 列表显示「🔥 已烧」
function UploadBurnedModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: any[]; errors: string[] }>({ rows: [], errors: [] });
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [skipBurned, setSkipBurned] = useState(true);

  // CSV 解析 (跟 exportToCsv 反向): BOM + 逗号 + 双引号转义
  // 不引 csv-parse 库, 200 行内够用
  const parseCsv = (text: string) => {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // 去 UTF-8 BOM
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { rows: [], errors: ['CSV 至少需要 1 行表头 + 1 行数据'] };
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const nfcIdx = headers.findIndex((h) => /^nfc[_]?id$/i.test(h));
    if (nfcIdx < 0) return { rows: [], errors: ['表头必须包含 nfc_id 列 (兼容 nfcid)'] };
    const batchIdx = headers.findIndex((h) => /^(batch|批次)$/i.test(h));
    const deviceIdx = headers.findIndex((h) => /^(device|设备)$/i.test(h));
    const rows = lines
      .slice(1)
      .map((line, i) => {
        // 简单 split, 不处理引号转义内的逗号 (工厂 CSV 没这种情况)
        const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        return {
          nfc_id: cells[nfcIdx] || '',
          batch: batchIdx >= 0 ? cells[batchIdx] || null : null,
          device: deviceIdx >= 0 ? cells[deviceIdx] || null : null,
          _row: i + 2, // 表头占 1 行, 数据从 2 开始
        };
      })
      .filter((r) => r.nfc_id);
    return { rows, errors: [] };
  };

  const onFile = (f: File | null) => {
    setFile(f);
    setResult(null);
    if (!f) {
      setPreview({ rows: [], errors: [] });
      return;
    }
    setParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      setPreview(parseCsv(text));
      setParsing(false);
    };
    reader.readAsText(f, 'UTF-8');
  };

  const submit = async () => {
    if (preview.rows.length === 0) return;
    setSubmitting(true);
    try {
      const res = await client.post('/admin/pets/import-burned', {
        rows: preview.rows.map((r) => ({
          nfc_id: r.nfc_id,
          batch: r.batch,
          device: r.device,
        })),
        skipBurned,
      });
      setResult(res.data);
      if (res.data?.success && res.data.imported > 0) onImported?.();
    } catch (e: any) {
      setResult({
        success: false,
        error: e?.response?.data?.error || e?.message || '请求失败',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    setPreview({ rows: [], errors: [] });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">📤 导入烧录清单</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {!result ? (
          <>
            <div className="mb-3 text-sm text-gray-600 bg-purple-50 border border-purple-200 rounded p-3">
              <div className="font-medium text-purple-800 mb-1">📋 CSV 格式 (3 列, batch/device 可选)</div>
              <code className="text-xs">nfc_id,batch,device</code>
              <div className="mt-1 text-xs text-purple-700">
                示例: <code>110001,BATCH-20260730-A,DEV01</code>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                💡 工厂烧完 NFC 后, 把第 6 列认领 URL 那张表, 删除前 5 列保留 nfc_id/batch/device 即可
              </div>
            </div>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
              className="block w-full text-sm border rounded p-2 cursor-pointer"
            />

            {parsing && <div className="mt-3 text-sm text-gray-500">⏳ 解析中...</div>}

            {preview.rows.length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-gray-700 mb-2">
                  ✅ 解析成功, 共 <b>{preview.rows.length}</b> 行, 预览前 5 行:
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border p-1">行</th>
                        <th className="border p-1">nfc_id</th>
                        <th className="border p-1">batch</th>
                        <th className="border p-1">device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td className="border p-1">{r._row}</td>
                          <td className="border p-1 font-mono">{r.nfc_id}</td>
                          <td className="border p-1">{r.batch || '-'}</td>
                          <td className="border p-1">{r.device || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipBurned}
                    onChange={(e) => setSkipBurned(e.target.checked)}
                  />
                  跳过已烧录的 (推荐, 防止误覆盖早期烧录记录)
                </label>
              </div>
            )}

            {preview.errors.length > 0 && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                ⚠️ {preview.errors.join('; ')}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t">
              <button
                onClick={onClose}
                className="px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={submit}
                disabled={preview.rows.length === 0 || submitting}
                className="px-4 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-50"
              >
                {submitting ? '提交中...' : `🚀 提交 ${preview.rows.length} 行`}
              </button>
            </div>
          </>
        ) : (
          <div>
            {result.success ? (
              <>
                <div className="mb-3 text-sm bg-green-50 border border-green-200 rounded p-3">
                  <div className="font-medium text-green-800">✅ 导入完成 {file ? <span className="text-xs text-gray-500 font-normal">({file.name})</span> : null}</div>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                    <div>导入成功: <b className="text-green-700">{result.imported}</b></div>
                    <div>跳过 (已烧): <b className="text-gray-600">{result.skipped}</b></div>
                    <div>未找到: <b className="text-red-600">{result.notFound}</b></div>
                    <div>非法格式: <b className="text-red-600">{result.invalid}</b></div>
                  </div>
                </div>

                {result.errors?.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-700 mb-1">⚠️ 详细 (前 200 条):</div>
                    <div className="max-h-60 overflow-y-auto text-xs border rounded">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="border p-1 text-left">行</th>
                            <th className="border p-1 text-left">nfc_id</th>
                            <th className="border p-1 text-left">原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.errors.map((e: any, i: number) => (
                            <tr key={i}>
                              <td className="border p-1">{e.row}</td>
                              <td className="border p-1 font-mono">{e.nfc_id}</td>
                              <td className="border p-1 text-red-600">{e.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                ❌ {result.error || '导入失败'}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
              <button
                onClick={onClose}
                className="px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
              >
                关闭
              </button>
              <button
                onClick={reset}
                className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
              >
                📤 再传一份
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
