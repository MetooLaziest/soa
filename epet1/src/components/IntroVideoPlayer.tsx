/**
 * 互动页开场视频播放器
 * 
 * 全屏播放，不可跳过，播放完毕后渐隐过渡到互动页。
 * 加载失败/超时时自动跳过。
 */
import { useState, useRef, useEffect } from 'react';

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

  // 进场动画
  useEffect(() => {
    const t = setTimeout(() => setFadeIn(false), 300);
    return () => clearTimeout(t);
  }, []);

  // 超时兜底：如果视频 duration_sec * 1.5 秒后还没结束，强制跳过
  useEffect(() => {
    const timeout = setTimeout(() => {
      handleComplete();
    }, video.duration_sec * 1000 * 1.5 + 3000); // 1.5x 时长 + 3s 缓冲
    return () => clearTimeout(timeout);
  }, [video.duration_sec]);

  // 更新进度
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const pct = (v.currentTime / v.duration) * 100;
    setProgress(pct);
    setRemaining(Math.max(0, Math.ceil(v.duration - v.currentTime)));
  };

  const handleComplete = () => {
    setFadeOut(true);
    setTimeout(() => {
      onComplete();
    }, 400);
  };

  const handleVideoEnded = () => {
    handleComplete();
  };

  const handleVideoError = () => {
    setLoadError(true);
    // 加载失败，3秒后自动跳过
    setTimeout(() => {
      onComplete();
    }, 3000);
  };

  const handleCanPlay = () => {
    setLoadError(false);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-300 ${
        fadeIn ? 'opacity-0' : fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
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
        {/* 视频名称 */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/60">{video.name || '开场视频'}</span>
          <span className="text-xs text-white/60">{remaining}s</span>
        </div>
        {/* 进度条 */}
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
