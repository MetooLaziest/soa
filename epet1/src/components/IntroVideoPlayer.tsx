/**
 * 互动页开场视频播放器
 * 
 * 全屏播放，不可跳过，播放完毕后渐隐过渡到互动页。
 * 加载失败/超时时自动跳过。
 * 移动端自动播放被阻止时，显示"点击播放"按钮。
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
  const [fadeIn, setFadeIn] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [needUserClick, setNeedUserClick] = useState(false); // 自动播放被阻止

  // 进场动画
  useEffect(() => {
    const t = setTimeout(() => setFadeIn(false), 300);
    return () => clearTimeout(t);
  }, []);

  // 尝试自动播放，如果被阻止则显示点击按钮
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const p = v.play();
    if (p) {
      p.catch(() => {
        // 自动播放被阻止（常见于 iOS Safari）
        setNeedUserClick(true);
      });
    }
  }, []);

  // 超时兜底
  useEffect(() => {
    const timeout = setTimeout(() => {
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
    handleComplete();
  };

  const handleVideoError = () => {
    setLoadError(true);
    setTimeout(() => {
      onComplete();
    }, 3000);
  };

  const handleCanPlay = () => {
    setLoadError(false);
  };

  // 用户点击播放按钮
  const handleUserPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      setLoadError(true);
      setTimeout(() => onComplete(), 3000);
    });
    setNeedUserClick(false);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-300 ${
        fadeIn ? 'opacity-0' : fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
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
        className="w-full h-full object-contain"
        style={{ maxHeight: 'calc(100vh - 60px)' }}
      />

      {/* 自动播放被阻止，显示点击播放按钮 */}
      {needUserClick && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <button
            onClick={handleUserPlay}
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white/10 backdrop-blur-sm active:scale-95 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <div className="w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[20px] border-l-white ml-1" />
            </div>
            <span className="text-sm text-white/80">点击播放开场视频</span>
          </button>
        </div>
      )}

      {/* 加载失败提示 */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-sm text-gray-400">视频加载失败，即将进入互动页...</p>
          </div>
        </div>
      )}

      {/* 底部进度条 */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/60">{video.name || '开场视频'}</span>
          <span className="text-xs text-white/60">{remaining}s</span>
        </div>
        <div className="h-1 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/80 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
