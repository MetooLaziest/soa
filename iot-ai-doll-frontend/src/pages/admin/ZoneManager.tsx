/**
 * ZoneManager — Admin page for managing yard zones (multi-zone + time-slot backgrounds)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

const UNLOCK_TYPES = [
  { value: 'free', label: '🆓 免费开放', desc: '所有用户默认可用' },
  { value: 'shop_item', label: '🛍️ 购买商品解锁', desc: '购买指定商店商品后解锁' },
  { value: 'pet_count', label: '🐾 宠物数量', desc: '拥有 N 只宠物后解锁' },
  { value: 'interact_count', label: '👆 互动次数', desc: '累计互动 N 次后解锁' },
  { value: 'growth_level', label: '⬆️ 成长等级', desc: '宠物达到 N 级后解锁' },
];

const TIME_SLOTS = [
  { key: 'dawn', label: '🌅 清晨/傍晚 (6:00-9:00, 17:00-20:00)', field: 'bg_image_dawn' },
  { key: 'day', label: '☀️ 白天 (9:00-17:00)', field: 'bg_image_day' },
  { key: 'night', label: '🌙 夜晚 (20:00-6:00)', field: 'bg_image_night' },
];

interface Zone {
  id: number;
  zone_key: string;
  zone_name: string;
  grid_x: number;
  grid_y: number;
  walk_bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  bg_image_dawn: string;
  bg_image_day: string;
  bg_image_night: string;
  is_default: boolean;
  unlock_type: string;
  unlock_value: string;
  unlock_shop_item_id: number | null;
  light_config?: { dawn: LightSlotConfig; day: LightSlotConfig; night: LightSlotConfig };
  created_at: string;
  updated_at: string;
}

interface LightSlotConfig {
  light_angle: number;
  shadow_offset: number;
}

export default function ZoneManager() {
  const navigate = useNavigate();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // 首页模式配置
  const [homeMode, setHomeMode] = useState<'yard' | 'live'>('yard');
  const [homeModeLoading, setHomeModeLoading] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  // Form fields
  const [fKey, setFKey] = useState('0,0');
  const [fName, setFName] = useState('');
  const [fGridX, setFGridX] = useState(0);
  const [fGridY, setFGridY] = useState(0);
  const [fUnlockType, setFUnlockType] = useState('free');
  const [fUnlockValue, setFUnlockValue] = useState('');
  const [fUnlockShopItemId, setFUnlockShopItemId] = useState<number | null>(null);
  const [fWalkBounds, setFWalkBounds] = useState({ xMin: 0.05, xMax: 0.88, yMin: 0.45, yMax: 0.78 });
  const [fLightConfig, setFLightConfig] = useState<Record<string, LightSlotConfig>>({
    dawn: { light_angle: 30, shadow_offset: 0.5 },
    day: { light_angle: 315, shadow_offset: 0.4 },
    night: { light_angle: 270, shadow_offset: 0.2 },
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/admin/zones');
      setZones(res.data.zones || []);
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 加载首页模式配置
  const loadHomeMode = async () => {
    try {
      const userId = 2; // 默认演示用户，实际应该从登录状态获取
      const res = await client.get(`/epet1/user/settings/${userId}`);
      if (res.data.success) {
        setHomeMode(res.data.settings?.home_mode || 'yard');
      }
    } catch (err) {
      console.error('加载首页模式失败:', err);
    }
  };

  // 保存首页模式
  const saveHomeMode = async (mode: 'yard' | 'live') => {
    setHomeModeLoading(true);
    try {
      const userId = 2; // 默认演示用户
      await client.post(`/epet1/user/settings/${userId}`, { home_mode: mode });
      setHomeMode(mode);
    } catch (err) {
      console.error('保存首页模式失败:', err);
      alert('保存失败');
    } finally {
      setHomeModeLoading(false);
    }
  };

  useEffect(() => { load(); loadHomeMode(); }, []);

  const resetForm = () => {
    setFKey('0,0'); setFName(''); setFGridX(0); setFGridY(0);
    setFUnlockType('free'); setFUnlockValue(''); setFUnlockShopItemId(null);
    setFWalkBounds({ xMin: 0.05, xMax: 0.88, yMin: 0.45, yMax: 0.78 });
    setFLightConfig({
      dawn: { light_angle: 30, shadow_offset: 0.5 },
      day: { light_angle: 315, shadow_offset: 0.4 },
      night: { light_angle: 270, shadow_offset: 0.2 },
    });
    setEditing(null); setShowForm(false);
  };

  const openEdit = (zone: Zone) => {
    setEditing(zone);
    setFKey(zone.zone_key); setFName(zone.zone_name);
    setFGridX(zone.grid_x); setFGridY(zone.grid_y);
    setFUnlockType(zone.unlock_type); setFUnlockValue(zone.unlock_value);
    setFUnlockShopItemId(zone.unlock_shop_item_id);
    const wb = typeof zone.walk_bounds === 'string' ? JSON.parse(zone.walk_bounds) : zone.walk_bounds;
    setFWalkBounds(wb || { xMin: 0.05, xMax: 0.88, yMin: 0.45, yMax: 0.78 });
    const lc = zone.light_config || {};
    const parsedLc = typeof lc === 'string' ? JSON.parse(lc) : lc;
    setFLightConfig({
      dawn: parsedLc.dawn || { light_angle: 30, shadow_offset: 0.5 },
      day: parsedLc.day || { light_angle: 315, shadow_offset: 0.4 },
      night: parsedLc.night || { light_angle: 270, shadow_offset: 0.2 },
    });
    setShowForm(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await client.put(`/admin/zones/${editing.id}`, {
          zone_name: fName, grid_x: fGridX, grid_y: fGridY,
          walk_bounds: fWalkBounds,
          unlock_type: fUnlockType, unlock_value: fUnlockValue,
          unlock_shop_item_id: fUnlockShopItemId,
          light_config: fLightConfig,
        });
      } else {
        await client.post('/admin/zones', {
          zone_key: fKey, zone_name: fName, grid_x: fGridX, grid_y: fGridY,
          walk_bounds: fWalkBounds,
          unlock_type: fUnlockType, unlock_value: fUnlockValue,
          unlock_shop_item_id: fUnlockShopItemId,
        });
      }
      resetForm(); load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteZone = async (zone: Zone) => {
    if (zone.is_default) { alert('不能删除默认区域'); return; }
    if (!confirm(`确定删除区域 "${zone.zone_name}" (${zone.zone_key})？此区域下的场景物体也会被删除。`)) return;
    try {
      await client.delete(`/admin/zones/${zone.id}`);
      load();
    } catch (err: any) {
      alert('删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const uploadBg = async (zoneKey: string, timeSlot: string, file: File) => {
    setUploadingSlot(`${zoneKey}-${timeSlot}`);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const image_data = ev.target?.result as string;
        await client.post('/admin/zones/upload-bg', { zone_id: zoneKey, time_slot: timeSlot, image_data });
        load();
        setUploadingSlot(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('上传失败: ' + (err.response?.data?.error || err.message));
      setUploadingSlot(null);
    }
  };

  const gridLabel = (gx: number, gy: number) => {
    const yLabel = gy < 0 ? '上' : gy > 0 ? '下' : '中';
    const xLabel = gx < 0 ? '左' : gx > 0 ? '右' : '中';
    return `${yLabel}${xLabel}`;
  };

  // Sort zones into grid order
  const sortedZones = [...zones].sort((a, b) => a.grid_y - b.grid_y || a.grid_x - b.grid_x);

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🗺️ 区域管理</h2>
          <p className="mt-1 text-sm text-gray-500">管理庭院区域、时段背景图、解锁条件、首页展示模式</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
          + 新增区域
        </button>
      </div>

      {/* 首页展示模式配置 */}
      <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-white">🏠 首页展示模式</h3>
            <p className="text-xs text-gray-500">配置 epet 首页默认展示的视图模式</p>
          </div>
          {homeModeLoading && <span className="text-xs text-gray-400">保存中...</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => saveHomeMode('yard')}
            disabled={homeModeLoading}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
              homeMode === 'yard'
                ? 'border-purple-500 bg-purple-500/20'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <span className="text-2xl">🏡</span>
            <div>
              <div className="text-sm font-medium text-white">庭院画面</div>
              <div className="text-xs text-gray-400">PixiJS 渲染的交互式场景，可抚摸互动</div>
            </div>
            {homeMode === 'yard' && (
              <span className="ml-auto rounded-full bg-purple-500/30 px-2 py-0.5 text-xs text-purple-300">当前</span>
            )}
          </button>
          <button
            onClick={() => saveHomeMode('live')}
            disabled={homeModeLoading}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
              homeMode === 'live'
                ? 'border-purple-500 bg-purple-500/20'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <span className="text-2xl">📹</span>
            <div>
              <div className="text-sm font-medium text-white">直播画面</div>
              <div className="text-xs text-gray-400">根据时间段自动播放机伴视频，上下滑动切换</div>
            </div>
            {homeMode === 'live' && (
              <span className="ml-auto rounded-full bg-purple-500/30 px-2 py-0.5 text-xs text-purple-300">当前</span>
            )}
          </button>
        </div>
      </div>

      {/* Zone Grid */}
      {!loading && (
        <div className="space-y-4">
          {sortedZones.map(zone => {
            const wb = typeof zone.walk_bounds === 'string' ? JSON.parse(zone.walk_bounds) : zone.walk_bounds;
            const unlockInfo = UNLOCK_TYPES.find(u => u.value === zone.unlock_type);
            return (
              <div key={zone.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-lg bg-purple-500/20 px-2.5 py-1 text-xs font-mono font-bold text-purple-300">
                      {zone.zone_key}
                    </span>
                    <span className="text-base font-semibold text-white">{zone.zone_name}</span>
                    {zone.is_default && (
                      <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-300">默认</span>
                    )}
                    <span className="text-xs text-gray-500">{gridLabel(zone.grid_x, zone.grid_y)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/admin/yard-editor?zone=${zone.zone_key}`)}
                      className="rounded bg-blue-600/20 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-600/30">
                      ✏️ 编辑布局
                    </button>
                    <button onClick={() => openEdit(zone)}
                      className="rounded bg-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/20">
                      ⚙️ 配置
                    </button>
                    {!zone.is_default && (
                      <button onClick={() => deleteZone(zone)}
                        className="rounded bg-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/30">
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* Unlock condition */}
                <div className="mb-3 text-xs text-gray-400">
                  解锁条件: {unlockInfo?.label || zone.unlock_type}
                  {zone.unlock_type !== 'free' && zone.unlock_value && ` — ${zone.unlock_value}`}
                </div>

                {/* Time-slot backgrounds */}
                <div className="grid grid-cols-3 gap-3">
                  {TIME_SLOTS.map(slot => {
                    const imgUrl = (zone as any)[slot.field] || '';
                    const isUploading = uploadingSlot === `${zone.zone_key}-${slot.key}`;
                    return (
                      <div key={slot.key} className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
                        <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/5">
                          <span className="text-xs text-gray-300">{slot.label}</span>
                          <label className={`cursor-pointer text-xs px-2 py-0.5 rounded ${
                            isUploading ? 'bg-gray-600 text-gray-400' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                            {isUploading ? '⏳' : '上传'}
                            <input type="file" accept="image/*" className="hidden" disabled={isUploading}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadBg(zone.zone_key, slot.key, f); e.target.value = ''; }} />
                          </label>
                        </div>
                        {imgUrl ? (
                          <div className="aspect-[9/16] max-h-40 overflow-hidden bg-black/50">
                            <img src={imgUrl} alt={slot.label} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="aspect-[9/16] max-h-40 flex items-center justify-center text-gray-600 text-xs">
                            未设置
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Walk bounds preview */}
                {wb && (
                  <div className="mt-3 text-xs text-gray-500">
                    🚶 可步行区域: x [{wb.xMin}, {wb.xMax}] y [{wb.yMin}, {wb.yMax}]
                  </div>
                )}
              </div>
            );
          })}
          {sortedZones.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              <div className="text-4xl mb-3">🗺️</div>
              <div>还没有区域，点击"新增区域"开始配置</div>
            </div>
          )}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={resetForm}>
          <div className="w-full max-w-lg rounded-xl bg-slate-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">{editing ? '编辑' : '新增'}区域</h3>
            <div className="space-y-3">
              {!editing && (
                <div>
                  <label className="text-xs text-gray-400">区域 Key（如 0,0 / 1,0 / 0,-1）</label>
                  <input value={fKey} onChange={e => setFKey(e.target.value)} placeholder="0,0"
                    className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white font-mono outline-none focus:ring-2 focus:ring-purple-500" />
                  <p className="text-[10px] text-gray-500 mt-1">格式: 列,行。0,0=中心，1,0=右侧，0,-1=上方</p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400">区域名称</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="主庭院"
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400">列号 (grid_x)</label>
                  <input type="number" value={fGridX} onChange={e => setFGridX(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none" />
                  <p className="text-[10px] text-gray-500">-1=左 0=中 1=右</p>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400">行号 (grid_y)</label>
                  <input type="number" value={fGridY} onChange={e => setFGridY(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none" />
                  <p className="text-[10px] text-gray-500">-1=上 0=中 1=下</p>
                </div>
              </div>

              {/* Light config per time slot */}
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 space-y-3">
                <div className="text-xs font-semibold text-yellow-300">☀️ 光源与阴影（按时段）</div>
                <p className="text-[10px] text-gray-500">角度：0°=右 → 90°=下 ↓ 180°=左 ← 270°=上 ↑ 315°=右上 ↗（模拟左上方光源）</p>
                {TIME_SLOTS.map(slot => {
                  const cfg = fLightConfig[slot.key] || { light_angle: 315, shadow_offset: 0.4 };
                  return (
                    <div key={slot.key} className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-2">
                      <div className="text-xs font-medium text-white">{slot.label}</div>
                      <div className="flex items-center gap-4">
                        {/* Angle */}
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-400">光源角度</label>
                          <div className="flex items-center gap-2">
                            <input type="range" min="0" max="360" step="5"
                              value={cfg.light_angle}
                              onChange={e => setFLightConfig({ ...fLightConfig, [slot.key]: { ...cfg, light_angle: Number(e.target.value) } })}
                              className="flex-1 accent-yellow-500" />
                            <span className="w-10 text-right text-xs text-yellow-300">{cfg.light_angle}°</span>
                          </div>
                        </div>
                        {/* Offset */}
                        <div className="w-32">
                          <label className="text-[10px] text-gray-400">阴影偏移</label>
                          <div className="flex items-center gap-2">
                            <input type="range" min="0" max="1" step="0.05"
                              value={cfg.shadow_offset}
                              onChange={e => setFLightConfig({ ...fLightConfig, [slot.key]: { ...cfg, shadow_offset: Number(e.target.value) } })}
                              className="flex-1 accent-yellow-500" />
                            <span className="w-8 text-right text-xs text-yellow-300">{cfg.shadow_offset}</span>
                          </div>
                        </div>
                        {/* Mini preview */}
                        <div className="flex-shrink-0">
                          <svg width="48" height="48" viewBox="0 0 48 48" className="rounded bg-black/30">
                            {/* Pet dot */}
                            <circle cx="24" cy="24" r="5" fill="white" opacity="0.8" />
                            {/* Shadow line */}
                            <line x1="24" y1="24"
                              x2={24 + Math.cos(cfg.light_angle * Math.PI / 180) * 18}
                              y2={24 + Math.sin(cfg.light_angle * Math.PI / 180) * 18}
                              stroke="rgba(0,0,0,0.3)" strokeWidth="4" strokeLinecap="round" />
                            {/* Light source indicator */}
                            <circle
                              cx={24 + Math.cos((cfg.light_angle - 180) * Math.PI / 180) * 20}
                              cy={24 + Math.sin((cfg.light_angle - 180) * Math.PI / 180) * 20}
                              r="3" fill="#FFD700" opacity="0.7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Walk bounds */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <div className="text-xs font-semibold text-amber-300">🚶 可步行区域 (0~1 屏幕比例)</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map(k => (
                    <div key={k}>
                      <label className="text-[10px] text-gray-400">{k}</label>
                      <input type="number" step="0.01" value={fWalkBounds[k]}
                        onChange={e => setFWalkBounds({ ...fWalkBounds, [k]: Number(e.target.value) })}
                        className="w-full rounded bg-white/10 px-2 py-1 text-sm text-white outline-none" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Unlock condition */}
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
                <div className="text-xs font-semibold text-cyan-300">🔓 解锁条件</div>
                <select value={fUnlockType} onChange={e => setFUnlockType(e.target.value)}
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none">
                  {UNLOCK_TYPES.map(u => <option key={u.value} value={u.value} className="bg-slate-800">{u.label}</option>)}
                </select>
                {fUnlockType !== 'free' && (
                  <div>
                    <label className="text-[10px] text-gray-400">
                      {fUnlockType === 'shop_item' ? '商品 ID' : '数值'}
                    </label>
                    <input value={fUnlockValue} onChange={e => setFUnlockValue(e.target.value)}
                      placeholder={fUnlockType === 'pet_count' ? '3' : fUnlockType === 'interact_count' ? '50' : ''}
                      className="w-full rounded bg-white/10 px-2 py-1 text-sm text-white outline-none" />
                  </div>
                )}
                <p className="text-[10px] text-gray-500">
                  {UNLOCK_TYPES.find(u => u.value === fUnlockType)?.desc}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={resetForm} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/20">取消</button>
              <button onClick={save} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">保存</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="py-8 text-center text-sm text-gray-400">加载中...</div>}
    </div>
  );
}
