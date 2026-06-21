import { useState, useEffect, useCallback } from 'react';
import GameFullscreen from './GameFullscreen';

/**
 * 找不同 - 全屏 + 上下对比
 * 从API加载关卡（双图 + 不同点坐标），随机选择3关
 */

interface DiffSpot {
  x: number;       // 百分比 0-100
  y: number;
  radius: number;
  label: string;
  found?: boolean;
}

interface Level {
  id: number;
  name: string;
  image_a_url: string;
  image_b_url: string;
  diff_spots: DiffSpot[];
}

// 内置备用关卡（当API无数据时使用）
const FALLBACK_ROUNDS: Level[] = [
  {
    id: 0, name: '庭院寻宝', image_a_url: '', image_b_url: '',
    diff_spots: [
      { x: 50, y: 25, radius: 25, label: '房子' },
      { x: 20, y: 35, radius: 22, label: '树' },
      { x: 30, y: 55, radius: 18, label: '花' },
      { x: 65, y: 45, radius: 16, label: '蝴蝶' },
      { x: 25, y: 10, radius: 18, label: '天气' },
    ],
  },
  {
    id: 0, name: '海底世界', image_a_url: '', image_b_url: '',
    diff_spots: [
      { x: 30, y: 30, radius: 20, label: '鱼' },
      { x: 70, y: 45, radius: 20, label: '珊瑚' },
      { x: 50, y: 60, radius: 24, label: '章鱼' },
      { x: 40, y: 80, radius: 16, label: '海星' },
      { x: 25, y: 50, radius: 18, label: '河豚' },
    ],
  },
  {
    id: 0, name: '星空夜景', image_a_url: '', image_b_url: '',
    diff_spots: [
      { x: 75, y: 15, radius: 22, label: '月亮' },
      { x: 25, y: 20, radius: 16, label: '星星' },
      { x: 55, y: 12, radius: 16, label: '流星' },
      { x: 20, y: 60, radius: 20, label: '树' },
      { x: 50, y: 72, radius: 18, label: '帐篷' },
    ],
  },
];

// 内置场景 emoji（当无图片时用 emoji 渲染）
const SCENE_EMOJIS: Record<string, { bg: [string, string]; elements: { emoji: string; x: number; y: number; size: number }[] }> = {
  '庭院寻宝': {
    bg: ['#4a7c59', '#2d5a3f'],
    elements: [
      { emoji: '🏠', x: 50, y: 25, size: 48 },
      { emoji: '🌳', x: 20, y: 35, size: 36 },
      { emoji: '🌳', x: 80, y: 35, size: 36 },
      { emoji: '🌸', x: 30, y: 55, size: 28 },
      { emoji: '🌸', x: 70, y: 55, size: 28 },
      { emoji: '🐱', x: 50, y: 65, size: 32 },
      { emoji: '🌤️', x: 25, y: 10, size: 32 },
      { emoji: '🦋', x: 65, y: 45, size: 22 },
    ],
  },
  '海底世界': {
    bg: ['#1a6b8a', '#0d3d56'],
    elements: [
      { emoji: '🐠', x: 30, y: 30, size: 32 },
      { emoji: '🐠', x: 70, y: 45, size: 32 },
      { emoji: '🐙', x: 50, y: 60, size: 38 },
      { emoji: '🪸', x: 15, y: 75, size: 30 },
      { emoji: '🪸', x: 85, y: 75, size: 30 },
      { emoji: '⭐', x: 40, y: 80, size: 24 },
      { emoji: '🐚', x: 60, y: 82, size: 24 },
      { emoji: '🐡', x: 25, y: 50, size: 28 },
    ],
  },
  '星空夜景': {
    bg: ['#1a1a3e', '#0a0a1a'],
    elements: [
      { emoji: '🌙', x: 75, y: 15, size: 36 },
      { emoji: '⭐', x: 25, y: 20, size: 22 },
      { emoji: '⭐', x: 55, y: 12, size: 20 },
      { emoji: '⭐', x: 85, y: 30, size: 18 },
      { emoji: '🏔️', x: 50, y: 55, size: 44 },
      { emoji: '🌲', x: 20, y: 60, size: 32 },
      { emoji: '🌲', x: 80, y: 62, size: 32 },
      { emoji: '🏕️', x: 50, y: 72, size: 28 },
    ],
  },
};

const SWAP_MAPS: Record<string, Record<number, string>> = {
  '庭院寻宝': { 0: '🏰', 1: '🎄', 2: '🌺', 3: '🐝', 4: '🌙' },
  '海底世界': { 0: '🐟', 1: '🫧', 2: '🦑', 3: '💫', 4: '🐬' },
  '星空夜景': { 0: '🌕', 1: '✨', 2: '💫', 3: '🎄', 4: '⛺' },
};

export default function SpotDifference({ onScore }: { onScore: (s: number) => void }) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [diffs, setDiffs] = useState<DiffSpot[]>([]);
  const [foundCount, setFoundCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentLevel = levels[currentIdx];
  const totalDiffs = diffs.length;

  // 加载关卡
  useEffect(() => {
    fetch('/api/epet1/spotdiff/levels?count=3')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.levels?.length > 0) {
          setLevels(data.levels);
        } else {
          setLevels(FALLBACK_ROUNDS);
        }
      })
      .catch(() => setLevels(FALLBACK_ROUNDS))
      .finally(() => setLoading(false));
  }, []);

  const initRound = useCallback(() => {
    if (!currentLevel) return;
    const newDiffs = (currentLevel.diff_spots || []).map(d => ({ ...d, found: false }));
    setDiffs(newDiffs);
    setFoundCount(0);
    setTimeLeft(60);
    setGameOver(false);
  }, [currentLevel]);

  useEffect(() => {
    if (currentLevel) initRound();
  }, [currentLevel, initRound]);

  // 倒计时
  useEffect(() => {
    if (gameOver || foundCount >= totalDiffs || totalDiffs === 0) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setGameOver(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameOver, foundCount, totalDiffs]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameOver || foundCount >= totalDiffs) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;

    const hitIdx = diffs.findIndex(d =>
      !d.found &&
      Math.sqrt((d.x - px) ** 2 + (d.y - py) ** 2) < (d.radius / rect.width * 100 + 5)
    );

    if (hitIdx >= 0) {
      const newDiffs = [...diffs];
      newDiffs[hitIdx] = { ...newDiffs[hitIdx], found: true };
      setDiffs(newDiffs);
      const newFound = foundCount + 1;
      setFoundCount(newFound);

      if (newFound >= totalDiffs) {
        const timeBonus = Math.floor(timeLeft / 2);
        const roundScore = 50 + timeBonus;
        const newScore = score + roundScore;
        setScore(newScore);

        if (currentIdx >= levels.length - 1) {
          setTimeout(() => setGameOver(true), 800);
        } else {
          setTimeout(() => setCurrentIdx(i => i + 1), 1200);
        }
      }
    }
  };

  // 渲染 emoji 场景（备用）
  const renderEmojiScene = (isModified: boolean) => {
    const name = currentLevel.name;
    const scene = SCENE_EMOJIS[name];
    if (!scene) return null;

    return (
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        background: `linear-gradient(180deg, ${scene.bg[0]}, ${scene.bg[1]})`,
        borderRadius: 12, overflow: 'hidden',
      }}>
        {scene.elements.map((el, i) => {
          let emoji = el.emoji;
          if (isModified) {
            const diffIdx = currentLevel.diff_spots.findIndex(d =>
              Math.abs(d.x - el.x) < 3 && Math.abs(d.y - el.y) < 3
            );
            if (diffIdx >= 0) {
              emoji = SWAP_MAPS[name]?.[diffIdx] || '❓';
            }
          }
          return (
            <div key={i} style={{
              position: 'absolute', left: `${el.x}%`, top: `${el.y}%`,
              transform: 'translate(-50%, -50%)', fontSize: el.size, lineHeight: 1,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}>
              {emoji}
            </div>
          );
        })}
      </div>
    );
  };

  // 渲染图片场景
  const renderImageScene = (url: string) => (
    <img src={url} alt="" style={{
      width: '100%', height: '100%', objectFit: 'contain',
      borderRadius: 12, background: '#1a1a2e',
    }} />
  );

  const hasImages = currentLevel?.image_a_url && currentLevel?.image_b_url;

  if (loading) {
    return (
      <GameFullscreen onClose={() => onScore(0)}>
        <div style={{ color: '#fff', textAlign: 'center' }}>加载中...</div>
      </GameFullscreen>
    );
  }

  return (
    <GameFullscreen onClose={() => onScore(score)}>
      <div style={{
        width: '100%', maxWidth: 400, height: '100%', display: 'flex',
        flexDirection: 'column', padding: '0 8px', paddingTop: 50, color: '#fff',
      }}>
        {/* 顶部信息 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 8, padding: '0 4px',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>🔍 {currentLevel?.name || '找不同'}</span>
          <span style={{ fontSize: 14, color: '#FFD700' }}>🏆 {score}分</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: 8,
          padding: '0 4px', fontSize: 13, color: 'rgba(255,255,255,0.7)',
        }}>
          <span>第 {currentIdx + 1}/{levels.length} 关</span>
          <span style={{ color: timeLeft <= 10 ? '#ff6b6b' : '#FFD700' }}>⏱️ {timeLeft}s</span>
          <span>已找到 {foundCount}/{totalDiffs}</span>
        </div>

        {/* 两张对比图 */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: 6,
          minHeight: 0, maxHeight: 'calc(100vh - 180px)',
        }}>
          {/* 原图 */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2, textAlign: 'center' }}>
              📷 原图
            </div>
            <div
              onClick={handleClick}
              style={{ position: 'relative', width: '100%', height: 'calc(100% - 16px)' }}
            >
              {hasImages ? renderImageScene(currentLevel.image_a_url) : renderEmojiScene(false)}
              {diffs.map((d, i) => d.found && (
                <div key={i} style={{
                  position: 'absolute', left: `${d.x}%`, top: `${d.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: d.radius * 2.5, height: d.radius * 2.5,
                  border: '3px solid #FF6B6B', borderRadius: '50%',
                  pointerEvents: 'none', boxShadow: '0 0 8px rgba(255,107,107,0.5)',
                }} />
              ))}
            </div>
          </div>

          {/* 改动图 */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2, textAlign: 'center' }}>
              🔎 找不同
            </div>
            <div
              onClick={handleClick}
              style={{ position: 'relative', width: '100%', height: 'calc(100% - 16px)' }}
            >
              {hasImages ? renderImageScene(currentLevel.image_b_url) : renderEmojiScene(true)}
              {diffs.map((d, i) => d.found && (
                <div key={i} style={{
                  position: 'absolute', left: `${d.x}%`, top: `${d.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: d.radius * 2.5, height: d.radius * 2.5,
                  border: '3px solid #FF6B6B', borderRadius: '50%',
                  pointerEvents: 'none', boxShadow: '0 0 8px rgba(255,107,107,0.5)',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* 游戏结束 */}
        {gameOver && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#fff', zIndex: 5,
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>
              {foundCount >= totalDiffs ? '🎉' : '⏱️'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {foundCount >= totalDiffs ? '太厉害了！' : '时间到！'}
            </div>
            <div style={{ fontSize: 16, color: '#FFD700', marginBottom: 16 }}>得分：{score}</div>
            <button onClick={() => onScore(score)} style={{
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              border: 'none', borderRadius: 20, padding: '10px 32px',
              fontSize: 16, fontWeight: 700, color: '#fff', cursor: 'pointer',
            }}>
              确定
            </button>
          </div>
        )}
      </div>
    </GameFullscreen>
  );
}
