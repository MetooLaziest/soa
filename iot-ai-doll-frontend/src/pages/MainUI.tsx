/**
 * 用户主界面 - AI 机伴对话页面
 * 顶部状态栏 + 对话区域 + 底部输入框
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useDeviceStore } from '../stores/deviceStore';
import { streamChat } from '../api/chat';
import type { ChatMessage } from '../types';

export default function MainUI() {
  const { logout } = useAuthStore();
  const { devices, activeSn } = useDeviceStore();
  const currentDevice = devices.find(d => d.sn === activeSn);
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setSending(true);
    
    let assistantMsg = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    
    try {
      await streamChat(
        { message: text, context: { sn: currentDevice?.sn } },
        (chunk) => {
          assistantMsg += chunk;
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content: assistantMsg };
            return copy;
          });
        },
        () => setSending(false),
        (err) => { console.error('Chat error:', err); setSending(false); }
      );
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: '（连接失败，请重试）' };
        return copy;
      });
      setSending(false);
    }
  }, [input, sending, currentDevice?.sn]);

  return (
    <div className="flex h-screen flex-col bg-dark">
      {/* ====== 顶部栏 ====== */}
      <header className="flex items-center justify-between border-b border-white/10 bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          {/* 机伴名称 */}
          <h1 className="text-lg font-bold text-white">
            {currentDevice?.device_name || '艾瑟拉机伴'}
          </h1>
          {currentDevice?.sn && (
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
              #{currentDevice.sn.slice(-6)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* 状态图标 */}
          <span className="text-xs text-green-400">📶</span>
          <span className="text-xs text-yellow-400">🔋</span>
          <span className="text-xs text-gray-400">🔊</span>
          {/* 操作按钮 */}
          {!currentDevice && (
            <button onClick={() => navigate('/bind-device')}
              className="rounded-lg bg-cyan-500/20 px-3 py-1 text-xs text-cyan-400 hover:bg-cyan-500/30">
              绑定设备
            </button>
          )}
          <button onClick={() => navigate('/admin')}
            className="rounded-lg bg-white/5 px-3 py-1 text-xs text-gray-400 hover:bg-white/10">
            后台管理
          </button>
          <button onClick={logout}
            className="rounded-lg bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20">
            退出
          </button>
        </div>
      </header>

      {/* ====== 对话区域 ====== */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="flex h-[50vh] flex-col items-center justify-center text-center">
              <div className="mb-4 text-6xl">🐱</div>
              <p className="text-lg text-gray-300">与你的机伴开始对话吧</p>
              <p className="mt-1 text-sm text-gray-500">输入消息开始冒险</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 text-cyan-50'
                  : 'border border-purple-500/30 bg-purple-500/10 text-purple-50'
              }`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content || '...'}</p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* ====== 底部输入区 ====== */}
      <footer className="border-t border-white/10 bg-card p-4">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="mx-auto flex max-w-2xl items-center gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-40">
            发送
          </button>
        </form>
      </footer>
    </div>
  );
}
