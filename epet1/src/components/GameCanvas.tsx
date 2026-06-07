import { useEffect, useRef } from 'react';
import { gameInstance } from '../game/Game';
import { useGameStore } from '../game/GameState';
import type { VisiblePet } from '../game/GameState';
import { fetchVisiblePets, petInteract } from '../api/epet';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef(gameInstance);

  const { setVisiblePets, setLoading, markPetted } = useGameStore();

  // 初始化 PixiJS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = gameRef.current;
    game.init(canvas).catch(console.error);
    return () => { game.destroy(); };
  }, []);

  // 加载宠物
  useEffect(() => {
    setLoading(true);
    fetchVisiblePets()
      .then((pets) => {
        const vPets: VisiblePet[] = pets.map((p: any) => ({
          ...p,
          petState: 'idle',
          animClass: 'walking',
          animX: 0,
          animY: 0,
          scale: 1,
        }));
        setVisiblePets(vPets);
        return Promise.all(vPets.map((p) => gameRef.current.addPet(p.petId, p.monsterType, p.displayName)));
      })
      .then(() => setLoading(false))
      .catch((e) => {
        console.error('Failed to load pets', e);
        setLoading(false);
      });
  }, []);

  // 点击检测
  const handleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const W = rect.width;
    const H = rect.height;

    const { visiblePets, lastPettedAt } = useGameStore.getState();

    let closest: VisiblePet | null = null;
    let minDist = 80;

    for (let i = 0; i < visiblePets.length; i++) {
      const p = visiblePets[i];
      const petX = W / 2 + (p.animX || 0);
      const petY = H / 2 + (p.animY || 0);
      const dist = Math.hypot(x - petX, y - petY);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }

    if (!closest) return;

    const now = Date.now();
    const lastPetted = lastPettedAt[closest.petId] || 0;

    if (now - lastPetted < 300) {
      window.open(`/epet/chat.html?id=${closest.petId}`, '_blank');
      return;
    }

    markPetted(closest.petId);
    gameRef.current.triggerShake(closest.petId);
    try {
      await petInteract(closest.petId);
    } catch (e) {
      console.warn('petInteract failed', e);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'block',
        cursor: 'pointer',
        zIndex: 0,
      }}
    />
  );
}
