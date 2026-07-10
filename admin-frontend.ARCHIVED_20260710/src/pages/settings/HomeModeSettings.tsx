import React, { useEffect, useState } from 'react';

interface UserSettings {
  home_mode: 'yard' | 'live';
  updated_at: string | null;
}

const HomeModeSettings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userId, setUserId] = useState<number>(2);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/epet1/user/settings/${userId}`);
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (err) {
      showMessage('error', '加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async (mode: 'yard' | 'live') => {
    try {
      setSaving(true);
      const res = await fetch(`/api/epet1/user/settings/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_mode: mode }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        showMessage('success', `已切换到${mode === 'yard' ? '庭院画面' : '直播画面'}模式`);
      } else {
        showMessage('error', data.error || '保存失败');
      }
    } catch (err) {
      showMessage('error', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <div style={{ fontSize: 24 }}>🌀 加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>首页展示设置</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>
        选择用户在 epet 首页看到的默认展示模式
      </p>

      {/* 消息提示 */}
      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            background: message.type === 'success' ? '#f6ffed' : '#fff2f0',
            border: `1px solid ${message.type === 'success' ? '#b7eb8f' : '#ffccc7'}`,
            color: message.type === 'success' ? '#52c41a' : '#ff4d4f',
          }}
        >
          {message.text}
        </div>
      )}

      <div
        style={{
          maxWidth: 600,
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        {/* 用户 ID 输入 */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            用户 ID
          </label>
          <input
            type="number"
            value={userId}
            onChange={(e) => setUserId(Number(e.target.value))}
            disabled={saving}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #d9d9d9',
              width: 200,
              fontSize: 14,
            }}
          />
        </div>

        {/* 模式选择 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 庭院画面选项 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderRadius: 8,
              border: `2px solid ${settings?.home_mode === 'yard' ? '#667eea' : '#e8e8e8'}`,
              background: settings?.home_mode === 'yard' ? '#f0f5ff' : '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <input
              type="radio"
              name="homeMode"
              value="yard"
              checked={settings?.home_mode === 'yard'}
              onChange={() => handleSave('yard')}
              disabled={saving}
              style={{ width: 20, height: 20 }}
            />
            <span style={{ fontSize: 24 }}>🏡</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>庭院画面</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                传统的 PixiJS 渲染场景，可抚摸互动
              </div>
            </div>
          </label>

          {/* 直播画面选项 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderRadius: 8,
              border: `2px solid ${settings?.home_mode === 'live' ? '#764ba2' : '#e8e8e8'}`,
              background: settings?.home_mode === 'live' ? '#f9f0ff' : '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <input
              type="radio"
              name="homeMode"
              value="live"
              checked={settings?.home_mode === 'live'}
              onChange={() => handleSave('live')}
              disabled={saving}
              style={{ width: 20, height: 20 }}
            />
            <span style={{ fontSize: 24 }}>📹</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>直播画面</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                根据时间段自动播放机伴视频，上下滑动切换
              </div>
            </div>
          </label>
        </div>

        {/* 当前状态 */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: '#f5f5f5',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 14, color: '#666' }}>
            <strong>当前模式：</strong>
            {settings?.home_mode === 'yard' ? '庭院画面' : '直播画面'}
          </div>
          {settings?.updated_at && (
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              最后更新：{new Date(settings.updated_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* 功能说明 */}
      <div
        style={{
          maxWidth: 600,
          marginTop: 24,
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>功能说明</h3>
        <div style={{ lineHeight: 1.8, color: '#666' }}>
          <p>
            <strong>庭院画面：</strong>
          </p>
          <ul>
            <li>使用 PixiJS 渲染的交互式场景</li>
            <li>支持抚摸、喂食等互动操作</li>
            <li>显示家具布置和情绪值</li>
          </ul>

          <p>
            <strong>直播画面：</strong>
          </p>
          <ul>
            <li>根据当前时间自动匹配最接近的时间段视频</li>
            <li>上下滑动切换不同时间段的视频</li>
            <li>循环播放，无需用户点击</li>
            <li>底部菜单保留【派遣旅行】快捷入口</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HomeModeSettings;
