/**
 * LoginOverlay — 全屏登录/注册遮罩
 * 未认证时覆盖整个 App，认证通过后自动消失
 * 支持 ?id=9527 演示免登录
 */
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

type Mode = 'login' | 'register';

export default function LoginOverlay() {
  const { sendCode, register, login, loading: authLoading } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 验证码倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    if (!/^1\d{10}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    setError('');
    try {
      const res = await sendCode(phone);
      if (res.ok) {
        setCodeSent(true);
        setCountdown(60);
      } else {
        setError(res.error || '发送失败');
      }
    } catch {
      setError('网络错误');
    }
  };

  // 注册
  const handleRegister = async () => {
    if (!phone || !code || !password) {
      setError('请填写所有字段');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6位');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await register(phone, code, password);
      if (!res.ok) {
        setError(res.error || '注册失败');
      }
      // 成功 → authStore 自动设置 isAuthenticated=true → overlay 消失
    } catch {
      setError('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  // 登录
  const handleLogin = async () => {
    if (!phone || !password) {
      setError('请输入手机号和密码');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await login(phone, password);
      if (!res.ok) {
        setError(res.error || '登录失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') handleLogin();
    else handleRegister();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'linear-gradient(180deg, #FFF8F0 0%, #F0E6D3 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24,
    }}>
      {/* 品牌区 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🏡</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#8B6914' }}>绒绒庭院</div>
        <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>E-Pet H5</div>
      </div>

      {/* 表单卡片 */}
      <form onSubmit={handleSubmit} style={{
        width: '100%', maxWidth: 320,
        background: '#fff', borderRadius: 20, padding: '28px 24px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* 模式切换 */}
        <div style={{ display: 'flex', marginBottom: 24, borderBottom: '2px solid #f0f0f0' }}>
          {(['login', 'register'] as Mode[]).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: mode === m ? 700 : 400,
                color: mode === m ? '#8B6914' : '#999',
                background: 'transparent',
                borderBottom: mode === m ? '2px solid #8B6914' : '2px solid transparent',
                marginBottom: -2,
              }}>
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        {/* 手机号 */}
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="手机号" maxLength={11}
          style={{
            width: '100%', height: 46, borderRadius: 12, border: '1px solid #ddd',
            padding: '0 14px', fontSize: 15, marginBottom: 12,
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* 注册模式：验证码 */}
        {mode === 'register' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="验证码" maxLength={6}
              style={{
                flex: 1, height: 46, borderRadius: 12, border: '1px solid #ddd',
                padding: '0 14px', fontSize: 15, outline: 'none',
              }}
            />
            <button type="button" onClick={handleSendCode}
              disabled={countdown > 0 || !/^1\d{10}$/.test(phone)}
              style={{
                width: 110, height: 46, borderRadius: 12, border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                color: '#fff',
                background: (countdown > 0 || !/^1\d{10}$/.test(phone)) ? '#ccc' : 'linear-gradient(135deg, #8B6914, #C49B2A)',
              }}>
              {countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '获取验证码'}
            </button>
          </div>
        )}

        {/* 密码 */}
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'register' ? '设置密码（至少6位）' : '密码'}
          style={{
            width: '100%', height: 46, borderRadius: 12, border: '1px solid #ddd',
            padding: '0 14px', fontSize: 15, marginBottom: 16,
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* 错误信息 */}
        {error && (
          <div style={{ color: '#e74c3c', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* 提交按钮 */}
        <button type="submit" disabled={submitting}
          style={{
            width: '100%', height: 48, borderRadius: 24, border: 'none',
            fontSize: 16, fontWeight: 700, cursor: 'pointer', color: '#fff',
            background: submitting ? '#ccc' : 'linear-gradient(135deg, #8B6914, #C49B2A)',
          }}>
          {submitting ? '处理中...' : mode === 'login' ? '登 录' : '注 册'}
        </button>
      </form>

      {/* 底部提示 */}
      <div style={{ marginTop: 20, fontSize: 12, color: '#bbb', textAlign: 'center' }}>
        开发环境验证码: 123456
      </div>
    </div>
  );
}
