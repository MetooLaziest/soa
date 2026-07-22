import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchCookingMethods,
  fetchCookingIngredients,
  cookDish,
  authFetch,
  type CookingMethod,
  type CookingIngredient,
  type CookingDish,
} from '../api/epet1';
import { useGameStore } from '../store/gameStore';

/**
 * 料理游戏 - 全屏版
 * 阶段: selectMethod → selectIngredients → cooking → result
 */

// 6个烹饪阶段定义
const STAGE_KEYS = ['img_0', 'img_1', 'img_2', 'img_3', 'img_4', 'img_5'] as const;
const STAGE_LABELS = ['刚开始煮', '稍微煮了一会儿', '快熟了', '刚好熟了', '有点老了', '变成焦炭了'];
const STAGE_DURATION = 2500; // 每阶段2.5秒

// 起锅评级映射
const STAGE_RATING: Record<number, { rating: number; name: string }> = {
  0: { rating: 1, name: '还行' },
  1: { rating: 1, name: '还行' },
  2: { rating: 2, name: '不错' },
  3: { rating: 3, name: '完美' },
  4: { rating: 1, name: '还行' },
  5: { rating: 0, name: '失败' },
};

export default function Cooking({ onClose, onPageBgChange }: { onClose: () => void; onPageBgChange?: (url: string | null) => void }) {
  const userId = useGameStore(s => s.userId);

  // 阶段
  const [phase, setPhase] = useState<'selectMethod' | 'selectIngredients' | 'cooking' | 'result'>('selectMethod');

  // 数据
  const [methods, setMethods] = useState<CookingMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<CookingMethod | null>(null);

  // 通知父组件全页背景变化
  useEffect(() => {
    if (onPageBgChange) {
      onPageBgChange(selectedMethod?.page_bg_url || null);
    }
  }, [selectedMethod, onPageBgChange]);
  const [availableIngredients, setAvailableIngredients] = useState<(CookingIngredient & { quantity: number })[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<(CookingIngredient & { quantity: number })[]>([]);

  // 烹饪状态
  const [currentStage, setCurrentStage] = useState(-1); // -1=有食材未开火
  const [isCooking, setIsCooking] = useState(false);

  // 结果
  const [resultDish, setResultDish] = useState<CookingDish | null>(null);
  const [cookingError, setCookingError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageStartTimeRef = useRef(0);

  // 禁止背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && phase !== 'cooking') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, phase]);

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
        authFetch(`/api/epet1/inventory/${userId}`).then(r => r.json()),
      ]);
      const foodItems = invRes?.categories?.food || [];
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

  useEffect(() => {
    if (selectedMethod) loadUserIngredients();
  }, [selectedMethod, loadUserIngredients]);

  // 烹饪计时器
  useEffect(() => {
    if (!isCooking) return;

    const tick = () => {
      const elapsed = Date.now() - stageStartTimeRef.current;
      const stage = Math.min(Math.floor(elapsed / STAGE_DURATION), 5);

      setCurrentStage(prev => {
        if (stage !== prev) {
          if (stage >= 5) {
            setIsCooking(false);
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
    setPhase('cooking');
  };

  // 起锅
  const serveDish = async () => {
    if (!userId || !selectedMethod || submitting) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setIsCooking(false);
    setSubmitting(true);

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
    setSubmitting(false);
    setPhase('result');
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
    if (currentStage < 0) return selectedMethod.img_loaded || '';
    if (currentStage <= 5) return selectedMethod[STAGE_KEYS[currentStage]] || '';
    return '';
  };

  const canGoBack = phase === 'selectIngredients' || (phase === 'selectMethod' && selectedMethod);

  // ─── 渲染 ─────────────────────────────────────

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      color: '#fff',
      fontFamily: "'PingFang SC', 'Noto Sans SC', sans-serif",
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      {/* 顶栏 */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '12px 16px',
        background: 'rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}>
        {/* 返回/关闭 */}
        <button onClick={() => {
          if (phase === 'selectIngredients') {
            setPhase('selectMethod');
            setSelectedIngredients([]);
          } else if (phase === 'selectMethod' && selectedMethod) {
            setSelectedMethod(null);
          } else {
            onClose();
          }
        }}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {canGoBack ? '←' : '✕'}
        </button>
        <div style={{
          flex: 1, textAlign: 'center',
          fontSize: 18, fontWeight: 700,
          color: '#FFE4B5',
          textShadow: '0 2px 8px rgba(255,150,0,0.5)',
        }}>
          🍳 料理
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* ═══ 阶段1: 选烹饪方式 ═══ */}
          {phase === 'selectMethod' && (
            <div>
              <div style={{ fontSize: 14, color: '#ccc', marginBottom: 16, textAlign: 'center' }}>
                选择烹饪方式
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {methods.map(m => (
                  <div
                    key={m.id}
                    onClick={() => { setSelectedMethod(m); setPhase('selectIngredients'); }}
                    style={{
                      width: 130, padding: '24px 12px',
                      background: 'linear-gradient(135deg, #2a2a4a, #3a3a5a)',
                      border: '2px solid #555', borderRadius: 16,
                      textAlign: 'center', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 8 }}>
                      {m.img_empty ? (
                        <img src={m.img_empty} style={{ width: 64, height: 64, objectFit: 'contain' }} />
                      ) : '🫕'}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{m.description}</div>
                  </div>
                ))}
                {methods.length === 0 && (
                  <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>
                    暂无烹饪方式<br /><span style={{ fontSize: 12 }}>请在后台配置</span>
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
                display: 'flex', gap: 8, minHeight: 56,
                padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
                borderRadius: 12, marginBottom: 12,
                alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
              }}>
                {selectedIngredients.length === 0 && (
                  <span style={{ color: '#555', fontSize: 13 }}>点击下方食材添加…</span>
                )}
                {selectedIngredients.map(ing => (
                  <div key={ing.id} onClick={() => toggleIngredient(ing)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '6px 10px',
                    background: 'linear-gradient(135deg, #4a2a0a, #6a3a1a)',
                    border: '1px solid #8a5a2a', borderRadius: 20,
                    fontSize: 13, cursor: 'pointer',
                  }}>
                    {ing.image_url ? (
                      <img src={ing.image_url} style={{ width: 22, height: 22, objectFit: 'contain' }} />
                    ) : '🍽️'}
                    <span>{ing.name}</span>
                    <span style={{ color: '#f66', fontSize: 11 }}>✕</span>
                  </div>
                ))}
              </div>

              {/* 食材列表 */}
              <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 16 }}>
                {availableIngredients.map(ing => {
                  const isSelected = selectedIngredients.some(i => i.id === ing.id);
                  return (
                    <div key={ing.id} onClick={() => toggleIngredient(ing)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', marginBottom: 4,
                      background: isSelected ? 'rgba(255,152,0,0.15)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid #FF9800' : '1px solid transparent',
                      borderRadius: 10, cursor: 'pointer',
                    }}>
                      {ing.image_url ? (
                        <img src={ing.image_url} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: 24, width: 36, textAlign: 'center' }}>🍽️</span>
                      )}
                      <span style={{ flex: 1, fontSize: 15 }}>{ing.name}</span>
                      <span style={{ fontSize: 12, color: '#aaa' }}>×{ing.quantity}</span>
                    </div>
                  );
                })}
                {availableIngredients.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>
                    背包里没有食材<br />去钓鱼或商店获取吧！
                  </div>
                )}
              </div>

              {/* 开火按钮 */}
              <button
                onClick={startCooking}
                disabled={selectedIngredients.length < 2}
                style={{
                  width: '100%', padding: '14px 0',
                  background: selectedIngredients.length >= 2
                    ? 'linear-gradient(135deg, #FF6B35, #FF9800)'
                    : '#333',
                  border: 'none', borderRadius: 14,
                  color: selectedIngredients.length >= 2 ? '#fff' : '#666',
                  fontSize: 20, fontWeight: 700, cursor: selectedIngredients.length >= 2 ? 'pointer' : 'not-allowed',
                  boxShadow: selectedIngredients.length >= 2 ? '0 4px 16px rgba(255,107,53,0.4)' : 'none',
                }}
              >
                🔥 开火料理！
              </button>
            </div>
          )}

          {/* ═══ 阶段3: 烹饪中 ═══ */}
          {phase === 'cooking' && selectedMethod && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {/* 锅/厨房区域 */}
              <div style={{
                position: 'relative',
                width: '100%', aspectRatio: '1', maxHeight: 320,
                margin: '0 auto 20px', borderRadius: 20, overflow: 'hidden',
                background: selectedMethod.kitchen_bg_url
                  ? `url(${selectedMethod.kitchen_bg_url}) center/cover`
                  : 'linear-gradient(180deg, #1a1a2e 0%, #2a1a0e 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {getPotImage() ? (
                  <img src={getPotImage()} style={{
                    maxWidth: '80%', maxHeight: '80%', objectFit: 'contain',
                    transition: 'opacity 0.3s',
                  }} />
                ) : (
                  <div style={{ fontSize: 80 }}>
                    {currentStage < 0 ? '🫕' : '🍳'}
                  </div>
                )}

                {/* 食材悬浮 */}
                {currentStage < 0 && selectedIngredients.map((ing, idx) => (
                  <div key={ing.id} style={{
                    position: 'absolute',
                    top: `${20 + idx * 25}%`, left: `${30 + idx * 15}%`,
                    fontSize: 28, animation: 'cooking-float 2s ease-in-out infinite',
                    animationDelay: `${idx * 0.3}s`,
                  }}>
                    {ing.image_url ? (
                      <img src={ing.image_url} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                    ) : '🍽️'}
                  </div>
                ))}

                {/* 阶段文字 */}
                {currentStage >= 0 && (
                  <div style={{
                    position: 'absolute', bottom: 16,
                    left: '50%', transform: 'translateX(-50%)',
                    padding: '6px 16px', background: 'rgba(0,0,0,0.7)',
                    borderRadius: 20, fontSize: 15, fontWeight: 600,
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
                <div style={{ width: '100%', marginBottom: 20 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: 4, fontSize: 11, color: '#666',
                  }}>
                    {STAGE_LABELS.map((_, idx) => (
                      <span key={idx} style={{
                        color: idx === currentStage ? '#FFD700' : '#444',
                        fontWeight: idx === currentStage ? 700 : 400,
                      }}>{idx + 1}</span>
                    ))}
                  </div>
                  <div style={{
                    height: 8, background: '#333', borderRadius: 4,
                    overflow: 'hidden', position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', left: '50%', width: '16.7%', height: '100%',
                      background: 'rgba(255,215,0,0.25)',
                    }} />
                    <div style={{
                      width: `${Math.min(((currentStage + 1) / 6) * 100, 100)}%`,
                      height: '100%',
                      background: currentStage <= 3
                        ? 'linear-gradient(90deg, #4CAF50, #FFC107)'
                        : 'linear-gradient(90deg, #FFC107, #f44)',
                      borderRadius: 4, transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              )}

              {/* 起锅按钮 */}
              {selectedMethod.cook_btn_url ? (
                <button
                  onClick={serveDish}
                  disabled={currentStage < 0 || submitting}
                  style={{
                    width: '100%', padding: 0,
                    background: 'none', border: 'none',
                    cursor: currentStage >= 0 && !submitting ? 'pointer' : 'not-allowed',
                    opacity: currentStage < 0 ? 0.4 : 1,
                    transition: 'opacity 0.3s',
                  }}
                >
                  <img
                    src={selectedMethod.cook_btn_url}
                    alt="起锅"
                    style={{
                      width: '100%', maxHeight: 80,
                      objectFit: 'contain', display: 'block',
                      filter: currentStage === 3 ? 'drop-shadow(0 0 16px rgba(255,215,0,0.6))' : 'none',
                    }}
                  />
                </button>
              ) : (
                <button
                  onClick={serveDish}
                  disabled={currentStage < 0 || submitting}
                  style={{
                    width: '100%', padding: '16px 0',
                    background: currentStage >= 0
                      ? (currentStage === 3
                        ? 'linear-gradient(135deg, #FFD700, #FFA000)'
                        : 'linear-gradient(135deg, #FF6B35, #FF9800)')
                      : '#333',
                    border: 'none', borderRadius: 14,
                    color: currentStage >= 0 ? '#fff' : '#666',
                    fontSize: 22, fontWeight: 700,
                    cursor: currentStage >= 0 && !submitting ? 'pointer' : 'not-allowed',
                    boxShadow: currentStage === 3 ? '0 0 24px rgba(255,215,0,0.5)' : 'none',
                    transition: 'all 0.3s',
                  }}
                >
                  {submitting ? '料理中…' : currentStage < 0 ? '等待开火…' : '🍳 起锅！'}
                </button>
              )}
            </div>
          )}

          {/* ═══ 阶段4: 结果 ═══ */}
          {phase === 'result' && resultDish && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              position: 'relative', padding: '24px 0',
            }}>
              {/* 放射性光线背景 */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 320, height: 320,
                transform: 'translate(-50%, -50%)',
                background: resultDish.rating >= 3
                  ? 'radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%)'
                  : resultDish.rating >= 2
                  ? 'radial-gradient(circle, rgba(255,152,0,0.3) 0%, transparent 70%)'
                  : resultDish.rating >= 1
                  ? 'radial-gradient(circle, rgba(200,200,200,0.2) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(100,0,0,0.4) 0%, transparent 70%)',
                animation: 'cooking-pulse 2s ease-in-out infinite',
                borderRadius: '50%', zIndex: 0,
              }} />

              {/* 旋转光线 */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 280, height: 280,
                transform: 'translate(-50%, -50%)',
                background: `conic-gradient(from 0deg,
                  transparent 0deg, rgba(255,215,0,0.12) 15deg, transparent 30deg,
                  transparent 45deg, rgba(255,215,0,0.12) 60deg, transparent 75deg,
                  transparent 90deg, rgba(255,215,0,0.12) 105deg, transparent 120deg,
                  transparent 135deg, rgba(255,215,0,0.12) 150deg, transparent 165deg,
                  transparent 180deg, rgba(255,215,0,0.12) 195deg, transparent 210deg,
                  transparent 225deg, rgba(255,215,0,0.12) 240deg, transparent 255deg,
                  transparent 270deg, rgba(255,215,0,0.12) 285deg, transparent 300deg,
                  transparent 315deg, rgba(255,215,0,0.12) 330deg, transparent 345deg
                )`,
                borderRadius: '50%',
                animation: 'cooking-spin 8s linear infinite',
                zIndex: 0,
              }} />

              {/* 料理图片 */}
              <div style={{ position: 'relative', zIndex: 1, marginBottom: 16 }}>
                {resultDish.image_url ? (
                  <img src={resultDish.image_url} style={{
                    width: 150, height: 150, objectFit: 'contain',
                    borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }} />
                ) : (
                  <div style={{
                    width: 150, height: 150, lineHeight: '150px',
                    fontSize: 80, background: 'rgba(255,255,255,0.05)',
                    borderRadius: 20, margin: '0 auto',
                  }}>
                    {resultDish.rating === 0 ? '💀' : '🍽️'}
                  </div>
                )}
              </div>

              {/* 料理名 */}
              <div style={{
                position: 'relative', zIndex: 1,
                fontSize: 24, fontWeight: 700, marginBottom: 8,
                color: resultDish.rating >= 3 ? '#FFD700' : resultDish.rating === 0 ? '#f66' : '#fff',
              }}>
                {resultDish.name}
              </div>

              {/* 评级星级 */}
              <div style={{ position: 'relative', zIndex: 1, fontSize: 32, marginBottom: 8 }}>
                {resultDish.rating >= 1 ? '⭐'.repeat(resultDish.rating) : '❌'}
              </div>

              {/* 评级文字 */}
              <div style={{
                position: 'relative', zIndex: 1,
                fontSize: 18, marginBottom: 4,
                color: resultDish.rating >= 3 ? '#FFD700' : resultDish.rating === 0 ? '#f66' : '#ccc',
              }}>
                {resultDish.rating_name}
              </div>

              {resultDish.description && (
                <div style={{
                  position: 'relative', zIndex: 1,
                  fontSize: 13, color: '#999', marginBottom: 24,
                }}>
                  {resultDish.description}
                </div>
              )}

              {cookingError && (
                <div style={{ color: '#f66', fontSize: 12, marginBottom: 8, position: 'relative', zIndex: 1 }}>{cookingError}</div>
              )}

              {/* 放入背包按钮 */}
              <button
                onClick={onClose}
                style={{
                  position: 'relative', zIndex: 1,
                  padding: '14px 56px',
                  background: 'linear-gradient(135deg, #4CAF50, #66BB6A)',
                  border: 'none', borderRadius: 14,
                  color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(76,175,80,0.4)',
                }}
              >
                🎒 放入背包
              </button>
            </div>
          )}

        </div>
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes cooking-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes cooking-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.7; }
        }
        @keyframes cooking-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
