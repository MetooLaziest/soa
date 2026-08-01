/**
 * FishingProgressBar — 顶部进度条 (v2)
 * 横条 + 绿色判定区 + 🐟 emoji 指针 + ✨ 闪光效果
 *
 * Props:
 *   - progress: 0-100 当前指针位置
 *   - greenStart/greenEnd: 0-100 绿色判定区起止
 *   - onPull: 拉杆回调
 *   - pullBtnUrl: "拉杆"按钮图 (来自 btn_rod_v2, 缺省走 emoji)
 *   - hint: 文案 (默认 "快拉杆!")
 */
import { useEffect, useState } from 'react';

import { useT } from '../i18n/useT';
const t = useT();

interface Props {
  progress: number;
  greenStart: number;
  greenEnd: number;
  onPull: () => void;
  pullBtnUrl?: string;
  hint?: string;
}

export default function FishingProgressBar({
  progress,
  greenStart,
  greenEnd,
  onPull,
  pullBtnUrl,
  hint = t('FishingProgressBar.s000', '快拉杆!'),
}: Props) {
  // 触觉反馈: 进入绿区时短震 (mobile)
  const [inGreen, setInGreen] = useState(false);
  useEffect(() => {
    const nowIn = progress >= greenStart && progress <= greenEnd;
    if (nowIn && !inGreen) {
      try { (navigator as any).vibrate?.(20); } catch { /* noop */ }
    }
    setInGreen(nowIn);
  }, [progress, greenStart, greenEnd, inGreen]);

  return (
    <div
      data-testid="fishing-progress-bar"
      style={{
        position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
        width: '88%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        zIndex: 11,
      }}
    >
      <div style={{
        color: '#FFD700', fontSize: 15, fontWeight: 700,
        textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 12px rgba(255,215,0,0.6)',
        animation: 'fpbHintPulse 0.8s ease-in-out infinite',
      }}>
        {inGreen ? t('FishingProgressBar.s001', '✨ 现在拉! ✨') : hint}
      </div>
      <div style={{
        position: 'relative', width: '100%', height: 28,
        background: 'rgba(0,0,0,0.55)',
        borderRadius: 14, overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.4)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 4px rgba(0,0,0,0.6)',
      }}>
        {/* 绿色判定区 */}
        <div style={{
          position: 'absolute', left: `${greenStart}%`, width: `${greenEnd - greenStart}%`,
          top: 0, bottom: 0,
          background: 'linear-gradient(180deg, rgba(76,175,80,0.7) 0%, rgba(56,142,60,0.7) 100%)',
          borderLeft: '2px solid rgba(129,199,132,0.95)',
          borderRight: '2px solid rgba(129,199,132,0.95)',
          boxShadow: inGreen
            ? '0 0 16px rgba(129,199,132,0.9), inset 0 0 12px rgba(255,255,255,0.4)'
            : 'inset 0 0 8px rgba(255,255,255,0.2)',
          transition: 'box-shadow 0.15s',
        }} />
        {/* 网格刻度 */}
        {[0, 25, 50, 75, 100].map(p => (
          <div key={p} style={{
            position: 'absolute', left: `${p}%`, top: 0, bottom: 0,
            width: 1, background: 'rgba(255,255,255,0.2)',
          }} />
        ))}
        {/* 🐟 指针 */}
        <div style={{
          position: 'absolute',
          left: `calc(${progress}% - 18px)`, top: '-6px',
          width: 36, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, lineHeight: 1,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7)) drop-shadow(0 0 8px rgba(255,255,255,0.6))',
          transform: 'rotate(-15deg)',
          transition: 'left 0.03s linear',
          animation: 'fpbCursorWiggle 0.3s ease-in-out infinite',
        }}>
          🐟
        </div>
      </div>
      {/* 拉杆按钮 (优先 btn_rod_v2 图) */}
      <button onClick={onPull} style={{
        marginTop: 4, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
      }}>
        {pullBtnUrl ? (
          <img src={pullBtnUrl} alt={t('FishingProgressBar.s002', '拉杆')} style={{
            height: 56, width: 'auto', maxWidth: 200,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
            animation: 'fpbBtnBob 1.2s ease-in-out infinite',
          }} />
        ) : (
          <div style={{
            padding: '12px 36px', fontSize: 18, fontWeight: 800,
            background: 'linear-gradient(180deg, #66bb6a 0%, #43a047 100%)',
            border: '3px solid #FFD700', borderRadius: 14, color: '#fff',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            boxShadow: '0 4px 12px rgba(76,175,80,0.5), inset 0 2px 0 rgba(255,255,255,0.3)',
            letterSpacing: 2, animation: 'fpbBtnBob 1.2s ease-in-out infinite',
          }}>
            🎣 {t('FishingProgressBar.s003', '拉杆')}
          </div>
        )}
      </button>
      <style>{`
        @keyframes fpbHintPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes fpbCursorWiggle {
          0%, 100% { transform: rotate(-15deg) translateY(0); }
          50% { transform: rotate(-10deg) translateY(-2px); }
        }
        @keyframes fpbBtnBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
