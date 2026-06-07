import { useState, useEffect } from 'react';
import GameFullscreen from './GameFullscreen';

/**
 * 找不同 - 全屏 + 上下布局
 * 上方一张图，下方一张图，找出所有不同之处
 */
export default function SpotDifference({ onScore }: { onScore: (s: number) => void }) {
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds] = useState(3);
  const [differences, setDifferences] = useState<{ x: number; y: number; found: boolean }[]>([]);
  const [foundCount, setFoundCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);

  // 初始化一轮
  const initRound = useCallback(() => {
    // 生成 5 个随机不同点
    const newDiffs = Array.from({ length: 5 }, () => ({
      x: Math.floor(Math.random() * 280) + 10,
      y: Math.floor(Math.random() * 180) + 10,
      found: false,
    }));
    setDifferences(newDiffs);
    setFoundCount(0);
    setTimeLeft(60);
    setGameOver(false);
  }, []);

  // 初始化
  useEffect(() => {
    initRound();
  }, [initRound]);

  // 倒计时
  useEffect(() => {
    if (gameOver || foundCount === 5) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameOver, foundCount]);

  // 点击找不同
  const handleClick = (imageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (gameOver || foundCount === 5) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 检查是否点中了某个不同点
    const clickedDiff = differences.find(d => 
      !d.found && Math.abs(d.x - x) < 20 && Math.abs(d.y - (imageIndex === 0 ? 0 : 200)) < 20
    );

    if (clickedDiff) {
      clickedDiff.found = true;
      const newFoundCount = foundCount + 1;
      setFoundCount(newFoundCount);

      if (newFoundCount === 5) {
        // 找到全部
        const timeBonus = Math.floor(timeLeft / 2);
        const roundScore = 50 + timeBonus;
        const newScore = score + roundScore;
        setScore(newScore);

        if (currentRound >= totalRounds) {
          onScore(newScore);
          setGameOver(true);
        } else {
          setTimeout(() => {
            setCurrentRound(r => r + 1);
            initRound();
          }, 1500);
        }
      }
    }
  };

  return (
    <GameFullscreen onClose={() => onScore(score)}>
      <div style={{ color: '#fff', textAlign: 'center', maxWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span>🔍 找不同</span>
          <span>🏆 {score} 分</span>
        </div>

        <div style={{ fontSize: 14, marginBottom: 8 }}>
          第 {currentRound}/{totalRounds} 轮 | ⏱️ {timeLeft}s | 已找到 {foundCount}/5
        </div>

        {/* 上下两张图 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 上方图 */}
          <div
            onClick={(e) => handleClick(0, e)}
            style={{
              position: 'relative',
              width: 300,
              height: 200,
              background: '#f0f0f0',
              borderRadius: 8,
              margin: '0 auto',
              cursor: 'pointer',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
              🖼️
            </div>
            {/* 标记已找到的点 */}
            {differences.map((d, i) => 
              d.found && (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: d.x - 15,
                    top: d.y - 15,
                    width: 30,
                    height: 30,
                    border: '3px solid red',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                  }}
                />
              )
            )}
          </div>

          <div style={{ fontSize: 12, color: '#aaa' }}>⬇️ 下方图 ⬇️</div>

          {/* 下方图 */}
          <div
            onClick={(e) => handleClick(1, e)}
            style={{
              position: 'relative',
              width: 300,
              height: 200,
              background: '#f0f0f0',
              borderRadius: 8,
              margin: '0 auto',
              cursor: 'pointer',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
              🖼️
            </div>
            {/* 标记已找到的点 */}
            {differences.map((d, i) => 
              d.found && (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: d.x - 15,
                    top: d.y - 15 + 200,
                    width: 30,
                    height: 30,
                    border: '3px solid red',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                  }}
                />
              )
            )}
          </div>
        </div>

        {gameOver && (
          <div style={{ marginTop: 16, fontSize: 18 }}>
            {foundCount === 5 ? '🎉 找到全部！' : '⏱️ 时间到！'}
            <br />
            最终得分：{score}
          </div>
        )}
      </div>
    </GameFullscreen>
  );
}
