import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 吃豆人 - 手机触摸控制版
 * 滑动屏幕改变方向，吃豆得分，躲避幽灵
 */
export default function PacMan({ onScore }: { onScore: (s: number) => void }) {
  const CANVAS = 400;
  const CELL = 20;
  const GRID = CANVAS / CELL; // 20x20 grid
  
  type Pos = { x: number; y: number };
  type Dir = 'up' | 'down' | 'left' | 'right';
  
  const [pacman, setPacman] = useState<Pos>({ x: 10, y: 10 });
  const [dir, setDir] = useState<Dir>('right');
  const [nextDir, setNextDir] = useState<Dir>('right');
  const [dots, setDots] = useState<Set<string>>(new Set());
  const [ghost, setGhost] = useState<Pos>({ x: 5, y: 5 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWin, setGameWin] = useState(false);
  const touchStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // 初始化豆子
  const initDots = useCallback(() => {
    const d = new Set<string>();
    for (let x = 1; x < GRID - 1; x++) {
      for (let y = 1; y < GRID - 1; y++) {
        if (Math.random() > 0.2) {
          d.add(`${x},${y}`);
        }
      }
    }
    d.delete('10,10'); // 移除吃豆人起始位置
    return d;
  }, [GRID]);
  
  // 开始新游戏
  const startGame = useCallback(() => {
    setPacman({ x: 10, y: 10 });
    setDir('right');
    setNextDir('right');
    setDots(initDots());
    setGhost({ x: 5, y: 5 });
    setScore(0);
    setGameOver(false);
    setGameWin(false);
  }, [initDots]);
  
  // 初始化
  useEffect(() => {
    startGame();
  }, [startGame]);
  
  // 移动逻辑
  useEffect(() => {
    if (gameOver || gameWin) return;
    
    const move = () => {
      // 尝试转向
      const tryMove = (d: Dir): Pos | null => {
        const delta: Record<Dir, Pos> = {
          up: { x: 0, y: -1 },
          down: { x: 0, y: 1 },
          left: { x: -1, y: 0 },
          right: { x: 1, y: 0 },
        };
        const nx = pacman.x + delta[d].x;
        const ny = pacman.y + delta[d].y;
        if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
          return { x: nx, y: ny };
        }
        return null;
      };
      
      // 先尝试 nextDir
      const next = tryMove(nextDir);
      if (next) {
        setDir(nextDir);
        setPacman(next);
        
        // 吃豆
        const key = `${next.x},${next.y}`;
        if (dots.has(key)) {
          const newDots = new Set(dots);
          newDots.delete(key);
          setDots(newDots);
          setScore(s => s + 10);
          
          // 检查胜利
          if (newDots.size === 0) {
            setGameWin(true);
            onScore(score + 10);
          }
        }
      } else {
        // 当前方向
        const curr = tryMove(dir);
        if (curr) {
          setPacman(curr);
          const key = `${curr.x},${curr.y}`;
          if (dots.has(key)) {
            const newDots = new Set(dots);
            newDots.delete(key);
            setDots(newDots);
            setScore(s => s + 10);
            if (newDots.size === 0) {
              setGameWin(true);
              onScore(score + 10);
            }
          }
        }
      }
      
      // 幽灵移动（简单AI）
      setGhost(prev => {
        const dx = pacman.x - prev.x;
        const dy = pacman.y - prev.y;
        const moveX = Math.abs(dx) > Math.abs(dy);
        const newPos = { ...prev };
        if (moveX) {
          newPos.x += dx > 0 ? 1 : -1;
        } else {
          newPos.y += dy > 0 ? 1 : -1;
        }
        return newPos;
      });
      
      // 碰撞检测
      if (ghost.x === pacman.x && ghost.y === pacman.y) {
        setGameOver(true);
        onScore(score);
      }
    };
    
    const timer = setInterval(move, 300);
    return () => clearInterval(timer);
  }, [pacman, dir, nextDir, dots, ghost, gameOver, gameWin, score, onScore, GRID]);
  
  // 触摸控制（滑动改变方向）
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    const minSwipe = 30;
    
    if (Math.abs(dx) > minSwipe || Math.abs(dy) > minSwipe) {
      if (Math.abs(dx) > Math.abs(dy)) {
        setNextDir(dx > 0 ? 'right' : 'left');
      } else {
        setNextDir(dy > 0 ? 'down' : 'up');
      }
    }
  };
  
  // 键盘控制
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: 'up', ArrowDown: 'down',
        ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
      };
      if (map[e.key]) {
        e.preventDefault();
        setNextDir(map[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  
  return (
    <div
      style={{ padding: 16, color: '#fff', textAlign: 'center', userSelect: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span>👾 吃豆人</span>
        <span>🏆 {score} 分</span>
      </div>
      
      {(gameOver || gameWin) && (
        <div style={{ marginBottom: 12, fontSize: 18 }}>
          {gameOver && '💥 被抓到了！'}
          {gameWin && '🎉 全部吃完！'}
          <br />
          最终得分：{score}
          <button
            onClick={startGame}
            style={{ marginLeft: 12, padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            再来
          </button>
        </div>
      )}
      
      <div
        style={{
          position: 'relative',
          width: CANVAS,
          height: CANVAS,
          background: '#000',
          borderRadius: 12,
          margin: '0 auto',
          overflow: 'hidden',
        }}
      >
        {/* 豆子 */}
        {Array.from(dots).map(key => {
          const [x, y] = key.split(',').map(Number);
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                left: x * CELL + CELL / 2 - 2,
                top: y * CELL + CELL / 2 - 2,
                width: 4,
                height: 4,
                background: '#FFE66D',
                borderRadius: '50%',
              }}
            />
          );
        })}
        
        {/* 吃豆人 */}
        <div
          style={{
            position: 'absolute',
            left: pacman.x * CELL,
            top: pacman.y * CELL,
            width: CELL,
            height: CELL,
            fontSize: 18,
            lineHeight: 1,
            textAlign: 'center',
            transition: 'left 0.1s, top 0.1s',
          }}
        >
          {dir === 'right' ? '😮' : dir === 'left' ? '😮⬅️' : dir === 'up' ? '😮⬆️' : '😮⬇️'}
        </div>
        
        {/* 幽灵 */}
        <div
          style={{
            position: 'absolute',
            left: ghost.x * CELL,
            top: ghost.y * CELL,
            width: CELL,
            height: CELL,
            fontSize: 18,
            lineHeight: 1,
            textAlign: 'center',
            transition: 'left 0.2s, top 0.2s',
          }}
        >
          👻
        </div>
        
        {/* 操作提示 */}
        {(gameOver || gameWin) === false && (
          <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, fontSize: 11, color: '#666' }}>
            滑动屏幕改变方向
          </div>
        )}
      </div>
    </div>
  );
}
