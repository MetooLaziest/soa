import { useEffect, useState, useCallback, useRef, type ReactNode, type MouseEvent, type KeyboardEvent, type ChangeEvent, type FormEvent } from 'react';
import { useGameStore } from './store/gameStore';
import SpotDifference from './games/SpotDifference';
import Fishing from './games/Fishing';
import CookFish from './games/CookFish';
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
} from './api/epet1';
import type { PetInstance, Postcard, DriftBottle, ShopItem, YardFurniture } from './api/epet1';
import { gameInstance, type PlacingFurnitureInfo } from './game/Game';
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
                  <div className="collection-card-name">{pet.nickname}</div>
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

// ─── 明信片 Modal ───────────────────────────────────────────
function PostcardModal({ onClose }: { onClose: () => void }) {
  const { userId } = useGameStore();
  const [postcards, setPostcards] = useState<Postcard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchPostcards(userId).then((p) => { setPostcards(p); setLoading(false); }).catch(() => setLoading(false));
  }, [userId]);

  const rarityColor: Record<string, string> = { N: '#aaa', R: '#4CAF50', SR: '#2196F3', SSR: '#FF9800', UR: '#E91E63' };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-header">
        <h3>💌 明信片收藏</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      {loading ? <div className="modal-loading">加载中...</div> : (
        <>
          <div className="modal-tip">共 {postcards.filter(p => p.obtained).length} / {postcards.length} 张</div>
          <div className="postcard-grid">
            {postcards.map((pc) => (
              <div key={pc.id} className="postcard-item" style={{ opacity: pc.obtained ? 1 : 0.35 }}>
                <div className="postcard-img" style={{ borderColor: rarityColor[pc.rarity] }}>
                  {pc.obtained ? RARITY_EMOJI[pc.rarity] : '❓'}
                </div>
                <div className="postcard-name">{pc.obtained ? pc.name : '???'}</div>
                <div className="postcard-rarity" style={{ color: rarityColor[pc.rarity] }}>{pc.rarity} · ×{pc.count}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </ModalOverlay>
  );
}

// ─── 旅行 Modal ─────────────────────────────────────────────
function TravelModal({ onClose }: { onClose: () => void }) {
  const { userId, yardPets, activeTravel, setActiveTravel, setYardPets } = useGameStore();
  const [starting, setStarting] = useState<number | null>(null);

  const handleStart = async (petId: number) => {
    if (!userId) return;
    setStarting(petId);
    try {
      const record = await startTravel(userId, petId);
      setActiveTravel(record);
      setYardPets(yardPets.filter((p) => p.id !== petId));
    } catch (e: any) {
      alert(e.message || '出游失败');
    } finally {
      setStarting(null);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-header">
        <h3>✈️ 旅行青蛙</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>

      {activeTravel ? (
        <div className="travel-active">
          <div className="travel-status">🛫 {activeTravel.pet_nickname} 正在旅行中...</div>
          <div className="travel-timer">12 小时后归来</div>
          <button className="btn-primary" disabled>归来时通知你</button>
        </div>
      ) : (
        <>
          <div className="modal-tip">选择一只宠物送它去旅行，回来会带明信片</div>
          {yardPets.length === 0 ? (
            <div className="modal-empty">庭院没有宠物，先去藏品库添加宠物吧</div>
          ) : (
            <div className="travel-pet-list">
              {yardPets.map((pet) => (
                <div key={pet.id} className="travel-pet-item">
                  <img src={getPetPortrait(pet)} alt={pet.nickname} />
                  <div className="travel-pet-info">
                    <div className="travel-pet-name">{pet.nickname}</div>
                    <div className="travel-pet-level">Lv.{pet.growth_level}</div>
                  </div>
                  <button
                    className="btn-travel-start"
                    onClick={() => handleStart(pet.id)}
                    disabled={starting === pet.id}
                  >
                    {starting === pet.id ? '出发中...' : '✈️ 出发'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ModalOverlay>
  );
}

// ─── 背包 Modal ────────────────────────────────────────────
const INV_TABS = [
  { id: 'food', name: '🥘 食材', empty: '还没有食材，去钓鱼或商店看看吧' },
  { id: 'furniture', name: '🪑 家具', empty: '还没有家具，去商店看看吧' },
  { id: 'postcard', name: '💌 明信片', empty: '还没有明信片，送宠物去旅行吧' },
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
  const { userId, placingFurniture, setPlacingFurniture, yardFurniture, setYardFurniture, addYardFurniture, removeYardFurniture } = useGameStore();
  const [activeTab, setActiveTab] = useState<'food' | 'furniture' | 'postcard'>('food');
  const [inventory, setInventory] = useState<{ food: any[]; furniture: any[]; postcard: any[] }>({ food: [], furniture: [], postcard: [] });

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
    const defaultSize = FURNITURE_DEFAULT_SIZE[item.name] || { width: 0.08, height: 0.12 };
    const info: PlacingFurnitureInfo = {
      shopItemId: item.shop_item_id || item.id,
      name: item.name,
      imageUrl: item.image_url || '',
      width: defaultSize.width,
      height: defaultSize.height,
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
            }}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* 内容区 */}
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
            }}>
              <div style={{
                width: 48, height: 48, margin: '0 auto 6px', borderRadius: 8,
                background: 'rgba(0,0,0,0.06)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 28,
                backgroundImage: item.image_url ? `url(${item.image_url})` : undefined,
                backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
              }}>
                {!item.image_url && (activeTab === 'postcard' ? '💌' : activeTab === 'food' ? '🐟' : '🪑')}
              </div>
              <div style={{ color: '#333', fontSize: 12, fontWeight: 600, marginBottom: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </div>
              {item.quantity !== undefined && (
                <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 10 }}>×{item.quantity}</div>
              )}
              {/* 家具布置按钮 */}
              {activeTab === 'furniture' && (
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
  const { userId, emotionPoints, setEmotionPoints } = useGameStore();
  const [activeTab, setActiveTab] = useState<string>('food');
  const [tabs, setTabs] = useState<Record<string, any[]>>({});
  const [bgImage, setBgImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);

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
    }).catch(() => setLoading(false));
  }, []);

  const handleBuy = async (item: any) => {
    if (!userId) return;
    if (emotionPoints < item.price_emotion) {
      alert(`情绪值不足！需要 ${item.price_emotion}，你有 ${emotionPoints}`);
      return;
    }
    if (item.stock === 0) { alert('该商品已售罄'); return; }
    setBuying(item.id);
    try {
      const res = await buyItem(userId, item.id);
      setEmotionPoints(res.remaining_emotion);
      alert(`✅ 购买成功！${item.name}`);
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
                </div>
                <div style={{ fontSize: 11, color: '#8B6914', fontWeight: 600, marginBottom: 6 }}>
                  💛 {item.price_emotion}
                </div>
                <button
                  onClick={() => handleBuy(item)}
                  disabled={buying === item.id || emotionPoints < item.price_emotion || item.stock === 0}
                  style={{
                    width: '100%', padding: '5px 0', border: 'none', borderRadius: 6,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: (buying === item.id || emotionPoints < item.price_emotion || item.stock === 0)
                      ? '#ddd' : 'linear-gradient(135deg, #FFD700, #FFA500)',
                    color: (buying === item.id || emotionPoints < item.price_emotion || item.stock === 0)
                      ? '#999' : '#fff',
                  }}
                >
                  {item.stock === 0 ? '售罄' : buying === item.id ? '...' : '购买'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 游戏 Modal ─────────────────────────────────────────────
function GameModal({ onClose }: { onClose: () => void }) {
  const { userId } = useGameStore();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [games] = useState([
    { id: 'fishing', name: '钓鱼', icon: '🎣', desc: '静待鱼儿上钩', status: 'ready' },
    { id: 'cook', name: '煎鱼小游戏', icon: '🐟', desc: '控制火候，煎出完美鱼', status: 'ready' },
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
      {selectedGame === 'cook' && (
        <CookFish onScore={(s) => { handleGameScore('cook', s); setSelectedGame(null); }} />
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
          addYardFurniture, removeYardFurniture } = useGameStore();
  const [toast, setToast] = useState('');
  const [otherExpanded, setOtherExpanded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<typeof gameInstance | null>(null);
  const petsRef = useRef<Map<string, PetInstance>>(new Map());
  const [gameReady, setGameReady] = useState(false);
  const [furnitureLoading, setFurnitureLoading] = useState(false);

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
        // 直接进入互动页（可抚摸+对话）
        setChatPetId(pet.id);
        setActiveModal('chat');
        console.log('[App] chatPetId set, activeModal=chat');
      },
      onReady() {
        setGameReady(true);
      },
      onFurniturePlaced(shopItemId, posX, posY) {
        if (!userId) return;
        setFurnitureLoading(true);
        const info = useGameStore.getState().placingFurniture;
        if (!info) return;
        placeFurniture(userId, shopItemId, posX, posY, info.width, info.height)
          .then((placed) => {
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
            alert(e.message || '放置失败');
            gameRef.current?.cancelPlacing();
            setPlacingFurniture(null);
          })
          .finally(() => setFurnitureLoading(false));
      },
      onFurnitureRemove(furnitureId) {
        if (!userId) return;
        if (!confirm('确定要将此家具收回背包吗？')) return;
        removeFurniture(userId, furnitureId)
          .then(() => {
            removeYardFurniture(furnitureId);
            gameRef.current?.removeFurnitureSprite(furnitureId);
            setToast('🪑 家具已收回背包');
          })
          .catch((e: any) => {
            alert(e.message || '收回失败');
          });
      },
      onFurnitureCancel() {
        setPlacingFurniture(null);
      },
    });

    g.init(canvas).catch(console.error);

    return () => {
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
        });
      }
    });
  }, [yardPets, gameReady]);

  return (
    <div className="home-panel">
      {/* 全屏 Canvas 庭院 */}
      <canvas ref={canvasRef} className="yard-canvas" />

      {/* 旅行横幅 */}
      {activeTravel && (
        <div className="travel-banner" onClick={() => setActiveModal('travel')}>
          ✈️ {activeTravel.pet_nickname} 正在旅行中... 点击查看
        </div>
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
        {otherExpanded && (
          <div className="other-menu">
            <button className="other-menu-item" onClick={() => { alert('功能开发中'); setOtherExpanded(false); }}>
              📱 打开小程序
            </button>
            <button className="other-menu-item" onClick={() => { alert('功能开发中'); setOtherExpanded(false); }}>
              🔗 绑定智能设备
            </button>
          </div>
        )}
        <button className="top-right-btn" onClick={() => setOtherExpanded(v => !v)}>
          <span className="top-right-btn-icon">☰</span>
          <span className="top-right-btn-label">其他</span>
        </button>
        <button className="top-right-btn" onClick={() => setActiveModal('shop')}>
          <span className="top-right-btn-icon">🛍️</span>
          <span className="top-right-btn-label">商店</span>
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

      {/* 底部菜单栏：漂流瓶、藏品库、背包、小游戏 */}
      <div className="bottom-bar">
        <button className="bottom-bar-btn" onClick={() => setActiveModal('drift')}>
          <span className="bottom-bar-icon">🌊</span>
          <span className="bottom-bar-label">漂流瓶</span>
        </button>
        <button className="bottom-bar-btn" onClick={() => setActiveModal('collection')}>
          <span className="bottom-bar-icon">🏠</span>
          <span className="bottom-bar-label">藏品库</span>
        </button>
        <button className="bottom-bar-btn" onClick={() => setActiveModal('inventory')}>
          <span className="bottom-bar-icon">🎒</span>
          <span className="bottom-bar-label">背包</span>
        </button>
        <button className="bottom-bar-btn" onClick={() => setActiveModal('game')}>
          <span className="bottom-bar-icon">🎮</span>
          <span className="bottom-bar-label">小游戏</span>
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

  // 找到当前对话的宠物
  const pet = yardPets.find((p) => p.id === chatPetId) || allPets.find((p) => p.id === chatPetId) || yardPets[0];

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
      alert('该宠物不在庭院中，无法出游');
      return;
    }
    setTraveling(true);
    try {
      const record = await startTravel(userId, pet.id);
      setYardPets(yardPets.filter((p) => p.id !== pet.id));
      setActiveTravel(record);
      onClose();
    } catch (e: any) {
      alert(e.message || '出游失败');
    } finally {
      setTraveling(false);
    }
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
      {/* 顶部栏 */}
      <div className="chat-topbar">
        <button className="chat-topbar-btn" onClick={onClose}>← 返回</button>
        <span className="chat-topbar-title">{pet.nickname}</span>
        <button
          className="chat-topbar-btn chat-topbar-travel"
          onClick={handleTravel}
          disabled={traveling}
        >
          ✈️ 派去旅游
        </button>
      </div>

      {/* 宠物大图 */}
      <div
        className={`chat-pet-area${petPulse ? ' pet-pulse' : ''}`}
        onClick={handlePetTouch}
      >
        <img
          className="chat-pet-img"
          src={getPetPortrait(pet)}
          alt={pet.nickname}
          draggable={false}
        />
      </div>

      <div className="chat-pet-hint">👆 点击宠物不同部位互动</div>

      {/* 宠物回复文本框（最新一条） */}
      <div className="chat-response-box">
        {lastAssistantMessage ? (
          <p className="chat-response-text">{lastAssistantMessage}</p>
        ) : sending ? (
          <p className="chat-response-text typing">宠物正在思考</p>
        ) : (
          <p className="chat-response-text chat-response-empty">摸摸宠物或发消息开始对话吧~</p>
        )}
      </div>


      {/* 底部输入栏 */}
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
          setYardFurniture } = useGameStore();

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
      {activeModal === 'travel' && <TravelModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'drift' && <DriftModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'shop' && <ShopModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'inventory' && <InventoryModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'game' && <GameModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'chat' && <ChatPage onClose={() => { setActiveModal(null); }} />}
    </div>
  );
}
