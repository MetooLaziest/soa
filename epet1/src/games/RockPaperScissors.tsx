import { useState, useCallback } from 'react';

/**
 * 猜拳（石头剪刀布）
 * 玩家 vs 宠物，三局两胜，每局胜负 +1 情绪值
 */
export default function RockPaperScissors({ onScore }: { onScore: (s: number) => void }) {
  const [playerChoice, setPlayerChoice] = useState<string | null>(null);
  const [petChoice, setPetChoice] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState(0);
  const [petWins, setPetWins] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const choices = ['✊ 石头', '✌️ 剪刀', '🖐️ 布'];
  const choiceKeys = ['rock', 'scissors', 'paper'];
  const emojis = ['✊', '✌️', '🖐️'];

  function getWinner(p: number, c: number): 'win' | 'lose' | 'draw' {
    if (p === c) return 'draw';
    if ((p === 0 && c === 1) || (p === 1 && c === 2) || (p === 2 && c === 0)) return 'win';
    return 'lose';
  }

  const play = useCallback((pIdx: number) => {
    if (gameOver) return;
    const cIdx = Math.floor(Math.random() * 3);
    setPlayerChoice(choiceKeys[pIdx]);
    setPetChoice(choiceKeys[cIdx]);

    const res = getWinner(pIdx, cIdx);
    if (res === 'win') {
      setWins(w => w + 1);
      setScore(s => s + 10);
      setResult('🎉 你赢了！+10分');
    } else if (res === 'lose') {
      setPetWins(w => w + 1);
      setResult('😢 宠物赢了...');
    } else {
      setResult('🤝 平局！');
    }

    // 检查三局两胜
    const newWins = res === 'win' ? wins + 1 : wins;
    const newPetWins = res === 'lose' ? petWins + 1 : petWins;

    if (newWins >= 2 || newPetWins >= 2) {
      setTimeout(() => {
        setGameOver(true);
        onScore(newWins >= 2 ? score + (newWins >= 2 ? 10 : 0) : score);
      }, 800);
    } else {
      setTimeout(() => {
        setRound(r => r + 1);
        setPlayerChoice(null);
        setPetChoice(null);
        setResult('');
      }, 1000);
    }
  }, [gameOver, wins, petWins, score, onScore]);

  const reset = () => {
    setPlayerChoice(null);
    setPetChoice(null);
    setResult('');
    setScore(0);
    setRound(1);
    setWins(0);
    setPetWins(0);
    setGameOver(false);
  };

  return (
    <div className="game-rps">
      <div className="game-rps-score">第 {round}/3 局 · 得分：{score}</div>
      <div className="game-rps-arena">
        <div className="game-rps-side">
          <div className="game-rps-label">你</div>
          <div className="game-rps-hand">{playerChoice ? emojis[choiceKeys.indexOf(playerChoice)] : '❓'}</div>
        </div>
        <div className="game-rps-vs">VS</div>
        <div className="game-rps-side">
          <div className="game-rps-label">宠物</div>
          <div className="game-rps-hand">{petChoice ? emojis[choiceKeys.indexOf(petChoice)] : '❓'}</div>
        </div>
      </div>
      {result && <div className={`game-rps-result ${result.includes('赢') ? 'win' : result.includes('输') ? 'lose' : ''}`}>{result}</div>}
      {!gameOver ? (
        <div className="game-rps-choices">
          {choices.map((c, i) => (
            <button key={c} className="game-rps-btn" onClick={() => play(i)} disabled={!!playerChoice}>
              {c}
            </button>
          ))}
        </div>
      ) : (
        <div className="game-rps-over">
          <div className="game-rps-final">{wins >= 2 ? '🏆 你赢了！' : '😢 宠物赢了...'}</div>
          <button className="btn-primary" onClick={reset}>再来一局</button>
        </div>
      )}
    </div>
  );
}
