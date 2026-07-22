/**
 * 演示时间管理 - 手动覆盖系统时间用于演示
 *
 * 功能:
 * - 显示当前真实时间 vs 演示时间
 * - 时间选择器设置演示时间
 * - 一键恢复真实时间
 * - 当前时段显示 (dawn/day/night)
 * - PM2 重启自动恢复 (天然回滚)
 */
import { useState, useEffect, useCallback } from 'react';

interface DemoTimeState {
  active: boolean;
  demo_time: string | null;
  real_time: string;
  effective_time: string;
  time_slot?: string;
}

const API_BASE = '/api/admin/demo-time';

function getTimeSlot(hour: number): { slot: string; label: string; icon: string } {
  if (hour >= 6 && hour < 9) return { slot: 'dawn', label: '黎明', icon: '🌅' };
  if (hour >= 9 && hour < 17) return { slot: 'day', label: '白天', icon: '☀️' };
  if (hour >= 17 && hour < 20) return { slot: 'dawn', label: '黄昏', icon: '🌇' };
  return { slot: 'night', label: '夜晚', icon: '🌙' };
}

export default function DemoTimeAdmin() {
  const [state, setState] = useState<DemoTimeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputHour, setInputHour] = useState('12');
  const [inputMinute, setInputMinute] = useState('00');

  // 轮询状态
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (data.success) {
        setState(data);
        if (data.demo_time) {
          const [h, m] = data.demo_time.split(':');
          setInputHour(h);
          setInputMinute(m);
        }
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchState();
    const timer = setInterval(fetchState, 5000); // 每5秒刷新
    return () => clearInterval(timer);
  }, [fetchState]);

  // 设置演示时间
  const applyDemoTime = async () => {
    setLoading(true);
    setError(null);
    try {
      const time = `${inputHour.padStart(2, '0')}:${inputMinute.padStart(2, '0')}`;
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time }),
      });
      const data = await res.json();
      if (data.success) {
        setState(data);
      } else {
        setError(data.error || '设置失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 恢复真实时间
  const clearDemoTime = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      });
      const data = await res.json();
      if (data.success) {
        setState(data);
      } else {
        setError(data.error || '恢复失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 快捷时段按钮
  const quickPresets = [
    { label: '黎明 06:30', hour: 6, minute: 30 },
    { label: '白天 12:00', hour: 12, minute: 0 },
    { label: '黄昏 18:00', hour: 18, minute: 0 },
    { label: '夜晚 21:00', hour: 21, minute: 0 },
    { label: '深夜 02:00', hour: 2, minute: 0 },
  ];

  const effectiveHour = state?.effective_time ? parseInt(state.effective_time.split(':')[0], 10) : new Date().getHours();
  const timeSlotInfo = getTimeSlot(effectiveHour);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">🕐 演示时间管理</h1>
      <p className="text-gray-400 text-sm mb-6">
        手动覆盖系统时间，用于触发庭院背景切换、宠物行为变化和直播视频选择。
        <br />
        <span className="text-yellow-400">PM2 重启后自动恢复真实时间（天然回滚机制）</span>
      </p>

      {/* 当前状态卡片 */}
      <div className="bg-slate-800 rounded-lg p-5 mb-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">当前状态</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-400 text-sm">真实时间</div>
            <div className="text-2xl font-mono text-white">{state?.real_time || '--:--'}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">有效时间</div>
            <div className="text-2xl font-mono text-white">
              {state?.effective_time || '--:--'}
              {state?.active && <span className="ml-2 text-yellow-400 text-sm">(演示)</span>}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">当前时段</div>
            <div className="text-xl text-white">
              {timeSlotInfo.icon} {timeSlotInfo.label}
              <span className="text-gray-500 text-sm ml-2">({timeSlotInfo.slot})</span>
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">演示模式</div>
            <div className={`text-xl ${state?.active ? 'text-yellow-400' : 'text-green-400'}`}>
              {state?.active ? '🔴 已激活' : '🟢 未激活'}
            </div>
          </div>
        </div>
      </div>

      {/* 时间设置 */}
      <div className="bg-slate-800 rounded-lg p-5 mb-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">设置演示时间</h2>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="number"
            min={0}
            max={23}
            value={inputHour}
            onChange={e => setInputHour(e.target.value)}
            className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center font-mono text-lg focus:outline-none focus:border-purple-500"
          />
          <span className="text-white text-2xl font-bold">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={inputMinute}
            onChange={e => setInputMinute(e.target.value)}
            className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center font-mono text-lg focus:outline-none focus:border-purple-500"
          />

          <button
            onClick={applyDemoTime}
            disabled={loading}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? '设置中...' : '应用'}
          </button>

          {state?.active && (
            <button
              onClick={clearDemoTime}
              disabled={loading}
              className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              恢复真实时间
            </button>
          )}
        </div>

        {/* 快捷按钮 */}
        <div className="text-gray-400 text-sm mb-2">快捷时段：</div>
        <div className="flex flex-wrap gap-2">
          {quickPresets.map(preset => (
            <button
              key={preset.label}
              onClick={() => {
                setInputHour(String(preset.hour));
                setInputMinute(String(preset.minute));
              }}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded text-sm transition"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 影响范围说明 */}
      <div className="bg-slate-800 rounded-lg p-5 mb-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">影响范围</h2>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li className="flex items-start gap-2">
            <span>🌅</span>
            <span><strong className="text-white">庭院背景</strong> — 根据时段切换 dawn/day/night 背景 (yard-scene)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>🐱</span>
            <span><strong className="text-white">宠物行为</strong> — 触发不同时间段的行为动画 (pet-behaviors)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>🎬</span>
            <span><strong className="text-white">直播视频</strong> — 选择对应时段的开场视频 (intro-videos + LivePage)</span>
          </li>
        </ul>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4">
          ❌ {error}
        </div>
      )}

      {/* 回滚说明 */}
      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 text-yellow-300 text-sm">
        <strong>🔄 回滚方式：</strong>
        <ul className="mt-1 ml-4 list-disc space-y-1">
          <li>点击「恢复真实时间」按钮</li>
          <li>PM2 重启后端进程 (<code className="bg-slate-800 px-1 rounded">pm2 restart iot-backend</code>)</li>
          <li>演示时间仅存储在内存中，不会持久化到数据库或文件</li>
        </ul>
      </div>
    </div>
  );
}
