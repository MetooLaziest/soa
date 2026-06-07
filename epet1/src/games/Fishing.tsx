import { useState, useEffect, useCallback } from 'react';

/**
 * 钓鱼 - 简单可玩版本
 * 点击起竿，等待进度条到绿色区域时点击收竿
 */
export default function Fishing({ onScore }: { onScore: (s: number) => void }) {
  const [gameState, setGameState] = useState<'idle' | 'waiting' | 'progress' | 'result'>('idle');
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [score, setScore] = useState(0);
  const [catches, setCatches] = useState(0);
  const [message, setMessage] = useState('');

  // 开始钓鱼
  const startFishing = () => {
    setGameState('waiting');
    setMessage('🎣 等待鱼儿上钩...');
    // 随机 1-4 秒后鱼上钩
    setTimeout(() => {
      setGameState('progress');
      setProgress(0);
      setDirection(1);
      setMessage('快点击按钮收竿！');
    }, 1000 + Math.random() * 3000);
  };

  // 进度条动画
  useEffect(() => {
    if (gameState !== 'progress') return;
    const timer = setInterval(() => {
      setProgress(p => {
        const next = p + direction * 3;
        if (next >= 100) { setDirection(-1); return 97; }
        if (next <= 0) { setDirection(1); return 3; }
        return next;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [gameState, direction]);

  // 收竿（点击时机判断）
  const reelIn = () => {
    if (gameState !== 'progress') return;
    setGameState('result');
    
    // 绿色区域 40-70
    if (progress >= 40 && progress <= 70) {
      const newCatches = catches + 1;
      const addScore = 30;
      setCatches(newCatches);
      setScore(s => s + addScore);
      setMessage(`✅ 钓到了！+${addScore}分`);
    } else {
      setMessage('❌ 跑掉了...');
    }
    
    setTimeout(() => {
      setGameState('idle');
      setMessage('');
    }, 1500);
  };

  // 游戏结束
  const endGame = () => {
    onScore(score);
  };

  return (
    <div style={{ padding: 16, color: '#fff', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span>🎣 钓到：{catches} 条</span>
        <span>🏆 得分：{score}</span>
      </div>

      {gameState === 'idle' && (
        <div>
          <div style={{ fontSize: 64, margin: '20px 0' }}>🎣</div>
          <button
            onClick={startFishing}
            style={{
              padding: '12px 32px',
              fontSize: 16,
              background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
              border: 'none',
              borderRadius: 12,
              color: '#1a1a2e',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            开始钓鱼
          </button>
          {message && <div style={{ marginTop: 12 }}>{message}</div>}
        </div>
      )}

      {gameState === 'waiting' && (
        <div>
          <div style={{ fontSize: 64, margin: '20px 0', animation: 'bounce 1s infinite' }}>🎣</div>
          <div style={{ fontSize: 18 }}>{message}</div>
        </div>
      )}

      {gameState === 'progress' && (
        <div>
          <div style={{ fontSize: 48, margin: '20px 0' }}>🐟</div>
          {/* 进度条 */}
          <div style={{ width: '80%', height: 24, background: '#333', borderRadius: 12, margin: '0 auto 16px', overflow: 'hidden', position: 'relative' }}>
            {/* 绿色区域 */}
            <div style={{ position: 'absolute', left: '40%', width: '30%', height: '100%', background: 'rgba(76, 175, 80, 0.4)' }} />
            {/* 进度指示器 */}
            <div
              style={{
                width: 20,
                height: '100%',
                background: '#fff',
                borderRadius: 10,
                marginLeft: `calc(${progress}% - 10px)`,
                transition: 'margin-left 0.03s linear',
              }}
            />
          </div>
          <button
            onClick={reelIn}
            style={{
              padding: '12px 32px',
              fontSize: 16,
              background: 'linear-gradient(135deg, #FF6B6B, #FFE66D)',
              border: 'none',
              borderRadius: 12,
              color: '#1a1a2e',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            收竿！
          </button>
        </div>
      )}

      {gameState === 'result' && (
        <div style={{ fontSize: 18, marginTop: 20 }}>{message}</div>
      )}

      <div style={{ marginTop: 20 }}>
        <button onClick={endGame} style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
          结束游戏
        </button>
      </div>
    </div>
  );
}
