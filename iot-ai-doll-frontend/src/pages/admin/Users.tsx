/**
 * 绒绒庭院 - 用户管理
 * 用户列表 + 背包管理 + 情绪值修改 + 消消乐记录清理
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface EpetUser {
  id: number;
  nickname: string;
  emotion_points: number;
  created_at: string;
  updated_at: string;
  pet_count: number;
  furniture_count: number;
  inventory_count: number;
}

interface InventoryItem {
  id: number;
  user_id: number;
  shop_item_id: number;
  quantity: number;
  item_category: string;
  source: string;
  dish_rating: number | null;
  name: string;
  image_url: string;
  price_emotion: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  food: '🥘 食材',
  furniture: '🪑 家具',
  dish: '🍳 料理',
  hidden: '🔒 系统',
};

export default function Users() {
  const [users, setUsers] = useState<EpetUser[]>([]);
  const [loading, setLoading] = useState(true);

  // 用户详情面板
  const [selectedUser, setSelectedUser] = useState<EpetUser | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(false);

  // 情绪值编辑
  const [emotionInput, setEmotionInput] = useState('');
  const [emotionSaving, setEmotionSaving] = useState(false);

  // 删除确认
  const [clearingMatch3, setClearingMatch3] = useState(false);
  const [resettingFishing, setResettingFishing] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await client.get('/admin/epet-users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('加载用户列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async (userId: number) => {
    setInvLoading(true);
    try {
      const res = await client.get(`/admin/epet-users/${userId}/inventory`);
      setInventory(res.data.inventory || []);
    } catch (err) {
      console.error('加载背包失败:', err);
      setInventory([]);
    } finally {
      setInvLoading(false);
    }
  };

  const openUserDetail = (user: EpetUser) => {
    setSelectedUser(user);
    setEmotionInput(String(user.emotion_points));
    loadInventory(user.id);
  };

  const closeDetail = () => {
    setSelectedUser(null);
    setInventory([]);
    setEmotionInput('');
  };

  // 修改情绪值
  const handleSaveEmotion = async () => {
    if (!selectedUser || !emotionInput) return;
    const val = parseInt(emotionInput);
    if (isNaN(val)) { alert('请输入有效数字'); return; }
    setEmotionSaving(true);
    try {
      await client.post(`/admin/epet-users/${selectedUser.id}/emotion`, { emotion_points: val });
      setSelectedUser({ ...selectedUser, emotion_points: val });
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, emotion_points: val } : u));
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setEmotionSaving(false);
    }
  };

  // 删除背包道具
  const handleDeleteInv = async (invId: number, itemName: string) => {
    if (!selectedUser) return;
    if (!confirm(`确认删除「${itemName}」？`)) return;
    try {
      await client.delete(`/admin/epet-users/${selectedUser.id}/inventory/${invId}`);
      setInventory(inventory.filter(i => i.id !== invId));
      // 更新列表中的 inventory_count
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, inventory_count: u.inventory_count - 1 } : u));
    } catch (err: any) {
      alert('删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  // 清空消消乐记录
  const handleClearMatch3 = async () => {
    if (!selectedUser) return;
    if (!confirm('确认清空该用户所有消消乐闯关记录？')) return;
    setClearingMatch3(true);
    try {
      const res = await client.delete(`/admin/epet-users/${selectedUser.id}/match3-records`);
      alert(`已清空 ${res.data.deleted} 条记录`);
    } catch (err: any) {
      alert('清空失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setClearingMatch3(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">👥 绒绒庭院 - 用户管理</h2>
        <p className="mt-1 text-sm text-gray-500">管理用户情绪值、背包道具、消消乐记录</p>
      </div>

      {/* 用户列表 */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">昵称</th>
              <th className="px-4 py-3">💛 情绪值</th>
              <th className="px-4 py-3">🐾 宠物</th>
              <th className="px-4 py-3">🎒 背包</th>
              <th className="px-4 py-3">🪑 庭院家具</th>
              <th className="px-4 py-3">注册时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-white/5 transition hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{user.id}</td>
                <td className="px-4 py-3 font-medium text-white">{user.nickname}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-yellow-500/15 px-2.5 py-0.5 text-xs font-semibold text-yellow-300">
                    {user.emotion_points}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{user.pet_count}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{user.inventory_count}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{user.furniture_count}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(user.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openUserDetail(user)}
                    className="rounded-lg bg-purple-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-purple-600"
                  >
                    管理
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">暂无用户数据</div>
      )}

      {/* 用户详情侧边栏 */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={closeDetail}>
          <div
            className="flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-white/10 bg-slate-900"
            onClick={e => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedUser.nickname}</h3>
                <span className="text-xs text-gray-500">ID: {selectedUser.id}</span>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
                ✕
              </button>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 情绪值 */}
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
                <div className="text-xs font-semibold text-yellow-300">💛 情绪值</div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={emotionInput}
                    onChange={e => setEmotionInput(e.target.value)}
                    className="w-28 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <button
                    onClick={handleSaveEmotion}
                    disabled={emotionSaving}
                    className="rounded-lg bg-yellow-600 px-4 py-2 text-xs font-semibold text-white hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {emotionSaving ? '保存中...' : '保存'}
                  </button>
                  <div className="flex gap-1">
                    {[100, 500, 1000, 9999].map(v => (
                      <button
                        key={v}
                        onClick={() => setEmotionInput(String(v))}
                        className="rounded bg-white/5 px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white"
                      >
                        +{v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 消消乐记录 */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                <div className="text-xs font-semibold text-red-300">💎 消消乐闯关记录</div>
                <p className="text-xs text-gray-500">清空后用户需要重新通关才能购买需通关的家具</p>
                <button
                  onClick={handleClearMatch3}
                  disabled={clearingMatch3}
                  className="rounded-lg bg-red-600/80 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {clearingMatch3 ? '清空中...' : '🗑️ 清空所有记录'}
                </button>
              </div>

              {/* 钓鱼次数重置 */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                <div className="text-xs font-semibold text-blue-300">🎣 今日钓鱼次数</div>
                <p className="text-xs text-gray-500">重置后用户今日可重新钓鱼（每日限制3次）</p>
                <button
                  onClick={async () => {
                    if (!confirm('确认重置该用户今日钓鱼次数？')) return;
                    setResettingFishing(true);
                    try {
                      const res = await client.delete(`/admin/epet-users/${selectedUser.id}/fishing-today`);
                      alert(`已删除 ${res.data.deleted} 条今日钓鱼记录`);
                    } catch (err: any) {
                      alert('重置失败: ' + (err.response?.data?.error || err.message));
                    } finally {
                      setResettingFishing(false);
                    }
                  }}
                  disabled={resettingFishing}
                  className="rounded-lg bg-blue-600/80 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {resettingFishing ? '重置中...' : '🔄 重置今日次数'}
                </button>
              </div>

              {/* 背包道具 */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-white">🎒 背包道具</div>
                {invLoading ? (
                  <div className="py-4 text-center text-sm text-gray-500">加载中...</div>
                ) : inventory.length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-500">背包为空</div>
                ) : (
                  <div className="space-y-2">
                    {inventory.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          {/* 缩略图 */}
                          <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-white/10">
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm">📦</div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {CATEGORY_LABELS[item.item_category] || item.item_category}
                              {item.source && ` · 来源: ${item.source}`}
                              {item.quantity > 1 && ` ×${item.quantity}`}
                              {item.dish_rating != null && ` · ⭐${item.dish_rating}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteInv(item.id, item.name)}
                          className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-400 hover:bg-red-500/25 hover:text-red-300"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
