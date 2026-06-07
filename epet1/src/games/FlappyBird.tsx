import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Flappy Bird - Canvas 实现
 * 空格/点击 飞翔，穿过柱子得分，撞到 Game Over
 */
export default function FlappyBird({ onScore }: { onScore: (s: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('flappy_best') || 0));
  const [gameOver, setGameOver] = useState(false);
  const [playing, setPlaying] = useState(false);
  const stateRef = useRef<{
    birdY: number; vel: number; pipes: { x: number; gapY: number; passed: boolean }[];
    score: number; frame: number; over: boolean; started: boolean;
  } | null>(null);
  const rafRef = useRef<number>(0);

  const W = 320, H = 480, GRAVITY = 0.45, FLAP = -7, PIPE_W = 52, GAP = 140, SPEED = 2.2;

  const reset = useCallback(() => {
    stateRef.current = {
      birdY: H / 2, vel: 0,
      pipes: [], score: 0, frame: 0, over: false, started: false,
    };
    setScore(0); setGameOver(false); setPlaying(false);
  }, []);

  useEffect(() => { reset(); return () => cancelAnimationFrame(rafRef.current); }, [reset]);

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.over) return;
    if (!s.started) { s.started = true; setPlaying(true); }
    s.vel = FLAP;
  }, []);

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [flap]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const loop = () => {
      const s = stateRef.current;
      if (!s) { rafRef.current = requestAnimationFrame(loop); return; }
      if (s.over) { cancelAnimationFrame(rafRef.current); return; }
      if (!s.started) { rafRef.current = requestAnimationFrame(loop); return; }

      // Physics
      s.vel += GRAVITY;
      s.birdY += s.vel;

      // Pipe management
      s.frame++;
      if (s.frame % 90 === 0) {
        s.pipes.push({ x: W + 10, gapY: 80 + Math.random() * (H - GAP - 160), passed: false });
      }
      s.pipes = s.pipes.map(p => ({ ...p, x: p.x - SPEED })).filter(p => p.x + PIPE_W > 0);

      // Score
      s.pipes.forEach(p => {
        if (!p.passed && p.x + PIPE_W < 60) { p.passed = true; s.score++; setScore(s.score); }
      });

      // Collision
      const birdTop = s.birdY - 12, birdBot = s.birdY + 12;
      if (birdTop < 0 || birdBot > H - 60) { s.over = true; finish(s.score); return; }
      for (const p of s.pipes) {
        if (60 + 12 > p.x && 60 - 12 < p.x + PIPE_W) {
          if (s.birdY - 12 < p.gapY || s.birdY + 12 > p.gapY + GAP) { s.over = true; finish(s.score); return; }
        }
      }

      // Draw
      ctx.fillStyle = '#70c5ce'; ctx.fillRect(0, 0, W, H);
      // Pipes
      ctx.fillStyle = '#75b836';
      s.pipes.forEach(p => {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, H);
      });
      // Ground
      ctx.fillStyle = '#d2a65a'; ctx.fillRect(0, H - 60, W, 60);
      // Bird
      ctx.fillStyle = '#f7dc6f'; ctx.beginPath(); ctx.arc(60, s.birdY, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.stroke();

      rafRef.current = requestAnimationFrame(loop);
    };

    const finish = (sc: number) => {
      setGameOver(true); setPlaying(false);
      const b = Math.max(sc, best);
      setBest(b); localStorage.setItem('flappy_best', String(b));
      onScore(sc);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [best, onScore]);

  const handleClick = () => { if (gameOver) reset(); else flap(); };

  return (
    <div className="game-flappy" onClick={handleClick}>
      <div className="game-flappy-hud">得分：{score} · 最高：{best}</div>
      <canvas ref={canvasRef} width={W} height={H} className="game-flappy-canvas" />
      {!playing && !gameOver && (
        <div className="game-flappy-overlay">点击/空格 开始</div>
      )}
      {gameOver && (
        <div className="game-flappy-overlay">
          <div>💀 Game Over</div>
          <div>得分：{score}</div>
          <button className="btn-primary" onClick={e => { e.stopPropagation(); reset(); }}>再来！</button>
        </div>
      )}
    </div>
  );
}
