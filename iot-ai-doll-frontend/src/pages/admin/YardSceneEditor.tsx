/**
 * YardSceneEditor — Admin page for editing yard scene layout
 *
 * Features:
 * - Canvas with background image
 * - Drag & resize scene objects
 * - Add/remove objects
 * - Toggle collidable
 * - Save all to API
 */
import { useState, useEffect, useRef, useCallback } from 'react';
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
  collidable: boolean;
  sort_priority: number;
}

interface Scene {
  id: number;
  name: string;
  bg_image_url: string;
  walk_bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
}

const OBJ_TYPES = [
  { value: 'tree', label: '🌳 树木', icon: '🌳' },
  { value: 'fence', label: '🪵 围栏', icon: '🪵' },
  { value: 'rock', label: '🪨 石头', icon: '🪨' },
  { value: 'flower', label: '🌸 花坛', icon: '🌸' },
  { value: 'decoration', label: '✨ 装饰', icon: '✨' },
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

export default function YardSceneEditor() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    objId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    mode: 'move' | 'resize';
  } | null>(null);

  const selectedObj = objects.find(o => o.id === selectedId);

  // Load scene data
  useEffect(() => {
    (async () => {
      try {
        const res = await client.get('/admin/yard-scenes');
        const scenes = res.data?.scenes || [];
        if (scenes.length === 0) return;
        const activeScene = scenes.find((s: Scene) => s.id) || scenes[0];
        setScene(activeScene);
        const detail = await client.get(`/admin/yard-scenes/${activeScene.id}`);
        setObjects(detail.data?.objects || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    if (!scene) return;
    setSaving(true);
    setError('');
    try {
      await client.put(`/admin/yard-scenes/${scene.id}/objects`, { objects });
      alert('保存成功！庭院配置已更新。');
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  // Add object
  const handleAdd = async (type: string) => {
    if (!scene) return;
    const ot = OBJ_TYPES.find(t => t.value === type)!;
    try {
      const res = await client.post(`/admin/yard-scenes/${scene.id}/objects`, {
        label: ot.label,
        object_type: type,
        layer: type === 'tree' ? 1 : 1,
        pos_x: 0.5,
        pos_y: 0.6,
        width: 0.08,
        height: 0.1,
        collidable: type !== 'decoration',
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
    if (!selectedId || !scene) return;
    if (!confirm('确定删除此物体？')) return;
    try {
      await client.delete(`/admin/yard-scenes/${scene.id}/objects/${selectedId}`);
      setObjects(prev => prev.filter(o => o.id !== selectedId));
      setSelectedId(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Update object field
  const updateField = (field: string, value: any) => {
    setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, [field]: value } : o));
  };

  if (loading) return <div className="p-8 text-gray-400">加载中...</div>;

  return (
    <div className="flex h-full gap-4">
      {/* Left: Canvas Editor */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold text-white">🗺️ 庭院地图编辑器</h2>
          <span className="text-xs text-gray-500">{scene?.name}</span>
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

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative flex-1 bg-black/40 rounded-lg overflow-hidden border border-white/10 select-none"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => !dragState && setSelectedId(null)}
        >
          {/* Background image */}
          {scene?.bg_image_url && (
            <img
              src={scene.bg_image_url}
              alt="yard-bg"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          )}

          {/* Walk bounds indicator */}
          {scene?.walk_bounds && (
            <div
              className="absolute border-2 border-dashed border-blue-400/30 pointer-events-none"
              style={{
                left: `${scene.walk_bounds.xMin * 100}%`,
                top: `${scene.walk_bounds.yMin * 100}%`,
                width: `${(scene.walk_bounds.xMax - scene.walk_bounds.xMin) * 100}%`,
                height: `${(scene.walk_bounds.yMax - scene.walk_bounds.yMin) * 100}%`,
              }}
            />
          )}

          {/* Objects */}
          {objects.map(obj => {
            const isSelected = obj.id === selectedId;
            const isCollider = obj.collidable || obj.object_type === 'collider';
            const ot = OBJ_TYPES.find(t => t.value === obj.object_type);

            return (
              <div
                key={obj.id}
                className="absolute group"
                style={{
                  left: `${(obj.pos_x - obj.width / 2) * 100}%`,
                  top: `${(obj.pos_y - obj.height * 0.85) * 100}%`,
                  width: `${obj.width * 100}%`,
                  height: `${obj.height * 100}%`,
                  border: isSelected ? SELECTED_BORDER : (isCollider ? `1px dashed ${COLLIDER_BORDER}` : '1px solid rgba(255,255,255,0.1)'),
                  background: isCollider ? COLLIDER_COLOR : 'rgba(255,255,255,0.05)',
                  borderRadius: 4,
                  zIndex: isSelected ? 100 : obj.layer * 10 + Math.round(obj.pos_y * 100),
                  cursor: dragState?.objId === obj.id ? 'grabbing' : 'grab',
                }}
                onMouseDown={e => handleMouseDown(e, obj, 'move')}
                onClick={e => { e.stopPropagation(); setSelectedId(obj.id); }}
              >
                {/* Label */}
                <div className="absolute -top-5 left-0 text-[10px] text-white/70 whitespace-nowrap pointer-events-none">
                  {ot?.icon} {obj.label}
                </div>

                {/* Type icon */}
                <div className="absolute inset-0 flex items-center justify-center text-lg opacity-50 pointer-events-none">
                  {ot?.icon || '?'}
                </div>

                {/* Resize handle */}
                {isSelected && (
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize"
                    onMouseDown={e => handleMouseDown(e, obj, 'resize')}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 text-xs text-gray-500">
          💡 拖拽移动物体 · 右下角蓝色方块调整大小 · 虚线蓝框=可走区域 · 红色区域=碰撞区域
        </div>
      </div>

      {/* Right: Property Panel */}
      <div className="w-72 flex flex-col bg-white/5 rounded-lg border border-white/10 overflow-y-auto">
        <div className="p-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white">属性面板</h3>
        </div>

        {selectedObj ? (
          <div className="p-3 space-y-3 text-sm">
            <div>
              <label className="block text-xs text-gray-400 mb-1">名称</label>
              <input type="text" value={selectedObj.label}
                onChange={e => updateField('label', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">类型</label>
              <select value={selectedObj.object_type}
                onChange={e => updateField('object_type', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm">
                {OBJ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">图层</label>
              <select value={selectedObj.layer}
                onChange={e => updateField('layer', Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm">
                <option value={0}>{LAYER_LABELS[0]}</option>
                <option value={1}>{LAYER_LABELS[1]}</option>
                <option value={2}>{LAYER_LABELS[2]}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">X位置</label>
                <input type="number" step="0.01" value={selectedObj.pos_x.toFixed(2)}
                  onChange={e => updateField('pos_x', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Y位置</label>
                <input type="number" step="0.01" value={selectedObj.pos_y.toFixed(2)}
                  onChange={e => updateField('pos_y', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">宽度</label>
                <input type="number" step="0.01" value={selectedObj.width.toFixed(2)}
                  onChange={e => updateField('width', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">高度</label>
                <input type="number" step="0.01" value={selectedObj.height.toFixed(2)}
                  onChange={e => updateField('height', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" checked={selectedObj.collidable}
                onChange={e => updateField('collidable', e.target.checked)}
                className="rounded" />
              <label className="text-xs text-gray-300">🔒 碰撞区域（宠物不可穿过）</label>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">图片URL</label>
              <input type="text" value={selectedObj.image_url}
                onChange={e => updateField('image_url', e.target.value)}
                placeholder="/epet/tree.png"
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              <p className="text-[10px] text-gray-500 mt-1">留空=纯碰撞区/占位</p>
            </div>

            {/* Upload image */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">上传素材图片</label>
              <input type="file" accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !scene) return;
                  e.target.value = '';
                  try {
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      const image_data = ev.target?.result as string;
                      const res = await client.post('/admin/yard-scenes/upload-image', {
                        scene_id: scene.id,
                        object_id: selectedObj.id,
                        image_data,
                      });
                      if (res.data?.url) {
                        updateField('image_url', res.data.url);
                      }
                    };
                    reader.readAsDataURL(file);
                  } catch (err) {
                    setError('上传失败');
                  }
                }}
                className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600/30 file:text-blue-300 hover:file:bg-blue-600/50" />
              <p className="text-[10px] text-gray-500 mt-1">支持 PNG/JPG/WebP，自动保存到服务器</p>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">排序优先级</label>
              <input type="number" value={selectedObj.sort_priority}
                onChange={e => updateField('sort_priority', Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm" />
              <p className="text-[10px] text-gray-500 mt-1">同图层内，数值大的绘制在上层</p>
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
        <div className="border-t border-white/10 p-3 flex-1">
          <h4 className="text-xs text-gray-400 mb-2">物体列表 ({objects.length})</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
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
