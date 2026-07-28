/**
 * FishingVideoOverlay — v2 抛竿/拉杆全屏视频层 (方案 A)
 *
 * 行为:
 *   - 给 videoUrl 时, 渲染一个 zIndex 30 的全屏 <video>, autoplay + muted + onEnded 回调
 *   - 静默跳过: videoUrl 为空 / 404 / load 失败 → 不渲染, 父级 onSkip 立即触发
 *   - 单次播放, 不循环, onEnded 一定调一次
 *
 * Props:
 *   - videoUrl: 视频 URL (来自 cast_video_v2 / pull_video_v2, 空则跳过)
 *   - onDone: 视频结束 (或跳过) 时的回调
 *   - hint: 屏幕中央提示文字 (e.g. "🎣 抛竿中..." / "💪 拉杆中...")
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  videoUrl?: string;
  onDone: () => void;
  hint?: string;
}

export default function FishingVideoOverlay({ videoUrl, onDone, hint }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // videoUrl 为空 → 立即跳过
  useEffect(() => {
    if (!videoUrl) onDoneRef.current();
  }, [videoUrl]);

  // autoplay 处理 (iOS 静音自动播放可绕过)
  useEffect(() => {
    if (!videoUrl || failed) return;
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* 静默 */ });
  }, [videoUrl, failed]);

  if (!videoUrl || failed) return null;

  return (
    <div
      data-testid="fishing-video-overlay"
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fvoFadeIn 0.2s ease-out',
      }}
    >
      <video
        ref={ref}
        src={videoUrl}
        playsInline
        muted
        onEnded={() => onDoneRef.current()}
        onError={() => onDoneRef.current()}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
        }}
      />
      {hint && (
        <div style={{
          position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
          color: '#FFD700', fontSize: 16, fontWeight: 700,
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: 12,
          pointerEvents: 'none',
        }}>{hint}</div>
      )}
      <style>{`
        @keyframes fvoFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
