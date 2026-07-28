/**
 * FishingResultModal — v2 钓鱼结果弹窗
 * 半透明黑色背景 + 气泡 (内含角色/鱼) + 战利品名 + 描述 + "开心收下" 按钮 + ✨ 粒子
 */
import { useEffect, useState } from 'react';

const RARITY_COLORS: Record<string, string> = {
  common: '#b0b0b0', rare: '#4fc3f7', epic: '#ab47bc', legendary: '#ffd740',
};

interface Props {
  fish: { name: string; image_url?: string; rarity: string } | null;
  bubbleUrl?: string;
  avatarUrl?: string;
  collectBtnUrl?: string;
  fishDesc?: string;
  onCollect: () => void;
  onClose: () => void;
}

export default function FishingResultModal({
  fish, bubbleUrl, avatarUrl, collectBtnUrl, fishDesc, onCollect, onClose,
}: Props) {
  const [particles] = useState(() => Array.from({ length: 14 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 1.2,
    duration: 2.5 + Math.random() * 1.5, size: 14 + Math.random() * 12, rot: Math.random() * 360,
  })));

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Escape') onCollect(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCollect]);

  const rarity = fish?.rarity || 'common';
  const accent = RARITY_COLORS[rarity] || RARITY_COLORS.common;

  return (
    <div
      data-testid="fishing-result-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onCollect(); }}
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)',
        animation: 'frmFadeIn 0.3s ease-out', padding: 20,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 21 }}>
        {particles.map(p => (
          <div key={p.id} style={{
            position: 'absolute', left: `${p.left}%`, top: '-30px',
            fontSize: p.size, opacity: 0.85,
            transform: `rotate(${p.rot}deg)`,
            animation: `frmFall ${p.duration}s ${p.delay}s linear infinite`,
          }}>✨</div>
        ))}
      </div>

      <div style={{
        position: 'relative', zIndex: 22,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 16, maxWidth: 340, width: '100%',
        animation: 'frmPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <div style={{
          color: '#FFD740', fontSize: 22, fontWeight: 800,
          textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 16px rgba(255,215,0,0.5)',
          letterSpacing: 2, textAlign: 'center',
        }}>
          {fish ? `🎉 恭喜获得 ${fish.name}` : '🎣 没有鱼虾也好'}
        </div>

        <div style={{
          position: 'relative', width: 240, height: 240,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {bubbleUrl ? (
            <img src={bubbleUrl} alt="" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
              filter: `drop-shadow(0 8px 24px ${accent}55)`,
            }} />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(245,245,255,0.9) 100%)',
              borderRadius: '50%',
              boxShadow: `0 8px 32px ${accent}66, inset 0 -8px 16px rgba(0,0,0,0.06)`,
            }} />
          )}
          <div style={{
            position: 'relative', zIndex: 1, width: 140, height: 140,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', overflow: 'hidden',
          }}>
            {fish?.image_url ? (
              <img src={fish.image_url} alt={fish.name} style={{
                width: '100%', height: '100%', objectFit: 'contain',
                filter: `drop-shadow(0 4px 8px ${accent}88)`,
                animation: 'frmFloat 2.5s ease-in-out infinite',
              }} />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="角色" style={{
                width: '100%', height: '100%', objectFit: 'cover',
                animation: 'frmFloat 2.5s ease-in-out infinite',
              }} />
            ) : (
              <div style={{ fontSize: 80, animation: 'frmFloat 2.5s ease-in-out infinite' }}>
                {fish ? '🐟' : '🎣'}
              </div>
            )}
          </div>
        </div>

        {fish && (
          <div style={{
            color: '#FFD740', fontSize: 18, fontWeight: 700,
            textShadow: '0 2px 8px rgba(0,0,0,0.9)', textAlign: 'center',
          }}>
            {fish.name}
          </div>
        )}

        {fishDesc && (
          <div style={{
            color: '#fff', fontSize: 13, lineHeight: 1.5,
            background: 'rgba(0,0,0,0.4)', borderRadius: 10,
            padding: '8px 14px', textAlign: 'center', maxWidth: 280,
          }}>
            {fishDesc}
          </div>
        )}

        <button onClick={onCollect} style={{
          marginTop: 4, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }}>
          {collectBtnUrl ? (
            <img src={collectBtnUrl} alt="开心收下" style={{
              height: 60, width: 'auto', maxWidth: 220,
              filter: 'drop-shadow(0 4px 12px rgba(236,64,122,0.5))',
            }} />
          ) : (
            <div style={{
              padding: '14px 44px', fontSize: 17, fontWeight: 800,
              background: 'linear-gradient(180deg, #ff80ab 0%, #ec407a 100%)',
              border: '3px solid #fff', borderRadius: 18, color: '#fff',
              textShadow: '0 2px 4px rgba(0,0,0,0.4)',
              boxShadow: '0 6px 16px rgba(236,64,122,0.5), inset 0 2px 0 rgba(255,255,255,0.4)',
              letterSpacing: 2,
            }}>
              开心收下 💖
            </div>
          )}
        </button>
      </div>

      <button onClick={onClose} aria-label="关闭" style={{
        position: 'absolute', top: 16, right: 16, zIndex: 23,
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)',
        color: '#fff', fontSize: 18, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>

      <style>{`
        @keyframes frmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes frmPop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes frmFloat {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-6px) rotate(3deg); }
        }
        @keyframes frmFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.9; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
