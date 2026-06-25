/**
 * 互动页开场视频播放器
 * 
 * 全屏播放，不可跳过，播放完毕后渐隐过渡到互动页。
 * 通过 React Portal 渲染到 document.body，脱离 App 层叠上下文。
 */
import { useState, useRef, useEffect, useCallback } from 'react';

interface IntroVideoData {
  id: number;
  video_url: string;
  duration_sec: number;
  name: string;
}

interface IntroVideoPlayerProps {
  video: IntroVideoData;
  onComplete: () => void;
}

export default function IntroVideoPlayer({ video, onComplete }: IntroVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState(video.duration_sec);
  const [visible, setVisible] = useState(false); // 初始不可见，等视频可播放后再显示
  const [fadeOut, setFadeOut] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [needUserClick, setNeedUserClick] = useState(false);

  // 视频可播放时才显示（避免黑屏闪烁）
  const handleCanPlay = () => {
    console.log('[IntroVideo] canplay');
    setVisible(true);
    setLoadError(false);
  };

  // 尝试自动播放
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    console.log('[IntroVideo] attempting autoplay...');
    const p = v.play();
    if (p) {
      p.then(() => {
        console.log('[IntroVideo] autoplay succeeded');
      }).catch((err) => {
        console.log('[IntroVideo] autoplay blocked:', err.message);
        setNeedUserClick(true);
        setVisible(true); // 显示点击播放按钮
      });
    }
  }, []);

  // 超时兜底
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('[IntroVideo] timeout, forcing complete');
      handleComplete();
    }, video.duration_sec * 1000 * 1.5 + 3000);
    return () => clearTimeout(timeout);
  }, [video.duration_sec]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const pct = (v.currentTime / v.duration) * 100;
    setProgress(pct);
    setRemaining(Math.max(0, Math.ceil(v.duration - v.currentTime)));
  };

  const handleComplete = useCallback(() => {
    setFadeOut(true);
    setTimeout(() => {
      onComplete();
    }, 400);
  }, [onComplete]);

  const handleVideoEnded = () => {
    console.log('[IntroVideo] ended');
    handleComplete();
  };

  const handleVideoError = () => {
    console.log('[IntroVideo] error');
    setLoadError(true);
    setVisible(true);
    setTimeout(() => {
      onComplete();
    }, 3000);
  };

  const handleUserPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      setLoadError(true);
      setTimeout(() => onComplete(), 3000);
    });
    setNeedUserClick(false);
  };

  const opacity = fadeOut ? 0 : visible ? 1 : 0;

  return (
    <div
      data-intro-video
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        opacity,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'auto',
      }}
      onClick={needUserClick ? handleUserPlay : undefined}
    >
      {/* 视频播放器 */}
      <video
        ref={videoRef}
        src={video.video_url}
        autoPlay
        muted
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleVideoEnded}
        onError={handleVideoError}
        onCanPlay={handleCanPlay}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          maxHeight: 'calc(100vh - 60px)',
          pointerEvents: 'none',
        }}
      />
      {/* 透明遮罩层 — 阻止触摸触发浏览器原生控制条 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
        }}
        onClick={needUserClick ? handleUserPlay : undefined}
      />
      <style>{`
        [data-intro-video] video::-webkit-media-controls { display: none !important; }
        [data-intro-video] video::-webkit-media-controls-enclosure { display: none !important; }
        [data-intro-video] video::-webkit-media-controls-panel { display: none !important; }
        [data-intro-video] video { pointer-events: none !important; }
      `}</style>

      {/* 自动播放被阻止，显示点击播放按钮 */}
      {needUserClick && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
        }}>
          <button
            onClick={handleUserPlay}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '24px 32px',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: '#fff',
            }}>
              ▶
            </div>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>点击播放开场视频</span>
          </button>
        </div>
      )}

      {/* 加载失败提示 */}
      {loadError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 13, color: '#999' }}>视频加载失败，即将进入互动页...</p>
          </div>
        </div>
      )}

      {/* 底部进度条 */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '32px 16px 16px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{video.name || '开场视频'}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{remaining}s</span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 2,
            background: 'rgba(255,255,255,0.8)',
            width: `${progress}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    </div>
  );
}
