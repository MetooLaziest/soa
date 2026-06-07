import { useState, useEffect, useCallback } from 'react';

/**
 * 煎鱼小游戏 - 简单可玩版本
 * 控制火候，点击翻面，煎出完美鱼
 */
export default function CookFish({ onScore }: { onScore: (s: number) => void }) {
  const [gameState, setGameState] = useState<'idle' | 'cooking' | 'flip' | 'done'>('idle');
  const [side, setSide] = useState<'first' | 'second'>('first');
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);

  // 开始游戏
  const startGame = useCallback(() => {
    setGameState('cooking');
    setSide('first');
    setProgress(0);
    setScore(0);
    setMessage('');
    setTimeLeft(30);
  }, []);

  // 计时器
  useEffect(() => {
    if (gameState !== 'cooking') return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          setGameState('done');
          onScore(score);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, score, onScore]);

  // 进度条
  useEffect(() => {
    if (gameState !== 'cooking') return;
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          // 煎糊了
          setMessage('💥 煎糊了！');
          setTimeout(() => {
            setGameState('done');
            onScore(score);
          }, 1000);
          return 100;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [gameState, score, onScore]);

  // 翻面
  const flip = () => {
    if (gameState !== 'cooking' || side === 'second') return;
    
    // 判断火候
    let addScore = 0;
    let msg = '';
    if (progress >= 40 && progress <= 70) {
      addScore = 30; // 完美
      msg = '✅ 完美翻面！+30分';
    } else if (progress >= 20 && progress <= 85) {
      addScore = 15; // 还行
      msg = '👌 还行 +15分';
    } else {
      addScore = 5; // 失败
      msg = '😅 火候不对 +5分';
    }
    
    setScore(s => s + addScore);
    setMessage(msg);
    setSide('second');
    setProgress(0);
    
    setTimeout(() => setMessage(''), 1000);
  };

  // 第二面完成
  useEffect(() => {
    if (side === 'second' && progress >= 50) {
      setMessage(`🎉 煎鱼完成！最终得分：${score + 20}`);
      setScore(s => s + 20);
      setTimeout(() => {
        setGameState('done');
        onScore(score + 20);
      }, 1500);
    }
  }, [side, progress, score, onScore]);

  return (
    <div style={{ padding: 16, color: '#fff', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span>⏱️ {timeLeft}s</span>
        <span>🏆 {score} 分</span>
      </div>

      {gameState === 'idle' && (
        <div>
          <div style={{ fontSize: 64, margin: '20px 0' }}>🐟</div>
          <button
            onClick={startGame}
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
            开始煎鱼
          </button>
        </div>
      )}

      {gameState === 'cooking' && (
        <div>
          {/* 鱼 */}
          <div style={{ fontSize: 80, margin: '10px 0' }}>🐟</div>

          {/* 火候进度条 */}
          <div style={{ width: '80%', height: 24, background: '#333', borderRadius: 12, margin: '0 auto 16px', overflow: 'hidden', position: 'relative' }}>
            {/* 完美区域 */}
            <div style={{ position: 'absolute', left: '40%', width: '30%', height: '100%', background: 'rgba(76, 175, 80, 0.4)' }} />
            {/* 进度指示器 */}
            <div
              style={{
                width: 20,
                height: '100%',
                background: progress >= 40 && progress <= 70 ? '#4CAF50' : '#FF5722',
                borderRadius: 10,
                marginLeft: `calc(${progress}% - 10px)`,
                transition: 'margin-left 0.1s linear',
              }}
            />
          </div>

          {/* 当前面提示 */}
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            {side === 'first' ? '第一面 - 等待进度条进入绿色区域后点击翻面！' : '第二面 - 继续煎...'}
          </div>

          {/* 翻面按钮 */}
          {side === 'first' && (
            <button
              onClick={flip}
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
              翻面！
            </button>
          )}

          {message && (
            <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700 }}>{message}</div>
          )}
        </div>
      )}

      {gameState === 'done' && (
        <div style={{ fontSize: 18, marginTop: 20 }}>
          🍳 游戏结束！最终得分：{score}
          <button
            onClick={startGame}
            style={{ marginLeft: 12, padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            再来
          </button>
        </div>
      )}
    </div>
  );
}
