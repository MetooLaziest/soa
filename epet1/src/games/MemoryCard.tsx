import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 记忆卡牌（翻翻乐）
 * 4×4 = 16 张牌，8 对，翻开所有配对即获胜
 */
const EMOJIS = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryCard({ onScore }: { onScore: (s: number) => void }) {
  const [cards, setCards] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>([]);
  const [first, setFirst] = useState<number | null>(null);
  const [second, setSecond] = useState<number | null>(null);
  const [lock, setLock] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matched, setMatched] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const initGame = useCallback(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
    const pairs = shuffle([...EMOJIS, ...EMOJIS]);
    const newCards = pairs.map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
    setCards(newCards);
    setFirst(null);
    setSecond(null);
    setLock(false);
    setMoves(0);
    setMatched(0);
    setGameOver(false);
  }, []);

  useEffect(() => { initGame(); return () => timerRef.current.forEach(clearTimeout); }, [initGame]);

  useEffect(() => {
    if (first !== null && second !== null) {
      setLock(true);
      const a = cards[first], b = cards[second];
      if (a.emoji === b.emoji) {
        // Match!
        const t = setTimeout(() => {
          setCards(prev => prev.map(c => c.id === a.id || c.id === b.id ? { ...c, matched: true } : c));
          setMatched(m => {
            const nm = m + 1;
            if (nm === 8) {
              setGameOver(true);
              onScore(Math.max(100 - moves * 2, 10));
            }
            return nm;
          });
          setFirst(null); setSecond(null); setLock(false);
        }, 600);
        timerRef.current.push(t);
      } else {
        // No match
        const t = setTimeout(() => {
          setCards(prev => prev.map(c => c.id === a.id || c.id === b.id ? { ...c, flipped: false } : c));
          setFirst(null); setSecond(null); setLock(false);
        }, 800);
        timerRef.current.push(t);
      }
      setMoves(m => m + 1);
    }
  }, [first, second, cards]);

  const handleClick = (idx: number) => {
    if (lock || cards[idx].flipped || cards[idx].matched) return;
    if (first === idx) return;
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, flipped: true } : c));
    if (first === null) setFirst(idx);
    else setSecond(idx);
  };

  return (
    <div className="game-memory">
      <div className="game-memory-info">
        <span>步数：{moves}</span>
        <span>配对：{matched}/8</span>
      </div>
      {gameOver ? (
        <div className="game-memory-over">
          <div className="game-memory-over-text">🎉 全部配对！</div>
          <div className="game-memory-score">步数：{moves} · 得分：{Math.max(100 - moves * 2, 10)}</div>
          <button className="btn-primary" onClick={initGame}>再来一局</button>
        </div>
      ) : (
        <div className="game-memory-grid">
          {cards.map((c, i) => (
            <div
              key={c.id}
              className={`game-memory-card ${c.flipped || c.matched ? 'flipped' : ''}`}
              onClick={() => handleClick(i)}
            >
              <div className="game-memory-card-front">❓</div>
              <div className="game-memory-card-back">{c.emoji}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
