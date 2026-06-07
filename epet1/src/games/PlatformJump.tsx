import { useState, useEffect, useRef } from 'react';
import GameFullscreen from './GameFullscreen';

/**
 * 平台跳跃 - 对标微信跳一跳
 * 按住蓄力，松手跳跃
 */
export default function PlatformJump({ onScore }: { onScore: (s: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [charging, setCharging] = useState(false);
  const [chargePower, setChargePower] = useState(0);

  // 游戏状态
  const gameStateRef = useRef({
    player: { x: 100, y: 300, vy: 0 },
    platforms: [
      { x: 50, y: 350, w: 100 },
      { x: 200, y: 350, w: 100 },
    ],
    gravity: 0.8,
    charging: false,
    chargePower: 0,
  });

  // 初始化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 游戏循环
    const gameLoop = () => {
      const state = gameStateRef.current;

      // 清空画布
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制平台
      ctx.fillStyle = '#8B4513';
      state.platforms.forEach(p => {
        ctx.fillRect(p.x, p.y, p.w, 20);
      });

      // 绘制玩家
      ctx.fillStyle = '#FFE66D';
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 15, 0, Math.PI * 2);
      ctx.fill();

      // 物理更新
      if (!state.charging) {
        state.player.vy += state.gravity;
        state.player.y += state.player.vy;

        // 落地检测
        state.platforms.forEach(p => {
          if (
            state.player.x > p.x &&
            state.player.x < p.x + p.w &&
            state.player.y + 15 >= p.y &&
            state.player.y + 15 <= p.y + 20
          ) {
            state.player.vy = 0;
            state.player.y = p.y - 15;
            setScore(s => s + 10);
          }
        });

        // 掉落检测
        if (state.player.y > canvas.height) {
          setGameOver(true);
          onScore(score);
        }
      }

      // 蓄力条
      if (state.charging) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(20, canvas.height - 40, 200, 20);
        ctx.fillStyle = '#4facfe';
        ctx.fillRect(20, canvas.height - 40, state.chargePower * 2, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.fillText(`蓄力: ${state.chargePower}%`, 230, canvas.height - 25);
      }

      if (!gameOver) {
        requestAnimationFrame(gameLoop);
      }
    };

    gameLoop();
  }, [gameOver, score, onScore]);

  // 触摸/鼠标控制
  const startCharge = () => {
    if (gameOver) return;
    setCharging(true);
    gameStateRef.current.charging = true;

    // 蓄力动画
    const chargeInterval = setInterval(() => {
      setChargePower(p => {
        if (p >= 100) {
          clearInterval(chargeInterval);
          return 100;
        }
        return p + 2;
      });
    }, 16);

    // 保存到 ref 以便结束时清除
    (window as any).chargeInterval = chargeInterval;
  };

  const releaseCharge = () => {
    if (!charging || gameOver) return;
    setCharging(false);
    gameStateRef.current.charging = false;
    clearInterval((window as any).chargeInterval);

    // 跳跃
    const state = gameStateRef.current;
    const power = chargePower;
    state.player.vy = -power * 0.3;
    state.player.x += power * 0.5;

    setChargePower(0);
  };

  return (
    <GameFullscreen onClose={() => onScore(score)}>
      <div style={{ color: '#fff', textAlign: 'center' }}>
        <div style={{ marginBottom: 12 }}>
          🏃 平台跳跃 | 🏆 {score} 分
        </div>

        <canvas
          ref={canvasRef}
          width={375}
          height={400}
          style={{ background: '#87CEEB', borderRadius: 12, touchAction: 'none' }}
          onMouseDown={startCharge}
          onMouseUp={releaseCharge}
          onTouchStart={startCharge}
          onTouchEnd={releaseCharge}
        />

        <div style={{ marginTop: 12, fontSize: 14, color: '#aaa' }}>
          {charging ? '� charging...' : '👆 按住蓄力，松手跳跃'}
        </div>

        {gameOver && (
          <div style={{ marginTop: 16, fontSize: 18 }}>
            💥 掉下去了！最终得分：{score}
          </div>
        )}
      </div>
    </GameFullscreen>
  );
}
