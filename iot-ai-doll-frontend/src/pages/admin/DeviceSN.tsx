/**
 * 设备 SN 录入管理
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface Device {
  id: string;
  device_sn: string;
  device_type?: string;
  status: 'unbound' | 'bound';
  bound_user_id?: string;
  created_at: string;
}

export default function DeviceSN() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSN, setNewSN] = useState('');
  const [newType, setNewType] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSNs, setBulkSNs] = useState('');

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const res = await client.get('/admin/devices');
      setDevices(res.data.devices || []);
    } catch (err) {
      console.error('加载设备列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSingle = async () => {
    if (!newSN.trim()) return;
    try {
      await client.post('/admin/devices', { 
        device_sn: newSN.trim(),
        device_type: newType.trim() || undefined
      });
      await loadDevices();
      setNewSN('');
      setNewType('');
      setShowAddModal(false);
    } catch (err: any) {
      alert(err.response?.data?.error || '添加失败');
    }
  };

  const handleAddBulk = async () => {
    const sns = bulkSNs.split('\n').map(s => s.trim()).filter(Boolean);
    if (sns.length === 0) return;
    
    try {
      let success = 0;
      let failed = 0;
      for (const sn of sns) {
        try {
          await client.post('/admin/devices', { 
            device_sn: sn,
            device_type: newType.trim() || undefined
          });
          success++;
        } catch {
          failed++;
        }
      }
      alert(`批量添加完成：成功 ${success} 个，失败 ${failed} 个`);
      await loadDevices();
      setBulkSNs('');
      setNewType('');
      setShowAddModal(false);
    } catch (err) {
      console.error('批量添加失败:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此设备序列号吗？')) return;
    try {
      await client.delete(`/admin/devices/${id}`);
      await loadDevices();
    } catch (err) {
      alert('删除失败');
    }
  };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">设备 SN 录入</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600"
        >
          + 录入设备 SN
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-card p-4">
          <div className="text-2xl font-bold text-white">{devices.length}</div>
          <div className="text-sm text-gray-500">设备总数</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-card p-4">
          <div className="text-2xl font-bold text-green-400">{devices.filter(d => d.status === 'bound').length}</div>
          <div className="text-sm text-gray-500">已绑定</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-card p-4">
          <div className="text-2xl font-bold text-yellow-400">{devices.filter(d => d.status === 'unbound').length}</div>
          <div className="text-sm text-gray-500">未绑定</div>
        </div>
      </div>

      {/* 设备列表 */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">序列号</th>
              <th className="px-4 py-3">设备类型</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => (
              <tr key={device.id} className="border-b border-white/5 transition hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-sm text-white">{device.device_sn}</td>
                <td className="px-4 py-3 text-gray-300">{device.device_type || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    device.status === 'bound' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {device.status === 'bound' ? '已绑定' : '未绑定'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(device.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(device.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {devices.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">暂无设备数据</div>
      )}

      {/* 添加设备弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">录入设备 SN</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            {/* 模式切换 */}
            <div className="mb-4 flex gap-2">
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

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">设备类型（可选）</label>
                <input
                  type="text"
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                  placeholder="如：AI玩偶-V1"
                />
              </div>

              {!bulkMode ? (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">设备序列号</label>
                  <input
                    type="text"
                    value={newSN}
                    onChange={e => setNewSN(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                    placeholder="如：MIAODA-001"
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">设备序列号（每行一个）</label>
                  <textarea
                    value={bulkSNs}
                    onChange={e => setBulkSNs(e.target.value)}
                    className="h-40 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                    placeholder="MIAODA-001&#10;MIAODA-002&#10;MIAODA-003"
                    autoFocus
                  />
                </div>
              )}

              <button
                onClick={bulkMode ? handleAddBulk : handleAddSingle}
                className="w-full rounded-lg bg-purple-500 py-2 text-sm text-white hover:bg-purple-600"
              >
                {bulkMode ? '批量添加' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
