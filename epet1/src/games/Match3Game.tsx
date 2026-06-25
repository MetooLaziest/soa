/**
 * 消消乐（开心连连看）— React + TypeScript 实现
 * 支持不规则棋盘、6种普通图标 + 2种特殊图标（小炸弹/大炸弹）
 * 完整游戏循环：交换 → 检测 → 消除 → 下落 → 再检测（连锁）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import GameFullscreen from './GameFullscreen';

// ═══════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════

interface Match3GameProps {
  levelId: number;
  userId: number;
  onPass: (score: number) => void;
  onFail: (score: number) => void;
  onQuit: () => void;
}

interface Cell {
  iconId: number;           // 图标ID（从 available_icons 映射）
  iconType: 'normal' | 'small_bomb' | 'big_bomb';
  isFalling: boolean;
  isEliminating: boolean;
  row: number;
  col: number;
}

interface IconInfo {
  id: number;
  image_url: string;
  name: string;
}

interface LevelConfig {
  id: number;
  name: string;
  grid_shape: number[][];     // 二维数组，1=有格 0=无格
  rows: number;
  cols: number;
  available_icons: number[];  // 可用图标ID列表（6种普通）
  target_score: number;
  max_moves: number;
}

// ═══════════════════════════════════════════════════════════
// 游戏常量
// ═══════════════════════════════════════════════════════════

const SMALL_BOMB_ICON_ID = -1;   // 小炸弹的特殊 iconId
const BIG_BOMB_ICON_ID = -2;     // 大炸弹的特殊 iconId

// 计分
const SCORE_3 = 30;   // 3连每个图标
const SCORE_4 = 40;   // 4连每个图标
const SCORE_5 = 50;   // 5连每个图标
const SCORE_SMALL_BOMB = 50;  // 小炸弹消除每个
const SCORE_BIG_BOMB = 60;    // 大炸弹消除每个

// 动画时间（ms）
const ANIM_SWAP = 200;
const ANIM_ELIMINATE = 300;
const ANIM_FALL = 300;
const ANIM_BOMB = 500;

// ═══════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════

export default function Match3Game({ levelId, userId, onPass, onFail, onQuit }: Match3GameProps) {
  // ─── 状态 ────────────────────────────────────────
  const [levelConfig, setLevelConfig] = useState<LevelConfig | null>(null);
  const [icons, setIcons] = useState<Map<number, IconInfo>>(new Map());
  const [board, setBoard] = useState<(Cell | null)[][]>([]);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(0);
  const [chain, setChain] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'idle' | 'swapping' | 'eliminating' | 'falling' | 'checking' | 'bomb' | 'ended'>('loading');
  const [result, setResult] = useState<'pass' | 'fail' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 动画追踪
  const [eliminatingCells, setEliminatingCells] = useState<Set<string>>(new Set());
  const [bombCells, setBombCells] = useState<Set<string>>(new Set());
  const [swapAnim, setSwapAnim] = useState<{ from: { row: number; col: number }; to: { row: number; col: number } } | null>(null);

  // 用 ref 存储最新的 board 和 phase，避免闭包问题
  const boardRef = useRef(board);
  const phaseRef = useRef(phase);
  const chainRef = useRef(chain);
  const scoreRef = useRef(score);
  const movesLeftRef = useRef(movesLeft);
  const levelConfigRef = useRef(levelConfig);

  boardRef.current = board;
  phaseRef.current = phase;
  chainRef.current = chain;
  scoreRef.current = score;
  movesLeftRef.current = movesLeft;
  levelConfigRef.current = levelConfig;

  // ─── 加载关卡配置和图标 ─────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        // 加载关卡配置
        const levelRes = await fetch(`/api/epet1/match3/levels/${levelId}`);
        const levelData = await levelRes.json();
        if (!levelData.ok && !levelData.level) {
          throw new Error(levelData.error || '加载关卡失败');
        }
        const level: LevelConfig = levelData.level || levelData;

        // 加载图标列表
        const iconRes = await fetch('/api/epet1/match3/icons');
        const iconData = await iconRes.json();
        const iconMap = new Map<number, IconInfo>();
        if (iconData.icons) {
          for (const icon of iconData.icons) {
            iconMap.set(icon.id, icon);
          }
        }

        setLevelConfig(level);
        setIcons(iconMap);
        setMovesLeft(level.max_moves);

        // 初始化棋盘
        initBoard(level, iconMap);

        setLoading(false);
      } catch (e: any) {
        console.error('加载消消乐配置失败:', e);
        setError(e.message || '加载失败');
        setLoading(false);
      }
    };
    load();
  }, [levelId]);

  // ─── 初始化棋盘 ─────────────────────────────────
  const initBoard = useCallback((level: LevelConfig, iconMap: Map<number, IconInfo>) => {
    const { rows, cols, grid_shape, available_icons } = level;
    const newBoard: (Cell | null)[][] = [];

    for (let r = 0; r < rows; r++) {
      newBoard[r] = [];
      for (let c = 0; c < cols; c++) {
        if (!grid_shape[r] || !grid_shape[r][c]) {
          newBoard[r][c] = null; // 无格
          continue;
        }

        // 随机选一个图标，避免初始 3 连
        let iconId = pickRandomIcon(available_icons);
        let attempts = 0;
        while (attempts < 50 && hasInitialMatch(newBoard, r, c, iconId)) {
          iconId = pickRandomIcon(available_icons);
          attempts++;
        }

        newBoard[r][c] = {
          iconId,
          iconType: 'normal',
          isFalling: false,
          isEliminating: false,
          row: r,
          col: c,
        };
      }
    }

    setBoard(newBoard);
    setPhase('idle');
    setScore(0);
    setChain(0);
    setSelected(null);
    setResult(null);
  }, []);

  // ─── 随机选图标 ─────────────────────────────────
  const pickRandomIcon = (available: number[]): number => {
    return available[Math.floor(Math.random() * available.length)];
  };

  // ─── 检测初始是否有 3 连 ────────────────────────
  const hasInitialMatch = (board: (Cell | null)[][], row: number, col: number, iconId: number): boolean => {
    // 横向检查：左边连续 2 个同 iconId
    if (col >= 2) {
      const c1 = board[row]?.[col - 1];
      const c2 = board[row]?.[col - 2];
      if (c1 && c2 && c1.iconId === iconId && c2.iconId === iconId) return true;
    }
    // 纵向检查：上边连续 2 个同 iconId
    if (row >= 2) {
      const c1 = board[row - 1]?.[col];
      const c2 = board[row - 2]?.[col];
      if (c1 && c2 && c1.iconId === iconId && c2.iconId === iconId) return true;
    }
    return false;
  };

  // ─── 检测所有连线 ─────────────────────────────────
  const findMatches = useCallback((board: (Cell | null)[][]): { cells: Set<string>; horizontal: Map<string, number>; vertical: Map<string, number> } => {
    const matched = new Set<string>();
    const horizontal = new Map<string, number>(); // key: "r,c_start", value: length
    const vertical = new Map<string, number>();   // key: "c,r_start", value: length
    const level = levelConfigRef.current;
    if (!level) return { cells: matched, horizontal, vertical };

    const { rows, cols, grid_shape } = level;

    // 横向检测
    for (let r = 0; r < rows; r++) {
      let c = 0;
      while (c < cols) {
        if (!grid_shape[r]?.[c] || !board[r]?.[c] || board[r][c]!.isEliminating) {
          c++;
          continue;
        }
        const cell = board[r][c]!;
        if (cell.iconType !== 'normal') { c++; continue; }
        const iconId = cell.iconId;
        let len = 1;
        while (c + len < cols && grid_shape[r]?.[c + len] && board[r]?.[c + len] &&
               !board[r][c + len]!.isEliminating &&
               board[r][c + len]!.iconType === 'normal' &&
               board[r][c + len]!.iconId === iconId) {
          len++;
        }
        if (len >= 3) {
          for (let i = 0; i < len; i++) matched.add(`${r},${c + i}`);
          horizontal.set(`${r},${c}`, len);
        }
        c += len;
      }
    }

    // 纵向检测
    for (let c = 0; c < cols; c++) {
      let r = 0;
      while (r < rows) {
        if (!grid_shape[r]?.[c] || !board[r]?.[c] || board[r][c]!.isEliminating) {
          r++;
          continue;
        }
        const cell = board[r][c]!;
        if (cell.iconType !== 'normal') { r++; continue; }
        const iconId = cell.iconId;
        let len = 1;
        while (r + len < rows && grid_shape[r + len]?.[c] && board[r + len]?.[c] &&
               !board[r + len][c]!.isEliminating &&
               board[r + len][c]!.iconType === 'normal' &&
               board[r + len][c]!.iconId === iconId) {
          len++;
        }
        if (len >= 3) {
          for (let i = 0; i < len; i++) matched.add(`${r + i},${c}`);
          vertical.set(`${c},${r}`, len);
        }
        r += len;
      }
    }

    return { cells: matched, horizontal, vertical };
  }, []);

  // ─── 处理格子点击 ─────────────────────────────────
  const handleCellClick = useCallback((row: number, col: number) => {
    if (phaseRef.current !== 'idle') return;
    const currentBoard = boardRef.current;
    if (!currentBoard[row]?.[col]) return; // 无格

    if (!selected) {
      // 选中
      setSelected({ row, col });
      return;
    }

    // 点同一个格子：取消选中
    if (selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }

    // 检查是否相邻
    const isAdjacent =
      (Math.abs(selected.row - row) === 1 && selected.col === col) ||
      (Math.abs(selected.col - col) === 1 && selected.row === row);

    if (!isAdjacent) {
      // 不相邻，重新选中
      setSelected({ row, col });
      return;
    }

    // 相邻，尝试交换
    const sr = selected.row;
    const sc = selected.col;
    setSelected(null);
    trySwap(sr, sc, row, col);
  }, [selected]);

  // ─── 尝试交换两个格子 ─────────────────────────────
  const trySwap = useCallback((r1: number, c1: number, r2: number, c2: number) => {
    const currentBoard = boardRef.current;
    const cell1 = currentBoard[r1]?.[c1];
    const cell2 = currentBoard[r2]?.[c2];
    if (!cell1 || !cell2) return;

    setPhase('swapping');
    setSwapAnim({ from: { row: r1, col: c1 }, to: { row: r2, col: c2 } });

    // 交换棋盘数据
    const newBoard = currentBoard.map(row => row.map(cell => cell ? { ...cell } : null));
    const temp = { ...newBoard[r1][c1]! };
    newBoard[r1][c1] = { ...newBoard[r2][c2]!, row: r1, col: c1 };
    newBoard[r2][c2] = { ...temp, row: r2, col: c2 };

    // 检查是否涉及炸弹
    const swapped1 = newBoard[r1][c1]!;
    const swapped2 = newBoard[r2][c2]!;

    // 如果交换方之一是小炸弹
    if (swapped1.iconType === 'small_bomb' || swapped2.iconType === 'small_bomb') {
      const bombCell = swapped1.iconType === 'small_bomb' ? swapped1 : swapped2;
      const otherCell = swapped1.iconType === 'small_bomb' ? swapped2 : swapped1;
      const bombRow = bombCell.row;
      const bombCol = bombCell.col;

      setTimeout(() => {
        setSwapAnim(null);
        setBoard(newBoard);
        triggerSmallBomb(newBoard, bombRow, bombCol);
      }, ANIM_SWAP);
      return;
    }

    // 如果交换方之一是大炸弹
    if (swapped1.iconType === 'big_bomb' || swapped2.iconType === 'big_bomb') {
      const bombCell = swapped1.iconType === 'big_bomb' ? swapped1 : swapped2;
      const otherCell = swapped1.iconType === 'big_bomb' ? swapped2 : swapped1;
      const bombRow = bombCell.row;
      const bombCol = bombCell.col;
      const targetIconId = otherCell.iconId;

      setTimeout(() => {
        setSwapAnim(null);
        setBoard(newBoard);
        triggerBigBomb(newBoard, bombRow, bombCol, targetIconId);
      }, ANIM_SWAP);
      return;
    }

    // 普通交换，检测是否有连线
    const { cells: matches } = findMatches(newBoard);

    if (matches.size === 0) {
      // 无连线，交换回去
      setTimeout(() => {
        setSwapAnim({ from: { row: r2, col: c2 }, to: { row: r1, col: c1 } });
        setTimeout(() => {
          setSwapAnim(null);
          setBoard(boardRef.current); // 恢复原样
          setPhase('idle');
        }, ANIM_SWAP);
      }, ANIM_SWAP);
      return;
    }

    // 有连线，消耗一步
    const newMoves = movesLeftRef.current - 1;
    setMovesLeft(newMoves);
    movesLeftRef.current = newMoves;

    setTimeout(() => {
      setSwapAnim(null);
      setBoard(newBoard);
      setChain(0);
      chainRef.current = 0;
      processMatchesAfterSwap(newBoard);
    }, ANIM_SWAP);
  }, [findMatches]);

  // ─── 小炸弹触发：消除整列 ─────────────────────────
  const triggerSmallBomb = useCallback((currentBoard: (Cell | null)[][], bombRow: number, bombCol: number) => {
    setPhase('bomb');
    const level = levelConfigRef.current;
    if (!level) return;

    const newBoard = currentBoard.map(row => row.map(cell => cell ? { ...cell } : null));
    const eliminated = new Set<string>();

    // 消除整列
    for (let r = 0; r < level.rows; r++) {
      if (level.grid_shape[r]?.[bombCol] && newBoard[r][bombCol]) {
        eliminated.add(`${r},${bombCol}`);
      }
    }

    setBombCells(new Set([`${bombRow},${bombCol}`, ...eliminated]));

    // 计分
    let bombScore = 0;
    eliminated.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      if (newBoard[r]?.[c]) bombScore += SCORE_SMALL_BOMB;
    });

    const newScore = scoreRef.current + bombScore;
    setScore(newScore);
    scoreRef.current = newScore;

    setTimeout(() => {
      // 标记消除
      eliminated.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        if (newBoard[r]) newBoard[r][c] = null;
      });
      setBombCells(new Set());
      setBoard(newBoard);

      // 下落填充
      applyGravityAndFill(newBoard, () => {
        // 下落后继续检测
        chainRef.current = 0;
        setChain(0);
        checkAndProcess(newBoard);
      });
    }, ANIM_BOMB);
  }, []);

  // ─── 大炸弹触发：消除所有同类图标 + 上下左右1格 ─────
  const triggerBigBomb = useCallback((currentBoard: (Cell | null)[][], bombRow: number, bombCol: number, targetIconId: number) => {
    setPhase('bomb');
    const level = levelConfigRef.current;
    if (!level) return;

    const newBoard = currentBoard.map(row => row.map(cell => cell ? { ...cell } : null));
    const eliminated = new Set<string>();

    // 消除所有同类普通图标
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (newBoard[r]?.[c] && newBoard[r][c]!.iconType === 'normal' && newBoard[r][c]!.iconId === targetIconId) {
          eliminated.add(`${r},${c}`);
          // 上下左右 1 格
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < level.rows && nc >= 0 && nc < level.cols && level.grid_shape[nr]?.[nc]) {
              eliminated.add(`${nr},${nc}`);
            }
          }
        }
      }
    }

    // 也消除炸弹本身
    eliminated.add(`${bombRow},${bombCol}`);

    setBombCells(new Set([`${bombRow},${bombCol}`, ...eliminated]));

    // 计分
    let bombScore = 0;
    eliminated.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      if (newBoard[r]?.[c]) bombScore += SCORE_BIG_BOMB;
    });

    const newScore = scoreRef.current + bombScore;
    setScore(newScore);
    scoreRef.current = newScore;

    setTimeout(() => {
      eliminated.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        if (newBoard[r]) newBoard[r][c] = null;
      });
      setBombCells(new Set());
      setBoard(newBoard);

      applyGravityAndFill(newBoard, () => {
        chainRef.current = 0;
        setChain(0);
        checkAndProcess(newBoard);
      });
    }, ANIM_BOMB);
  }, []);

  // ─── 交换后处理连线 ──────────────────────────────
  const processMatchesAfterSwap = useCallback((currentBoard: (Cell | null)[][]) => {
    const { cells: matches, horizontal, vertical } = findMatches(currentBoard);
    if (matches.size === 0) {
      // 无连线，检查是否结束
      checkGameEnd();
      return;
    }

    setPhase('eliminating');
    setEliminatingCells(matches);

    // 计算得分和生成特殊图标
    let roundScore = 0;
    const newChain = chainRef.current + 1;
    setChain(newChain);
    chainRef.current = newChain;

    // 分析横竖连线长度，确定每个位置的分数和特殊图标
    const specialCells = new Map<string, 'small_bomb' | 'big_bomb'>(); // 位置 → 特殊类型

    // 处理横向连线
    horizontal.forEach((len, key) => {
      const [r, cStart] = key.split(',').map(Number);
      const perIcon = len >= 5 ? SCORE_5 : len >= 4 ? SCORE_4 : SCORE_3;
      roundScore += perIcon * len;

      // 在消除位置生成特殊图标
      if (len >= 5) {
        // 5连：在中间位置生成大炸弹
        const midC = cStart + Math.floor(len / 2);
        specialCells.set(`${r},${midC}`, 'big_bomb');
      } else if (len >= 4) {
        // 4连：在消除位置生成小炸弹
        const bombC = cStart + Math.floor(len / 2);
        specialCells.set(`${r},${bombC}`, 'small_bomb');
      }
    });

    // 处理纵向连线
    vertical.forEach((len, key) => {
      const [c, rStart] = key.split(',').map(Number);
      const perIcon = len >= 5 ? SCORE_5 : len >= 4 ? SCORE_4 : SCORE_3;
      roundScore += perIcon * len;

      if (len >= 5) {
        const midR = rStart + Math.floor(len / 2);
        // 如果这个位置已经有大炸弹，保留大炸弹
        if (!specialCells.has(`${midR},${c}`)) {
          specialCells.set(`${midR},${c}`, 'big_bomb');
        }
      } else if (len >= 4) {
        const bombR = rStart + Math.floor(len / 2);
        // 如果已是大炸弹则不降级
        if (specialCells.get(`${bombR},${c}`) !== 'big_bomb') {
          specialCells.set(`${bombR},${c}`, 'small_bomb');
        }
      }
    });

    // 连锁倍率
    roundScore *= newChain;

    const newScore = scoreRef.current + roundScore;
    setScore(newScore);
    scoreRef.current = newScore;

    // 消除动画
    setTimeout(() => {
      const newBoard = currentBoard.map(row => row.map(cell => cell ? { ...cell } : null));

      // 标记消除
      matches.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        // 如果这个位置要生成特殊图标，保留并替换类型
        if (specialCells.has(key)) {
          const specialType = specialCells.get(key)!;
          newBoard[r][c] = {
            iconId: specialType === 'big_bomb' ? BIG_BOMB_ICON_ID : SMALL_BOMB_ICON_ID,
            iconType: specialType,
            isFalling: false,
            isEliminating: false,
            row: r,
            col: c,
          };
        } else {
          newBoard[r][c] = null;
        }
      });

      setEliminatingCells(new Set());
      setBoard(newBoard);

      // 下落填充
      applyGravityAndFill(newBoard, () => {
        // 下落后继续检测（连锁）
        checkAndProcess(newBoard);
      });
    }, ANIM_ELIMINATE);
  }, [findMatches]);

  // ─── 检测并处理连线（连锁循环） ──────────────────
  const checkAndProcess = useCallback((currentBoard: (Cell | null)[][]) => {
    const { cells: matches } = findMatches(currentBoard);
    if (matches.size > 0) {
      processMatchesAfterSwap(currentBoard);
    } else {
      // 无连线，检查死局
      if (isDeadBoard(currentBoard)) {
        shuffleBoard(currentBoard);
      }
      checkGameEnd();
    }
  }, [findMatches, processMatchesAfterSwap]);

  // ─── 下落填充 ────────────────────────────────────
  const applyGravityAndFill = useCallback((currentBoard: (Cell | null)[][], onComplete: () => void) => {
    const level = levelConfigRef.current;
    if (!level) { onComplete(); return; }

    const { rows, cols, grid_shape, available_icons } = level;
    setPhase('falling');

    const newBoard = currentBoard.map(row => row.map(cell => cell ? { ...cell } : null));

    // 逐列处理下落
    for (let c = 0; c < cols; c++) {
      // 找到该列所有有效格
      const validRows: number[] = [];
      for (let r = 0; r < rows; r++) {
        if (grid_shape[r]?.[c]) validRows.push(r);
      }

      // 从下往上，将非空格子下移
      const cells: (Cell | null)[] = [];
      for (const r of validRows) {
        if (newBoard[r][c]) {
          cells.push(newBoard[r][c]!);
        }
      }

      // 空位数 = 有效格数 - 已有格子数
      const emptyCount = validRows.length - cells.length;

      // 生成新图标填充顶部空位
      const newCells: Cell[] = [];
      for (let i = 0; i < emptyCount; i++) {
        const iconId = pickRandomIcon(available_icons);
        newCells.push({
          iconId,
          iconType: 'normal',
          isFalling: true,
          isEliminating: false,
          row: -1, // 临时标记为从上方落入
          col: c,
        });
      }

      // 合并：新格子在上，已有格子在下
      const allCells = [...newCells, ...cells];

      // 重新分配行号
      for (let i = 0; i < validRows.length; i++) {
        const targetRow = validRows[i];
        newBoard[targetRow][c] = allCells[i] ? { ...allCells[i], row: targetRow, col: c, isFalling: i < emptyCount } : null;
      }
    }

    setBoard(newBoard);

    // 等待下落动画完成
    setTimeout(() => {
      // 清除 falling 标记
      const cleared = newBoard.map(row =>
        row.map(cell => cell ? { ...cell, isFalling: false } : null)
      );
      setBoard(cleared);
      onComplete();
    }, ANIM_FALL);
  }, []);

  // ─── 检查死局（没有可用交换能产生连线） ─────────
  const isDeadBoard = useCallback((currentBoard: (Cell | null)[][]): boolean => {
    const level = levelConfigRef.current;
    if (!level) return false;
    const { rows, cols, grid_shape } = level;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid_shape[r]?.[c] || !currentBoard[r]?.[c]) continue;

        // 尝试右交换
        if (c + 1 < cols && grid_shape[r]?.[c + 1] && currentBoard[r][c + 1]) {
          const testBoard = currentBoard.map(row => row.map(cell => cell ? { ...cell } : null));
          [testBoard[r][c], testBoard[r][c + 1]] = [testBoard[r][c + 1], testBoard[r][c]];
          if (testBoard[r][c]) { testBoard[r][c]!.row = r; testBoard[r][c]!.col = c; }
          if (testBoard[r][c + 1]) { testBoard[r][c + 1]!.row = r; testBoard[r][c + 1]!.col = c + 1; }
          const { cells: m } = findMatches(testBoard);
          if (m.size > 0) return false;
        }

        // 尝试下交换
        if (r + 1 < rows && grid_shape[r + 1]?.[c] && currentBoard[r + 1][c]) {
          const testBoard = currentBoard.map(row => row.map(cell => cell ? { ...cell } : null));
          [testBoard[r][c], testBoard[r + 1][c]] = [testBoard[r + 1][c], testBoard[r][c]];
          if (testBoard[r][c]) { testBoard[r][c]!.row = r; testBoard[r][c]!.col = c; }
          if (testBoard[r + 1][c]) { testBoard[r + 1][c]!.row = r + 1; testBoard[r + 1][c]!.col = c; }
          const { cells: m } = findMatches(testBoard);
          if (m.size > 0) return false;
        }
      }
    }
    return true;
  }, [findMatches]);

  // ─── 随机打乱棋盘（避免死局） ───────────────────
  const shuffleBoard = useCallback((currentBoard: (Cell | null)[][]) => {
    const level = levelConfigRef.current;
    if (!level) return;
    const { rows, cols, grid_shape, available_icons } = level;

    const newBoard = currentBoard.map(row => row.map(cell => cell ? { ...cell } : null));

    // 收集所有普通图标
    const normalIcons: number[] = [];
    const positions: [number, number][] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (newBoard[r]?.[c] && newBoard[r][c]!.iconType === 'normal') {
          normalIcons.push(newBoard[r][c]!.iconId);
          positions.push([r, c]);
        }
      }
    }

    // 洗牌
    for (let i = normalIcons.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [normalIcons[i], normalIcons[j]] = [normalIcons[j], normalIcons[i]];
    }

    // 重新分配
    positions.forEach(([r, c], i) => {
      newBoard[r][c]!.iconId = normalIcons[i];
    });

    setBoard(newBoard);

    // 如果还是死局，递归打乱（最多3次）
    if (isDeadBoard(newBoard)) {
      setTimeout(() => shuffleBoard(newBoard), 100);
    }
  }, [isDeadBoard]);

  // ─── 检查游戏结束 ────────────────────────────────
  const checkGameEnd = useCallback(() => {
    const level = levelConfigRef.current;
    if (!level) return;

    const currentScore = scoreRef.current;
    const currentMoves = movesLeftRef.current;

    if (currentScore >= level.target_score) {
      // 通关
      setPhase('ended');
      setResult('pass');
      // 上报成绩
      reportResult(true, currentScore, level.max_moves - currentMoves);
      onPass(currentScore);
    } else if (currentMoves <= 0) {
      // 步数用完，未达标
      setPhase('ended');
      setResult('fail');
      reportResult(false, currentScore, level.max_moves - currentMoves);
      onFail(currentScore);
    } else {
      setPhase('idle');
    }
  }, [onPass, onFail]);

  // ─── 上报成绩 ────────────────────────────────────
  const reportResult = async (passed: boolean, finalScore: number, movesUsed: number) => {
    try {
      await fetch('/api/epet1/match3/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          level_id: levelId,
          score: finalScore,
          passed,
          moves_used: movesUsed,
        }),
      });
    } catch (e) {
      console.error('上报消消乐成绩失败:', e);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <GameFullscreen onClose={onQuit}>
        <div style={{ color: '#fff', fontSize: 18, textAlign: 'center' }}>加载中...</div>
      </GameFullscreen>
    );
  }

  if (error) {
    return (
      <GameFullscreen onClose={onQuit}>
        <div style={{ color: '#FF6B6B', fontSize: 16, textAlign: 'center', padding: 20 }}>
          ❌ {error}
          <br />
          <button onClick={onQuit} style={{ marginTop: 16, padding: '8px 24px', borderRadius: 8, border: 'none', background: '#FFD700', cursor: 'pointer' }}>返回</button>
        </div>
      </GameFullscreen>
    );
  }

  if (!levelConfig) return null;

  const { rows, cols, grid_shape, target_score } = levelConfig;

  // 格子大小自适应
  const cellSize = Math.min(
    (window.innerWidth - 32) / cols,
    (window.innerHeight * 0.6) / rows,
    50
  );
  const gap = 3;
  const boardWidth = cols * (cellSize + gap) - gap;
  const boardHeight = rows * (cellSize + gap) - gap;

  // 图标渲染
  const renderIcon = (cell: Cell) => {
    if (cell.iconType === 'small_bomb') {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: cellSize * 0.5, fontWeight: 900,
          background: 'linear-gradient(135deg, #FF6B35, #FF4500)',
          borderRadius: cellSize * 0.15, color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          boxShadow: '0 2px 8px rgba(255,69,0,0.4)',
        }}>
          💣
        </div>
      );
    }

    if (cell.iconType === 'big_bomb') {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: cellSize * 0.5, fontWeight: 900,
          background: 'linear-gradient(135deg, #9B59B6, #8E44AD)',
          borderRadius: cellSize * 0.15, color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          boxShadow: '0 2px 8px rgba(142,68,173,0.4)',
        }}>
          💥
        </div>
      );
    }

    // 普通图标
    const iconInfo = icons.get(cell.iconId);
    if (iconInfo?.image_url) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#fff', borderRadius: cellSize * 0.15,
          overflow: 'hidden', padding: 2,
        }}>
          <img
            src={iconInfo.image_url}
            alt={iconInfo.name || ''}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      );
    }

    // 无图片时的 fallback：彩色方块
    const colorIdx = cell.iconId % 6;
    const fallbackColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A29BFE', '#FD79A8', '#00B894'];
    const fallbackEmojis = ['🔴', '🟢', '🟡', '🟣', '🩷', '🟩'];
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: fallbackColors[colorIdx],
        borderRadius: cellSize * 0.15,
        fontSize: cellSize * 0.5,
        boxShadow: `0 2px 6px ${fallbackColors[colorIdx]}44`,
      }}>
        {fallbackEmojis[colorIdx]}
      </div>
    );
  };

  return (
    <GameFullscreen onClose={onQuit}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: '100%', height: '100%', padding: '0 16px',
        maxWidth: 420, margin: '0 auto',
      }}>
        {/* 顶部信息栏 */}
        <div style={{
          width: '100%', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: '12px 0', marginBottom: 8,
          color: '#fff', fontSize: 14,
        }}>
          <div style={{ fontWeight: 600 }}>
            ⭐ {score} / {target_score}
          </div>
          {chain > 1 && (
            <div style={{
              color: '#FFE66D', fontWeight: 700, fontSize: 16,
              animation: 'match3ChainPop 0.3s ease-out',
            }}>
              🔥 ×{chain}
            </div>
          )}
          <div style={{ fontWeight: 600 }}>
            🕹️ {movesLeft} 步
          </div>
        </div>

        {/* 进度条 */}
        <div style={{
          width: '100%', height: 8, background: 'rgba(255,255,255,0.15)',
          borderRadius: 4, marginBottom: 12, overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(100, (score / target_score) * 100)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #FFD700, #FFA500)',
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* 棋盘 */}
        <div style={{
          position: 'relative',
          width: boardWidth,
          height: boardHeight,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: gap,
        }}>
          {/* 渲染格子 */}
          {board.map((row, r) =>
            row.map((cell, c) => {
              if (!cell || !grid_shape[r]?.[c]) return null;

              const isSelected = selected?.row === r && selected?.col === c;
              const isEliminating = eliminatingCells.has(`${r},${c}`);
              const isBomb = bombCells.has(`${r},${c}`);
              const isSwappingOut = swapAnim?.from.row === r && swapAnim?.from.col === c;
              const isSwappingIn = swapAnim?.to.row === r && swapAnim?.to.col === c;

              // 交换动画偏移
              let transform = '';
              if (swapAnim) {
                if (isSwappingOut) {
                  const dx = (swapAnim.to.col - swapAnim.from.col) * (cellSize + gap);
                  const dy = (swapAnim.to.row - swapAnim.from.row) * (cellSize + gap);
                  transform = `translate(${dx}px, ${dy}px)`;
                } else if (isSwappingIn) {
                  const dx = (swapAnim.from.col - swapAnim.to.col) * (cellSize + gap);
                  const dy = (swapAnim.from.row - swapAnim.to.row) * (cellSize + gap);
                  transform = `translate(${dx}px, ${dy}px)`;
                }
              }

              // 消除动画
              const eliminateStyle = isEliminating ? {
                transform: 'scale(0.3)', opacity: 0,
                transition: `transform ${ANIM_ELIMINATE}ms ease, opacity ${ANIM_ELIMINATE}ms ease`,
              } : {};

              // 炸弹闪光
              const bombStyle = isBomb ? {
                animation: `match3BombFlash ${ANIM_BOMB}ms ease-out`,
              } : {};

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  style={{
                    position: 'absolute',
                    left: c * (cellSize + gap),
                    top: r * (cellSize + gap),
                    width: cellSize,
                    height: cellSize,
                    cursor: phase === 'idle' ? 'pointer' : 'default',
                    transition: swapAnim ? `transform ${ANIM_SWAP}ms ease` : undefined,
                    transform: transform || undefined,
                    ...eliminateStyle,
                    ...bombStyle,
                  }}
                >
                  {/* 选中高亮 */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute', inset: -3,
                      border: '3px solid #FFD700',
                      borderRadius: cellSize * 0.2,
                      boxShadow: '0 0 12px rgba(255,215,0,0.6)',
                      animation: 'match3SelectPulse 0.8s ease-in-out infinite',
                    }} />
                  )}

                  {/* 图标 */}
                  <div style={{
                    width: '100%', height: '100%',
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                    transition: 'transform 0.15s ease',
                  }}>
                    {renderIcon(cell)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部：退出按钮 */}
        <button
          onClick={onQuit}
          style={{
            marginTop: 16, padding: '10px 32px', borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          退出
        </button>

        {/* 结束遮罩 */}
        {phase === 'ended' && result && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 20,
          }}>
            <div style={{
              fontSize: 48, marginBottom: 16,
              animation: 'match3ResultPop 0.5s ease-out',
            }}>
              {result === 'pass' ? '🎉' : '😢'}
            </div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              {result === 'pass' ? '通关成功！' : '挑战失败'}
            </div>
            <div style={{ color: '#FFD700', fontSize: 18, fontWeight: 600, marginBottom: 24 }}>
              得分：{score}
            </div>
            <button
              onClick={onQuit}
              style={{
                padding: '12px 40px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(255,165,0,0.4)',
              }}
            >
              确定
            </button>
          </div>
        )}
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes match3SelectPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(255,215,0,0.4); }
          50% { box-shadow: 0 0 16px rgba(255,215,0,0.8); }
        }
        @keyframes match3ChainPop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes match3BombFlash {
          0% { filter: brightness(1); }
          30% { filter: brightness(3); }
          100% { filter: brightness(0); opacity: 0; }
        }
        @keyframes match3ResultPop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </GameFullscreen>
  );
}
