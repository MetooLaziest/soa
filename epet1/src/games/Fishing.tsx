import { useState, useEffect, useCallback } from 'react';

/**
 * 钓鱼 - 背景图 + 拉杆 UI + 每日3次 + 钓到鱼入背包
 */

const FISH_BG = '/epet/static/fishing/fishbg.png';

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

interface FishMap {
  id: number;
  name: string;
  description: string;
  image_url: string;
  fish: { id: number; name: string; rarity: string; weight: number }[];
}

interface CaughtFish {
  id: number;
  name: string;
  rarity: string;
  description: string;
  image_url: string;
}

export default function Fishing({ onScore, userId }: { onScore: (s: number) => void; userId?: number }) {
  const [gameState, setGameState] = useState<'select-map' | 'idle' | 'waiting' | 'progress' | 'result'>('select-map');
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [maps, setMaps] = useState<FishMap[]>([]);
  const [selectedMap, setSelectedMap] = useState<FishMap | null>(null);
  const [dailyStatus, setDailyStatus] = useState({ used: 0, limit: 3, remaining: 3 });
  const [caughtFish, setCaughtFish] = useState<CaughtFish | null>(null);
  const [message, setMessage] = useState('');
  const [bgLoaded, setBgLoaded] = useState(false);
  const [catchCount, setCatchCount] = useState(0);

  // 预加载背景图
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = FISH_BG;
  }, []);

  // 加载地图和每日次数
  useEffect(() => {
    loadMaps();
    if (userId) loadDailyStatus();
  }, [userId]);

  const loadMaps = async () => {
    try {
      const res = await fetch('/api/epet1/fishing/maps');
      const data = await res.json();
      if (data.ok) setMaps(data.maps);
    } catch (e) { console.error('Failed to load maps:', e); }
  };

  const loadDailyStatus = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/epet1/fishing/daily-status?user_id=${userId}`);
      const data = await res.json();
      if (data.ok) setDailyStatus(data);
    } catch (e) { console.error('Failed to load daily status:', e); }
  };

  // 选择地图
  const selectMap = (map: FishMap) => {
    setSelectedMap(map);
    setGameState('idle');
  };

  // 开始钓鱼
  const startFishing = useCallback(() => {
    setGameState('waiting');
    setMessage('🎣 等待鱼儿上钩...');
    setCaughtFish(null);
    setTimeout(() => {
      setGameState('progress');
      setProgress(0);
      setDirection(1);
      setMessage('快拉杆！');
    }, 1000 + Math.random() * 3000);
  }, []);

  // 进度条动画
  useEffect(() => {
    if (gameState !== 'progress') return;
    const timer = setInterval(() => {
      setProgress(p => {
        const next = p + direction * 3;
        if (next >= 100) { setDirection(-1); return 97; }
        if (next <= 0) { setDirection(1); return 3; }
        return next;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [gameState, direction]);

  // 拉杆
  const pullRod = useCallback(async () => {
    if (gameState !== 'progress') return;
    setGameState('result');

    // 绿色区域 40-70
    const success = progress >= 40 && progress <= 70;

    if (success) {
      // 调用后端 API 获取鱼
      try {
        const res = await fetch('/api/epet1/fishing/cast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId || 1,
            fishing_map_id: selectedMap?.id || 1,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setCaughtFish(data.fish);
          setCatchCount(c => c + 1);
          setDailyStatus(prev => ({ ...prev, used: prev.used + 1, remaining: data.remaining }));
          setMessage(`钓到了 ${data.fish.name}！`);
        } else {
          setMessage(data.error || '钓鱼失败');
        }
      } catch (e) {
        setMessage('网络错误');
      }
    } else {
      setMessage('鱼跑掉了...');
    }

    setTimeout(() => {
      if (dailyStatus.remaining <= 1 && success) {
        setGameState('idle');
      } else {
        setGameState('idle');
      }
      setCaughtFish(null);
      setMessage('');
    }, 2200);
  }, [gameState, progress, userId, selectedMap, dailyStatus]);

  // 结束游戏
  const endGame = useCallback(() => {
    onScore(catchCount);
  }, [catchCount, onScore]);

  const GREEN_START = 40;
  const GREEN_END = 70;

  // 地图选择页
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
                  {map.fish.length} 种鱼 · {map.fish.filter(f => f.rarity === 'legendary').length} 传说
                </div>
              </button>
            ))}
          </div>
          <button onClick={endGame} style={{
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

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: bgLoaded ? 'none' : 'linear-gradient(180deg, #1a3a5c 0%, #0d2137 60%, #0a1628 100%)',
    }}>
      {/* 背景图 */}
      <img src={FISH_BG} alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: 'center',
      }} />

      {/* 顶部状态栏 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
        zIndex: 10,
      }}>
        <span style={{ color: '#fff', fontSize: 14, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
          🎣 {selectedMap?.name || '钓鱼'}
        </span>
        <span style={{ color: dailyStatus.remaining > 0 ? '#FFD700' : '#FF6B6B', fontSize: 13, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
          今日 {dailyStatus.remaining}/{dailyStatus.limit}
        </span>
      </div>

      {/* 等待状态 */}
      {gameState === 'waiting' && (
        <div style={{
          position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 10, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, animation: 'fishingBob 1.5s ease-in-out infinite' }}>🎣</div>
          <div style={{ color: '#fff', fontSize: 16, marginTop: 12, textShadow: '0 2px 8px rgba(0,0,0,0.8)', animation: 'fishingPulse 1.5s ease-in-out infinite' }}>
            {message}
          </div>
        </div>
      )}

      {/* 进度条 + 拉杆 */}
      {gameState === 'progress' && (
        <div style={{
          position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, width: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: '100%', height: 20, background: 'rgba(0,0,0,0.6)', borderRadius: 10,
            overflow: 'hidden', position: 'relative', border: '2px solid rgba(255,255,255,0.3)',
          }}>
            <div style={{ position: 'absolute', left: `${GREEN_START}%`, width: `${GREEN_END - GREEN_START}%`, height: '100%', background: 'rgba(76, 175, 80, 0.5)', borderLeft: '2px solid rgba(76, 175, 80, 0.8)', borderRight: '2px solid rgba(76, 175, 80, 0.8)' }} />
            <div style={{ width: 14, height: '100%', background: '#fff', borderRadius: 7, marginLeft: `calc(${progress}% - 7px)`, transition: 'margin-left 0.03s linear', boxShadow: '0 0 8px rgba(255,255,255,0.8)' }} />
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

      {/* 结果 */}
      {gameState === 'result' && caughtFish && (
        <div style={{
          position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 10, textAlign: 'center', animation: 'resultPop 0.4s ease-out',
        }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🐟</div>
          <div style={{
            color: RARITY_COLORS[caughtFish.rarity] || '#fff', fontSize: 22, fontWeight: 700,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)', marginBottom: 4,
          }}>
            {caughtFish.name}
          </div>
          <div style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 8, fontSize: 12,
            background: `${RARITY_COLORS[caughtFish.rarity]}33`, color: RARITY_COLORS[caughtFish.rarity],
            border: `1px solid ${RARITY_COLORS[caughtFish.rarity]}66`,
          }}>
            {RARITY_NAMES[caughtFish.rarity] || caughtFish.rarity}
          </div>
          {caughtFish.description && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 8, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              {caughtFish.description}
            </div>
          )}
          <div style={{ color: '#FFD700', fontSize: 14, marginTop: 8, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            ✅ 已加入背包
          </div>
        </div>
      )}

      {gameState === 'result' && !caughtFish && (
        <div style={{
          position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 10, textAlign: 'center', animation: 'resultPop 0.4s ease-out',
        }}>
          <div style={{ fontSize: 40 }}>💨</div>
          <div style={{ color: '#FF6B6B', fontSize: 18, fontWeight: 600, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
            {message}
          </div>
        </div>
      )}

      {/* 空闲 - 拉杆按钮 */}
      {gameState === 'idle' && (
        <div style={{
          position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          {dailyStatus.remaining > 0 ? (
            <>
              <button onClick={startFishing} style={{
                padding: '16px 48px', fontSize: 20,
                background: 'linear-gradient(180deg, #4facfe 0%, #0090d9 100%)',
                border: '3px solid #FFD700', borderRadius: 16, color: '#fff', fontWeight: 800,
                cursor: 'pointer', textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                boxShadow: '0 4px 16px rgba(79, 172, 254, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)',
                letterSpacing: 4, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}>
                拉杆
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
            <button onClick={endGame} style={{
              padding: '8px 20px', background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12,
            }}>
              返回
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fishingBob {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-8px) rotate(5deg); }
        }
        @keyframes fishingPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes resultPop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
