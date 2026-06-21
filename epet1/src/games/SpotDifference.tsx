import { useState, useEffect, useCallback } from 'react';
import GameFullscreen from './GameFullscreen';

/**
 * 找不同 - 全屏 + 左右/上下对比
 * 用 canvas 绘制两张图，第二张有若干处不同
 * 点击找出所有不同之处
 */

interface DiffSpot {
  x: number;       // 百分比坐标 0-100
  y: number;
  radius: number;   // 检测半径(px)
  found: boolean;
  label: string;
}

// 预设关卡：每关有不同的元素布局，第二张图有变化
const ROUNDS: {
  title: string;
  bgGradient: [string, string];
  elements: { emoji: string; x: number; y: number; size: number }[];
  diffs: Omit<DiffSpot, 'found'>[];
  // diffs 描述第二张图相比第一张图的变化
}[] = [
  {
    title: '庭院寻宝',
    bgGradient: ['#4a7c59', '#2d5a3f'],
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
    diffs: [
      { x: 50, y: 25, radius: 25, label: '房子变了' },     // 🏠 → 🏰
      { x: 20, y: 35, radius: 22, label: '树变了' },       // 🌳 → 🎄
      { x: 30, y: 55, radius: 18, label: '花变了' },       // 🌸 → 🌺
      { x: 65, y: 45, radius: 16, label: '蝴蝶变了' },     // 🦋 → 🐝
      { x: 25, y: 10, radius: 18, label: '天气变了' },     // 🌤️ → 🌙
    ],
  },
  {
    title: '海底世界',
    bgGradient: ['#1a6b8a', '#0d3d56'],
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
    diffs: [
      { x: 30, y: 30, radius: 20, label: '鱼变色了' },
      { x: 70, y: 45, radius: 20, label: '鱼不见了' },
      { x: 50, y: 60, radius: 24, label: '章鱼变了' },
      { x: 40, y: 80, radius: 16, label: '海星变了' },
      { x: 25, y: 50, radius: 18, label: '河豚变了' },
    ],
  },
  {
    title: '星空夜景',
    bgGradient: ['#1a1a3e', '#0a0a1a'],
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
    diffs: [
      { x: 75, y: 15, radius: 22, label: '月亮变了' },
      { x: 25, y: 20, radius: 16, label: '星星变了' },
      { x: 55, y: 12, radius: 16, label: '星星变了' },
      { x: 20, y: 60, radius: 20, label: '树变了' },
      { x: 50, y: 72, radius: 18, label: '帐篷变了' },
    ],
  },
];

// 第二张图的替换 emoji（按 diff 索引映射）
const SWAP_EMOJIS: string[][] = [
  ['🏰', '🎄', '🌺', '🐝', '🌙'],
  ['🐟', '🫧', '🦑', '💫', '🐬'],
  ['🌕', '✨', '💫', '🎄', '⛺'],
];

export default function SpotDifference({ onScore }: { onScore: (s: number) => void }) {
  const [currentRound, setCurrentRound] = useState(0);
  const [diffs, setDiffs] = useState<DiffSpot[]>([]);
  const [foundCount, setFoundCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const round = ROUNDS[currentRound];
  const totalDiffs = round.diffs.length;

  const initRound = useCallback(() => {
    const newDiffs = ROUNDS[currentRound].diffs.map(d => ({ ...d, found: false }));
    setDiffs(newDiffs);
    setFoundCount(0);
    setTimeLeft(60);
    setGameOver(false);
    setShowHint(false);
  }, [currentRound]);

  useEffect(() => { initRound(); }, [initRound]);

  // 倒计时
  useEffect(() => {
    if (gameOver || foundCount >= totalDiffs) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setGameOver(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameOver, foundCount, totalDiffs]);

  // 点击检测
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameOver || foundCount >= totalDiffs) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;

    // 检查是否点中未发现的不同
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

        if (currentRound >= ROUNDS.length - 1) {
          // 最后一关
          setTimeout(() => setGameOver(true), 800);
        } else {
          setTimeout(() => {
            setCurrentRound(r => r + 1);
          }, 1200);
        }
      }
    }
  };

  // 渲染场景
  const renderScene = (isModified: boolean) => {
    const round = ROUNDS[currentRound];
    return (
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        background: `linear-gradient(180deg, ${round.bgGradient[0]}, ${round.bgGradient[1]})`,
        borderRadius: 12, overflow: 'hidden',
      }}>
        {round.elements.map((el, i) => {
          // 如果这是修改版，检查是否有 diff 对应这个元素
          let emoji = el.emoji;
          if (isModified) {
            const diffIdx = round.diffs.findIndex(d => {
              return Math.abs(d.x - el.x) < 3 && Math.abs(d.y - el.y) < 3;
            });
            if (diffIdx >= 0) {
              emoji = SWAP_EMOJIS[currentRound]?.[diffIdx] || '❓';
            }
          }
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${el.x}%`, top: `${el.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: el.size,
              lineHeight: 1,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}>
              {emoji}
            </div>
          );
        })}
      </div>
    );
  };

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
          <span style={{ fontSize: 15, fontWeight: 700 }}>🔍 {round.title}</span>
          <span style={{ fontSize: 14, color: '#FFD700' }}>🏆 {score}分</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: 8,
          padding: '0 4px', fontSize: 13, color: 'rgba(255,255,255,0.7)',
        }}>
          <span>第 {currentRound + 1}/{ROUNDS.length} 关</span>
          <span style={{ color: timeLeft <= 10 ? '#ff6b6b' : '#FFD700' }}>⏱️ {timeLeft}s</span>
          <span>已找到 {foundCount}/{totalDiffs}</span>
        </div>

        {/* 提示按钮 */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <button onClick={() => setShowHint(h => !h)} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 12,
            color: '#FFD700', fontSize: 12, padding: '3px 12px', cursor: 'pointer',
          }}>
            {showHint ? '🙈 隐藏提示' : '💡 显示提示'}
          </button>
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
              {renderScene(false)}
              {/* 已找到的标记 */}
              {diffs.map((d, i) => d.found && (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${d.x}%`, top: `${d.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: d.radius * 2.5, height: d.radius * 2.5,
                  border: '3px solid #FF6B6B',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  animation: 'pulse 0.3s ease-out',
                  boxShadow: '0 0 8px rgba(255,107,107,0.5)',
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
              {renderScene(true)}
              {diffs.map((d, i) => d.found && (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${d.x}%`, top: `${d.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: d.radius * 2.5, height: d.radius * 2.5,
                  border: '3px solid #FF6B6B',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  boxShadow: '0 0 8px rgba(255,107,107,0.5)',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* 提示浮层 */}
        {showHint && !gameOver && (
          <div style={{
            position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.8)', borderRadius: 12, padding: '8px 16px',
            fontSize: 12, color: '#FFD700', textAlign: 'center', maxWidth: 280,
          }}>
            💡 提示：找找看 {round.diffs.filter(d => !diffs.find(dd => dd.x === d.x && dd.found)).slice(0, 2).map(d => d.label).join('、')}
          </div>
        )}

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
            <div style={{ fontSize: 16, color: '#FFD700', marginBottom: 16 }}>
              得分：{score}
            </div>
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
