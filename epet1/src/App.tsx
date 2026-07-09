import { useEffect, useState, useCallback, useRef, type ReactNode, type MouseEvent, type KeyboardEvent, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from './store/gameStore';
import { useGameStore as usePixiGameStore } from './game/GameState';
import SpotDifference from './games/SpotDifference';
import Fishing from './games/Fishing';
import Cooking from './games/Cooking';
import Match3Game from './games/Match3Game';
import {
  getOrCreateUser,
  fetchYardPets,
  fetchUserPets,
  fetchTravelStatus,
  fetchTravelingPetIds,
  addToYard,
  removeFromYard,
  startTravel,
  fetchPostcards,
  fetchDriftBottles,
  sendDriftBottle,
  pickupDriftBottle,
  fetchShopItems,
  buyItem,
  activatePet,
  recordGameScore,
  sendChatMessage,
  placeFurniture,
  removeFurniture,
  fetchYardFurniture,
  fetchEmotionDrops,
  collectEmotionDrop,
} from './api/epet1';
import type { PetInstance, Postcard, DriftBottle, ShopItem, YardFurniture } from './api/epet1';
import { gameInstance, type PlacingFurnitureInfo } from './game/Game';
import IntroVideoPlayer from './components/IntroVideoPlayer';
import './App.css';

// ─── 宠物图片映射 ────────────────────────────────────────────
// model_id=1→海浪沫沫(蓝) model_id=2→团子糯糯(白) model_id=3→糖心莓莓(粉)
const PET_IMAGES: Record<number, string> = {
  1: '/assets/pets/moomo.png',
  2: '/assets/pets/nuonuo.png',
  3: '/assets/pets/meimei.png',
  4: '/assets/pets/moomo.png',
  5: '/assets/pets/meimei.png',
  6: '/assets/pets/moomo.png',
};

/** Render icon from uploaded assets or fallback emoji */
function IconImg({ iconKey, fallback }: { iconKey: string; fallback: string }) {
  const icons = usePixiGameStore(s => s.icons);
  const icon = icons[iconKey];
  if (icon?.image_url) {
    const base = `${window.location.protocol}//${window.location.host}`;
    const url = icon.image_url.startsWith('/') ? `${base}${icon.image_url}` : icon.image_url;
    return <img src={url} alt={icon.label || iconKey} className="bottom-bar-icon-img uploaded" />;
  }
  return <span className="bottom-bar-icon">{fallback}</span>;
}

// model_id → PixiJS monsterType (PetEntity.getImageName 映射)
function getMonsterType(modelId: number): string {
  // model_id=1→海浪沫沫(蓝/blue) model_id=2→团子糯糯(白/white) model_id=3→糖心莓莓(粉/pink)
  const map: Record<number, string> = { 1: 'blue', 2: 'white', 3: 'pink' };
  return map[modelId] || 'white';
}

function getPetImage(modelId: number): string {
  return PET_IMAGES[modelId] || '/assets/pets/placeholder.png';
}

// 统一获取宠物立绘: 优先用 DB image_url (用户上传的 portrait), fallback 静态 PET_IMAGES
function getPetPortrait(pet: any): string {
  return pet?.image_url || getPetImage(pet?.pet_model_id);
}

// ─── Emoji 映射 ──────────────────────────────────────────────
const RARITY_EMOJI: Record<string, string> = { N: '📭', R: '💌', SR: '🎀', SSR: '🌟', UR: '🏅' };

// ─── Toast 提示 ──────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast-popup">{msg}</div>;
}

// ─── Modal 基类 ──────────────────────────────────────────────
function ModalOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── 藏品库 Modal ───────────────────────────────────────────
function CollectionModal({ onClose }: { onClose: () => void }) {
  const { userId, allPets, setAllPets, yardPets, setYardPets } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string>('');
  const [travelingPetIds, setTravelingPetIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!userId) return;
    fetchTravelingPetIds(userId).then((ids) => setTravelingPetIds(new Set(ids)));
  }, [userId]);

  const handleToggleYard = async (pet: PetInstance) => {
    if (!userId) return;
    setAction(String(pet.id));
    try {
      const isInYard = yardPets.some(yp => yp.id === pet.id);
      if (isInYard) {
        await removeFromYard(userId, pet.id);
        setYardPets(yardPets.filter((p) => p.id !== pet.id));
      } else {
        if (yardPets.length >= 3) {
          alert('庭院最多放 3 只宠物！');
          return;
        }
        await addToYard(userId, pet.id);
        setYardPets([...yardPets, pet]);
      }
    } catch (e: any) {
      alert(e.message || '操作失败');
    } finally {
      setAction('');
    }
  };

  const handleNFCActivate = async () => {
    const nfcId = prompt('请输入 NFC 标签 ID（卡片上的数字）：');
    if (!nfcId || !userId) return;
    setLoading(true);
    try {
      const pet = await activatePet(userId, nfcId.trim());
      setAllPets([...allPets, pet]);
      alert(`🎉 激活成功！${pet.nickname} 加入你的藏品库！`);
    } catch (e: any) {
      alert(e.message || '激活失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-header">
        <h3>🏠 藏品库</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-tip">最多同时展示 2 只宠物在庭院中</div>

      {loading ? (
        <div className="modal-loading">加载中...</div>
      ) : (
        <>
          {/* 激活新宠物 */}
          <button className="btn-nfc-activate" onClick={handleNFCActivate}>
            📱 扫描NFC激活新宠物
          </button>

          {allPets.length === 0 ? (
            <div className="modal-empty">还没有宠物，扫描NFC标签激活吧！</div>
          ) : (
            <div className="collection-grid">
              {allPets.map((pet) => {
                const isInYard = yardPets.some(yp => yp.id === pet.id);
                const isTraveling = travelingPetIds.has(Number(pet.id));
                return (
                <div
                  key={pet.id}
                  className={`collection-card ${isInYard ? 'active' : ''} ${isTraveling ? 'traveling' : ''}`}
                  onClick={() => {
                    if (isTraveling || action === String(pet.id)) return;
                    handleToggleYard(pet);
                  }}
                >
                  <div className="collection-card-img">
                    <img src={getPetPortrait(pet)} alt={pet.nickname} />
                    {isTraveling && <div className="collection-travel-badge">✈️</div>}
                    {!isTraveling && isInYard && <div className="collection-check">✓</div>}
                  </div>
                  <div className="collection-card-name">{pet.model_name || pet.nickname}</div>
                  <div className="collection-card-level">
                    {isTraveling ? '🛫 旅行中' : `Lv.${pet.growth_level}`}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </ModalOverlay>
  );
}

// ─── 旅行横幅（带倒计时） ──────────────────────────────────────
function TravelBanner({ travel, onClick }: { travel: any; onClick: () => void }) {
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!travel.expected_end_at) return;
    const tick = () => {
      const diff = new Date(travel.expected_end_at).getTime() - Date.now();
      if (diff <= 0) { setCountdown('即将归来'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${h}时${m}分`);
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, [travel.expected_end_at]);

  return (
    <div className="travel-banner" onClick={onClick}>
      ✈️ {travel.pet_nickname} 旅行中 · {countdown || '...'}
      {travel.dish_rating && <span style={{ marginLeft: 6 }}>{'⭐'.repeat(travel.dish_rating)}</span>}
    </div>
  );
}

// ─── 明信片 Modal ───────────────────────────────────────────
function PostcardModal({ onClose }: { onClose: () => void }) {
  const { userId, setFullscreenVideoUrl } = useGameStore();
  const [postcards, setPostcards] = useState<Postcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!userId) return;
    fetchPostcards(userId).then((p) => { setPostcards(p); setLoading(false); }).catch(() => setLoading(false));
  }, [userId]);

  const rarityColor: Record<string, string> = { N: '#aaa', R: '#4CAF50', SR: '#2196F3', SSR: '#FF9800', UR: '#E91E63' };

  const obtainedCards = postcards.filter(p => p.obtained);
  const currentPc = obtainedCards[currentIndex];

  const goPrev = () => setCurrentIndex(Math.max(0, currentIndex - 1));
  const goNext = () => setCurrentIndex(Math.min(obtainedCards.length - 1, currentIndex + 1));

  // Touch swipe support
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50) goPrev();
    else if (dx < -50) goNext();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex', flexDirection: 'column',
        touchAction: 'pan-y',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 顶栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', color: '#fff',
      }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>💌 明信片</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>
            {obtainedCards.length > 0 ? `${currentIndex + 1} / ${obtainedCards.length}` : '0 张'}
          </span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, color: '#fff', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
      </div>

      {/* 明信片展示区 */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px', position: 'relative', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>加载中...</div>
        ) : obtainedCards.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💌</div>
            <div style={{ fontSize: 14 }}>还没有明信片</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>送宠物去旅行吧</div>
          </div>
        ) : currentPc ? (
          <>
            {/* 左箭头 */}
            {currentIndex > 0 && (
              <button onClick={goPrev} style={{
                position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
                width: 36, height: 36, color: '#fff', fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>‹</button>
            )}

            {/* 明信片卡片 */}
            <div
              onClick={() => currentPc.video_url && setFullscreenVideoUrl(currentPc.video_url)}
              style={{
                width: '100%', maxWidth: 320, textAlign: 'center',
                cursor: currentPc.video_url ? 'pointer' : 'default',
              }}
            >
              <div style={{
                width: '100%', aspectRatio: '4/3', borderRadius: 16,
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundImage: currentPc.image_url ? `url(${currentPc.image_url})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center',
                border: `2px solid ${rarityColor[currentPc.rarity]}`,
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}>
                {!currentPc.image_url && <span style={{ fontSize: 48, opacity: 0.5 }}>💌</span>}
                {/* 视频播放提示 */}
                {currentPc.video_url && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.2)',
                  }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, color: '#333',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                    }}>▶</div>
                  </div>
                )}
              </div>
              {/* 信息 */}
              <div style={{ marginTop: 12, color: '#fff' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{currentPc.name}</div>
                <div style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                  background: rarityColor[currentPc.rarity], color: '#fff',
                  fontSize: 11, fontWeight: 700,
                }}>{currentPc.rarity}</div>
                {currentPc.description && (
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{currentPc.description}</div>
                )}
                {currentPc.video_url && (
                  <div style={{ color: '#FF9800', fontSize: 12, marginTop: 6 }}>🎬 点击明信片播放旅行视频</div>
                )}
              </div>
            </div>

            {/* 右箭头 */}
            {currentIndex < obtainedCards.length - 1 && (
              <button onClick={goNext} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
                width: 36, height: 36, color: '#fff', fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>›</button>
            )}
          </>
        ) : null}
      </div>

      {/* 底部进度点 */}
      {obtainedCards.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '16px 0 24px' }}>
          {obtainedCards.map((_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.3)',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 旅行 Modal (v3: 需要料理) ────────────────────────────────
function TravelModal({ onClose, preselectedPetId }: { onClose: () => void; preselectedPetId?: number }) {
  const { userId, yardPets, activeTravel, setActiveTravel, setYardPets } = useGameStore();
  const [starting, setStarting] = useState<number | null>(null);
  const [dishes, setDishes] = useState<any[]>([]);
  const [selectedDish, setSelectedDish] = useState<any | null>(null);
  const [selectedPet, setSelectedPet] = useState<number | null>(preselectedPetId || null);
  const [step, setStep] = useState<'selectPet' | 'selectDish' | 'confirm'>(preselectedPetId ? 'selectDish' : 'selectPet');

  // 加载背包中的料理
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/epet1/inventory/${userId}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          const dishList = (data.categories?.dish || []).filter((d: any) => d.dish_rating >= 1);
          setDishes(dishList);
        }
      })
      .catch(e => console.error('load dishes error:', e));
  }, [userId]);

  // 倒计时
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!activeTravel?.expected_end_at) return;
    const tick = () => {
      const diff = new Date(activeTravel.expected_end_at!).getTime() - Date.now();
      if (diff <= 0) { setCountdown('即将归来'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}时${m}分${s}秒`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeTravel?.expected_end_at]);

  const handleStart = async () => {
    if (!userId || !selectedPet || !selectedDish) return;
    setStarting(selectedPet);
    try {
      const record = await startTravel(userId, selectedPet, selectedDish.id);
      setActiveTravel(record);
      setYardPets(yardPets.filter((p) => p.id !== selectedPet));
      onClose();
    } catch (e: any) {
      alert(e.message || '出游失败');
    } finally {
      setStarting(null);
    }
  };

  const ratingLabel: Record<number, string> = { 1: '还行(12h)', 2: '不错(10h)', 3: '完美(8h)' };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-header">
        <h3>✈️ 派遣旅行</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>

      {activeTravel ? (
        <div className="travel-active">
          <div className="travel-status">🛫 {activeTravel.pet_nickname} 正在旅行中...</div>
          <div className="travel-timer">{countdown || '计算中...'}</div>
          {activeTravel.dish_rating && (
            <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
              料理评级: {'⭐'.repeat(activeTravel.dish_rating)}
            </div>
          )}
          <button className="btn-primary" disabled>归来时通知你</button>
        </div>
      ) : (
        <>
          {/* 步骤1: 选宠物 */}
          {step === 'selectPet' && (
            <>
              <div className="modal-tip">选择一只宠物送它去旅行</div>
              {yardPets.length === 0 ? (
                <div className="modal-empty">庭院没有宠物，先去藏品库添加宠物吧</div>
              ) : (
                <div className="travel-pet-list">
                  {yardPets.map((pet) => (
                    <div key={pet.id} className="travel-pet-item"
                      style={selectedPet === pet.id ? { background: 'rgba(255,152,0,0.15)', border: '1px solid #FF9800' } : {}}
                      onClick={() => { setSelectedPet(pet.id); setStep('selectDish'); }}
                    >
                      <img src={getPetPortrait(pet)} alt={pet.nickname} />
                      <div className="travel-pet-info">
                        <div className="travel-pet-name">{pet.nickname}</div>
                        <div className="travel-pet-level">Lv.{pet.growth_level}</div>
                      </div>
                      <span style={{ fontSize: 18 }}>→</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 步骤2: 选料理 */}
          {step === 'selectDish' && (
            <>
              <div style={{ marginBottom: 8 }}>
                <button style={{ background: 'none', border: 'none', color: '#FF9800', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => setStep('selectPet')}>← 返回选宠物</button>
              </div>
              <div className="modal-tip">提供一份料理给宠物当旅行口粮</div>
              {dishes.length === 0 ? (
                <div className="modal-empty">
                  背包里没有可用的料理<br />
                  <span style={{ fontSize: 12, color: '#999' }}>需要至少1星料理，去做菜吧！</span>
                </div>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {dishes.map((dish: any) => (
                    <div key={dish.id} onClick={() => { setSelectedDish(dish); setStep('confirm'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', marginBottom: 6,
                        background: selectedDish?.id === dish.id ? 'rgba(255,152,0,0.15)' : 'rgba(0,0,0,0.03)',
                        border: selectedDish?.id === dish.id ? '1px solid #FF9800' : '1px solid transparent',
                        borderRadius: 10, cursor: 'pointer',
                      }}
                    >
                      {dish.image_url ? (
                        <img src={dish.image_url} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: 24 }}>🍳</span>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{dish.name}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {'⭐'.repeat(dish.dish_rating)} {ratingLabel[dish.dish_rating] || ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: '#999' }}>×{dish.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 步骤3: 确认 */}
          {step === 'confirm' && selectedDish && (
            <>
              <div style={{ marginBottom: 8 }}>
                <button style={{ background: 'none', border: 'none', color: '#FF9800', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => setStep('selectDish')}>← 重选料理</button>
              </div>
              <div style={{
                textAlign: 'center', padding: 16,
                background: 'rgba(255,152,0,0.08)', borderRadius: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                  🧳 旅行确认
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                  宠物: {yardPets.find(p => p.id === selectedPet)?.nickname}
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                  料理: {selectedDish.name} {'⭐'.repeat(selectedDish.dish_rating)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#FF9800' }}>
                  旅行时间: {ratingLabel[selectedDish.dish_rating]}
                </div>
              </div>
              <button
                className="btn-travel-start"
                onClick={handleStart}
                disabled={starting !== null}
                style={{
                  width: '100%', padding: '14px 0', border: 'none', borderRadius: 12,
                  background: 'linear-gradient(135deg, #FF6B35, #FF9800)',
                  color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {starting !== null ? '出发中...' : '✈️ 出发旅行！'}
              </button>
            </>
          )}
        </>
      )}
    </ModalOverlay>
  );
}

// ─── 背包 Modal ────────────────────────────────────────────
const INV_TABS = [
  { id: 'food', name: '🥘 食材', empty: '还没有食材，去钓鱼或商店看看吧' },
  { id: 'dish', name: '🍳 料理', empty: '还没有料理，去做菜吧' },
  { id: 'furniture', name: '🪑 家具', empty: '还没有家具，去商店看看吧' },
];

// 默认家具尺寸（视口比例）
const FURNITURE_DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  '椅子': { width: 0.06, height: 0.10 },
  '秋千': { width: 0.10, height: 0.14 },
  '盆栽': { width: 0.05, height: 0.08 },
  '太阳伞': { width: 0.12, height: 0.16 },
  '小帐篷': { width: 0.12, height: 0.14 },
  '飞盘': { width: 0.06, height: 0.06 },
};

function InventoryModal({ onClose }: { onClose: () => void }) {
  const { userId, placingFurniture, setPlacingFurniture, yardFurniture, setYardFurniture, addYardFurniture, removeYardFurniture, setRemovingFurnitureMode } = useGameStore();
  const [activeTab, setActiveTab] = useState<'food' | 'dish' | 'furniture'>('food');
  const [inventory, setInventory] = useState<{ food: any[]; dish: any[]; furniture: any[]; postcard: any[] }>({ food: [], dish: [], furniture: [], postcard: [] });

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/epet1/inventory/${userId}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setInventory(data.categories);
      })
      .catch(e => console.error('Failed to load inventory:', e));
  }, [userId]);

  const items = inventory[activeTab] || [];

  const handlePlaceFurniture = (item: any) => {
    if (!userId) return;
    if (yardFurniture.length >= 8) {
      alert('庭院最多放置 8 件家具！');
      return;
    }
    // 优先使用后台配置的 yard_width/yard_height，否则 fallback 到默认表
    const defaultSize = FURNITURE_DEFAULT_SIZE[item.name] || { width: 0.08, height: 0.12 };
    const info: PlacingFurnitureInfo = {
      shopItemId: item.shop_item_id || item.id,
      name: item.name,
      imageUrl: item.image_url || '',
      width: item.yard_width ? parseFloat(item.yard_width) : defaultSize.width,
      height: item.yard_height ? parseFloat(item.yard_height) : defaultSize.height,
    };
    setPlacingFurniture(info);
    gameInstance.startPlacing(info);
    onClose(); // close modal, show yard with placement ghost
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3>🎒 背包</h3>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {INV_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#8B6914' : 'rgba(0,0,0,0.4)',
              background: activeTab === tab.id ? 'rgba(139,105,20,0.12)' : 'rgba(0,0,0,0.04)',
              position: 'relative',
            }}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      {activeTab === 'furniture' && yardFurniture.length > 0 && (
        <button
          onClick={() => { setRemovingFurnitureMode(true); onClose(); }}
          style={{
            width: '100%', marginBottom: 10, padding: '8px 12px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #c0392b, #e74c3c)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          🔄 回收家具
        </button>
      )}
      {items.length === 0 ? (
        <div className="modal-empty" style={{ padding: '40px 0' }}>
          {INV_TABS.find(t => t.id === activeTab)?.empty}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxHeight: '50vh', overflowY: 'auto' }}>
          {items.map((item: any, i: number) => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 10,
              textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)',
            }}
            >
              <div style={{
                width: 48, height: 48, margin: '0 auto 6px', borderRadius: 8,
                background: 'rgba(0,0,0,0.06)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 28,
                backgroundImage: item.image_url ? `url(${item.image_url})` : undefined,
                backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
              }}>
                {!item.image_url && (activeTab === 'food' ? '🐟' : activeTab === 'dish' ? '🍳' : '🪑')}
              </div>
              <div style={{ color: '#333', fontSize: 12, fontWeight: 600, marginBottom: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </div>
              {/* 料理评级星级 */}
              {activeTab === 'dish' && item.dish_rating != null && (
                <div style={{ fontSize: 10, marginBottom: 2 }}>
                  {item.dish_rating >= 1 ? '⭐'.repeat(item.dish_rating) : '❌'}
                </div>
              )}
              {item.quantity !== undefined && (
                <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 10 }}>×{item.quantity}</div>
              )}
              {/* 家具布置按钮 */}
              {activeTab === 'furniture' && (
                yardFurniture.some(f => String(f.shop_item_id) === String(item.shop_item_id || item.id)) ? (
                  <div style={{
                    marginTop: 6, padding: '4px 10px', borderRadius: 6,
                    background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.35)',
                    fontSize: 11, fontWeight: 500, textAlign: 'center',
                  }}>
                    ✅ 已放置
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePlaceFurniture(item); }}
                    style={{
                      marginTop: 6, padding: '4px 10px', borderRadius: 6, border: 'none',
                      background: 'linear-gradient(135deg, #8B6914, #C49B2A)', color: '#fff',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%',
                    }}
                  >
                    🏗️ 布置
                  </button>
                )
              )}
              {item.duplicate_count !== undefined && item.duplicate_count > 0 && (
                <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 10 }}>重复 ×{item.duplicate_count}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </ModalOverlay>
  );
}

// ─── 漂流瓶 Modal ───────────────────────────────────────────
function DriftModal({ onClose }: { onClose: () => void }) {
  const { userId, emotionPoints, setEmotionPoints, addEmotionPoints } = useGameStore();
  const [bottles, setBottles] = useState<DriftBottle[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    fetchDriftBottles(userId).then((b) => { setBottles(b); setLoading(false); }).catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!userId) return;
    if (emotionPoints < 5) { alert('情绪值不足，需要 5 点情绪值才能投放漂流瓶'); return; }
    const msg = prompt('想说什么？（情绪值 5 点）');
    if (!msg) return;
    setSending(true);
    try {
      await sendDriftBottle(userId, msg);
      setEmotionPoints(emotionPoints - 5);
      alert('漂流瓶已投入大海 🌊');
    } catch (e: any) {
      alert(e.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handlePickup = async () => {
    if (!userId) return;
    setPicking(true);
    try {
      const bottle = await pickupDriftBottle(userId);
      if (bottle) {
        addEmotionPoints(bottle.reward_amount);
        alert(`🎁 捡到漂流瓶！来自 ${bottle.sender_nickname}：${bottle.message}\n获得 ${bottle.reward_name} ×${bottle.reward_amount}！`);
        load();
      } else {
        alert('海面上没有漂流瓶...再等等吧 🌊');
      }
    } catch (e: any) {
      alert(e.message || '捡瓶子失败');
    } finally {
      setPicking(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-header">
        <h3>🌊 漂流瓶</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-tip">投放需 5 情绪值，捡瓶有概率获得奖励</div>
      <div className="drift-actions">
        <button className="btn-drift-send" onClick={handleSend} disabled={sending}>
          📜 投放漂流瓶
        </button>
        <button className="btn-drift-pickup" onClick={handlePickup} disabled={picking}>
          🏄 捡漂流瓶
        </button>
      </div>
      {loading ? <div className="modal-loading">加载中...</div> : (
        <div className="drift-list">
          {bottles.length === 0 && <div className="modal-empty">还没有漂流瓶</div>}
          {bottles.map((b) => (
            <div key={b.id} className="drift-item">
              <div className="drift-from">来自：{b.sender_nickname}</div>
              <div className="drift-msg">{b.message}</div>
            </div>
          ))}
        </div>
      )}
    </ModalOverlay>
  );
}

// ─── 商店 Modal ─────────────────────────────────────────────
function ShopModal({ onClose }: { onClose: () => void }) {
  const { userId, emotionPoints, setEmotionPoints, setActiveModal, setMatch3LevelId } = useGameStore();
  const [activeTab, setActiveTab] = useState<string>('food');
  const [tabs, setTabs] = useState<Record<string, any[]>>({});
  const [bgImage, setBgImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [match3Passed, setMatch3Passed] = useState<Record<number, boolean>>({});
  const [ownedFurnitureIds, setOwnedFurnitureIds] = useState<Set<number>>(new Set());
  const [successToast, setSuccessToast] = useState<any>(null); // 购买成功弹窗

  const SHOP_TABS = [
    { id: 'food', name: '🥘 食材' },
    { id: 'furniture', name: '🪑 家具' },
    { id: 'decoration', name: '✨ 装扮' },
    { id: 'map', name: '🗺️ 地图' },
    { id: 'toy', name: '🎨 潮玩' },
  ];

  useEffect(() => {
    Promise.all([
      fetch('/api/epet1/shop2/items').then(r => r.json()),
      fetch('/api/epet1/shop2/config').then(r => r.json()),
    ]).then(([itemsData, configData]) => {
      if (itemsData.ok) setTabs(itemsData.tabs);
      if (configData.ok && configData.config?.background_image) {
        setBgImage(configData.config.background_image);
      }
      setLoading(false);

      // 加载用户已拥有的家具 ID
      if (userId) {
        fetch(`/api/epet1/inventory/${userId}`)
          .then(r => r.json())
          .then(data => {
            if (data.ok) {
              const furn = (data.categories?.furniture || []) as any[];
              setOwnedFurnitureIds(new Set(furn.map(f => f.shop_item_id || f.id)));
            }
          })
          .catch(() => {});
      }

      // 检查有 match3_level_id 的商品是否已通关
      if (userId && itemsData.ok) {
        const allItems = Object.values(itemsData.tabs || {}).flat();
        const match3Items = allItems.filter((item: any) => item.match3_level_id);
        if (match3Items.length > 0) {
          Promise.all(
            match3Items.map((item: any) =>
              fetch(`/api/epet1/match3/check/${userId}/${item.id}`)
                .then(r => r.json())
                .then(data => ({ id: item.id, passed: data.passed || false }))
                .catch(() => ({ id: item.id, passed: false }))
            )
          ).then(results => {
            const passedMap: Record<number, boolean> = {};
            results.forEach(r => { passedMap[r.id] = r.passed; });
            setMatch3Passed(passedMap);
          });
        }
      }
    }).catch(() => setLoading(false));
  }, [userId]);

  const handleBuy = async (item: any) => {
    if (!userId) return;

    // 如果有 match3_level_id 且未通关，走消消乐流程
    if (item.match3_level_id && !match3Passed[item.id]) {
      setMatch3LevelId(item.match3_level_id, item.id);
      setActiveModal('match3');
      return;
    }

    if (emotionPoints < item.price_emotion) {
      alert(`情绪值不足！需要 ${item.price_emotion}，你有 ${emotionPoints}`);
      return;
    }
    if (item.stock === 0) { alert('该商品已售罄'); return; }
    setBuying(item.id);
    try {
      const res = await buyItem(userId, item.id);
      setEmotionPoints(res.remaining_emotion);
      if (item.item_category === 'furniture') {
        setOwnedFurnitureIds(prev => new Set([...prev, item.id]));
      }
      // 购买成功 → 显示成功弹窗
      setSuccessToast(item);
      setTimeout(() => setSuccessToast(null), 3000); // 3秒自动关闭
    } catch (e: any) {
      alert(e.message || '购买失败');
    } finally {
      setBuying(null);
    }
  };

  const items = tabs[activeTab] || [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: bgImage
        ? `url(${bgImage}) center/cover no-repeat`
        : 'linear-gradient(180deg, #FFF8F0 0%, #F0E6D6 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 顶部栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))',
        background: 'rgba(255,248,240,0.9)', borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#333' }}>🛍️ 商店</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#8B6914', fontWeight: 600 }}>💛 {emotionPoints}</span>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'rgba(0,0,0,0.08)', fontSize: 16, cursor: 'pointer', color: '#666',
          }}>✕</button>
        </div>
      </div>

      {/* Tab 栏 */}
      <div style={{
        display: 'flex', gap: 0, background: 'rgba(255,248,240,0.85)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {SHOP_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, minWidth: 60, padding: '10px 8px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#8B6914' : '#999',
              background: 'transparent',
              borderBottom: activeTab === tab.id ? '3px solid #8B6914' : '3px solid transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* 商品网格 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>暂无商品</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {items.map((item: any) => (
              <div key={item.id} style={{
                background: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: 10,
                textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 48, height: 48, margin: '0 auto 6px', borderRadius: 8,
                  background: 'rgba(0,0,0,0.04)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 28, overflow: 'hidden',
                }}>
                  {item.image_url
                    ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : '📦'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                  {item.match3_level_id && !match3Passed[item.id] && (
                    <span style={{
                      display: 'inline-block', marginLeft: 4, padding: '0 4px',
                      borderRadius: 4, fontSize: 9, verticalAlign: 'middle',
                      background: 'linear-gradient(135deg, #FF6B35, #FF4500)',
                      color: '#fff', fontWeight: 700,
                    }}>
                      消消乐
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#8B6914', fontWeight: 600, marginBottom: 6 }}>
                  💛 {item.price_emotion}
                </div>
                <button
                  onClick={() => handleBuy(item)}
                  disabled={buying === item.id || item.stock === 0 || (item.item_category === 'furniture' && ownedFurnitureIds.has(item.id)) || (emotionPoints < item.price_emotion && (!item.match3_level_id || match3Passed[item.id]))}
                  style={{
                    width: '100%', padding: '5px 0', border: 'none', borderRadius: 6,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: (buying === item.id || item.stock === 0 || (item.item_category === 'furniture' && ownedFurnitureIds.has(item.id)))
                      ? '#ddd' : item.match3_level_id && !match3Passed[item.id]
                      ? 'linear-gradient(135deg, #FF6B35, #FF4500)'
                      : 'linear-gradient(135deg, #FFD700, #FFA500)',
                    color: (buying === item.id || item.stock === 0 || (item.item_category === 'furniture' && ownedFurnitureIds.has(item.id))) ? '#999' : '#fff',
                  }}
                >
                  {item.stock === 0 ? '售罄' : (item.item_category === 'furniture' && ownedFurnitureIds.has(item.id)) ? '已购买' : buying === item.id ? '...' : item.match3_level_id && !match3Passed[item.id] ? '🎮 挑战解锁' : '购买'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 购买成功提示弹窗 — 遮罩 + 卡片 + 素材 */}
      {successToast && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
          animation: 'fadeIn 0.2s ease',
        }} onClick={() => setSuccessToast(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', width: '100%', maxWidth: 300,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            {/* 弹窗底卡背景 (icon-05) */}
            <img src="/epet/assets/shop-dialog-bg.png" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'fill', pointerEvents: 'none', borderRadius: 24,
            }} />

            <div style={{
              position: 'relative', width: '100%', padding: '36px 24px 28px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              {/* 关闭按钮 */}
              <button onClick={() => setSuccessToast(null)} style={{
                position: 'absolute', top: 10, right: 10, width: 24, height: 24,
                borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)',
                fontSize: 12, cursor: 'pointer', color: '#aaa', lineHeight: '24px', textAlign: 'center',
              }}>✕</button>

              {/* 顶部紫色装饰图标 (icon-07) */}
              <img src="/epet/assets/shop-icon-badge.png" style={{
                width: 72, height: 72, marginBottom: 16, objectFit: 'contain',
              }} />

              {/* 成功文字 */}
              <div style={{ fontSize: 18, fontWeight: 700, color: '#333', marginBottom: 8 }}>
                购买成功！
              </div>

              {/* 商品图片 */}
              <div style={{
                width: 88, height: 88, borderRadius: 16,
                background: 'linear-gradient(135deg, #EDE7F6, #E8DAEF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12, overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(149,117,205,0.2)',
              }}>
                {successToast.image_url
                  ? <img src={successToast.image_url} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 40 }}>📦</span>}
              </div>

              {/* 商品名称 */}
              <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 4 }}>
                {successToast.name}
              </div>

              {/* 已扣减提示 */}
              <div style={{ fontSize: 12, color: '#999', marginBottom: 24 }}>
                💛 已扣减 {successToast.price_emotion} 情绪值
              </div>

              {/* 确认按钮 (icon-06 粉色按钮) */}
              <button
                onClick={() => setSuccessToast(null)}
                style={{
                  position: 'relative', width: '65%', height: 42,
                  border: 'none', borderRadius: 21, fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', color: '#fff', overflow: 'hidden',
                  background: 'transparent',
                }}
              >
                <img src="/epet/assets/shop-btn-buy.png" style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', pointerEvents: 'none', borderRadius: 21,
                }} />
                <span style={{ position: 'relative', zIndex: 1 }}>好的</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 游戏 Modal ─────────────────────────────────────────────
function GameModal({ onClose }: { onClose: () => void }) {
  const { userId } = useGameStore();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [games] = useState([
    { id: 'fishing', name: '钓鱼', icon: '🎣', desc: '静待鱼儿上钩', status: 'ready' },
    { id: 'cooking', name: '料理', icon: '🍳', desc: '把食材变成料理', status: 'ready' },
    { id: 'spot', name: '找不同', icon: '🔍', desc: '找出两图的不同之处', status: 'ready' },
  ]);

  const handleGameScore = async (gameId: string, s: number) => {
    if (userId) {
      await recordGameScore(userId, gameId, s);
    }
  };

  // 钓鱼游戏全屏独立渲染
  if (selectedGame === 'fishing') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#0a1628',
      }}>
        <Fishing
          onScore={() => { setSelectedGame(null); }}
          userId={userId}
        />
      </div>
    );
  }

  // 料理游戏全屏独立渲染
  if (selectedGame === 'cooking') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #2a1a0e 100%)',
      }}>
        <Cooking onClose={() => setSelectedGame(null)} />
      </div>
    );
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-header">
        <h3>
          {selectedGame ? (
            <>
              <button className="btn-back" onClick={() => setSelectedGame(null)}>←</button>
              &nbsp;{games.find(g => g.id === selectedGame)?.name || '游戏'}
            </>
          ) : (
            '🎮 小游戏'
          )}
        </h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      {selectedGame === 'spot' && (
        <SpotDifference onScore={(s) => { handleGameScore('spot', s); setSelectedGame(null); }} />
      )}
      {!selectedGame && (
        <div className="game-list">
          {games.map((g) => (
            <div key={g.id} className={`game-item ${g.status === 'coming' ? 'coming' : ''}`} onClick={() => g.status === 'ready' && setSelectedGame(g.id)}>
              <div className="game-icon">{g.icon}</div>
              <div className="game-info">
                <div className="game-name">{g.name}</div>
                <div className="game-desc">{g.desc}</div>
              </div>
              {g.status === 'coming' ? (
                <span className="game-coming-label">开发中</span>
              ) : (
                <button className="btn-play">开始</button>
              )}
            </div>
          ))}
        </div>
      )}
    </ModalOverlay>
  );
}

// ─── 主页（庭院 PixiJS 渲染） ─────────────────────────────────
function HomePanel() {
  const { emotionPoints, yardPets, setChatPetId, setActiveModal, activeTravel,
          userId, placingFurniture, setPlacingFurniture, yardFurniture, setYardFurniture,
          addYardFurniture, removeYardFurniture, removingFurnitureMode, setRemovingFurnitureMode,
          setIntroVideoData } = useGameStore();
  const [toast, setToast] = useState('');
  const [otherExpanded, setOtherExpanded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<typeof gameInstance | null>(null);
  const petsRef = useRef<Map<string, PetInstance>>(new Map());
  const [gameReady, setGameReady] = useState(false);
  const [furnitureLoading, setFurnitureLoading] = useState(false);

  // Load emotion drops + render in game
  const loadEmotionDrops = useCallback(async (uid: number) => {
    try {
      const drops = await fetchEmotionDrops(uid);
      // Set icon URL from epet_icons if available
      const icons = usePixiGameStore.getState().icons;
      const dropIcon = icons['icon-emotion-drop'];
      gameRef.current?.setEmotionDropIcon(dropIcon?.url || null);
      gameRef.current?.renderEmotionDrops(drops);
    } catch (e) {
      console.error('[App] loadEmotionDrops error:', e);
    }
  }, []);

  // Init PixiJS game + sync on ready
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameRef.current) return;
    const g = gameInstance;
    gameRef.current = g;

    g.setCallbacks({
      onPetTap(petId) {
        const pet = petsRef.current.get(petId);
        if (!pet) return;
        console.log('[App] onPetTap:', petId, pet);
        setChatPetId(pet.id);
        // 先检查是否有开场视频
        (async () => {
          try {
            const res = await fetch(`/api/epet1/intro-video/match?pet_model_id=${pet.pet_model_id}&growth_level=${pet.growth_level}`);
            const data = await res.json();
            if (data.success && data.video) {
              setIntroVideoData(data.video);
              setActiveModal('intro-video');
            } else {
              setActiveModal('chat');
            }
          } catch {
            setActiveModal('chat');
          }
        })();
      },
      onReady() {
        setGameReady(true);
        // 启动定时行为轮询（每60秒查一次）
        g.startBehaviorPolling(60000);
        // 加载情绪值掉落
        const uid = useGameStore.getState().userId;
        if (uid) loadEmotionDrops(uid);
      },
      onFurniturePlaced(shopItemId, posX, posY) {
        const currentUserId = useGameStore.getState().userId;
        console.log('[App] onFurniturePlaced called:', { shopItemId, posX, posY, userId: currentUserId });
        if (!currentUserId) { console.log('[App] no userId, abort'); return; }
        setFurnitureLoading(true);
        const info = useGameStore.getState().placingFurniture;
        console.log('[App] placingFurniture info:', info);
        if (!info) { console.log('[App] no placingFurniture info, abort'); return; }
        placeFurniture(currentUserId, shopItemId, posX, posY, info.width, info.height)
          .then((placed) => {
            console.log('[App] placeFurniture success:', placed);
            addYardFurniture(placed);
            // Convert to SceneObjectData format for game rendering
            const sceneObj = {
              id: placed.id,
              label: placed.name || info.name,
              object_type: 'furniture',
              layer: 1,
              pos_x: parseFloat(String(placed.pos_x)),
              pos_y: parseFloat(String(placed.pos_y)),
              width: parseFloat(String(placed.width)),
              height: parseFloat(String(placed.height)),
              image_url: placed.image_url || info.imageUrl,
              collidable: true,
              sort_priority: 0,
              is_user_furniture: true,
              shop_item_id: placed.shop_item_id,
            };
            gameRef.current?.confirmPlacement(sceneObj);
            setPlacingFurniture(null);
            setToast(`🪑 ${info.name} 已放置到庭院`);
          })
          .catch((e: any) => {
            console.error('[App] placeFurniture error:', e);
            alert(e.message || '放置失败');
            gameRef.current?.cancelPlacing();
            setPlacingFurniture(null);
          })
          .finally(() => setFurnitureLoading(false));
      },
      onFurnitureRemove(furnitureId) {
        const currentUserId = useGameStore.getState().userId;
        if (!currentUserId) return;
        if (!confirm('确定要将此家具收回背包吗？')) return;
        removeFurniture(currentUserId, furnitureId)
          .then(() => {
            removeYardFurniture(furnitureId);
            gameRef.current?.removeFurnitureSprite(furnitureId);
            setToast('🪑 家具已收回背包');
            // Exit removing mode after one removal
            useGameStore.getState().setRemovingFurnitureMode(false);
          })
          .catch((e: any) => {
            alert(e.message || '收回失败');
          });
      },
      onFurnitureCancel() {
        setPlacingFurniture(null);
      },
      onEmotionDropCollect(dropId) {
        const currentUserId = useGameStore.getState().userId;
        if (!currentUserId) return;
        collectEmotionDrop(currentUserId, dropId)
          .then((res) => {
            gameRef.current?.removeEmotionDrop(dropId);
            addEmotionPoints(res.amount);
            setToast(`💛 +${res.amount} 情绪值！`);
          })
          .catch((e: any) => {
            console.error('[App] collectEmotionDrop error:', e);
          });
      },
    });

    g.init(canvas).catch(console.error);

    return () => {
      g.stopBehaviorPolling();
      g.destroy();
      gameRef.current = null;
    };
  }, []);


  // Sync yard pets to game (runs when gameReady or yardPets change)
  useEffect(() => {
    const g = gameRef.current;
    if (!g || !gameReady) return;

    const currentIds = new Set(g.petEntities.keys());
    const yardIds = new Set(yardPets.map(p => String(p.id)));

    // Remove pets not in yard
    currentIds.forEach(id => {
      if (!yardIds.has(id)) g.removePet(id);
    });

    // Add new pets with correct monsterType
    yardPets.forEach(p => {
      if (!currentIds.has(String(p.id))) {
        const petId = String(p.id);
        const monsterType = getMonsterType(p.pet_model_id);
        petsRef.current.set(petId, p);
        g.addPet(petId, monsterType, p.nickname, {
          modelId: p.pet_model_id,
          nickname: p.nickname,
          imageUrl: (p as any).image_url || getPetImage(p.pet_model_id),
          animations: (p as any).animations || {},
          sizeMult: (p as any).size_mult ?? 1.0,
          animConfig: (p as any).anim_config ?? {},
        });
      }
    });

    // 宠物列表变化后立即触发一次行为轮询
    if (yardPets.length > 0) {
      g.pollBehaviorsOnce?.();
    }
  }, [yardPets, gameReady]);

  // Sync removingFurnitureMode to game
  useEffect(() => {
    if (!gameRef.current) return;
    if (removingFurnitureMode) {
      gameRef.current.showRemoveButtons();
    } else {
      gameRef.current.hideRemoveButtons();
    }
  }, [removingFurnitureMode, gameReady]);

  // Poll emotion drops every 60s
  useEffect(() => {
    if (!gameReady || !userId) return;
    const iv = setInterval(() => {
      loadEmotionDrops(userId);
    }, 60000);
    return () => clearInterval(iv);
  }, [gameReady, userId, loadEmotionDrops]);

  return (
    <div className="home-panel">
      {/* 全屏 Canvas 庭院 */}
      <canvas ref={canvasRef} className="yard-canvas" />

      {/* 旅行横幅 */}
      {activeTravel && (
        <TravelBanner travel={activeTravel} onClick={() => setActiveModal('travel')} />
      )}

      {/* 左上角情绪值 */}
      <div className="emotion-badge">💛 {emotionPoints}</div>

      {/* 空庭院提示 */}
      {yardPets.length === 0 && (
        <div className="yard-empty-overlay">
          <div className="yard-empty-icon">🏡</div>
          <div className="yard-empty-text">庭院空空如也</div>
          <button className="btn-primary" onClick={() => setActiveModal('collection')}>
            去藏品库添加宠物
          </button>
        </div>
      )}

      {/* 右上角：其他 + 商店 */}
      <div className="top-right-area">
        <button className="top-right-btn" onClick={() => setActiveModal('shop')}>
          <IconImg iconKey="icon-shop" fallback="🛍️" />
        </button>
      </div>

      {/* 家具布置模式提示栏 */}
      {placingFurniture && (
        <div className="placing-bar">
          <span className="placing-hint">👆 点击庭院空地放置 {placingFurniture.name}</span>
          <button
            className="placing-cancel"
            onClick={() => {
              gameRef.current?.cancelPlacing();
              setPlacingFurniture(null);
            }}
          >
            取消
          </button>
        </div>
      )}

      {/* 家具回收模式提示栏 */}
      {removingFurnitureMode && !placingFurniture && (
        <div className="placing-bar" style={{ background: 'rgba(192,57,43,0.9)' }}>
          <span className="placing-hint">👆 点击家具上的 × 回收</span>
          <button
            className="placing-cancel"
            onClick={() => setRemovingFurnitureMode(false)}
          >
            取消
          </button>
        </div>
      )}

      {/* 底部菜单栏：明信片、藏品库、背包、小游戏 */}
      <div className="bottom-bar">
        <button className="bottom-bar-btn" onClick={() => setActiveModal('postcard')}>
          <IconImg iconKey="icon-postcard" fallback="💌" />
        </button>
        <button className="bottom-bar-btn" onClick={() => setActiveModal('collection')}>
          <IconImg iconKey="icon-collection" fallback="🏠" />
        </button>
        <button className="bottom-bar-btn" onClick={() => setActiveModal('inventory')}>
          <IconImg iconKey="icon-backpack" fallback="🎒" />
        </button>
        <button className="bottom-bar-btn" onClick={() => setActiveModal('game')}>
          <IconImg iconKey="icon-minigame" fallback="🎮" />
        </button>
      </div>

      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </div>
  );
}

// ─── 对话页（全屏）───────────────────────────────────────────
const TOUCH_AREA_LABELS: Record<string, string> = {
  head: '摸了摸头',
  belly: '摸了摸肚子',
  hands: '握了握手',
  feet: '挠了挠脚底',
};

function ChatPage({ onClose }: { onClose: () => void }) {
  console.log('[ChatPage] Rendering...');
  const {
    userId, yardPets, allPets, chatPetId,
    setYardPets, setActiveTravel, addEmotionPoints,
  } = useGameStore();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);

  // ═══════════════════════════════════════════════════
  // 开场视频已移到 App 层级，ChatPage 不再处理
  // ═══════════════════════════════════════════════════

  // 找到当前对话的宠物
  const pet = yardPets.find((p) => p.id === chatPetId) || allPets.find((p) => p.id === chatPetId) || yardPets[0];

  // ═══════════════════════════════════════════════════
  // 原有 ChatPage 逻辑
  // ═══════════════════════════════════════════════════

  // 最后一条助理消息（显示在回复框）
  const lastAssistantMessage = messages
    .filter(m => m.role === 'assistant')
    .slice(-1)[0]?.content || null;
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [traveling, setTraveling] = useState(false);
  const [chatBgUrl, setChatBgUrl] = useState<string | null>(null);
  const [petPulse, setPetPulse] = useState(false);
  const bubblesRef = useRef<HTMLDivElement>(null);

  // 消息更新时滚到底
  useEffect(() => {
    if (bubblesRef.current) {
      bubblesRef.current.scrollTop = bubblesRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // 加载互动页背景 (从 /api/game-assets/config 拿)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/game-assets/config', { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && data?.chatBg) setChatBgUrl(data.chatBg);
      } catch { /* fallback 用 CSS 背景色 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // (pet 已在上方定义)

  /** 通用发送逻辑 */
  const doSend = async (message?: string, touchArea?: string) => {
    if (!userId || !pet || sending) return;
    setSending(true);

    // 点击立绘时, 客户端组装"用户视角"消息 (不带 [系统] 前缀)
    let userBubble = '';
    if (touchArea) {
      userBubble = `🤚 ${TOUCH_AREA_LABELS[touchArea] || '摸了摸'}`;
      // 点击反馈
      setPetPulse(true);
      setTimeout(() => setPetPulse(false), 500);
    } else if (message) {
      userBubble = message;
    }

    if (userBubble) {
      setMessages((m) => [...m, { role: 'user', content: userBubble }]);
    }

    try {
      const { reply } = await sendChatMessage(userId, pet.id, message, touchArea);
      // 防御性: 剥离 LLM 偶尔回传的 [系统] 前缀
      const cleanReply = (reply || '').replace(/\[系统\][^\n]*\n?/g, '').trim() || '...';
      setMessages((m) => [...m, { role: 'assistant', content: cleanReply }]);
      addEmotionPoints(1);
    } catch (e: any) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: e.message?.includes('503') ? '（AI 服务未配置，对话功能暂不可用）' : '（网络出错了...）',
      }]);
    } finally {
      setSending(false);
    }
  };

  /** 文字发送 */
  const handleTextSend = () => {
    const msg = input.trim();
    if (!msg) return;
    setInput('');
    doSend(msg);
  };

  /** 抚摸宠物图片 */
  const handlePetTouch = (e: MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    let area: string;
    if (y < 0.28) {
      area = 'head';
    } else if (y >= 0.72) {
      area = 'feet';
    } else if (x < 0.25 || x > 0.75) {
      area = 'hands';
    } else {
      area = 'belly';
    }
    doSend(undefined, area);
  };

  /** 派去旅游 */
  const handleTravel = async () => {
    if (!userId || !pet || traveling) return;
    if (!yardPets.some((p) => p.id === pet.id)) {
      alert('宠物正在旅行中，无法再次派遣');
      return;
    }
    // 跳转到旅行 Modal（带预选宠物）
    useGameStore.getState().setActiveModal('travel');
  };


  if (!pet) {
    return (
      <div
        className="chat-page"
        style={chatBgUrl ? { backgroundImage: `url(${chatBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <div className="chat-topbar">
          <button className="chat-topbar-btn" onClick={onClose}>← 返回</button>
        </div>
        <div className="chat-empty">请先在庭院中选择一只宠物</div>
      </div>
    );
  }

  return (
    <div
      className="chat-page"
      style={chatBgUrl ? { backgroundImage: `url(${chatBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* 顶部栏 — 始终可见，flex-shrink:0 */}
      <div className="chat-topbar">
        <button className="chat-topbar-btn" onClick={onClose}>← 返回</button>
        <span className="chat-topbar-title">{pet.nickname}</span>
        <button
          className="chat-topbar-btn chat-topbar-travel"
          onClick={handleTravel}
          disabled={traveling}
        >
          ✈️ 派遣旅行
        </button>
      </div>

      {/* 宠物展示区 — flex:1，自动占据剩余空间 */}
      <div className={`chat-pet-area${petPulse ? ' pet-pulse' : ''}`}>
        <div className="chat-pet-hint">👆 点击宠物不同部位互动</div>
        <img
          className="chat-pet-img"
          src={getPetPortrait(pet)}
          alt={pet.nickname}
          draggable={false}
          onClick={handlePetTouch}
        />
      </div>

      {/* 宠物回复文本框 — flex-shrink:0，始终可见 */}
      <div className="chat-response-box">
        {lastAssistantMessage ? (
          <p className="chat-response-text">{lastAssistantMessage}</p>
        ) : sending ? (
          <p className="chat-response-text typing">宠物正在思考</p>
        ) : (
          <p className="chat-response-text chat-response-empty">摸摸宠物或发消息开始对话吧~</p>
        )}
      </div>

      {/* 底部输入栏 — flex-shrink:0，始终可见 */}
      <div className="chat-input-bar">
        <input
          className="chat-input-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
          placeholder="和宠物说点什么..."
          disabled={sending}
        />
        <button
          className="chat-send-btn"
          onClick={handleTextSend}
          disabled={sending || !input.trim()}
        >
          发送
        </button>
      </div>
    </div>
  );
}

// ─── App 根组件 ──────────────────────────────────────────────
export default function App() {
  const { setUser, setYardPets, setAllPets, setActiveTravel, setLoading, activeModal, setActiveModal,
          setYardFurniture, introVideoData, setIntroVideoData, match3LevelId, userId, chatPetId,
          fullscreenVideoUrl, setFullscreenVideoUrl } = useGameStore();

  useEffect(() => {
    const init = async () => {
      try {
        const user = await getOrCreateUser();
        setUser(user.user_id, user.emotion_points);

        // 保存 user_id 到 localStorage 供 Game.ts 场景加载使用
        localStorage.setItem('epet_user_id', String(user.user_id));

        const [yardPets, allPets, travel, yardFurn] = await Promise.all([
          fetchYardPets(user.user_id),
          fetchUserPets(user.user_id),
          fetchTravelStatus(user.user_id),
          fetchYardFurniture(user.user_id),
        ]);
        setYardPets(yardPets);
        setAllPets(allPets);
        setActiveTravel(travel);
        setYardFurniture(yardFurn);
      } catch (e) {
        console.error('init failed', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  return (
    <div className="app">
      <div className="scene-bg" />
      <div className="app-content">
        <HomePanel />
      </div>

      {/* Modals */}
      {activeModal === 'collection' && <CollectionModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'postcard' && <PostcardModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'travel' && <TravelModal onClose={() => setActiveModal(null)} preselectedPetId={chatPetId ?? undefined} />}
      {activeModal === 'drift' && <DriftModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'shop' && <ShopModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'inventory' && <InventoryModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'game' && <GameModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'match3' && match3LevelId && (
        <Match3Game
          levelId={match3LevelId}
          userId={userId || 0}
          onPass={(score) => {
            // 通关后自动触发购买
            const shopItemId = useGameStore.getState().match3ShopItemId;
            if (shopItemId && userId) {
              buyItem(userId, shopItemId)
                .then(res => {
                  useGameStore.getState().setEmotionPoints(res.remaining_emotion);
                  alert(`🎉 通关！购买成功！`);
                })
                .catch(e => alert(e.message || '购买失败'));
            }
            useGameStore.getState().setMatch3LevelId(null);
            setActiveModal(null);
          }}
          onFail={(score) => {
            useGameStore.getState().setMatch3LevelId(null);
            setActiveModal(null);
          }}
          onQuit={() => {
            useGameStore.getState().setMatch3LevelId(null);
            setActiveModal(null);
          }}
        />
      )}
      {activeModal === 'intro-video' && introVideoData && createPortal(
        <IntroVideoPlayer
          video={introVideoData}
          onComplete={() => {
            setIntroVideoData(null);
            setActiveModal('chat');
          }}
        />,
        document.body
      )}
      {activeModal === 'chat' && <ChatPage onClose={() => { setActiveModal(null); }} />}
      {/* 全屏明信片视频播放器 */}
      {fullscreenVideoUrl && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#000', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <video
            src={fullscreenVideoUrl}
            controls
            autoPlay
            playsInline
            onEnded={() => setFullscreenVideoUrl(null)}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          <button
            onClick={() => setFullscreenVideoUrl(null)}
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 10,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)', border: 'none',
              color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>,
        document.body
      )}
    </div>
  );
}
