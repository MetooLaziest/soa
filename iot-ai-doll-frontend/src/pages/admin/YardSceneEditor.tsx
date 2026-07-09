/**
 * YardSceneEditor — Admin page for editing yard scene layout
 *
 * V2: Multi-zone + time-slot support
 * - URL param: ?zone=0,0 to select zone
 * - Time-slot tabs: dawn / day / night for background preview
 * - Object properties: image_url_dawn / image_url_night variants
 * - Back link to Zone Manager
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import client from '../../api/client';

interface SceneObject {
  id: number;
  label: string;
  object_type: string;
  layer: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  image_url: string;
  image_url_dawn?: string;
  image_url_night?: string;
  collidable: boolean;
  sort_priority: number;
}

interface Zone {
  id: number;
  zone_key: string;
  zone_name: string;
  grid_x: number;
  grid_y: number;
  bg_image_dawn: string;
  bg_image_day: string;
  bg_image_night: string;
  walk_bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  is_default: boolean;
}

const TIME_SLOTS = [
  { key: 'dawn', label: '🌅 清晨/傍晚', bgField: 'bg_image_dawn' as const },
  { key: 'day', label: '☀️ 白天', bgField: 'bg_image_day' as const },
  { key: 'night', label: '🌙 夜晚', bgField: 'bg_image_night' as const },
];

const OBJ_TYPES = [
  { value: 'tree', label: '🌳 树木', icon: '🌳' },
  { value: 'fence', label: '🪵 围栏', icon: '🪵' },
  { value: 'rock', label: '🪨 石头', icon: '🪨' },
  { value: 'flower', label: '🌸 花坛', icon: '🌸' },
  { value: 'decoration', label: '✨ 装饰', icon: '✨' },
  { value: 'lamp', label: '🏮 灯具', icon: '🏮' },
  { value: 'collider', label: '🔲 碰撞区(隐形)', icon: '🔲' },
];

const LAYER_LABELS: Record<number, string> = {
  0: '背景层(L0)',
  1: 'Y排序层(L1)',
  2: '树冠层(L2)',
};

const COLLIDER_COLOR = 'rgba(255, 50, 50, 0.3)';
const COLLIDER_BORDER = 'rgba(255, 50, 50, 0.7)';
const SELECTED_BORDER = '2px solid #3b82f6';

function computeAspectFitStyle(
  obj: { pos_x: number; pos_y: number; width: number; height: number },
  imgNaturalW: number | undefined,
  imgNaturalH: number | undefined,
): { left: string; top: string; width: string; height: string } {
  if (!imgNaturalW || !imgNaturalH || imgNaturalW === 0 || imgNaturalH === 0) {
    return {
      left: `${(obj.pos_x - obj.width / 2) * 100}%`,
      top: `${(obj.pos_y - obj.height * 0.85) * 100}%`,
      width: `${obj.width * 100}%`,
      height: `${obj.height * 100}%`,
    };
  }
  const scaleX = obj.width / imgNaturalW;
  const scaleY = obj.height / imgNaturalH;
  const actualScale = Math.min(scaleX, scaleY);
  const actualW = imgNaturalW * actualScale;
  const actualH = imgNaturalH * actualScale;

  return {
    left: `${(obj.pos_x - actualW / 2) * 100}%`,
    top: `${(obj.pos_y - actualH * 0.85) * 100}%`,
    width: `${actualW * 100}%`,
    height: `${actualH * 100}%`,
  };
}

export default function YardSceneEditor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentZoneKey = searchParams.get('zone') || '0,0';

  const [zone, setZone] = useState<Zone | null>(null);
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTimeSlot, setActiveTimeSlot] = useState<'dawn' | 'day' | 'night'>('day');
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    objId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    mode: 'move' | 'resize';
  } | null>(null);
  const imgSizes = useRef<Map<number, { w: number; h: number }>>(new Map());

  const selectedObj = objects.find(o => o.id === selectedId);

  // Load zone + objects
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Load zones list to find current zone
        const zonesRes = await client.get('/admin/zones');
        const zones: Zone[] = zonesRes.data.zones || [];
        const currentZone = zones.find(z => z.zone_key === currentZoneKey);
        if (!currentZone) {
          setError(`未找到区域 ${currentZoneKey}`);
          setLoading(false);
          return;
        }
        setZone(currentZone);

        // Load objects for this zone
        const detailRes = await client.get(`/admin/zones/${currentZone.id}`);
        setObjects(detailRes.data.objects || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentZoneKey]);

  // Get current background URL based on time slot
  const currentBgUrl = zone ? (zone as any)[TIME_SLOTS.find(t => t.key === activeTimeSlot)?.bgField || 'bg_image_day'] : '';

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, obj: SceneObject, mode: 'move' | 'resize') => {
    e.stopPropagation();
    setSelectedId(obj.id);
    const rect = canvasRef.current!.getBoundingClientRect();
    setDragState({
      objId: obj.id,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      origX: obj.pos_x,
      origY: obj.pos_y,
      mode,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - rect.left - dragState.startX) / rect.width;
    const dy = (e.clientY - rect.top - dragState.startY) / rect.height;

    setObjects(prev => prev.map(o => {
      if (o.id !== dragState.objId) return o;
      if (dragState.mode === 'move') {
        return { ...o, pos_x: Math.max(0, Math.min(1, dragState.origX + dx)), pos_y: Math.max(0, Math.min(1, dragState.origY + dy)) };
      } else {
        return { ...o, width: Math.max(0.02, o.width + dx), height: Math.max(0.02, o.height + dy) };
      }
    }));
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  // Save
  const handleSave = async () => {
    if (!zone) return;
    setSaving(true);
    setError('');
    try {
      await client.put(`/admin/zones/${zone.id}/objects`, { objects });
      alert('保存成功！庭院配置已更新。');
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  // Add object
  const handleAdd = async (type: string) => {
    if (!zone) return;
    const ot = OBJ_TYPES.find(t => t.value === type)!;
    try {
      const res = await client.post(`/admin/zones/${zone.id}/objects`, {
        label: ot.label,
        object_type: type,
        layer: type === 'tree' ? 1 : 1,
        pos_x: 0.5,
        pos_y: 0.6,
        width: 0.08,
        height: 0.1,
        collidable: type !== 'decoration' && type !== 'lamp',
      });
      if (res.data?.object) {
        setObjects(prev => [...prev, res.data.object]);
        setSelectedId(res.data.object.id);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Delete object
  const handleDelete = async () => {
    if (!selectedId || !zone) return;
    if (!confirm('确定删除此物体？')) return;
    try {
      await client.delete(`/admin/zones/${zone.id}/objects/${selectedId}`);
      setObjects(prev => prev.filter(o => o.id !== selectedId));
      setSelectedId(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Upload object image (with time-slot variant support)
  const uploadObjImage = async (objectId: number, timeSlot: string | null, file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const image_data = ev.target?.result as string;
        const res = await client.post('/admin/zones/upload-obj-image', {
          object_id: objectId,
          time_slot: timeSlot,
          image_data,
        });
        if (res.data?.url) {
          if (timeSlot === 'dawn') {
            updateField('image_url_dawn', res.data.url);
          } else if (timeSlot === 'night') {
            updateField('image_url_night', res.data.url);
          } else {
            updateField('image_url', res.data.url);
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('上传失败');
    }
  };

  const updateField = (field: string, value: any) => {
    setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, [field]: value } : o));
  };

  if (loading) return <div className="p-8 text-gray-400">加载中...</div>;

  return (
    <div className="flex h-full gap-4">
      {/* Left: Canvas Editor */}
      <div className="flex-1 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-3 flex-wrap w-full">
          <button onClick={() => navigate('/admin/zones')}
            className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-gray-400">
            ← 返回区域管理
          </button>
          <h2 className="text-lg font-semibold text-white">🗺️ 庭院编辑器</h2>
          <span className="text-xs text-gray-500">{zone?.zone_name} ({currentZoneKey})</span>

          <div className="flex-1" />

          {/* Time-slot tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            {TIME_SLOTS.map(slot => (
              <button key={slot.key} onClick={() => setActiveTimeSlot(slot.key as any)}
                className={`px-2.5 py-1 text-xs rounded transition ${
                  activeTimeSlot === slot.key ? 'bg-purple-500/30 text-purple-200' : 'text-gray-400 hover:text-white'}`}>
                {slot.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {OBJ_TYPES.map(t => (
            <button key={t.value} onClick={() => handleAdd(t.value)}
              className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10">
              {t.label}
            </button>
          ))}
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
            {saving ? '保存中...' : '💾 保存'}
          </button>
        </div>

        {error && <div className="mb-2 text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">{error}</div>}

        {/* Canvas — constrained to mobile portrait 9:16 ratio */}
        <div className="relative w-full" style={{ maxWidth: '405px', aspectRatio: '9/16' }}>
        <div
          ref={canvasRef}
          className="relative w-full h-full bg-black/40 rounded-lg overflow-hidden border border-white/10 select-none"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => !dragState && setSelectedId(null)}
        >
          {/* Background image (time-slot aware) */}
          {currentBgUrl && (
            <img
              src={currentBgUrl}
              alt={`yard-bg-${activeTimeSlot}`}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          )}

          {/* Walk bounds indicator */}
          {zone?.walk_bounds && (
            <div
              className="absolute border-2 border-dashed border-blue-400/30 pointer-events-none"
              style={{
                left: `${zone.walk_bounds.xMin * 100}%`,
                top: `${zone.walk_bounds.yMin * 100}%`,
                width: `${(zone.walk_bounds.xMax - zone.walk_bounds.xMin) * 100}%`,
                height: `${(zone.walk_bounds.yMax - zone.walk_bounds.yMin) * 100}%`,
              }}
            />
          )}

          {/* Objects */}
          {objects.map(obj => {
            const isSelected = obj.id === selectedId;
            const isCollider = obj.collidable || obj.object_type === 'collider';
            const ot = OBJ_TYPES.find(t => t.value === obj.object_type);
            const imgSize = imgSizes.current.get(obj.id);
            const style = computeAspectFitStyle(obj, imgSize?.w, imgSize?.h);

            // Choose image based on time slot
            let displayImage = obj.image_url;
            if (activeTimeSlot === 'dawn' && obj.image_url_dawn) displayImage = obj.image_url_dawn;
            if (activeTimeSlot === 'night' && obj.image_url_night) displayImage = obj.image_url_night;

            return (
              <div
                key={obj.id}
                className="absolute group"
                style={{
                  left: style.left,
                  top: style.top,
                  width: style.width,
                  height: style.height,
                  border: isSelected ? SELECTED_BORDER : (isCollider ? `1px dashed ${COLLIDER_BORDER}` : '1px solid rgba(255,255,255,0.1)'),
                  background: isCollider ? COLLIDER_COLOR : 'rgba(255,255,255,0.05)',
                  borderRadius: 4,
                  zIndex: isSelected ? 100 : obj.layer * 10 + Math.round(obj.pos_y * 100),
                  cursor: dragState?.objId === obj.id ? 'grabbing' : 'grab',
                }}
                onMouseDown={e => handleMouseDown(e, obj, 'move')}
                onClick={e => { e.stopPropagation(); setSelectedId(obj.id); }}
              >
                {/* Actual image */}
                {displayImage && (
                  <img
                    src={displayImage}
                    alt={obj.label}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && img.naturalHeight) {
                        imgSizes.current.set(obj.id, { w: img.naturalWidth, h: img.naturalHeight });
                        setObjects(prev => [...prev]);
                      }
                    }}
                  />
                )}

                {/* Label */}
                <div className="absolute -top-5 left-0 text-[10px] text-white/70 whitespace-nowrap pointer-events-none">
                  {ot?.icon} {obj.label}
                </div>

                {/* Type icon (only if no image) */}
                {!displayImage && (
                  <div className="absolute inset-0 flex items-center justify-center text-lg opacity-50 pointer-events-none">
                    {ot?.icon || '?'}
                  </div>
                )}

                {/* Resize handle */}
                {isSelected && (
                  <div
                    className="absolute -right-1 -bottom-1 w-4 h-4 bg-blue-500 rounded-sm cursor-se-resize z-10"
                    onMouseDown={e => handleMouseDown(e, obj, 'resize')}
                  />
                )}

                {/* Time-slot variant indicator */}
                {(obj.image_url_dawn || obj.image_url_night) && (
                  <div className="absolute -top-1 -right-1 flex gap-0.5 pointer-events-none">
                    {obj.image_url_dawn && <span className="text-[8px] leading-none">🌅</span>}
                    {obj.image_url_night && <span className="text-[8px] leading-none">🌙</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>{/* end 9:16 wrapper */}
      </div>

      {/* Right: Property Panel */}
      <div className="w-72 flex flex-col border-l border-white/10 bg-slate-900/50">
        {selectedObj ? (
          <div className="p-3 space-y-3 overflow-y-auto flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">属性</h3>
              <span className="text-[10px] text-gray-600">ID: {selectedObj.id}</span>
            </div>

            <div>
              <label className="text-xs text-gray-400">标签</label>
              <input type="text" value={selectedObj.label}
                onChange={e => updateField('label', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-400">类型</label>
                <select value={selectedObj.object_type}
                  onChange={e => updateField('object_type', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm">
                  {OBJ_TYPES.map(t => <option key={t.value} value={t.value} className="bg-slate-800">{t.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400">图层</label>
                <select value={selectedObj.layer}
                  onChange={e => updateField('layer', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm">
                  {Object.entries(LAYER_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-slate-800">{v}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">X位置</label>
                <input type="number" step="0.01" value={selectedObj.pos_x}
                  onChange={e => updateField('pos_x', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Y位置</label>
                <input type="number" step="0.01" value={selectedObj.pos_y}
                  onChange={e => updateField('pos_y', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400">宽度</label>
                <input type="number" step="0.01" value={selectedObj.width}
                  onChange={e => updateField('width', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400">高度</label>
                <input type="number" step="0.01" value={selectedObj.height}
                  onChange={e => updateField('height', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" checked={selectedObj.collidable}
                onChange={e => updateField('collidable', e.target.checked)}
                className="rounded" />
              <label className="text-xs text-gray-300">🔒 碰撞区域</label>
            </div>

            {/* ── Time-slot variant images ── */}
            <div className="border-t border-white/10 pt-3 space-y-3">
              <div className="text-xs font-semibold text-amber-300">🌅 时段变体图</div>
              <p className="text-[10px] text-gray-500">可选：为灯具等发光物体上传不同时段的图片变体</p>

              {/* Day (default) image */}
              <div>
                <label className="text-xs text-gray-400">☀️ 白天图片 (默认)</label>
                <div className="flex items-center gap-2 mt-1">
                  {selectedObj.image_url && <img src={selectedObj.image_url} alt="" className="h-8 w-8 rounded object-contain bg-black/30" />}
                  <div className="flex-1">
                    <input type="text" value={selectedObj.image_url}
                      onChange={e => updateField('image_url', e.target.value)}
                      placeholder="/epet/tree.png"
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs" />
                  </div>
                </div>
                <input type="file" accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadObjImage(selectedObj.id, null, file);
                    e.target.value = '';
                  }}
                  className="w-full mt-1 text-xs text-gray-400 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-600/30 file:text-blue-300" />
              </div>

              {/* Dawn variant */}
              <div>
                <label className="text-xs text-gray-400">🌅 清晨变体</label>
                <div className="flex items-center gap-2 mt-1">
                  {selectedObj.image_url_dawn && <img src={selectedObj.image_url_dawn} alt="" className="h-8 w-8 rounded object-contain bg-black/30" />}
                  <div className="flex-1">
                    <input type="text" value={selectedObj.image_url_dawn || ''}
                      onChange={e => updateField('image_url_dawn', e.target.value)}
                      placeholder="留空=使用默认图"
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs" />
                  </div>
                </div>
                <input type="file" accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadObjImage(selectedObj.id, 'dawn', file);
                    e.target.value = '';
                  }}
                  className="w-full mt-1 text-xs text-gray-400 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-amber-600/30 file:text-amber-300" />
              </div>

              {/* Night variant */}
              <div>
                <label className="text-xs text-gray-400">🌙 夜晚变体</label>
                <div className="flex items-center gap-2 mt-1">
                  {selectedObj.image_url_night && <img src={selectedObj.image_url_night} alt="" className="h-8 w-8 rounded object-contain bg-black/30" />}
                  <div className="flex-1">
                    <input type="text" value={selectedObj.image_url_night || ''}
                      onChange={e => updateField('image_url_night', e.target.value)}
                      placeholder="留空=使用默认图"
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs" />
                  </div>
                </div>
                <input type="file" accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadObjImage(selectedObj.id, 'night', file);
                    e.target.value = '';
                  }}
                  className="w-full mt-1 text-xs text-gray-400 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-indigo-600/30 file:text-indigo-300" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400">排序优先级</label>
              <input type="number" value={selectedObj.sort_priority}
                onChange={e => updateField('sort_priority', Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
            </div>

            <button onClick={handleDelete}
              className="w-full mt-2 px-3 py-1.5 text-sm rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30">
              🗑️ 删除物体
            </button>
          </div>
        ) : (
          <div className="p-4 text-sm text-gray-500 text-center">
            点击画布上的物体<br />查看和编辑属性
          </div>
        )}

        {/* Object list */}
        <div className="border-t border-white/10 p-3 flex-1 max-h-64 overflow-y-auto">
          <h4 className="text-xs text-gray-400 mb-2">物体列表 ({objects.length})</h4>
          <div className="space-y-1">
            {objects.map(obj => {
              const ot = OBJ_TYPES.find(t => t.value === obj.object_type);
              return (
                <div
                  key={obj.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer hover:bg-white/5 ${obj.id === selectedId ? 'bg-white/10 text-white' : 'text-gray-400'}`}
                  onClick={() => setSelectedId(obj.id)}
                >
                  <span>{ot?.icon}</span>
                  <span className="flex-1 truncate">{obj.label}</span>
                  {obj.collidable && <span className="text-red-400">🔒</span>}
                  {(obj.image_url_dawn || obj.image_url_night) && <span className="text-amber-400">⏰</span>}
                  <span className="text-gray-600">L{obj.layer}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
