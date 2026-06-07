import { useEffect, useRef, useCallback, useState } from 'react';

interface Props {
  onScore: (score: number) => void;
}

const COLS = 7;
const ROWS = 7;
const CELL = 40;
const GAP = 2;
const W = COLS * (CELL + GAP) + GAP;
const H = ROWS * (CELL + GAP) + GAP + 60;

const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A29BFE', '#FD79A8', '#00B894'];
const SHAPES = ['●', '◆', '▲', '★', '♥', '⬟'];

interface Gem {
  color: number; // 0-5
  row: number;
  col: number;
  dying: boolean;
  ay: number; // animation offset
}

let gems: Gem[][] = [];
let selectedRow = -1;
let selectedCol = -1;
let swapping = false;
let score = 0;
let combo = 0;
let gameOver = false;
let movesLeft = 20;
let animId = 0;

function randomColor(): number {
  return Math.floor(Math.random() * COLORS.length);
}

function initGrid() {
  gems = [];
  for (let r = 0; r < ROWS; r++) {
    gems[r] = [];
    for (let c = 0; c < COLS; c++) {
      let color = randomColor();
      // avoid initial matches
      while (
        (c >= 2 && gems[r][c - 1].color === color && gems[r][c - 2].color === color) ||
        (r >= 2 && gems[r - 1]?.[c]?.color === color && gems[r - 2]?.[c]?.color === color)
      ) {
        color = randomColor();
      }
      gems[r][c] = { color, row: r, col: c, dying: false, ay: 0 };
    }
  }
}

function resetGame() {
  initGrid();
  selectedRow = -1;
  selectedCol = -1;
  swapping = false;
  score = 0;
  combo = 0;
  gameOver = false;
  movesLeft = 20;
}

function findMatches(): [number, number][] {
  const matched = new Set<string>();
  // horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      if (gems[r][c].dying) continue;
      const color = gems[r][c].color;
      let len = 1;
      while (c + len < COLS && gems[r][c + len].color === color && !gems[r][c + len].dying) len++;
      if (len >= 3) {
        for (let i = 0; i < len; i++) matched.add(`${r},${c + i}`);
      }
    }
  }
  // vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 2; r++) {
      if (gems[r][c].dying) continue;
      const color = gems[r][c].color;
      let len = 1;
      while (r + len < ROWS && gems[r + len]?.[c]?.color === color && !gems[r + len][c].dying) len++;
      if (len >= 3) {
        for (let i = 0; i < len; i++) matched.add(`${r + i},${c}`);
      }
    }
  }
  return Array.from(matched).map((s) => {
    const [r, c] = s.split(',').map(Number);
    return [r, c];
  });
}

function applyGravity(): boolean {
  let moved = false;
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!gems[r][c].dying) {
        if (writeRow !== r) {
          gems[writeRow][c] = { ...gems[r][c], row: writeRow, ay: -(writeRow - r) * (CELL + GAP) };
          gems[r][c].dying = true;
          moved = true;
        }
        writeRow--;
      }
    }
    // fill empty top with new gems
    for (let r = writeRow; r >= 0; r--) {
      gems[r][c] = {
        color: randomColor(),
        row: r,
        col: c,
        dying: false,
        ay: -(writeRow + 1) * (CELL + GAP),
      };
      moved = true;
    }
  }
  return moved;
}

function processMatches(onScore: (s: number) => void) {
  const matches = findMatches();
  if (matches.length === 0) return false;

  combo++;
  const points = matches.length * 10 * combo;
  score += points;
  onScore(score);

  // Mark matched gems
  for (const [r, c] of matches) {
    gems[r][c].dying = true;
  }

  // After a delay, apply gravity and check again
  setTimeout(() => {
    applyGravity();
    // Reset dying flags
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        gems[r][c].dying = false;
    processMatches(onScore);
  }, 200);

  return true;
}

function trySwap(r1: number, c1: number, r2: number, c2: number, onScore: (s: number) => void): boolean {
  // Swap
  [gems[r1][c1], gems[r2][c2]] = [gems[r2][c2], gems[r1][c1]];
  [gems[r1][c1].row, gems[r2][c2].row] = [r2, r1];
  [gems[r1][c1].col, gems[r2][c2].col] = [c2, c1];

  const matches = findMatches();
  if (matches.length === 0) {
    // Swap back
    [gems[r1][c1], gems[r2][c2]] = [gems[r2][c2], gems[r1][c1]];
    [gems[r1][c1].row, gems[r2][c2].row] = [r2, r1];
    [gems[r1][c1].col, gems[r2][c2].col] = [c2, c1];
    return false;
  }

  combo = 0;
  processMatches(onScore);
  return true;
}

function draw(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = '#2c2c54';
  ctx.fillRect(0, 0, W, H);

  // grid background
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(GAP, GAP, COLS * (CELL + GAP), ROWS * (CELL + GAP));

  // gems
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const g = gems[r][c];
      if (g.dying) continue;
      const gx = GAP + c * (CELL + GAP);
      const gy = GAP + r * (CELL + GAP) + g.ay;

      // animate ay towards 0
      if (g.ay !== 0) {
        g.ay *= 0.85;
        if (Math.abs(g.ay) < 0.5) g.ay = 0;
      }

      // selection highlight
      if (r === selectedRow && c === selectedCol) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(gx - 2, gy - 2, CELL + 4, CELL + 4);
      }

      // gem body
      ctx.fillStyle = COLORS[g.color];
      ctx.beginPath();
      ctx.roundRect(gx, gy, CELL, CELL, 6);
      ctx.fill();

      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.roundRect(gx + 3, gy + 3, CELL - 12, CELL - 12, 4);
      ctx.fill();

      // shape icon
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `${CELL * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SHAPES[g.color], gx + CELL / 2, gy + CELL / 2 + 1);
    }
  }

  // HUD
  const hudY = GAP + ROWS * (CELL + GAP) + 10;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`⭐ ${score}`, 10, hudY + 15);
  ctx.textAlign = 'right';
  ctx.fillText(`🕹 剩余 ${movesLeft} 步`, W - 10, hudY + 15);

  // combo
  if (combo > 1) {
    ctx.fillStyle = '#FFE66D';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🔥 x${combo}`, W / 2, hudY + 35);
  }

  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 游戏结束', W / 2, H / 2 - 15);
    ctx.font = '16px sans-serif';
    ctx.fillText(`得分：${score}`, W / 2, H / 2 + 20);
  }
}

export default function Match3({ onScore: onScoreProp }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  const onScore = useCallback(
    (s: number) => {
      onScoreProp(s);
    },
    [onScoreProp],
  );

  useEffect(() => {
    resetGame();
    setReady(true);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      draw(ctx);
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    const handleClick = (e: MouseEvent) => {
      if (gameOver || swapping) return;
      const rect = canvas.getBoundingClientRect();
      const scale = W / rect.width;
      const mx = (e.clientX - rect.left) * scale;
      const my = (e.clientY - rect.top) * scale;

      const col = Math.floor((mx - GAP) / (CELL + GAP));
      const row = Math.floor((my - GAP) / (CELL + GAP));
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

      if (selectedRow === -1) {
        selectedRow = row;
        selectedCol = col;
      } else if (selectedRow === row && selectedCol === col) {
        selectedRow = -1;
        selectedCol = -1;
      } else if (
        Math.abs(selectedRow - row) + Math.abs(selectedCol - col) === 1
      ) {
        swapping = true;
        const sr = selectedRow;
        const sc = selectedCol;
        selectedRow = -1;
        selectedCol = -1;

        const success = trySwap(sr, sc, row, col, onScore);
        if (success) {
          movesLeft--;
          if (movesLeft <= 0) {
            setTimeout(() => {
              gameOver = true;
              onScoreProp(score);
            }, 1000);
          }
        }
        setTimeout(() => {
          swapping = false;
        }, 300);
      } else {
        selectedRow = row;
        selectedCol = col;
      }
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      if (gameOver) {
        resetGame();
        return;
      }
      if (swapping) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scale = W / rect.width;
      const mx = (touch.clientX - rect.left) * scale;
      const my = (touch.clientY - rect.top) * scale;

      const col = Math.floor((mx - GAP) / (CELL + GAP));
      const row = Math.floor((my - GAP) / (CELL + GAP));
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

      if (selectedRow === -1) {
        selectedRow = row;
        selectedCol = col;
      } else if (selectedRow === row && selectedCol === col) {
        selectedRow = -1;
        selectedCol = -1;
      } else if (
        Math.abs(selectedRow - row) + Math.abs(selectedCol - col) === 1
      ) {
        swapping = true;
        const sr = selectedRow;
        const sc = selectedCol;
        selectedRow = -1;
        selectedCol = -1;

        const success = trySwap(sr, sc, row, col, onScore);
        if (success) {
          movesLeft--;
          if (movesLeft <= 0) {
            setTimeout(() => {
              gameOver = true;
              onScoreProp(score);
            }, 1000);
          }
        }
        setTimeout(() => {
          swapping = false;
        }, 300);
      } else {
        selectedRow = row;
        selectedCol = col;
      }
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleTouch);
    };
  }, [ready, onScore]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: '100%', maxWidth: W, borderRadius: 12, display: 'block', margin: '0 auto', touchAction: 'none' }}
    />
  );
}
