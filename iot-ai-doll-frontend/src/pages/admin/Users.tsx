/**
 * 用户列表管理
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface User {
  id: string;
  username: string;
  role: string;
  created_at: string;
  last_login?: string;
}

interface UserDevice {
  device_sn: string;
  bound_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDevices, setUserDevices] = useState<UserDevice[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await client.get('/admin/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('加载用户列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDevices = async (userId: string) => {
    try {
      const res = await client.get(`/admin/users/${userId}/devices`);
      setUserDevices(res.data.devices || []);
    } catch (err) {
      console.error('加载用户设备失败:', err);
      setUserDevices([]);
    }
  };

  const handleViewDevices = async (user: User) => {
    setSelectedUser(user);
    await loadUserDevices(user.id);
  };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 animate-fade-in-up">
      <h2 className="mb-6 text-xl font-bold text-white">用户列表</h2>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">用户名</th>
              <th className="px-4 py-3">角色</th>
              <th className="px-4 py-3">注册时间</th>
              <th className="px-4 py-3">最后登录</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-white/5 transition hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{user.id.slice(0, 8)}...</td>
                <td className="px-4 py-3 font-medium text-white">{user.username}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    user.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {user.role === 'admin' ? '管理员' : '用户'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {user.last_login ? new Date(user.last_login).toLocaleString() : '从未登录'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleViewDevices(user)}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    查看设备
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

      {/* 设备绑定详情弹窗 */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-slate-900 p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">用户设备 - {selectedUser.username}</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            {userDevices.length > 0 ? (
              <div className="space-y-2">
                {userDevices.map(device => (
                  <div key={device.device_sn} className="rounded-lg bg-white/5 px-4 py-3">
                    <div className="font-mono text-sm text-white">{device.device_sn}</div>
                    <div className="mt-1 text-xs text-gray-500">绑定于 {new Date(device.bound_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500">该用户暂无绑定设备</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
