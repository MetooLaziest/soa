import { useState, useEffect, useCallback } from 'react';
import GameFullscreen from './GameFullscreen';

/**
 * 塔楼建筑 - 全屏 + 触摸支持
 * 点击屏幕放置方块
 */
export default function Tower({ onScore }: { onScore: (s: number) => void }) {
  const BLOCK_H = 30;
  const GAME_W = 375;
  const GAME_H = 500;
  
  const [blocks, setBlocks] = useState<{ x: number; y: number; w: number }[]>([
    { x: 100, y: GAME_H - BLOCK_H, w: 200 }
  ]);
  const [currentX, setCurrentX] = useState(150);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [placing, setPlacing] = useState(false);

  // 放置方块
  const placeBlock = useCallback(() => {
    if (gameOver || placing) return;
    setPlacing(true);

    const last = blocks[blocks.length - 1];
    const newW = 100;
    const newX = currentX - newW / 2;
    const newY = last.y - BLOCK_H;

    // 计算对齐度
    const overlap = Math.min(last.x + last.w, newX + newW) - Math.max(last.x, newX);
    const penalty = Math.abs((newX + newW / 2) - (last.x + last.w / 2));

    let addScore = 0;
    if (overlap > 0) {
      addScore = Math.max(10, Math.floor(30 - penalty));
    } else {
      addScore = -20;
    }

    const newScore = score + addScore;
    setScore(newScore);
    setBlocks(prev => [...prev, { x: newX, y: newY, w: newW }]);

    // 检查游戏结束
    if (newY < 50 || penalty > 60) {
      setGameOver(true);
      onScore(newScore);
    } else {
      setTimeout(() => setPlacing(false), 200);
    }
  }, [gameOver, placing, blocks, currentX, score, onScore]);

  // 方块左右移动
  useEffect(() => {
    if (gameOver || placing) return;
    const timer = setInterval(() => {
      setCurrentX(x => {
        const next = x + direction * 3;
        if (next > GAME_W - 50 || next < 50) {
          setDirection(d => d === 1 ? -1 : 1);
          return x + direction * 3;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(timer);
  }, [gameOver, placing, direction]);

  // 键盘控制
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        placeBlock();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [placeBlock]);

  return (
    <GameFullscreen onClose={() => onScore(score)}>
      <div style={{ color: '#fff', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span>🏗️ 塔楼建筑</span>
          <span>🏆 {score} 分</span>
        </div>

        {gameOver && (
          <div style={{ marginBottom: 12, fontSize: 18 }}>
            💥 游戏结束！最终得分：{score}
          </div>
        )}

        <div
          style={{
            position: 'relative',
            width: GAME_W,
            height: GAME_H,
            background: 'linear-gradient(180deg, #87CEEB, #E0F7FA)',
            borderRadius: 12,
            margin: '0 auto',
            overflow: 'hidden',
          }}
          onClick={placeBlock}
        >
          {/* 已放置的方块 */}
          {blocks.map((b, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: b.x,
                top: b.y,
                width: b.w,
                height: BLOCK_H,
                background: i === 0 ? '#8B4513' : `hsl(${i * 30}, 70%, 60%)`,
                borderRadius: 4,
              }}
            />
          ))}

          {/* 当前移动的方块 */}
          {!gameOver && (
            <div
              style={{
                position: 'absolute',
                left: currentX - 50,
                top: blocks[blocks.length - 1].y - BLOCK_H,
                width: 100,
                height: BLOCK_H,
                background: '#FFE66D',
                borderRadius: 4,
                border: '2px solid #F5C76D',
              }}
            />
          )}

          {/* 提示 */}
          {!gameOver && (
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, fontSize: 12, color: '#333' }}>
              点击屏幕或按空格键放置方块
            </div>
          )}
        </div>
      </div>
    </GameFullscreen>
  );
}
