/**
 * 消消乐管理 - 图标CRUD + 关卡CRUD + 地图形态可视化编辑器
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface Match3Icon {
  id: number;
  name: string;
  icon_type: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

interface Match3Level {
  id: number;
  name: string;
  grid_rows: number;
  grid_cols: number;
  grid_shape: number[][];  // 0=无, 1=有
  score_target: number;
  max_moves: number;
  available_icons: number[];
  difficulty: number;
  is_active: boolean;
  bg_image_url?: string;
}

const ICON_TYPES = [
  { value: 'normal', label: '普通' },
  { value: 'small_bomb', label: '小炸弹' },
  { value: 'big_bomb', label: '大炸弹' },
];

const GRID_TEMPLATES = [
  { name: '全满', make: (r: number, c: number) => Array.from({ length: r }, () => Array(c).fill(1)) },
  { name: '菱形', make: (r: number, c: number) => {
    const g = Array.from({ length: r }, () => Array(c).fill(0));
    const cr = Math.floor(r / 2), cc = Math.floor(c / 2);
    for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) {
      if (Math.abs(i - cr) / (r / 2) + Math.abs(j - cc) / (c / 2) <= 1) g[i][j] = 1;
    }
    return g;
  }},
  { name: '十字', make: (r: number, c: number) => {
    const g = Array.from({ length: r }, () => Array(c).fill(0));
    const cr = Math.floor(r / 2), cc = Math.floor(c / 2);
    for (let i = 0; i < r; i++) g[i][cc] = 1;
    for (let j = 0; j < c; j++) g[cr][j] = 1;
    return g;
  }},
  { name: '空心', make: (r: number, c: number) => {
    const g = Array.from({ length: r }, () => Array(c).fill(1));
    for (let i = 1; i < r - 1; i++) for (let j = 1; j < c - 1; j++) g[i][j] = 0;
    return g;
  }},
  { name: '清空', make: (r: number, c: number) => Array.from({ length: r }, () => Array(c).fill(0)) },
];

export default function Match3Admin() {
  const [tab, setTab] = useState<'icons' | 'levels'>('icons');
  const [icons, setIcons] = useState<Match3Icon[]>([]);
  const [levels, setLevels] = useState<Match3Level[]>([]);
  const [loading, setLoading] = useState(true);

  // Icon form
  const [showIconForm, setShowIconForm] = useState(false);
  const [editingIcon, setEditingIcon] = useState<Match3Icon | null>(null);
  const [iconName, setIconName] = useState('');
  const [iconType, setIconType] = useState('normal');
  const [iconImageUrl, setIconImageUrl] = useState('');
  const [iconSort, setIconSort] = useState(0);
  const [iconActive, setIconActive] = useState(true);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingLevelBg, setUploadingLevelBg] = useState(false);

  // Level form
  const [showLevelForm, setShowLevelForm] = useState(false);
  const [editingLevel, setEditingLevel] = useState<Match3Level | null>(null);
  const [levelName, setLevelName] = useState('');
  const [levelRows, setLevelRows] = useState(8);
  const [levelCols, setLevelCols] = useState(8);
  const [levelShape, setLevelShape] = useState<number[][]>([]);
  const [levelScoreTarget, setLevelScoreTarget] = useState(1000);
  const [levelMaxMoves, setLevelMaxMoves] = useState(20);
  const [levelAvailableIcons, setLevelAvailableIcons] = useState<number[]>([]);
  const [levelDifficulty, setLevelDifficulty] = useState(1);
  const [levelActive, setLevelActive] = useState(true);
  const [levelBgUrl, setLevelBgUrl] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [iconsRes, levelsRes] = await Promise.all([
        client.get('/admin/match3/icons'),
        client.get('/admin/match3/levels'),
      ]);
      setIcons(iconsRes.data.icons || []);
      setLevels(levelsRes.data.levels || []);
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ===================== Icon CRUD =====================

  const resetIconForm = () => {
    setEditingIcon(null); setShowIconForm(false);
    setIconName(''); setIconType('normal'); setIconImageUrl(''); setIconSort(0); setIconActive(true);
  };

  const openEditIcon = (icon: Match3Icon) => {
    setEditingIcon(icon);
    setIconName(icon.name); setIconType(icon.icon_type); setIconImageUrl(icon.image_url);
    setIconSort(icon.sort_order); setIconActive(icon.is_active);
    setShowIconForm(true);
  };

  const saveIcon = async () => {
    if (!iconName) return;
    try {
      if (editingIcon) {
        await client.put(`/admin/match3/icons/${editingIcon.id}`, {
          name: iconName, icon_type: iconType, image_url: iconImageUrl,
          sort_order: iconSort, is_active: iconActive,
        });
      } else {
        await client.post('/admin/match3/icons', {
          name: iconName, icon_type: iconType, image_url: iconImageUrl,
          sort_order: iconSort, is_active: iconActive,
        });
      }
      resetIconForm(); load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteIcon = async (id: number) => {
    if (!confirm('确认删除？')) return;
    try { await client.delete(`/admin/match3/icons/${id}`); load(); }
    catch (err: any) { alert('删除失败: ' + err.message); }
  };

  const uploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', 'game-assets');
      const res = await client.post('/game-assets/upload', form, { timeout: 300000 });
      if (res.data?.asset?.url) setIconImageUrl(res.data.asset.url);
    } catch (err: any) {
      alert('上传失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingImg(false);
    }
  };

  // ===================== Level CRUD =====================

  const resetLevelForm = () => {
    setEditingLevel(null); setShowLevelForm(false);
    setLevelName(''); setLevelRows(8); setLevelCols(8);
    setLevelShape(Array.from({ length: 8 }, () => Array(8).fill(1)));
    setLevelScoreTarget(1000); setLevelMaxMoves(20);
    setLevelAvailableIcons([]); setLevelDifficulty(1); setLevelActive(true); setLevelBgUrl('');
  };

  const openEditLevel = (level: Match3Level) => {
    setEditingLevel(level);
    setLevelName(level.name); setLevelRows(level.grid_rows); setLevelCols(level.grid_cols);
    // Parse grid_shape — it might come as a JSON string or already parsed array
    let shape = level.grid_shape;
    if (typeof shape === 'string') {
      try { shape = JSON.parse(shape); } catch { shape = []; }
    }
    if (!Array.isArray(shape) || shape.length === 0) {
      shape = Array.from({ length: level.grid_rows }, () => Array(level.grid_cols).fill(1));
    }
    setLevelShape(shape);
    let availIcons = level.available_icons;
    if (typeof availIcons === 'string') {
      try { availIcons = JSON.parse(availIcons); } catch { availIcons = []; }
    }
    setLevelAvailableIcons(Array.isArray(availIcons) ? availIcons : []);
    setLevelScoreTarget(level.score_target); setLevelMaxMoves(level.max_moves);
    setLevelDifficulty(level.difficulty); setLevelActive(level.is_active);
    setLevelBgUrl(level.bg_image_url || '');
    setShowLevelForm(true);
  };

  const saveLevel = async () => {
    if (!levelName) return;
    try {
      // Ensure shape matches current rows/cols
      const shape = buildShape(levelRows, levelCols, levelShape);
      if (editingLevel) {
        await client.put(`/admin/match3/levels/${editingLevel.id}`, {
          name: levelName, grid_rows: levelRows, grid_cols: levelCols,
          grid_shape: shape, score_target: levelScoreTarget, max_moves: levelMaxMoves,
          available_icons: levelAvailableIcons, difficulty: levelDifficulty, is_active: levelActive, bg_image_url: levelBgUrl,
        });
      } else {
        await client.post('/admin/match3/levels', {
          name: levelName, grid_rows: levelRows, grid_cols: levelCols,
          grid_shape: shape, score_target: levelScoreTarget, max_moves: levelMaxMoves,
          available_icons: levelAvailableIcons, difficulty: levelDifficulty, is_active: levelActive, bg_image_url: levelBgUrl,
        });
      }
      resetLevelForm(); load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteLevel = async (id: number) => {
    if (!confirm('确认删除？删除关卡将同时删除相关通关记录。')) return;
    try { await client.delete(`/admin/match3/levels/${id}`); load(); }
    catch (err: any) { alert('删除失败: ' + err.message); }
  };

  // Build shape grid that matches current rows/cols
  const buildShape = (rows: number, cols: number, currentShape: number[][]): number[][] => {
    const result: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(currentShape[r]?.[c] ?? 1);
      }
      result.push(row);
    }
    return result;
  };

  const toggleCell = (r: number, c: number) => {
    const shape = buildShape(levelRows, levelCols, levelShape);
    shape[r][c] = shape[r][c] === 1 ? 0 : 1;
    setLevelShape(shape);
  };

  const applyTemplate = (template: typeof GRID_TEMPLATES[0]) => {
    const shape = template.make(levelRows, levelCols);
    setLevelShape(shape);
  };

  const handleRowsColsChange = (newRows: number, newCols: number) => {
    setLevelRows(newRows);
    setLevelCols(newCols);
    setLevelShape(buildShape(newRows, newCols, levelShape));
  };

  const toggleIconSelection = (iconId: number) => {
    setLevelAvailableIcons(prev =>
      prev.includes(iconId) ? prev.filter(id => id !== iconId) : [...prev, iconId]
    );
  };

  const activeIcons = icons.filter(i => i.is_active);
  const displayShape = buildShape(levelRows, levelCols, levelShape);

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">💎 消消乐管理</h2>
          <p className="mt-1 text-sm text-gray-500">管理图标和关卡配置</p>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('icons')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'icons' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-white/5 text-gray-400'}`}>
          🎨 图标管理
        </button>
        <button onClick={() => setTab('levels')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'levels' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-white/5 text-gray-400'}`}>
          🏰 关卡管理
        </button>
      </div>

      {/* ===================== 图标管理 ===================== */}
      {tab === 'icons' && (
        <div>
          <div className="mb-4 flex justify-end">
            <button onClick={() => { resetIconForm(); setShowIconForm(true); }}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
              + 新增图标
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {icons.map(icon => (
              <div key={icon.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                  {icon.image_url
                    ? <img src={icon.image_url} alt={icon.name} className="h-full w-full object-cover" />
                    : <span className="text-2xl">🧩</span>}
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-white">{icon.name}</div>
                  <div className="text-xs text-gray-500">
                    {ICON_TYPES.find(t => t.value === icon.icon_type)?.label || icon.icon_type}
                    {' · '}排序:{icon.sort_order}
                    {!icon.is_active && ' · ❌'}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditIcon(icon)} className="rounded bg-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/20">编辑</button>
                  <button onClick={() => deleteIcon(icon.id)} className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30">删除</button>
                </div>
              </div>
            ))}
            {icons.length === 0 && !loading && (
              <div className="col-span-full py-8 text-center text-sm text-gray-500">暂无图标</div>
            )}
          </div>

          {/* 图标表单弹窗 */}
          {showIconForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={resetIconForm}>
              <div className="w-full max-w-md rounded-xl bg-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="mb-4 text-lg font-bold text-white">{editingIcon ? '编辑' : '新增'}图标</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400">名称</label>
                    <input value={iconName} onChange={e => setIconName(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">类型</label>
                    <select value={iconType} onChange={e => setIconType(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none">
                      {ICON_TYPES.map(t => <option key={t.value} value={t.value} className="bg-slate-800">{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">图片素材</label>
                    <div className="mt-1 flex items-center gap-3">
                      {iconImageUrl && <img src={iconImageUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-white/20" />}
                      <div className="flex flex-1 items-center gap-2">
                        <input value={iconImageUrl} onChange={e => setIconImageUrl(e.target.value)}
                          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none" placeholder="路径或上传" />
                        <label className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-medium ${uploadingImg ? 'bg-gray-600 text-gray-400' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}>
                          {uploadingImg ? '...' : '上传'}
                          <input type="file" accept="image/*" className="hidden" disabled={uploadingImg}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">排序</label>
                      <input type="number" value={iconSort} onChange={e => setIconSort(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">启用</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="checkbox" checked={iconActive} onChange={e => setIconActive(e.target.checked)}
                          className="h-4 w-4 rounded accent-purple-500" />
                        <span className="text-sm text-gray-300">{iconActive ? '启用' : '禁用'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={resetIconForm} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/20">取消</button>
                  <button onClick={saveIcon} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== 关卡管理 ===================== */}
      {tab === 'levels' && (
        <div>
          <div className="mb-4 flex justify-end">
            <button onClick={() => { resetLevelForm(); setShowLevelForm(true); }}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
              + 新增关卡
            </button>
          </div>

          <div className="space-y-2">
            {levels.map(level => {
              let shape = level.grid_shape;
              if (typeof shape === 'string') { try { shape = JSON.parse(shape); } catch { shape = []; } }
              const cellCount = Array.isArray(shape) ? shape.flat().filter(v => v === 1).length : level.grid_rows * level.grid_cols;
              return (
                <div key={level.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-lg font-bold text-amber-300">
                      {level.difficulty}
                    </div>
                    <div>
                      <span className="font-medium text-white text-sm">{level.name}</span>
                      <div className="text-xs text-gray-500">
                        {level.grid_rows}×{level.grid_cols} · 🎯{level.score_target}分 · 🔄{level.max_moves}步
                        {' · '}格子:{cellCount}
                        {!level.is_active && ' · ❌已禁用'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditLevel(level)} className="rounded bg-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/20">编辑</button>
                    <button onClick={() => deleteLevel(level.id)} className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30">删除</button>
                  </div>
                </div>
              );
            })}
            {levels.length === 0 && !loading && (
              <div className="py-8 text-center text-sm text-gray-500">暂无关卡</div>
            )}
          </div>

          {/* 关卡表单弹窗 */}
          {showLevelForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={resetLevelForm}>
              <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="mb-4 text-lg font-bold text-white">{editingLevel ? '编辑' : '新增'}关卡</h3>
                <div className="space-y-4">
                  {/* 基本信息 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400">关卡名称</label>
                      <input value={levelName} onChange={e => setLevelName(e.target.value)}
                        className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">难度</label>
                      <select value={levelDifficulty} onChange={e => setLevelDifficulty(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none">
                        {[1, 2, 3, 4, 5].map(d => <option key={d} value={d} className="bg-slate-800">{d} - {'⭐'.repeat(d)}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-400">行数</label>
                      <input type="number" min={3} max={12} value={levelRows}
                        onChange={e => handleRowsColsChange(Number(e.target.value), levelCols)}
                        className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">列数</label>
                      <input type="number" min={3} max={12} value={levelCols}
                        onChange={e => handleRowsColsChange(levelRows, Number(e.target.value))}
                        className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">目标分数</label>
                      <input type="number" value={levelScoreTarget} onChange={e => setLevelScoreTarget(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">最大步数</label>
                      <input type="number" value={levelMaxMoves} onChange={e => setLevelMaxMoves(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                  </div>

                  {/* 地图形态可视化编辑器 */}
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-amber-300">🗺️ 地图形态编辑器</div>
                      <div className="text-xs text-gray-500">点击格子切换有无</div>
                    </div>
                    {/* 模板按钮 */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      {GRID_TEMPLATES.map(t => (
                        <button key={t.name} onClick={() => applyTemplate(t)}
                          className="rounded-lg bg-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-white/20">
                          {t.name}
                        </button>
                      ))}
                    </div>
                    {/* Grid */}
                    <div className="flex justify-center">
                      <div className="inline-grid gap-0.5" style={{
                        gridTemplateColumns: `repeat(${levelCols}, minmax(0, 1fr))`,
                        width: `${levelCols * 32}px`,
                      }}>
                        {displayShape.map((row, r) =>
                          row.map((cell, c) => (
                            <div key={`${r}-${c}`}
                              onClick={() => toggleCell(r, c)}
                              className={`h-7 w-7 rounded-sm cursor-pointer border transition-colors ${
                                cell === 1
                                  ? 'bg-amber-500/60 border-amber-400/50 hover:bg-amber-500/80'
                                  : 'bg-slate-700/50 border-slate-600/30 hover:bg-slate-600/50'
                              }`}
                              title={`(${r},${c}) ${cell ? '有' : '无'}`}
                            />
                          ))
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      有效格子: {displayShape.flat().filter(v => v === 1).length} / {levelRows * levelCols}
                    </div>
                  </div>

                  {/* 可用图标选择 */}
                  <div>
                    <label className="text-xs text-gray-400">可用图标（点击选择/取消）</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeIcons.map(icon => {
                        const selected = levelAvailableIcons.includes(icon.id);
                        return (
                          <div key={icon.id}
                            onClick={() => toggleIconSelection(icon.id)}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 cursor-pointer transition-colors ${
                              selected
                                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                            }`}>
                            {icon.image_url
                              ? <img src={icon.image_url} alt={icon.name} className="h-5 w-5 rounded object-cover" />
                              : <span>🧩</span>}
                            <span className="text-xs">{icon.name}</span>
                          </div>
                        );
                      })}
                      {activeIcons.length === 0 && (
                        <span className="text-xs text-gray-500">请先在图标管理中添加图标</span>
                      )}
                    </div>
                  </div>

                  {/* 启用开关 */}
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={levelActive} onChange={e => setLevelActive(e.target.checked)}
                      className="h-4 w-4 rounded accent-purple-500" />
                    <span className="text-sm text-gray-300">{levelActive ? '启用' : '禁用'}</span>
                  </div>

                  {/* 背景图 */}
                  <div>
                    <label className="text-xs text-gray-400">🎨 关卡背景图</label>
                    <div className="mt-1 flex gap-2">
                      <input value={levelBgUrl} onChange={e => setLevelBgUrl(e.target.value)} placeholder="/epet/static/xxx.png"
                        className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
                      <label className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-medium ${uploadingLevelBg ? 'bg-gray-600 text-gray-400' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}>
                        {uploadingLevelBg ? '...' : '上传'}
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingLevelBg}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingLevelBg(true);
                            try {
                              const form = new FormData();
                              form.append('file', file);
                              form.append('type', 'game-assets');
                              const res = await client.post('/game-assets/upload', form, { timeout: 300000 });
                              if (res.data?.asset?.url) setLevelBgUrl(res.data.asset.url);
                            } catch (err: any) {
                              alert('上传失败: ' + (err.response?.data?.error || err.message));
                            } finally {
                              setUploadingLevelBg(false);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                    {levelBgUrl && (
                      <img src={levelBgUrl} alt="bg preview" className="mt-2 h-24 w-full rounded-lg object-cover opacity-70" />
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={resetLevelForm} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/20">取消</button>
                  <button onClick={saveLevel} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && <div className="py-8 text-center text-sm text-gray-400">加载中...</div>}
    </div>
  );
}
