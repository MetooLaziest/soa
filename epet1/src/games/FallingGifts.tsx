import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 天降好礼 - Canvas 实现
 * 拖动篮子接住掉落礼物，漏接 3 个游戏结束
 */
export default function FallingGifts({ onScore }: { onScore: (s: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [playing, setPlaying] = useState(false);
  const stateRef = useRef<{
    basketX: number; targetX: number; score: number;
    gifts: { x: number; y: number; speed: number; emoji: string }[];
    frame: number; over: boolean; started: boolean;
  } | null>(null);
  const rafRef = useRef(0);
  const BASKET_W = 60, GIFT_SIZE = 24;

  const EMOJIS = ['🎁','🎀','🧧','🎊','🎉','💝','🎈'];

  const reset = useCallback(() => {
    stateRef.current = {
      basketX: 160, targetX: 160, score: 0,
      gifts: [], frame: 0, over: false, started: false,
    };
    setScore(0); setLives(3); setGameOver(false); setPlaying(false);
  }, []);

  useEffect(() => { reset(); return () => cancelAnimationFrame(rafRef.current); }, [reset]);

  // Mouse/Touch move
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const move = (e: MouseEvent | TouchEvent) => {
      const rect = cvs.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const mx = x - rect.left;
      if (stateRef.current) stateRef.current.targetX = Math.max(BASKET_W/2, Math.min(320 - BASKET_W/2, mx));
    };
    cvs.addEventListener('mousemove', move);
    cvs.addEventListener('touchmove', move, { passive: true });
    return () => { cvs.removeEventListener('mousemove', move); cvs.removeEventListener('touchmove', move); };
  }, []);

  // Start on click
  const handleStart = () => {
    if (stateRef.current && !stateRef.current.started) {
      stateRef.current.started = true;
      setPlaying(true);
    }
  };

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 320, H = 480;

    const loop = () => {
      const s = stateRef.current;
      if (!s || s.over) { cancelAnimationFrame(rafRef.current); return; }
      if (!s.started) { rafRef.current = requestAnimationFrame(loop); return; }

      // Move basket smoothly
      s.basketX += (s.targetX - s.basketX) * 0.15;

      // Spawn gifts
      s.frame++;
      if (s.frame % 40 === 0) {
        s.gifts.push({
          x: Math.random() * (W - GIFT_SIZE),
          y: -GIFT_SIZE,
          speed: 1.5 + Math.random() * 1.5,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        });
      }

      // Update gifts
      let caught = 0;
      s.gifts = s.gifts.filter(g => {
        g.y += g.speed;
        // Catch check
        if (g.y >= H - 60 - GIFT_SIZE && g.y <= H - 60 &&
            g.x + GIFT_SIZE/2 >= s.basketX - BASKET_W/2 && g.x - GIFT_SIZE/2 <= s.basketX + BASKET_W/2) {
          caught++;
          return false;
        }
        if (g.y > H) {
          // Missed
          setLives(prev => {
            const nl = prev - 1;
            if (nl <= 0) { s.over = true; setGameOver(true); onScore(s.score); }
            return nl;
          });
          return false;
        }
        return true;
      });
      if (caught > 0) setScore(prev => prev + caught * 10);

      // Draw
      ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, W, H);
      // Gifts
      s.gifts.forEach(g => {
        ctx.font = '22px serif'; ctx.textAlign = 'center';
        ctx.fillText(g.emoji, g.x + GIFT_SIZE/2, g.y + GIFT_SIZE);
      });
      // Basket
      ctx.font = '36px serif';
      ctx.fillText('🧺', s.basketX, H - 35);
      // HUD
      ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
      ctx.fillText(`❤️ ×${lives}  💰 ${s.score}`, 10, 20);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onScore]);

  return (
    <div className="game-gifts" onClick={handleStart}>
      <div className="game-gifts-hud">得分：{score} · ❤️ {lives}</div>
      <canvas ref={canvasRef} width={320} height={480} className="game-gifts-canvas" />
      {!playing && !gameOver && (
        <div className="game-gifts-overlay">点击开始 · 移动接礼物</div>
      )}
      {gameOver && (
        <div className="game-gifts-overlay">
          <div>💀 游戏结束</div>
          <div>得分：{score}</div>
          <button className="btn-primary" onClick={e => { e.stopPropagation(); reset(); }}>再来！</button>
        </div>
      )}
    </div>
  );
}
