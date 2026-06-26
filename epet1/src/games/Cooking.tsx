import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchCookingMethods,
  fetchCookingIngredients,
  cookDish,
  type CookingMethod,
  type CookingIngredient,
  type CookingDish,
} from '../api/epet1';
import { useGameStore } from '../store/gameStore';

/**
 * 料理游戏
 * 阶段: selectMethod → selectIngredients → cooking → result
 */

// 6个烹饪阶段定义
const STAGE_KEYS = ['img_0', 'img_1', 'img_2', 'img_3', 'img_4', 'img_5'] as const;
const STAGE_LABELS = ['刚开始煮', '稍微煮了一会儿', '快熟了', '刚好熟了', '有点老了', '变成焦炭了'];
const STAGE_DURATION = 2500; // 每阶段2.5秒

// 起锅评级映射：在哪个阶段起锅 → 评级
const STAGE_RATING: Record<number, { rating: number; name: string }> = {
  0: { rating: 1, name: '还行' },   // 刚开始煮就起锅 → 还行
  1: { rating: 1, name: '还行' },   // 稍微煮了一会儿 → 还行
  2: { rating: 2, name: '不错' },   // 快熟了 → 不错
  3: { rating: 3, name: '完美' },   // 刚好熟了 → 完美 ★
  4: { rating: 1, name: '还行' },   // 有点老了 → 还行
  5: { rating: 0, name: '失败' },   // 焦炭 → 失败 → 不可名状之物
};

export default function Cooking({ onClose }: { onClose: () => void }) {
  const userId = useGameStore(s => s.userId);

  // 阶段
  const [phase, setPhase] = useState<'selectMethod' | 'selectIngredients' | 'cooking' | 'result'>('selectMethod');

  // 数据
  const [methods, setMethods] = useState<CookingMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<CookingMethod | null>(null);
  const [availableIngredients, setAvailableIngredients] = useState<(CookingIngredient & { quantity: number })[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<(CookingIngredient & { quantity: number })[]>([]);

  // 烹饪状态
  const [currentStage, setCurrentStage] = useState(-1); // -1=有食材未开火
  const [isCooking, setIsCooking] = useState(false);
  const [canServe, setCanServe] = useState(false);

  // 结果
  const [resultDish, setResultDish] = useState<CookingDish | null>(null);
  const [cookingError, setCookingError] = useState('');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageStartTimeRef = useRef(0);

  // 加载烹饪方式
  useEffect(() => {
    (async () => {
      try {
        const ms = await fetchCookingMethods();
        setMethods(ms);
      } catch (e) {
        console.error('load methods error', e);
      }
    })();
  }, []);

  // 加载用户背包食材
  const loadUserIngredients = useCallback(async () => {
    if (!userId) return;
    try {
      const [allIngredients, invRes] = await Promise.all([
        fetchCookingIngredients(),
        fetch(`/api/epet1/inventory/${userId}`).then(r => r.json()),
      ]);
      const foodItems = invRes?.categories?.food || [];
      // 合并：有库存的食材才显示
      const merged = allIngredients
        .map(ing => {
          const inv = foodItems.find((f: any) => f.shop_item_id === ing.id);
          return inv ? { ...ing, quantity: inv.quantity } : null;
        })
        .filter((x): x is CookingIngredient & { quantity: number } => x !== null && x.quantity > 0);
      setAvailableIngredients(merged);
    } catch (e) {
      console.error('load ingredients error', e);
    }
  }, [userId]);

  // 选烹饪方式后加载食材
  useEffect(() => {
    if (selectedMethod) {
      loadUserIngredients();
    }
  }, [selectedMethod, loadUserIngredients]);

  // 烹饪计时器
  useEffect(() => {
    if (!isCooking) return;

    const tick = () => {
      const elapsed = Date.now() - stageStartTimeRef.current;
      const stage = Math.min(Math.floor(elapsed / STAGE_DURATION), 5);

      setCurrentStage(prev => {
        if (stage !== prev) {
          // 到新阶段
          if (stage >= 5) {
            // 焦炭了，自动停止计时但仍在烹饪中（用户仍可起锅）
            setIsCooking(false);
            setCanServe(true);
            return 5;
          }
          return stage;
        }
        return prev;
      });

      if (stage < 5) {
        timerRef.current = setTimeout(tick, 200);
      }
    };

    stageStartTimeRef.current = Date.now();
    setCurrentStage(0);
    timerRef.current = setTimeout(tick, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isCooking]);

  // 开始烹饪（开火）
  const startCooking = () => {
    setCurrentStage(0);
    setIsCooking(true);
    setCanServe(false);
    setPhase('cooking');
  };

  // 起锅
  const serveDish = async () => {
    if (!userId || !selectedMethod) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setIsCooking(false);

    const stageRating = STAGE_RATING[currentStage] || STAGE_RATING[5];
    const ingredients = selectedIngredients.map(i => ({
      shop_item_id: i.id,
      quantity: 1,
    }));

    try {
      const res = await cookDish(userId, selectedMethod.id, ingredients, stageRating.rating);
      if (res.ok && res.dish) {
        setResultDish(res.dish);
      } else {
        setResultDish({
          name: '不可名状之物',
          image_url: '',
          description: res.error || '料理出了问题…',
          rating: 0,
          rating_name: '失败',
        });
      }
    } catch (e: any) {
      setCookingError(e.message || '料理失败');
      setResultDish({
        name: '不可名状之物',
        image_url: '',
        description: '料理出了问题…',
        rating: 0,
        rating_name: '失败',
      });
    }
    setPhase('result');
  };

  // 放入背包 → 关闭
  const putInBag = () => {
    onClose();
  };

  // 选择食材
  const toggleIngredient = (ing: CookingIngredient & { quantity: number }) => {
    const idx = selectedIngredients.findIndex(i => i.id === ing.id);
    if (idx >= 0) {
      setSelectedIngredients(prev => prev.filter((_, i) => i !== idx));
    } else if (selectedIngredients.length < 3) {
      setSelectedIngredients(prev => [...prev, ing]);
    }
  };

  // 获取当前锅图片
  const getPotImage = () => {
    if (!selectedMethod) return '';
    if (currentStage < 0) {
      // 有食材未开火
      return selectedMethod.img_loaded || '';
    }
    if (currentStage <= 5) {
      return selectedMethod[STAGE_KEYS[currentStage]] || '';
    }
    return '';
  };

  // 占位图
  const PLACEHOLDER_POT = '🍳';
  const PLACEHOLDER_EMPTY = '🫕';

  // ─── 渲染 ─────────────────────────────────────

  return (
    <div style={{
      width: '100%',
      maxWidth: 400,
      margin: '0 auto',
      color: '#fff',
      fontFamily: "'PingFang SC', 'Noto Sans SC', sans-serif",
      userSelect: 'none',
    }}>
      {/* 标题栏 */}
      <div style={{
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 16,
        color: '#FFE4B5',
        textShadow: '0 2px 8px rgba(255,150,0,0.5)',
      }}>
        🍳 料理
      </div>

      {/* ═══ 阶段1: 选烹饪方式 ═══ */}
      {phase === 'selectMethod' && (
        <div>
          <div style={{ fontSize: 14, color: '#ccc', marginBottom: 12, textAlign: 'center' }}>
            选择烹饪方式
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {methods.map(m => (
              <div
                key={m.id}
                onClick={() => { setSelectedMethod(m); setPhase('selectIngredients'); }}
                style={{
                  width: 120,
                  padding: '20px 12px',
                  background: 'linear-gradient(135deg, #2a2a4a, #3a3a5a)',
                  border: '2px solid #555',
                  borderRadius: 16,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#FF9800'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#555'; }}
              >
                <div style={{ fontSize: 40, marginBottom: 8 }}>
                  {m.img_empty ? <img src={m.img_empty} style={{ width: 60, height: 60, objectFit: 'contain' }} /> : '🫕'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{m.description}</div>
              </div>
            ))}
            {methods.length === 0 && (
              <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>
                暂无烹饪方式<br/><span style={{ fontSize: 12 }}>请在后台配置</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ 阶段2: 选食材 ═══ */}
      {phase === 'selectIngredients' && selectedMethod && (
        <div>
          <div style={{ fontSize: 14, color: '#ccc', marginBottom: 8, textAlign: 'center' }}>
            {selectedMethod.name} — 选择食材（2~3种）
          </div>

          {/* 已选食材 */}
          <div style={{
            display: 'flex',
            gap: 8,
            minHeight: 70,
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            marginBottom: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {selectedIngredients.length === 0 && (
              <span style={{ color: '#666', fontSize: 13 }}>点击下方食材添加…</span>
            )}
            {selectedIngredients.map(ing => (
              <div
                key={ing.id}
                onClick={() => toggleIngredient(ing)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  background: 'linear-gradient(135deg, #4a2a0a, #6a3a1a)',
                  border: '1px solid #8a5a2a',
                  borderRadius: 20,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {ing.image_url ? (
                  <img src={ing.image_url} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                ) : '🍽️'}
                <span>{ing.name}</span>
                <span style={{ color: '#aaa', fontSize: 11 }}>×{ing.quantity}</span>
                <span style={{ color: '#f66', fontSize: 11 }}>✕</span>
              </div>
            ))}
          </div>

          {/* 食材列表 */}
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
            {availableIngredients.map(ing => {
              const isSelected = selectedIngredients.some(i => i.id === ing.id);
              return (
                <div
                  key={ing.id}
                  onClick={() => toggleIngredient(ing)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    marginBottom: 4,
                    background: isSelected ? 'rgba(255,152,0,0.15)' : 'rgba(255,255,255,0.03)',
                    border: isSelected ? '1px solid #FF9800' : '1px solid transparent',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                >
                  {ing.image_url ? (
                    <img src={ing.image_url} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 24 }}>🍽️</span>
                  )}
                  <span style={{ flex: 1, fontSize: 14 }}>{ing.name}</span>
                  <span style={{ fontSize: 12, color: '#aaa' }}>×{ing.quantity}</span>
                </div>
              );
            })}
            {availableIngredients.length === 0 && (
              <div style={{ textAlign: 'center', color: '#666', padding: 20, fontSize: 13 }}>
                背包里没有食材<br/>去钓鱼或商店获取吧！
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setPhase('selectMethod'); setSelectedIngredients([]); }}
              style={{
                flex: 1,
                padding: '10px 0',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 10,
                color: '#ccc',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              返回
            </button>
            <button
              onClick={startCooking}
              disabled={selectedIngredients.length < 2}
              style={{
                flex: 2,
                padding: '10px 0',
                background: selectedIngredients.length >= 2
                  ? 'linear-gradient(135deg, #FF6B35, #FF9800)'
                  : '#444',
                border: 'none',
                borderRadius: 10,
                color: selectedIngredients.length >= 2 ? '#fff' : '#888',
                fontSize: 16,
                fontWeight: 700,
                cursor: selectedIngredients.length >= 2 ? 'pointer' : 'not-allowed',
              }}
            >
              🔥 开火料理！
            </button>
          </div>
        </div>
      )}

      {/* ═══ 阶段3: 烹饪中 ═══ */}
      {phase === 'cooking' && selectedMethod && (
        <div>
          {/* 厨房背景/锅 */}
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            maxHeight: 320,
            margin: '0 auto 16px',
            borderRadius: 20,
            overflow: 'hidden',
            background: selectedMethod.kitchen_bg_url
              ? `url(${selectedMethod.kitchen_bg_url}) center/cover`
              : 'linear-gradient(180deg, #1a1a2e 0%, #2a1a0e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* 锅图片 */}
            {getPotImage() ? (
              <img
                src={getPotImage()}
                style={{
                  maxWidth: '80%',
                  maxHeight: '80%',
                  objectFit: 'contain',
                  transition: 'opacity 0.3s',
                }}
              />
            ) : (
              <div style={{ fontSize: 80 }}>
                {currentStage < 0 ? PLACEHOLDER_EMPTY : PLACEHOLDER_POT}
              </div>
            )}

            {/* 食材悬浮图标 */}
            {currentStage < 0 && selectedIngredients.map((ing, idx) => (
              <div key={ing.id} style={{
                position: 'absolute',
                top: `${20 + idx * 25}%`,
                left: `${30 + idx * 15}%`,
                fontSize: 28,
                animation: 'float 2s ease-in-out infinite',
                animationDelay: `${idx * 0.3}s`,
              }}>
                {ing.image_url ? (
                  <img src={ing.image_url} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                ) : '🍽️'}
              </div>
            ))}

            {/* 阶段文字提示 */}
            {currentStage >= 0 && (
              <div style={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '6px 16px',
                background: 'rgba(0,0,0,0.7)',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                color: currentStage === 3 ? '#FFD700' : currentStage === 5 ? '#f44' : '#fff',
              }}>
                {STAGE_LABELS[currentStage]}
                {currentStage === 3 && ' ⭐'}
              </div>
            )}
          </div>

          {/* 进度条 */}
          {currentStage >= 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
                fontSize: 11,
                color: '#888',
              }}>
                {STAGE_LABELS.map((label, idx) => (
                  <span key={idx} style={{
                    color: idx === currentStage ? '#FFD700' : '#555',
                    fontWeight: idx === currentStage ? 700 : 400,
                  }}>
                    {idx + 1}
                  </span>
                ))}
              </div>
              <div style={{
                height: 8,
                background: '#333',
                borderRadius: 4,
                overflow: 'hidden',
                position: 'relative',
              }}>
                {/* 完美区域标记 */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  width: '16.7%',
                  height: '100%',
                  background: 'rgba(255,215,0,0.3)',
                }} />
                {/* 当前进度 */}
                <div style={{
                  width: `${Math.min(((currentStage + 1) / 6) * 100, 100)}%`,
                  height: '100%',
                  background: currentStage <= 3
                    ? 'linear-gradient(90deg, #4CAF50, #FFC107)'
                    : 'linear-gradient(90deg, #FFC107, #f44)',
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}

          {/* 起锅按钮 */}
          <button
            onClick={serveDish}
            disabled={currentStage < 0}
            style={{
              width: '100%',
              padding: '14px 0',
              background: currentStage >= 0
                ? (currentStage === 3
                  ? 'linear-gradient(135deg, #FFD700, #FFA000)'
                  : 'linear-gradient(135deg, #FF6B35, #FF9800)')
                : '#444',
              border: 'none',
              borderRadius: 14,
              color: currentStage >= 0 ? '#fff' : '#888',
              fontSize: 20,
              fontWeight: 700,
              cursor: currentStage >= 0 ? 'pointer' : 'not-allowed',
              boxShadow: currentStage === 3 ? '0 0 20px rgba(255,215,0,0.5)' : 'none',
              transition: 'all 0.3s',
            }}
          >
            {currentStage < 0 ? '等待开火…' : '🍳 起锅！'}
          </button>
        </div>
      )}

      {/* ═══ 阶段4: 结果 ═══ */}
      {phase === 'result' && resultDish && (
        <div style={{
          position: 'relative',
          textAlign: 'center',
          padding: '20px 0',
        }}>
          {/* 放射性光线背景 */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 300,
            height: 300,
            transform: 'translate(-50%, -50%)',
            background: resultDish.rating >= 3
              ? 'radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%)'
              : resultDish.rating >= 2
              ? 'radial-gradient(circle, rgba(255,152,0,0.3) 0%, transparent 70%)'
              : resultDish.rating >= 1
              ? 'radial-gradient(circle, rgba(200,200,200,0.2) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(100,0,0,0.4) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite',
            borderRadius: '50%',
            zIndex: 0,
          }} />

          {/* 旋转光线 */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 260,
            height: 260,
            transform: 'translate(-50%, -50%)',
            background: `conic-gradient(from 0deg, 
              transparent 0deg, rgba(255,215,0,0.15) 15deg, transparent 30deg,
              transparent 45deg, rgba(255,215,0,0.15) 60deg, transparent 75deg,
              transparent 90deg, rgba(255,215,0,0.15) 105deg, transparent 120deg,
              transparent 135deg, rgba(255,215,0,0.15) 150deg, transparent 165deg,
              transparent 180deg, rgba(255,215,0,0.15) 195deg, transparent 210deg,
              transparent 225deg, rgba(255,215,0,0.15) 240deg, transparent 255deg,
              transparent 270deg, rgba(255,215,0,0.15) 285deg, transparent 300deg,
              transparent 315deg, rgba(255,215,0,0.15) 330deg, transparent 345deg
            )`,
            borderRadius: '50%',
            animation: 'spin 8s linear infinite',
            zIndex: 0,
          }} />

          {/* 料理图片 */}
          <div style={{ position: 'relative', zIndex: 1, marginBottom: 16 }}>
            {resultDish.image_url ? (
              <img
                src={resultDish.image_url}
                style={{
                  width: 140,
                  height: 140,
                  objectFit: 'contain',
                  borderRadius: 20,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              />
            ) : (
              <div style={{
                width: 140,
                height: 140,
                lineHeight: '140px',
                fontSize: 72,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 20,
                margin: '0 auto',
              }}>
                {resultDish.rating === 0 ? '💀' : '🍽️'}
              </div>
            )}
          </div>

          {/* 料理名 */}
          <div style={{
            position: 'relative', zIndex: 1,
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 8,
            color: resultDish.rating >= 3 ? '#FFD700' : resultDish.rating === 0 ? '#f66' : '#fff',
          }}>
            {resultDish.name}
          </div>

          {/* 评级星级 */}
          <div style={{ position: 'relative', zIndex: 1, fontSize: 28, marginBottom: 8 }}>
            {resultDish.rating >= 1 ? '⭐'.repeat(resultDish.rating) : '❌'}
          </div>

          {/* 评级文字 */}
          <div style={{
            position: 'relative', zIndex: 1,
            fontSize: 16,
            marginBottom: 4,
            color: resultDish.rating >= 3 ? '#FFD700' : resultDish.rating === 0 ? '#f66' : '#ccc',
          }}>
            {resultDish.rating_name}
          </div>

          {/* 描述 */}
          {resultDish.description && (
            <div style={{
              position: 'relative', zIndex: 1,
              fontSize: 13,
              color: '#999',
              marginBottom: 16,
            }}>
              {resultDish.description}
            </div>
          )}

          {cookingError && (
            <div style={{ color: '#f66', fontSize: 12, marginBottom: 8 }}>{cookingError}</div>
          )}

          {/* 放入背包按钮 */}
          <button
            onClick={putInBag}
            style={{
              position: 'relative', zIndex: 1,
              padding: '12px 48px',
              background: 'linear-gradient(135deg, #4CAF50, #66BB6A)',
              border: 'none',
              borderRadius: 14,
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(76,175,80,0.4)',
            }}
          >
            🎒 放入背包
          </button>
        </div>
      )}

      {/* CSS 动画 */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.7; }
        }
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
