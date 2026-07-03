import { useState } from 'react';
import { useGameStore } from '../game/GameState';
import { fetchVisiblePets, toggleVisibility, transformMonsterItem } from '../api/epet';
import type { Pet } from '../api/epet';

/** Get icon: uses uploaded image if available, otherwise falls back to emoji */
function useIcon(iconKey: string, fallbackEmoji: string): string | React.ReactNode {
  const icons = useGameStore(s => s.icons);
  const icon = icons[iconKey];
  if (icon?.image_url) {
    const base = `${window.location.protocol}//${window.location.host}`;
    const url = icon.image_url.startsWith('/') ? `${base}${icon.image_url}` : icon.image_url;
    return url;
  }
  return fallbackEmoji;
}

/** Render an icon: image if available, otherwise emoji text */
function IconOrEmoji({ iconKey, fallback }: { iconKey: string; fallback: string }) {
  const icons = useGameStore(s => s.icons);
  const icon = icons[iconKey];
  if (icon?.image_url) {
    const base = `${window.location.protocol}//${window.location.host}`;
    const url = icon.image_url.startsWith('/') ? `${base}${icon.image_url}` : icon.image_url;
    return <img src={url} alt={icon.label || iconKey} className="bottom-bar-icon-img" />;
  }
  return <span className="bottom-bar-icon">{fallback}</span>;
}

export function HUD() {
  const { setVisiblePets } = useGameStore();
  const [showCollection, setShowCollection] = useState(false);
  const [allPets, setAllPets] = useState<Pet[]>([]);
  const [loadingCollection, setLoadingCollection] = useState(false);

  const handleOpenCollection = async () => {
    setShowCollection(true);
    if (allPets.length === 0) {
      setLoadingCollection(true);
      try {
        const pets = await fetchVisiblePets();
        setAllPets(pets);
      } catch (e) {
        console.error('fetch pets failed', e);
      } finally {
        setLoadingCollection(false);
      }
    }
  };

  const handleToggleVisible = async (pet: Pet) => {
    try {
      const result = await toggleVisibility(pet.petId, pet.isVisible);
      const updated = result.monsters.map(transformMonsterItem);
      setAllPets(updated);
      setVisiblePets(
        updated
          .filter((p) => p.isVisible)
          .map((p) => ({
            ...p,
            petState: 'idle',
            animClass: 'walking',
            animX: 0,
            animY: 0,
            scale: 1,
          }))
      );
    } catch (e) {
      console.error('toggle visibility failed', e);
    }
  };

  const modelName = (modelId: string | number) => {
    if (modelId == 1) return '团子糯糯';
    if (modelId == 2) return '海浪沫沫';
    return '糖心莓莓';
  };

  const getPetImg = (monsterType: string) => {
    if (monsterType === 'white') return 'https://soa.laziestlife.com/epet/pet-white.png';
    if (monsterType === 'blue') return 'https://soa.laziestlife.com/epet/pet-blue.png';
    if (monsterType === 'pink') return 'https://soa.laziestlife.com/epet/pet-pink.png';
    return 'https://soa.laziestlife.com/epet/pet-idle.png';
  };

  return (
    <>
      {/* 右上角藏品库按钮 */}
      <button className="collection-btn" onClick={handleOpenCollection} title="藏品库">
        🏠
      </button>

      {/* 藏品库面板 */}
      {showCollection && (
        <div className="collection-overlay" onClick={() => setShowCollection(false)}>
          <div className="collection-panel" onClick={(e) => e.stopPropagation()}>
            <div className="collection-header">
              <h3>🏠 藏品库</h3>
              <button className="collection-close" onClick={() => setShowCollection(false)}>
                ×
              </button>
            </div>
            {loadingCollection ? (
              <div className="collection-loading">加载中...</div>
            ) : (
              <>
                <p className="collection-tip">选择要展示的宠物（最多2只）</p>
                <div className="collection-grid">
                  {allPets.map((p) => (
                    <div
                      key={p.petId}
                      className={`collection-card ${p.isVisible ? 'active' : ''}`}
                      onClick={() => handleToggleVisible(p)}
                    >
                      <div className="collection-card-img">
                        <img src={getPetImg(p.monsterType)} alt={p.displayName} />
                        {p.isVisible && <div className="collection-check">✓</div>}
                      </div>
                      <div className="collection-card-name">{p.displayName}</div>
                      <div className="collection-card-model">{modelName(p.modelId)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 底部 4 按钮栏 */}
      <div className="bottom-bar">
        <button className="bottom-bar-btn" onClick={() => alert('功能开发中')}>
          <IconOrEmoji iconKey="icon-miniprogram" fallback="📱" />
          <span className="bottom-bar-label">打开小程序</span>
        </button>
        <button className="bottom-bar-btn" onClick={() => alert('功能开发中')}>
          <IconOrEmoji iconKey="icon-smarthome" fallback="🏠" />
          <span className="bottom-bar-label">绑定智能家居</span>
        </button>
        <button className="bottom-bar-btn" onClick={() => alert('功能开发中')}>
          <IconOrEmoji iconKey="icon-postcard" fallback="✉️" />
          <span className="bottom-bar-label">旅行明信片</span>
        </button>
        <button className="bottom-bar-btn" onClick={() => alert('功能开发中')}>
          <IconOrEmoji iconKey="icon-buy" fallback="🛍️" />
          <span className="bottom-bar-label">购买新产品</span>
        </button>
      </div>

    </>
  );
}
