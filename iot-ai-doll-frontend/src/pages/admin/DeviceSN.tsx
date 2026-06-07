/**
 * 设备 SN 录入管理
 * 选模板 + 填序列号 → 创建宠物实体 → 出现在「宠物实体管理」
 */
import { useState, useEffect } from 'react';
import type { DeviceModel, Device } from '../../api/pets';
import { getAvailableModels, getDevices, createDevice, deleteDevice } from '../../api/pets';

export default function DeviceSN() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  // 新建表单
  const [newSN, setNewSN] = useState('');
  const [newModelId, setNewModelId] = useState<number>(1);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [devList, modelList] = await Promise.all([
        getDevices(),
        getAvailableModels()
      ]);
      setDevices(devList);
      setModels(modelList);
    } catch (err) {
      console.error('加载失败', err);
    } finally {
      setLoading(false);
    }
  };

  // 单个创建设备
  const handleAddSingle = async () => {
    if (!newSN.trim()) { alert('请输入序列号'); return; }
    if (!newModelId) { alert('请选择模板'); return; }
    setSaving(true);
    try {
      await createDevice(newSN.trim(), newModelId, newDisplayName.trim() || undefined);
      setShowModal(false);
      setNewSN(''); setNewModelId(1); setNewDisplayName('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || '添加失败');
    } finally { setSaving(false); }
  };

  // 批量创建设备（每行: SN,模板ID[,显示名]）
  const handleAddBulk = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setSaving(true);
    let ok = 0, fail = 0;
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      const sn = parts[0];
      const modelId = parseInt(parts[1]);
      const name = parts[2] || undefined;
      if (!sn || !modelId) { fail++; continue; }
      try {
        await createDevice(sn, modelId, name);
        ok++;
      } catch { fail++; }
    }
    alert(`完成：成功 ${ok} 个${fail ? `，失败 ${fail} 个` : ''}`);
    setShowModal(false); setBulkText('');
    loadData();
  };

  const handleDelete = async (deviceSn: string) => {
    if (!confirm(`确定删除设备 ${deviceSn}？该宠物实体也会被删除。`)) return;
    try {
      await deleteDevice(deviceSn);
      loadData();
    } catch { alert('删除失败'); }
  };

  const modelName = (id: number) => models.find(m => m.model_id === id)?.name || `型号${id}`;

  return (
    <div className="p-6 space-y-5">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">设备 SN 录入</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            选模板 → 填序列号 → 创建宠物实体 → 在「宠物实体管理」中查看
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600"
        >
          + 录入设备 SN
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '设备总数', value: devices.length, color: 'text-white' },
          { label: '已激活', value: devices.filter(d => d.is_visible).length, color: 'text-green-400' },
          { label: '未激活', value: devices.filter(d => !d.is_visible).length, color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 说明 */}
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
        <p className="text-xs text-gray-400">
          <span className="text-purple-400 font-medium">提示：</span>
          序列号（SN）就是 NFC 标签 ID，每个 SN 对应一个宠物实体。
          创建后可在「宠物实体管理」中编辑状态、设置显示名；在「机伴管理」中编辑人设和 RAG 关联。
        </p>
      </div>

      {/* 设备列表 */}
      {loading ? (
        <div className="py-12 text-center text-gray-500">加载中...</div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 py-12 text-center text-gray-500">
          暂无设备，点击上方「录入设备 SN」创建
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">序列号</th>
                <th className="px-4 py-3">模板</th>
                <th className="px-4 py-3">显示名</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">创建时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.device_sn} className="border-b border-white/5 transition hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-sm text-white">{d.device_sn}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
                      {modelName(d.model_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{d.display_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      d.is_visible ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {d.is_visible ? '已激活' : '未激活'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(d.created_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(d.device_sn)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 录入弹窗 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-800 p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">录入设备 SN</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            {/* 模式切换 */}
            <div className="flex gap-2">
              <button
                onClick={() => setBulkMode(false)}
                className={`flex-1 rounded-lg py-2 text-sm ${!bulkMode ? 'bg-purple-500 text-white' : 'bg-slate-700 text-gray-400'}`}
              >
                单个录入
              </button>
              <button
                onClick={() => setBulkMode(true)}
                className={`flex-1 rounded-lg py-2 text-sm ${bulkMode ? 'bg-purple-500 text-white' : 'bg-slate-700 text-gray-400'}`}
              >
                批量录入
              </button>
            </div>

            {!bulkMode ? (
              /* 单个录入表单 */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">模板 *</label>
                  <select
                    value={newModelId}
                    onChange={e => setNewModelId(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-slate-700 px-3 py-2 text-sm text-white"
                  >
                    {models.map(m => (
                      <option key={m.model_id} value={m.model_id}>{m.name}</option>
                    ))}
                  </select>
                  {newModelId && models.find(m => m.model_id === newModelId)?.description && (
                    <p className="mt-1 text-xs text-gray-500">
                      {models.find(m => m.model_id === newModelId)?.description}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">序列号 *（NFC标签ID）</label>
                  <input
                    value={newSN}
                    onChange={e => setNewSN(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-700 px-3 py-2 text-sm text-white font-mono"
                    placeholder="如：10001"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">显示名（可选）</label>
                  <input
                    value={newDisplayName}
                    onChange={e => setNewDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-700 px-3 py-2 text-sm text-white"
                    placeholder="留空则使用模板名称"
                  />
                </div>

                <button
                  onClick={handleAddSingle}
                  disabled={saving}
                  className="w-full rounded-lg bg-purple-500 py-2.5 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
                >
                  {saving ? '创建中...' : '创建设备'}
                </button>
              </div>
            ) : (
              /* 批量录入 */
              <div className="space-y-4">
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-300">
                  格式：<span className="font-mono">序列号,模板ID[,显示名]</span>
                  <br />例如：<span className="font-mono">10001,1,我的宠物</span>
                </div>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  className="h-40 w-full rounded-lg border border-white/10 bg-slate-700 px-3 py-2 text-sm text-white font-mono"
                  placeholder={"10001,1,宠物A\n10002,2,宠物B\n10003,3"}
                  autoFocus
                />
                <button
                  onClick={handleAddBulk}
                  disabled={saving}
                  className="w-full rounded-lg bg-purple-500 py-2.5 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
                >
                  {saving ? '创建中...' : '批量创建'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
