import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchFishingMaps,
  fetchFishingDailyStatus,
  castFishingRod,
  fetchFishingMapAssets,
  type FishMap,
  type FishingAssets,
  type FishingMapConfig,
} from '../api/epet1';
import { useGameStore } from '../store/gameStore';

/**
 * 钓鱼游戏 V2 — 8状态机 + 5层渲染 + CSS湖面动画
 * select-map → idle → casting → waiting → progress → pulling → judgment → result
 */

// ─── 默认配置 ────────────────────────────────────────────
const DEFAULT_CONFIG: FishingMapConfig = {
  lake_top_pct: 55,
  lake_left_pct: 0,
  lake_width_pct: 100,
  lake_height_pct: 45,
  green_start_pct: 40,
  green_end_pct: 70,
  cast_duration_ms: 800,
  pull_duration_ms: 1200,
  waiting_min_ms: 1000,
  waiting_max_ms: 4000,
};

const RARITY_COLORS: Record<string, string> = {
  common: '#b0b0b0',
  rare: '#4fc3f7',
  epic: '#ab47bc',
  legendary: '#ffd740',
};
const RARITY_NAMES: Record<string, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

// ─── 类型 ────────────────────────────────────────────────
type GameState = 'select-map' | 'idle' | 'casting' | 'waiting' | 'progress' | 'pulling' | 'judgment' | 'result';

interface CaughtFish {
  id: number;
  name: string;
  rarity: string;
  description?: string;
  image_url: string;
}

// ─── 组件 ────────────────────────────────────────────────
export default function Fishing({ onClose }: { onClose: () => void }) {
  const userId = useGameStore(s => s.userId);

  // 状态机
  const [gameState, setGameState] = useState<GameState>('select-map');

  // 数据
  const [maps, setMaps] = useState<FishMap[]>([]);
  const [selectedMap, setSelectedMap] = useState<FishMap | null>(null);
  const [dailyStatus, setDailyStatus] = useState({ used: 0, limit: 3, remaining: 3 });
  const [assets, setAssets] = useState<FishingAssets>({});
  const [config, setConfig] = useState<FishingMapConfig>(DEFAULT_CONFIG);

  // 进度条
  const [progress, setProgress] = useState(0);
  const directionRef = useRef<1 | -1>(1);

  // 判定
  const [judgmentResult, setJudgmentResult] = useState<'GREAT' | 'FAIL' | null>(null);
  const [caughtFish, setCaughtFish] = useState<CaughtFish | null>(null);

  // 定时器
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 帧序列
  const [castFrames, setCastFrames] = useState<string[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);

  // ─── 生命周期 ────────────────────────────────────────

  // 禁止背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // 初始加载
  useEffect(() => {
    loadMaps();
    if (userId) loadDailyStatus();
  }, [userId]);

  // ─── 数据加载 ────────────────────────────────────────

  const loadMaps = async () => {
    try {
      const ms = await fetchFishingMaps();
      setMaps(ms);
    } catch (e) { console.error('Failed to load maps:', e); }
  };

  const loadDailyStatus = async () => {
    if (!userId) return;
    try {
      const ds = await fetchFishingDailyStatus(userId);
      setDailyStatus(ds);
    } catch (e) { console.error('Failed to load daily status:', e); }
  };

  const loadAssets = async (mapId: number) => {
    try {
      const { assets: a, config: c } = await fetchFishingMapAssets(mapId);
      setAssets(a);
      setConfig(c || DEFAULT_CONFIG);
      // 提取 cast_frame_0..N
      const frames: string[] = [];
      let i = 0;
      while (a[`cast_frame_${i}`]) {
        frames.push(a[`cast_frame_${i}`]);
        i++;
      }
      setCastFrames(frames);
    } catch (e) {
      console.error('Failed to load assets:', e);
      setAssets({});
      setConfig(DEFAULT_CONFIG);
      setCastFrames([]);
    }
  };

  // ─── 状态转换 ────────────────────────────────────────

  // 选择地图
  const selectMap = (map: FishMap) => {
    setSelectedMap(map);
    setGameState('idle');
    loadAssets(map.id);
    if (userId) loadDailyStatus();
  };

  // 抛竿 → casting
  const startCasting = () => {
    setGameState('casting');
    setCurrentFrame(0);
    setCaughtFish(null);
    setJudgmentResult(null);

    const duration = config.cast_duration_ms;

    // 优先用 cast_gif，否则用帧序列
    if (assets.cast_gif) {
      timerRef.current = setTimeout(() => {
        setGameState('waiting');
        startWaiting();
      }, duration);
    } else if (castFrames.length > 0) {
      const frameTime = duration / castFrames.length;
      let frameIdx = 0;
      intervalRef.current = setInterval(() => {
        frameIdx++;
        if (frameIdx >= castFrames.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setGameState('waiting');
          startWaiting();
        } else {
          setCurrentFrame(frameIdx);
        }
      }, frameTime);
    } else {
      timerRef.current = setTimeout(() => {
        setGameState('waiting');
        startWaiting();
      }, duration);
    }
  };

  // 等待鱼上钩
  const startWaiting = () => {
    const waitMs = config.waiting_min_ms + Math.random() * (config.waiting_max_ms - config.waiting_min_ms);
    timerRef.current = setTimeout(() => {
      setGameState('progress');
      setProgress(0);
      directionRef.current = 1;
      startProgressBar();
    }, waitMs);
  };

  // 进度条指针振荡
  const startProgressBar = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        const next = p + directionRef.current * 3;
        if (next >= 100) { directionRef.current = -1; return 97; }
        if (next <= 0) { directionRef.current = 1; return 3; }
        return next;
      });
    }, 30);
  };

  // 拉杆 → pulling
  const pullRod = () => {
    if (gameState !== 'progress') return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const finalProgress = progress;

    setGameState('pulling');

    timerRef.current = setTimeout(() => {
      const isGreat = finalProgress >= config.green_start_pct && finalProgress <= config.green_end_pct;
      setJudgmentResult(isGreat ? 'GREAT' : 'FAIL');
      setGameState('judgment');

      if (isGreat && userId && selectedMap) {
        castFishingRod(userId, selectedMap.id).then(res => {
          if (res.ok && res.fish) {
            setCaughtFish(res.fish as CaughtFish);
            setDailyStatus(prev => ({ ...prev, used: prev.used + 1, remaining: res.remaining ?? prev.remaining - 1 }));
          }
        }).catch(e => console.error('Cast error:', e));
      }

      timerRef.current = setTimeout(() => {
        setGameState('result');
      }, 1500);
    }, config.pull_duration_ms);
  };

  // 再来一次
  const playAgain = () => {
    setCaughtFish(null);
    setJudgmentResult(null);
    setGameState('idle');
    if (userId) loadDailyStatus();
  };

  // ─── 渲染辅助 ────────────────────────────────────────

  const bgUrl = assets.bg || '';
  const avatarUrl = assets.avatar || '';
  const castGifUrl = assets.cast_gif || '';
  const pullGifUrl = assets.pull_gif || '';

  const getCastFrameUrl = () => {
    if (castGifUrl) return castGifUrl;
    if (castFrames.length > 0) return castFrames[currentFrame] || '';
    return '';
  };

  // ─── 地图选择页 ──────────────────────────────────────
  if (gameState === 'select-map') {
    return (
      <div style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        background: 'linear-gradient(180deg, #0a1628 0%, #1a3a5c 50%, #0d2137 100%)',
      }}>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 10,
        }}>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 8, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
            🎣 选择钓鱼地点
          </h2>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 24 }}>
            今日剩余 {dailyStatus.remaining} / {dailyStatus.limit} 次
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {maps.map(map => (
              <button
                key={map.id}
                onClick={() => selectMap(map)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '2px solid rgba(255,255,255,0.15)',
                  borderRadius: 16, padding: '20px 24px', cursor: 'pointer',
                  color: '#fff', textAlign: 'center', minWidth: 160,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>🏞️</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{map.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{map.description}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {map.fish?.length || 0} 种鱼 · {(map.fish || []).filter(f => f.rarity === 'legendary').length} 传说
                </div>
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{
            marginTop: 24, padding: '8px 24px', background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
          }}>
            返回
          </button>
        </div>
      </div>
    );
  }

  // ─── 主游戏画面（5层渲染） ───────────────────────────
  const lakeTop = config.lake_top_pct;
  const greenStart = config.green_start_pct;
  const greenEnd = config.green_end_pct;

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: bgUrl ? 'none' : 'linear-gradient(180deg, #1a3a5c 0%, #0d2137 60%, #0a1628 100%)',
    }}>
      {/* ─── L1 背景图 ─── */}
      {bgUrl && (
        <img src={bgUrl} alt="" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center', zIndex: 1,
        }} />
      )}

      {/* ─── L2 湖面动画 ─── */}
      <div style={{
        position: 'absolute',
        top: `${lakeTop}%`, left: `${config.lake_left_pct}%`,
        width: `${config.lake_width_pct}%`, height: `${config.lake_height_pct}%`,
        overflow: 'hidden', zIndex: 2,
      }}>
        {[7, 11, 15].map((dur, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: i === 0 ? '-30%' : i === 1 ? '-20%' : '-10%',
            left: '-50%',
            width: '200%', height: '80%',
            borderRadius: '45%',
            background: i === 0
              ? 'rgba(30,100,180,0.25)'
              : i === 1
              ? 'rgba(40,130,210,0.2)'
              : 'rgba(60,160,240,0.15)',
            animation: `fishingWave${i} ${dur}s ease-in-out infinite alternate`,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(100,180,255,0.08) 0%, transparent 40%)',
        }} />
      </div>

      {/* ─── L3 角色头像 ─── */}
      {avatarUrl && (
        <div style={{
          position: 'absolute',
          top: `${lakeTop - 12}%`, left: '10%',
          width: 64, height: 64, zIndex: 3,
          borderRadius: '50%', overflow: 'hidden',
          border: '3px solid rgba(255,255,255,0.6)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}>
          <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* ─── L4 角色动画 ─── */}
      {(gameState === 'casting' || gameState === 'pulling') && (
        <div style={{
          position: 'absolute',
          top: `${lakeTop - 8}%`, left: '10%',
          zIndex: 4,
        }}>
          {gameState === 'casting' && getCastFrameUrl() && (
            <img src={getCastFrameUrl()} style={{ width: 120, height: 120, objectFit: 'contain' }} />
          )}
          {gameState === 'pulling' && pullGifUrl && (
            <img src={pullGifUrl} style={{ width: 120, height: 120, objectFit: 'contain' }} />
          )}
          {gameState === 'casting' && !getCastFrameUrl() && (
            <div style={{ fontSize: 56, animation: 'fishingBob 0.4s ease-in-out infinite' }}>🎣</div>
          )}
          {gameState === 'pulling' && !pullGifUrl && (
            <div style={{ fontSize: 56, animation: 'fishingBob 0.2s ease-in-out infinite' }}>🎣</div>
          )}
        </div>
      )}

      {/* ─── L5 UI 覆盖层 ─── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>

        {/* 顶部状态栏 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
        }}>
          <span style={{ color: '#fff', fontSize: 14, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            🎣 {selectedMap?.name || '钓鱼'}
          </span>
          <span style={{
            color: dailyStatus.remaining > 0 ? '#FFD700' : '#FF6B6B',
            fontSize: 13, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}>
            今日 {dailyStatus.remaining}/{dailyStatus.limit}
          </span>
        </div>

        {/* ── idle: 抛竿按钮 ── */}
        {gameState === 'idle' && (
          <div style={{
            position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            {dailyStatus.remaining > 0 ? (
              <>
                <button onClick={startCasting} style={{
                  padding: '16px 48px', fontSize: 20,
                  background: 'linear-gradient(180deg, #4facfe 0%, #0090d9 100%)',
                  border: '3px solid #FFD700', borderRadius: 16, color: '#fff', fontWeight: 800,
                  cursor: 'pointer', textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  boxShadow: '0 4px 16px rgba(79, 172, 254, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)',
                  letterSpacing: 4, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                }}>
                  抛竿
                </button>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  剩余 {dailyStatus.remaining} 次
                </div>
              </>
            ) : (
              <div style={{ color: '#FF6B6B', fontSize: 16, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                🌙 今日钓鱼次数已用完
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setGameState('select-map')} style={{
                padding: '8px 20px', background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12,
              }}>
                换地图
              </button>
              <button onClick={onClose} style={{
                padding: '8px 20px', background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12,
              }}>
                返回
              </button>
            </div>
          </div>
        )}

        {/* ── waiting: 浮漂 ── */}
        {gameState === 'waiting' && (
          <div style={{
            position: 'absolute', top: `${lakeTop + 5}%`, left: '50%',
            transform: 'translate(-50%, -50%)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, animation: 'fishingBob 1.2s ease-in-out infinite' }}>🎣</div>
            <div style={{
              color: '#fff', fontSize: 14, marginTop: 8,
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              animation: 'fishingPulse 1.5s ease-in-out infinite',
            }}>
              等待鱼儿上钩...
            </div>
          </div>
        )}

        {/* ── progress: 判定条 + 拉杆 ── */}
        {gameState === 'progress' && (
          <div style={{
            position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
            width: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              color: '#FFD700', fontSize: 16, fontWeight: 700,
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              animation: 'fishingPulse 0.8s ease-in-out infinite',
            }}>
              快拉杆！
            </div>
            <div style={{
              width: '100%', height: 24, background: 'rgba(0,0,0,0.6)', borderRadius: 12,
              overflow: 'hidden', position: 'relative', border: '2px solid rgba(255,255,255,0.3)',
            }}>
              <div style={{
                position: 'absolute', left: `${greenStart}%`, width: `${greenEnd - greenStart}%`,
                height: '100%', background: 'rgba(76, 175, 80, 0.5)',
                borderLeft: '2px solid rgba(76, 175, 80, 0.9)',
                borderRight: '2px solid rgba(76, 175, 80, 0.9)',
              }} />
              <div style={{
                width: 16, height: '100%', background: '#fff', borderRadius: 8,
                marginLeft: `calc(${progress}% - 8px)`, transition: 'margin-left 0.03s linear',
                boxShadow: '0 0 10px rgba(255,255,255,0.9)',
              }} />
            </div>
            <button onClick={pullRod} style={{
              padding: '16px 48px', fontSize: 20,
              background: 'linear-gradient(180deg, #FF6B35 0%, #E84E0E 100%)',
              border: '3px solid #FFD700', borderRadius: 16, color: '#fff', fontWeight: 800,
              cursor: 'pointer', textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              boxShadow: '0 4px 16px rgba(232, 78, 14, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)',
              letterSpacing: 4, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}>
              拉杆！
            </button>
          </div>
        )}

        {/* ── judgment: GREAT / FAIL ── */}
        {gameState === 'judgment' && judgmentResult && (
          <div style={{
            position: 'absolute', top: '35%', left: '50%',
            transform: 'translate(-50%, -50%)', textAlign: 'center',
            animation: 'judgmentPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}>
            <div style={{
              fontSize: 52, fontWeight: 900, letterSpacing: 6,
              color: judgmentResult === 'GREAT' ? '#FFD700' : '#FF4444',
              textShadow: judgmentResult === 'GREAT'
                ? '0 0 20px rgba(255,215,0,0.8), 0 4px 12px rgba(0,0,0,0.6)'
                : '0 0 20px rgba(255,68,68,0.8), 0 4px 12px rgba(0,0,0,0.6)',
            }}>
              {judgmentResult === 'GREAT' ? '✨ GREAT ✨' : '💨 FAIL'}
            </div>
            <div style={{
              fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8,
              textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}>
              {judgmentResult === 'GREAT' ? '完美收杆！' : '鱼跑掉了...'}
            </div>
          </div>
        )}

        {/* ── result: 结算页 ── */}
        {gameState === 'result' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            animation: 'resultFadeIn 0.4s ease-out',
          }}>
            {judgmentResult === 'GREAT' && caughtFish ? (
              <div style={{
                textAlign: 'center', padding: 24, maxWidth: 320, position: 'relative',
                background: 'rgba(0,0,0,0.6)', borderRadius: 24,
                border: `2px solid ${RARITY_COLORS[caughtFish.rarity] || '#fff'}44`,
                animation: 'resultCardPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: 260, height: 260,
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle, ${RARITY_COLORS[caughtFish.rarity] || '#fff'}33 0%, transparent 70%)`,
                  borderRadius: '50%', animation: 'fishingPulse 2s ease-in-out infinite',
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  {caughtFish.image_url ? (
                    <img src={caughtFish.image_url} style={{
                      width: 120, height: 120, objectFit: 'contain',
                      borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }} />
                  ) : (
                    <div style={{ fontSize: 72 }}>🐟</div>
                  )}
                </div>
                <div style={{
                  position: 'relative', zIndex: 1,
                  color: RARITY_COLORS[caughtFish.rarity] || '#fff',
                  fontSize: 22, fontWeight: 700, marginTop: 12,
                  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                }}>
                  {caughtFish.name}
                </div>
                <div style={{
                  display: 'inline-block', position: 'relative', zIndex: 1,
                  padding: '2px 12px', borderRadius: 10, fontSize: 12,
                  background: `${RARITY_COLORS[caughtFish.rarity] || '#fff'}33`,
                  color: RARITY_COLORS[caughtFish.rarity] || '#fff',
                  border: `1px solid ${RARITY_COLORS[caughtFish.rarity] || '#fff'}66`,
                  marginTop: 6,
                }}>
                  {RARITY_NAMES[caughtFish.rarity] || caughtFish.rarity}
                </div>
                {caughtFish.description && (
                  <div style={{
                    position: 'relative', zIndex: 1,
                    color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8,
                  }}>
                    {caughtFish.description}
                  </div>
                )}
                <div style={{
                  position: 'relative', zIndex: 1,
                  color: '#FFD700', fontSize: 14, marginTop: 8,
                }}>
                  ✅ 已加入背包
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center', padding: 32,
                background: 'rgba(0,0,0,0.6)', borderRadius: 24,
                animation: 'resultCardPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                <div style={{ fontSize: 48 }}>💨</div>
                <div style={{
                  color: '#FF6B6B', fontSize: 20, fontWeight: 600, marginTop: 12,
                  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                }}>
                  鱼跑掉了...
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 8 }}>
                  下次再试试吧
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
              {dailyStatus.remaining > 0 ? (
                <button onClick={playAgain} style={{
                  padding: '14px 36px', fontSize: 18,
                  background: 'linear-gradient(180deg, #4facfe 0%, #0090d9 100%)',
                  border: '2px solid #FFD700', borderRadius: 14, color: '#fff', fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 4px 16px rgba(79,172,254,0.4)',
                }}>
                  再来一次
                </button>
              ) : null}
              <button onClick={onClose} style={{
                padding: '14px 36px', fontSize: 18,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 14,
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              }}>
                返回
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ─── CSS 动画 ─── */}
      <style>{`
        @keyframes fishingWave0 {
          0% { transform: translateX(0) rotate(0deg); }
          100% { transform: translateX(3%) rotate(1deg); }
        }
        @keyframes fishingWave1 {
          0% { transform: translateX(0) rotate(0deg); }
          100% { transform: translateX(-2%) rotate(-1deg); }
        }
        @keyframes fishingWave2 {
          0% { transform: translateX(0) rotate(0deg); }
          100% { transform: translateX(1.5%) rotate(0.5deg); }
        }
        @keyframes fishingBob {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-8px) rotate(5deg); }
        }
        @keyframes fishingPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes judgmentPop {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes resultFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes resultCardPop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
