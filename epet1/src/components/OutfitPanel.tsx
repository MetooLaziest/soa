/**
 * OutfitPanel — 装扮装备/卸下面板 (底部抽屉)
 *
 * - 顶部: 机伴名 + 4 个装备槽位指示器 (hat/accessory/back/body)
 * - 中部: 拥有装扮网格 (兼容当前机伴型号)
 * - 底部: 选中装扮后 "装备" 按钮；已有装备的槽位显示 ✕ 卸装按钮
 * - 装备/卸装后调用 gameInstance.updatePetOutfits() 即时刷新渲染
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchOutfitInventory,
  fetchEquippedOutfits,
  equipOutfit,
  unequipOutfit,
  fetchCompatibleOutfits,
  type OutfitItem,
  type EquippedOutfit,
} from '../api/epet1';
import { useGameStore } from '../store/gameStore';

interface OutfitPanelProps {
  petId: number;
  petModelId: number;
  petName: string;
  onClose: () => void;
  gameRef: any; // Game instance ref
}

const SLOT_LABELS: Record<string, string> = {
  hat: '🎩 头饰',
  accessory: '💍 配饰',
  back: '🦋 背饰',
  body: '👗 身体',
};

const SLOT_ORDER = ['hat', 'accessory', 'back', 'body'];

export function OutfitPanel({ petId, petModelId, petName, onClose, gameRef }: OutfitPanelProps) {
  const userId = useGameStore(s => s.userId);
  const [inventory, setInventory] = useState<OutfitItem[]>([]);
  const [equipped, setEquipped] = useState<EquippedOutfit[]>([]);
  const [selectedItem, setSelectedItem] = useState<OutfitItem | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [inv, eq, compat] = await Promise.all([
        fetchOutfitInventory(userId),
        fetchEquippedOutfits(petId),
        fetchCompatibleOutfits(petModelId),
      ]);
      // Filter inventory to only show compatible items
      const compatIds = new Set(compat.map(c => c.shop_item_id));
      const filtered = inv.filter(i => compatIds.has(i.shop_item_id));
      setInventory(filtered);
      setEquipped(eq);
    } catch (e) {
      console.error('[OutfitPanel] load error:', e);
    }
    setLoading(false);
  }, [userId, petId, petModelId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build a map of slot → equipped item
  const equippedBySlot = Object.fromEntries(equipped.map(e => [e.equip_slot, e]));

  const handleEquip = async () => {
    if (!selectedItem) return;
    setLoading(true);
    try {
      await equipOutfit(petId, selectedItem.shop_item_id, selectedItem.equip_slot);
      await loadData();
      syncGameOutfits();
    } catch (e) {
      console.error('[OutfitPanel] equip error:', e);
    }
    setLoading(false);
  };

  const handleUnequip = async (slot: string) => {
    setLoading(true);
    try {
      await unequipOutfit(petId, slot);
      await loadData();
      syncGameOutfits();
    } catch (e) {
      console.error('[OutfitPanel] unequip error:', e);
    }
    setLoading(false);
  };

  const syncGameOutfits = () => {
    // Refresh game rendering with current equipped state
    const currentEquipped = useGameStore.getState().showPetActionOverlay;
    if (gameRef && petId) {
      // Re-fetch equipped and update game
      fetchEquippedOutfits(petId).then(eq => {
        gameRef.updatePetOutfits?.(String(petId), eq.map(e => ({
          equipSlot: e.equip_slot,
          shopItemId: e.outfit_shop_item_id,
          animations: e.animations || {},
          anchorOverride: e.anchor_override,
        })));
      });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: 'white',
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        maxHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.25s ease-out',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
      }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>👔 {petName} 的装扮</span>
        <button onClick={onClose} style={{
          border: 'none', background: '#f5f5f5', borderRadius: '50%',
          width: 28, height: 28, cursor: 'pointer', fontSize: 14,
        }}>✕</button>
      </div>

      {/* Slot indicators */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f0',
      }}>
        {SLOT_ORDER.map(slot => {
          const eq = equippedBySlot[slot];
          return (
            <div key={slot} style={{
              flex: 1, textAlign: 'center', padding: '6px 4px',
              borderRadius: 8, background: eq ? '#e8f5e9' : '#f5f5f5',
              fontSize: 11,
            }}>
              <div>{SLOT_LABELS[slot]}</div>
              {eq && (
                <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#666' }}>{eq.name}</span>
                  <button onClick={() => handleUnequip(slot)} style={{
                    border: 'none', background: '#ff5252', color: 'white',
                    borderRadius: '50%', width: 16, height: 16, fontSize: 10,
                    cursor: 'pointer', lineHeight: '16px', padding: 0,
                  }}>✕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inventory grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px 16px',
      }}>
        {loading && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>加载中...</div>}
        {!loading && inventory.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
            暂无兼容装扮，去商店看看吧 🛍️
          </div>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}>
          {inventory.map(item => {
            const isEquipped = equippedBySlot[item.equip_slot]?.outfit_shop_item_id === item.shop_item_id;
            const isSelected = selectedItem?.shop_item_id === item.shop_item_id;
            return (
              <div
                key={item.shop_item_id}
                onClick={() => setSelectedItem(isSelected ? null : item)}
                style={{
                  border: isSelected ? '2px solid #4caf50' : '2px solid #eee',
                  borderRadius: 8,
                  padding: 6,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isEquipped ? '#e8f5e9' : 'white',
                  opacity: isEquipped && !isSelected ? 0.7 : 1,
                }}
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: 40, height: 40, lineHeight: '40px', fontSize: 20 }}>👕</div>
                )}
                <div style={{ fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 9, color: '#999' }}>{SLOT_LABELS[item.equip_slot] || item.equip_slot}</div>
                {isEquipped && <div style={{ fontSize: 9, color: '#4caf50' }}>已装备</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action button */}
      {selectedItem && !equippedBySlot[selectedItem.equip_slot]?.outfit_shop_item_id && (
        <div style={{ padding: '8px 16px 16px' }}>
          <button
            onClick={handleEquip}
            disabled={loading}
            style={{
              width: '100%', padding: '10px', border: 'none', borderRadius: 8,
              background: '#4caf50', color: 'white', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            装备「{selectedItem.name}」→ {SLOT_LABELS[selectedItem.equip_slot]}
          </button>
        </div>
      )}
    </div>
  );
}
