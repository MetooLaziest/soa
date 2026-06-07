import { useEffect, useRef, useCallback } from 'react';

interface Props {
  onScore: (score: number) => void;
}

const W = 320;
const H = 480;
const PLATFORM_W = 72;
const PLATFORM_H = 8;
const PLAYER_W = 24;
const PLAYER_H = 28;
const SCROLL_SPEED = 2;
const PLAYER_SPEED = 5;
const PLAYER_GRAVITY = 0.5;
const PLAYER_JUMP = -8;
const MAX_FALL = 400; // pixels fallen = game over

const STATE = {
  player: { x: W / 2 - PLAYER_W / 2, y: 100, vy: 0, onGround: false },
  platforms: [] as { x: number; y: number }[],
  floors: 0,
  fallDistance: 0,
  gameOver: false,
  keys: { left: false, right: false, up: false },
};

let animId = 0;

function initPlatforms() {
  STATE.platforms = [];
  // start platform under player
  STATE.platforms.push({ x: W / 2 - PLATFORM_W / 2, y: 160 });
  for (let y = 200; y < H + 100; y += 60 + Math.random() * 30) {
    const x = Math.random() * (W - PLATFORM_W);
    STATE.platforms.push({ x, y });
  }
}

function resetGame() {
  STATE.player = { x: W / 2 - PLAYER_W / 2, y: 100, vy: 0, onGround: false };
  STATE.floors = 0;
  STATE.fallDistance = 0;
  STATE.gameOver = false;
  initPlatforms();
}

function update() {
  if (STATE.gameOver) return;
  const p = STATE.player;

  // input
  if (STATE.keys.left) p.x -= PLAYER_SPEED;
  if (STATE.keys.right) p.x += PLAYER_SPEED;

  // bounds
  if (p.x < 0) p.x = 0;
  if (p.x > W - PLAYER_W) p.x = W - PLAYER_W;

  // gravity
  p.vy += PLAYER_GRAVITY;
  p.y += p.vy;

  // scroll platforms up
  const scroll = SCROLL_SPEED;
  for (const pl of STATE.platforms) {
    pl.y -= scroll;
  }

  // remove off-screen platforms, count floors
  STATE.platforms = STATE.platforms.filter((pl) => {
    if (pl.y < -20) {
      STATE.floors++;
      return false;
    }
    return true;
  });

  // generate new platforms at bottom
  while (STATE.platforms.length < 10) {
    const lastY = STATE.platforms.length > 0
      ? STATE.platforms[STATE.platforms.length - 1].y
      : H;
    const gap = 50 + Math.random() * 40;
    const newY = lastY + gap;
    if (newY < H + 100) {
      const x = Math.random() * (W - PLATFORM_W);
      STATE.platforms.push({ x, y: newY });
    } else {
      break;
    }
  }

  // collision: only when falling down
  p.onGround = false;
  if (p.vy >= 0) {
    for (const pl of STATE.platforms) {
      if (
        p.x + PLAYER_W > pl.x &&
        p.x < pl.x + PLATFORM_W &&
        p.y + PLAYER_H >= pl.y &&
        p.y + PLAYER_H <= pl.y + PLATFORM_H + 8
      ) {
        p.y = pl.y - PLAYER_H;
        p.vy = 0;
        p.onGround = true;
        break;
      }
    }
  }

  // track fall
  if (!p.onGround && p.y > H / 2) {
    STATE.fallDistance += scroll;
  }

  // game over conditions
  if (p.y < -30 || STATE.fallDistance > MAX_FALL) {
    STATE.gameOver = true;
  }
}

function draw(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // spikes at top
  ctx.fillStyle = '#e74c3c';
  for (let i = 0; i < W; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 6);
    ctx.lineTo(i + 8, 0);
    ctx.lineTo(i + 16, 6);
    ctx.fill();
  }

  // danger zone gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 30);
  grad.addColorStop(0, 'rgba(231,76,60,0.3)');
  grad.addColorStop(1, 'rgba(231,76,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 6, W, 24);

  // platforms
  ctx.fillStyle = '#16213e';
  for (const pl of STATE.platforms) {
    ctx.fillRect(pl.x, pl.y, PLATFORM_W, PLATFORM_H);
    // highlight
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(pl.x, pl.y, PLATFORM_W, 3);
    ctx.fillStyle = '#16213e';
  }

  // player
  const p = STATE.player;
  ctx.fillStyle = '#e94560';
  ctx.fillRect(p.x, p.y, PLAYER_W, PLAYER_H);
  // face
  ctx.fillStyle = '#fff';
  ctx.fillRect(p.x + 5, p.y + 6, 4, 4);
  ctx.fillRect(p.x + 15, p.y + 6, 4, 4);
  ctx.fillStyle = '#333';
  ctx.fillRect(p.x + 6, p.y + 7, 2, 2);
  ctx.fillRect(p.x + 16, p.y + 7, 2, 2);

  // HUD
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`⬇ ${STATE.floors} 层`, 10, 30);
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`坠落 ${Math.floor(STATE.fallDistance / 10)}m`, W - 10, 30);

  if (STATE.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💀 游戏结束', W / 2, H / 2 - 20);
    ctx.font = '16px sans-serif';
    ctx.fillText(`${STATE.floors} 层`, W / 2, H / 2 + 15);
  }
}

export default function Down100Floors({ onScore }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    update();
    draw(ctx);

    if (STATE.gameOver) {
      onScore(STATE.floors);
      return;
    }

    animId = requestAnimationFrame(loop);
  }, [onScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resetGame();
    animId = requestAnimationFrame(loop);

    const handleKey = (e: KeyboardEvent, down: boolean) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') STATE.keys.left = down;
      if (e.key === 'ArrowRight' || e.key === 'd') STATE.keys.right = down;
      if (e.key === 'ArrowUp' || e.key === 'w') {
        STATE.keys.up = down;
        if (down && STATE.player.onGround) {
          STATE.player.vy = PLAYER_JUMP;
        }
      }
      if (STATE.gameOver && e.key === ' ') {
        resetGame();
        animId = requestAnimationFrame(loop);
      }
    };

    const handleTouch = (e: TouchEvent) => {
      if (STATE.gameOver) {
        resetGame();
        animId = requestAnimationFrame(loop);
        return;
      }
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const tx = touch.clientX - rect.left;
      const scale = W / rect.width;
      const x = tx * scale;

      // left third = move left, right third = move right, middle = jump
      if (x < W / 3) {
        STATE.keys.left = true;
        STATE.keys.right = false;
      } else if (x > (W * 2) / 3) {
        STATE.keys.right = true;
        STATE.keys.left = false;
      } else if (STATE.player.onGround) {
        STATE.player.vy = PLAYER_JUMP;
      }
    };

    const handleTouchEnd = () => {
      STATE.keys.left = false;
      STATE.keys.right = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleTouch(e);
    };

    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', (e) => handleKey(e, true));
      window.removeEventListener('keyup', (e) => handleKey(e, false));
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [loop]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: '100%', maxWidth: W, borderRadius: 12, display: 'block', margin: '0 auto', touchAction: 'none' }}
    />
  );
}
