import { useState, useEffect } from 'react';
import client from '../../api/client';

// 同步 state 与 props 的 hook
function useSyncState<T>(value: T): [T, (v: T) => void] {
  const [state, setState] = useState(value);
  useEffect(() => setState(value), [value]);
  return [state, setState];
}

interface PetSeries {
  id: number;
  name: string;
  banner_image_url?: string;
  theme_color: string;
  display_order: number;
  silhouette_image_url?: string;
  background_style?: Record<string, any>;
  is_visible: boolean;
  display_background_url?: string;
}

interface DisplayConfig {
  x: number;
  y: number;
  scale: number;
}

interface PetModel {
  id: number;
  name: string;
  portrait_image_url?: string;
  image_url?: string;
}

interface SeriesPet {
  id: number;
  series_id: number;
  model_id: number;
  display_order: number;
  display_config?: DisplayConfig;
  model_name?: string;
  portrait_image_url?: string;
}

// 从 models 列表中获取机伴图片
function getPetImageFromModels(modelId: number, models: PetModel[]): string | undefined {
  const model = models.find(m => m.id === modelId);
  return model?.portrait_image_url || model?.image_url;
}

// 获取系列机伴的显示图片（优先使用 models 列表中的图片）
function getSeriesPetImage(sp: SeriesPet, models: PetModel[]): string | undefined {
  // 优先从 models 列表获取（最新的图片）
  const fromModels = getPetImageFromModels(sp.model_id, models);
  if (fromModels) return fromModels;
  // 回退到后端返回的图片
  return sp.portrait_image_url;
}

export default function PetSeriesAdmin() {
  const [seriesList, setSeriesList] = useState<PetSeries[]>([]);
  const [allPets, setAllPets] = useState<PetModel[]>([]);
  const [seriesPets, setSeriesPets] = useState<SeriesPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSeries, setEditingSeries] = useState<PetSeries | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<PetSeries | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingSilhouette, setUploadingSilhouette] = useState(false);
  const [uploadingDisplayBg, setUploadingDisplayBg] = useState(false);
  const [editingPetPosition, setEditingPetPosition] = useState<SeriesPet | null>(null);

  // 上传图片到素材库
  const uploadImage = async (file: File, prefix: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', `${prefix}_${Date.now()}.${file.name.split('.').pop()}`);
    
    const res = await client.post('/admin/epet-assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return `/epet/static/${res.data.filename}`;
  };

  // 处理 Banner 上传
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingSeries) return;
    
    setUploadingBanner(true);
    try {
      const url = await uploadImage(file, `series_${editingSeries.id || 'new'}_banner`);
      setEditingSeries({ ...editingSeries, banner_image_url: url });
    } catch (e: any) {
      setError(e.response?.data?.error || '上传失败');
    } finally {
      setUploadingBanner(false);
    }
  };

  // 处理剪影上传
  const handleSilhouetteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingSeries) return;
    
    setUploadingSilhouette(true);
    try {
      const url = await uploadImage(file, `series_${editingSeries.id || 'new'}_silhouette`);
      setEditingSeries({ ...editingSeries, silhouette_image_url: url });
    } catch (e: any) {
      setError(e.response?.data?.error || '上传失败');
    } finally {
      setUploadingSilhouette(false);
    }
  };

  // 处理展示柜背景上传
  const handleDisplayBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingSeries) return;
    
    setUploadingDisplayBg(true);
    try {
      const url = await uploadImage(file, `series_${editingSeries.id || 'new'}_display`);
      setEditingSeries({ ...editingSeries, display_background_url: url });
    } catch (e: any) {
      setError(e.response?.data?.error || '上传失败');
    } finally {
      setUploadingDisplayBg(false);
    }
  };

  // 更新机伴展示位置
  const handleUpdatePetPosition = async (petId: number, config: DisplayConfig) => {
    try {
      await client.put(`/admin/pet-series/${selectedSeries?.id}/pets/${petId}/position`, config);
      if (selectedSeries) {
        await loadSeriesPets(selectedSeries.id);
      }
      setEditingPetPosition(null);
    } catch (e: any) {
      setError(e.response?.data?.error || '更新位置失败');
    }
  };

  // 加载系列列表
  const loadSeries = async () => {
    try {
      const res = await client.get('/admin/pet-series');
      setSeriesList(res.data.series || []);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  // 加载所有机伴模型
  const loadPets = async () => {
    try {
      const res = await client.get('/admin/models');
      setAllPets(res.data.models || []);
    } catch (e: any) {
      console.error('Failed to load pets:', e);
    }
  };

  // 加载系列内机伴
  const loadSeriesPets = async (seriesId: number) => {
    try {
      const res = await client.get(`/admin/pet-series/${seriesId}/pets`);
      setSeriesPets(res.data.pets || []);
    } catch (e: any) {
      console.error('Failed to load series pets:', e);
    }
  };

  useEffect(() => {
    Promise.all([loadSeries(), loadPets()]).then(() => setLoading(false));
  }, []);

  // 创建/更新系列
  const handleSaveSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeries) return;
    
    try {
      if (editingSeries.id) {
        await client.put(`/admin/pet-series/${editingSeries.id}`, editingSeries);
      } else {
        await client.post('/admin/pet-series', editingSeries);
      }
      await loadSeries();
      setEditingSeries(null);
      setShowAddModal(false);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  // 删除系列
  const handleDeleteSeries = async (id: number) => {
    if (!confirm('确定删除该系列？')) return;
    try {
      await client.delete(`/admin/pet-series/${id}`);
      await loadSeries();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  // 添加机伴到系列
  const handleAddPetToSeries = async (modelId: number) => {
    if (!selectedSeries) return;
    try {
      await client.post(`/admin/pet-series/${selectedSeries.id}/pets`, {
        model_id: modelId,
        display_order: seriesPets.length + 1,
      });
      await loadSeriesPets(selectedSeries.id);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  // 从系列移除机伴
  const handleRemovePetFromSeries = async (seriesPetId: number) => {
    if (!selectedSeries) return;
    try {
      await client.delete(`/admin/pet-series/${selectedSeries.id}/pets/${seriesPetId}`);
      await loadSeriesPets(selectedSeries.id);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🐾 机伴系列管理</h2>
          <p className="text-sm text-gray-400 mt-1">管理藏品库中的机伴系列、Banner、机伴归属</p>
        </div>
        <button
          onClick={() => {
            setEditingSeries({ id: 0, name: '', theme_color: '#FFF5E6', display_order: 0, is_visible: true });
            setShowAddModal(true);
          }}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500"
        >
          + 创建系列
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">{error}</div>
      )}

      {/* 系列列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {seriesList.map(series => (
          <div
            key={series.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ background: series.theme_color }}
                >
                  🏠
                </div>
                <div>
                  <div className="font-semibold text-white">{series.name}</div>
                  <div className="text-xs text-gray-400">
                    排序: {series.display_order} | {series.is_visible ? '可见' : '隐藏'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedSeries(series);
                    loadSeriesPets(series.id);
                  }}
                  className="px-3 py-1.5 text-xs rounded bg-white/10 text-white hover:bg-white/20"
                >
                  管理机伴
                </button>
                <button
                  onClick={() => {
                    setEditingSeries(series);
                    setShowAddModal(true);
                  }}
                  className="px-3 py-1.5 text-xs rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDeleteSeries(series.id)}
                  className="px-3 py-1.5 text-xs rounded bg-red-600/20 text-red-400 hover:bg-red-600/30"
                >
                  删除
                </button>
              </div>
            </div>

            {/* Banner 预览 */}
            {series.banner_image_url && (
              <div className="h-24 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${series.banner_image_url})` }} />
            )}

            {/* 剪影预览 */}
            {series.silhouette_image_url && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>剪影:</span>
                <img src={series.silhouette_image_url} className="w-8 h-8 object-contain opacity-50" alt="silhouette" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 编辑/创建系列弹窗 */}
      {showAddModal && editingSeries && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-white">
              {editingSeries.id ? '编辑系列' : '创建系列'}
            </h3>
            <form onSubmit={handleSaveSeries} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">系列名称</label>
                <input
                  type="text"
                  value={editingSeries.name}
                  onChange={e => setEditingSeries({ ...editingSeries, name: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">主题色</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={editingSeries.theme_color}
                    onChange={e => setEditingSeries({ ...editingSeries, theme_color: e.target.value })}
                    className="w-12 h-10 rounded"
                  />
                  <input
                    type="text"
                    value={editingSeries.theme_color}
                    onChange={e => setEditingSeries({ ...editingSeries, theme_color: e.target.value })}
                    className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
                  />
                </div>
              </div>
              {/* Banner 上传 */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Banner 图片</label>
                <div className="space-y-2">
                  {editingSeries.banner_image_url && (
                    <div className="h-24 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${editingSeries.banner_image_url})` }} />
                  )}
                  <div className="flex gap-2">
                    <label className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-center cursor-pointer hover:bg-white/20 transition">
                      {uploadingBanner ? '上传中...' : '上传 Banner'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerUpload}
                        className="hidden"
                        disabled={uploadingBanner}
                      />
                    </label>
                    <input
                      type="text"
                      value={editingSeries.banner_image_url || ''}
                      onChange={e => setEditingSeries({ ...editingSeries, banner_image_url: e.target.value })}
                      placeholder="或输入 URL"
                      className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* 剪影上传 */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">剪影图片</label>
                <div className="space-y-2">
                  {editingSeries.silhouette_image_url && (
                    <div className="flex items-center gap-2 p-2 rounded bg-white/5">
                      <img src={editingSeries.silhouette_image_url} className="w-12 h-12 object-contain opacity-50" alt="silhouette" />
                      <span className="text-xs text-gray-400">当前剪影</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-center cursor-pointer hover:bg-white/20 transition">
                      {uploadingSilhouette ? '上传中...' : '上传剪影'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSilhouetteUpload}
                        className="hidden"
                        disabled={uploadingSilhouette}
                      />
                    </label>
                    <input
                      type="text"
                      value={editingSeries.silhouette_image_url || ''}
                      onChange={e => setEditingSeries({ ...editingSeries, silhouette_image_url: e.target.value })}
                      placeholder="或输入 URL"
                      className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* 展示柜背景上传 */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">🎨 展示柜背景（展架）</label>
                <div className="space-y-2">
                  {editingSeries.display_background_url && (
                    <div className="h-32 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${editingSeries.display_background_url})` }} />
                  )}
                  <div className="flex gap-2">
                    <label className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-center cursor-pointer hover:bg-white/20 transition">
                      {uploadingDisplayBg ? '上传中...' : '上传展架背景'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleDisplayBgUpload}
                        className="hidden"
                        disabled={uploadingDisplayBg}
                      />
                    </label>
                    <input
                      type="text"
                      value={editingSeries.display_background_url || ''}
                      onChange={e => setEditingSeries({ ...editingSeries, display_background_url: e.target.value })}
                      placeholder="或输入 URL"
                      className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">显示顺序</label>
                <input
                  type="number"
                  value={editingSeries.display_order}
                  onChange={e => setEditingSeries({ ...editingSeries, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingSeries.is_visible}
                  onChange={e => setEditingSeries({ ...editingSeries, is_visible: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-400">在藏品库中可见</label>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingSeries(null); }}
                  className="flex-1 px-4 py-2 rounded bg-white/10 text-white hover:bg-white/20"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 机伴位置编辑弹窗 - 带背景预览 */}
      {editingPetPosition && selectedSeries && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4 max-h-[95vh] overflow-auto">
            <h3 className="text-lg font-semibold text-white">
              设置 {editingPetPosition.model_name} 的位置
            </h3>
            <PetPositionEditor
              config={editingPetPosition.display_config || { x: 50, y: 50, scale: 1 }}
              backgroundUrl={selectedSeries.display_background_url}
              petImageUrl={getSeriesPetImage(editingPetPosition, allPets)}
              onSave={(config) => handleUpdatePetPosition(editingPetPosition.id, config)}
              onCancel={() => setEditingPetPosition(null)}
            />
          </div>
        </div>
      )}

      {/* 管理系列机伴弹窗 */}
      {selectedSeries && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {selectedSeries.name} - 机伴管理
              </h3>
              <button
                onClick={() => { setSelectedSeries(null); setSeriesPets([]); }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* 当前系列中的机伴 */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-400 mb-2">当前系列机伴（点击设置位置）</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {seriesPets.map(sp => {
                  const config = sp.display_config || { x: 50, y: 50, scale: 1 };
                  const imageUrl = getSeriesPetImage(sp, allPets);
                  return (
                    <div key={sp.id} className="relative group cursor-pointer" onClick={() => setEditingPetPosition(sp)}>
                      <div className="aspect-square rounded-lg bg-white/10 flex items-center justify-center">
                        {imageUrl ? (
                          <img src={imageUrl} className="w-3/4 h-3/4 object-contain" alt={sp.model_name} />
                        ) : (
                          <span className="text-2xl">🐾</span>
                        )}
                      </div>
                      <div className="text-xs text-center text-gray-400 mt-1 truncate">
                        {sp.model_name || `ID:${sp.model_id}`}
                      </div>
                      <div className="text-[10px] text-center text-gray-500">
                        X:{config.x} Y:{config.y} S:{config.scale}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePetFromSeries(sp.id); }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 可添加的机伴 */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">可添加的机伴</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {allPets
                  .filter(p => !seriesPets.some(sp => sp.model_id === p.id))
                  .map(pet => (
                    <button
                      key={pet.id}
                      onClick={() => handleAddPetToSeries(pet.id)}
                      className="aspect-square rounded-lg bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center p-2 transition"
                    >
                      {(pet.portrait_image_url || pet.image_url) ? (
                        <img src={pet.portrait_image_url || pet.image_url} className="w-3/4 h-3/4 object-contain opacity-60" alt={pet.name} />
                      ) : (
                        <span className="text-2xl opacity-50">🐾</span>
                      )}
                      <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">{pet.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 机伴位置编辑器组件 - 带移动端比例预览
interface PetPositionEditorProps {
  config: DisplayConfig;
  backgroundUrl?: string;
  petImageUrl?: string;
  onSave: (config: DisplayConfig) => void;
  onCancel: () => void;
}

function PetPositionEditor({ config, backgroundUrl, petImageUrl, onSave, onCancel }: PetPositionEditorProps) {
  // 使用同步 hook，当 config 变化时自动更新 state
  const [x, setX] = useSyncState(config.x);
  const [y, setY] = useSyncState(config.y);
  const [scale, setScale] = useSyncState(config.scale);

  // 移动端 9:16 比例 - 使用 padding-bottom 实现，与藏品库展示区域一致
  const PREVIEW_WIDTH = 280;

  return (
    <div className="space-y-4">
      {/* 预览区域 - 移动端 9:16 比例 */}
      <div className="space-y-2">
        <label className="block text-sm text-gray-400">位置预览 (9:16 移动端比例)</label>
        <div 
          className="relative mx-auto rounded-lg overflow-hidden border-2 border-white/20"
          style={{
            width: PREVIEW_WIDTH,
            paddingBottom: '177.78%', /* 16/9 = 177.78%，实现 9:16 竖屏比例 */
          }}
        >
          {/* 背景层 */}
          <div 
            className="absolute inset-0"
            style={{
              background: backgroundUrl 
                ? `url(${backgroundUrl}) center/cover no-repeat`
                : 'linear-gradient(180deg, #2a2a4a 0%, #1a1a2e 100%)',
            }}
          />
          
          {/* 网格辅助线 */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/50" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/50" />
          </div>
          
          {/* 宠物预览 - 与藏品库保持一致的结构 */}
          {petImageUrl && (
            <div
              className="absolute transition-all duration-200"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                width: 80,
              }}
            >
              <div style={{
                width: '100%',
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <img
                  src={petImageUrl}
                  alt="pet preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
                  }}
                />
              </div>
            </div>
          )}
          
          {/* 位置标记点 */}
          <div 
            className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
        {!backgroundUrl && (
          <p className="text-xs text-amber-400 text-center">⚠️ 请先上传展示柜背景图片以获得准确预览</p>
        )}
      </div>

      {/* 控制滑块 */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">水平位置 X (0-100)</label>
          <input
            type="range"
            min="0"
            max="100"
            value={x}
            onChange={(e) => setX(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="text-xs text-gray-500 text-right">{x}%</div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">垂直位置 Y (0-100)</label>
          <input
            type="range"
            min="0"
            max="100"
            value={y}
            onChange={(e) => setY(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="text-xs text-gray-500 text-right">{y}%</div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">缩放比例 (0.5-2.0)</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="text-xs text-gray-500 text-right">{scale.toFixed(1)}x</div>
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 rounded bg-white/10 text-white hover:bg-white/20"
        >
          取消
        </button>
        <button
          onClick={() => onSave({ x, y, scale })}
          className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
        >
          保存位置
        </button>
      </div>
    </div>
  );
}
