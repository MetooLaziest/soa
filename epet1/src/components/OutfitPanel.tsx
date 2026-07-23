/**
 * OutfitPanel — 装扮面板 (全屏覆盖, 套装模式)
 *
 * 左侧: 机伴当前形象预览
 * 右侧: 可替换装扮列表
 *   - 首格: 「去除装扮」
 *   - 点击装扮 → 预览效果 (即时渲染到游戏 canvas)
 *   - 点击确认 → 调 API 完成装扮
 *   - 点击取消 → 恢复原装扮
 *
 * 套装模式: 每只宠物最多穿 1 套装扮, 替换身体帧
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
}

export function OutfitPanel({ petId, petModelId, petName, onClose }: OutfitPanelProps) {
  const userId = useGameStore(s => s.userId);
  const gameRef = useGameStore(s => s.gameRef);
  const petModels = useGameStore(s => s.petModels);
  const [inventory, setInventory] = useState<OutfitItem[]>([]);
  const [equipped, setEquipped] = useState<EquippedOutfit | null>(null);
  const [previewing, setPreviewing] = useState<EquippedOutfit | null | 'remove'>(null);
  const [selectedItem, setSelectedItem] = useState<OutfitItem | 'remove' | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Store original equipped state for cancel/restore
  const originalEquippedRef = useRef<EquippedOutfit | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [inv, eq, compat] = await Promise.all([
        fetchOutfitInventory(userId),
        fetchEquippedOutfits(petId),
        fetchCompatibleOutfits(petModelId),
      ]);
      const compatIds = new Set(compat.map(c => c.shop_item_id));
      const filtered = inv.filter(i => compatIds.has(i.shop_item_id));
      setInventory(filtered);
      setEquipped(eq);
      originalEquippedRef.current = eq;
    } catch (e) {
      console.error('[OutfitPanel] load error:', e);
    }
    setLoading(false);
  }, [userId, petId, petModelId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Get pet model image for preview
  const petModel = petModels.find(m => m.id === petModelId);
  const petImageUrl = petModel?.image_url || '';

  /** Sync game rendering with given outfit or null */
  const syncGameOutfits = (eq: EquippedOutfit | null) => {
    if (gameRef && petId) {
      if (eq) {
        gameRef.updatePetOutfits?.(String(petId), {
          shopItemId: eq.outfit_shop_item_id,
          animations: eq.animations || {},
          anchorOffset: eq.anchor_override?.offset as [number, number] | undefined,
        });
      } else {
        gameRef.updatePetOutfits?.(String(petId), null);
      }
    }
  };

  /** Preview an outfit item (update game rendering temporarily) */
  const handlePreview = (item: OutfitItem | 'remove') => {
    setSelectedItem(item);
    if (item === 'remove') {
      setPreviewing('remove');
      syncGameOutfits(null);
      return;
    }
    const previewItem: EquippedOutfit = {
      id: -1,
      outfit_shop_item_id: item.shop_item_id,
      equipped_at: '',
      name: item.name,
      image_url: item.image_url,
      description: item.description,
    };
    setPreviewing(previewItem);
    syncGameOutfits(previewItem);
  };

  /** Confirm: apply the previewed outfit via API */
  const handleConfirm = async () => {
    if (!selectedItem) return;
    setConfirming(true);
    try {
      if (selectedItem === 'remove') {
        // Unequip current outfit
        await unequipOutfit(petId);
      } else {
        // Equip the selected outfit (replaces any existing)
        await equipOutfit(petId, selectedItem.shop_item_id);
      }
      // Reload to get authoritative state
      await loadData();
      setSelectedItem(null);
      setPreviewing(null);
    } catch (e) {
      console.error('[OutfitPanel] confirm error:', e);
    }
    setConfirming(false);
  };

  /** Cancel: restore original outfits */
  const handleCancel = () => {
    if (previewing) {
      syncGameOutfits(originalEquippedRef.current);
      setPreviewing(null);
    }
    setSelectedItem(null);
  };

  /** Close panel and restore if there's an unconfirmed preview */
  const handleClose = () => {
    if (previewing) {
      syncGameOutfits(originalEquippedRef.current);
    }
    onClose();
  };

  // Current display outfit (preview or real)
  const displayOutfit = previewing === 'remove' ? null : (previewing || equipped);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          maxHeight: '75vh',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.25s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #eee',
        }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>👔 {petName} 的装扮</span>
          <button onClick={handleClose} style={{
            border: 'none', background: '#f5f5f5', borderRadius: '50%',
            width: 28, height: 28, cursor: 'pointer', fontSize: 14,
          }}>✕</button>
        </div>

        {/* Main content: left preview + right list */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: Pet preview */}
          <div style={{
            width: 120, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-start', padding: '16px 8px',
            background: '#f9f9f9', borderRight: '1px solid #f0f0f0',
          }}>
            {petImageUrl ? (
              <img src={petImageUrl} alt={petName} style={{
                width: 90, height: 90, objectFit: 'contain',
                borderRadius: 12, background: '#fff', padding: 4,
              }} />
            ) : (
              <div style={{
                width: 90, height: 90, lineHeight: '90px',
                textAlign: 'center', fontSize: 40, background: '#fff',
                borderRadius: 12,
              }}>🐾</div>
            )}
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, textAlign: 'center' }}>
              {petName}
            </div>
            {/* Current equipped outfit */}
            <div style={{ marginTop: 8, width: '100%' }}>
              {displayOutfit ? (
                <div style={{
                  fontSize: 10, color: '#666', padding: '2px 4px',
                  background: '#e8f5e9', borderRadius: 4,
                  textAlign: 'center',
                }}>
                  👗 {displayOutfit.name}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#999', textAlign: 'center' }}>
                  未穿戴装扮
                </div>
              )}
            </div>
          </div>

          {/* Right: Outfit list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            {loading && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>加载中...</div>}

            {!loading && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}>
                {/* First item: Remove outfit */}
                <div
                  onClick={() => handlePreview('remove')}
                  style={{
                    border: selectedItem === 'remove' ? '2px solid #f44336' : '2px solid #eee',
                    borderRadius: 8, padding: 6, textAlign: 'center',
                    cursor: 'pointer', background: selectedItem === 'remove' ? '#fff3e0' : '#fafafa',
                  }}
                >
                  <div style={{ width: 40, height: 40, lineHeight: '40px', fontSize: 18, margin: '0 auto' }}>
                    🚫
                  </div>
                  <div style={{ fontSize: 10, marginTop: 2, color: '#999' }}>去除装扮</div>
                </div>

                {/* Outfit items */}
                {inventory.map(item => {
                  const isEquipped = equipped?.outfit_shop_item_id === item.shop_item_id;
                  const isSelected = selectedItem !== 'remove' && (selectedItem as OutfitItem)?.shop_item_id === item.shop_item_id;
                  return (
                    <div
                      key={item.shop_item_id}
                      onClick={() => handlePreview(item)}
                      style={{
                        border: isSelected ? '2px solid #4caf50' : '2px solid #eee',
                        borderRadius: 8, padding: 6, textAlign: 'center',
                        cursor: 'pointer',
                        background: isEquipped ? '#e8f5e9' : 'white',
                        opacity: isEquipped && !isSelected ? 0.7 : 1,
                      }}
                    >
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={{
                          width: 40, height: 40, objectFit: 'contain', display: 'block', margin: '0 auto',
                        }} />
                      ) : (
                        <div style={{ width: 40, height: 40, lineHeight: '40px', fontSize: 20, margin: '0 auto' }}>👕</div>
                      )}
                      <div style={{
                        fontSize: 10, marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.name}
                      </div>
                      {isEquipped && <div style={{ fontSize: 9, color: '#4caf50' }}>已装备</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && inventory.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                暂无兼容装扮，去商店看看吧 🛍️
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Confirm / Cancel */}
        {selectedItem && (
          <div style={{
            display: 'flex', gap: 8, padding: '8px 16px 16px',
            borderTop: '1px solid #f0f0f0',
          }}>
            <button
              onClick={handleCancel}
              style={{
                flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: 8,
                background: 'white', fontSize: 14, cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              style={{
                flex: 2, padding: '10px', border: 'none', borderRadius: 8,
                background: '#4caf50', color: 'white', fontSize: 14, fontWeight: 600,
                cursor: confirming ? 'not-allowed' : 'pointer',
                opacity: confirming ? 0.7 : 1,
              }}
            >
              {confirming ? '确认中...' : selectedItem === 'remove'
                ? '确认去除装扮'
                : `确认装备「${(selectedItem as OutfitItem).name}」`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
