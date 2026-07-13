/**
 * LivePage - 直播画面模式
 *
 * 功能:
 * - 显示 yardPets[0] 的视频
 * - 根据当前时间匹配最接近的时间段视频
 * - 上下滑动切换不同时间段的视频
 * - 底部菜单栏: 明信片、藏品库、背包、游玩
 * - 【游玩】栏目中包含【派遣旅行】子选项
 * - 右上角【商店】入口
 * - 图标从 GameState Zustand store 读取（与庭院页面完全一致, 由 App.tsx init 加载）
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { fetchPetVideos, type IntroVideo } from '../api/epet1';
import { IconImg } from './IconImg';

// ─── 主组件 ───

interface LivePageProps {
  onOpenModal: (modal: 'postcard' | 'travel' | 'drift' | 'shop' | 'inventory' | 'collection' | 'fishing' | 'cooking') => void;
  onSwitchToYard: () => void;
}

export function LivePage({ onOpenModal, onSwitchToYard }: LivePageProps) {
  const { userId, yardPets } = useGameStore();
  const [videos, setVideos] = useState<IntroVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [showModeSwitch, setShowModeSwitch] = useState(false);
  const [showPlayMenu, setShowPlayMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 获取第一个庭院机伴的视频列表
  useEffect(() => {
    if (!userId || yardPets.length === 0) {
      setLoading(false);
      return;
    }

    const loadVideos = async () => {
      try {
        const firstPet = yardPets[0];
        const petVideos = await fetchPetVideos(firstPet.pet_model_id, firstPet.growth_level);
        setVideos(petVideos);

        // 根据当前时间计算默认视频索引
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        let closestIndex = 0;
        let minDiff = Infinity;

        petVideos.forEach((video, index) => {
          const [startHour, startMin] = video.time_start.split(':').map(Number);
          const videoMinutes = startHour * 60 + startMin;
          const diff = Math.abs(currentMinutes - videoMinutes);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = index;
          }
        });

        setCurrentIndex(closestIndex);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load videos:', err);
        setLoading(false);
      }
    };

    loadVideos();
  }, [userId, yardPets]);

  // 自动播放当前视频
  useEffect(() => {
    if (videoRef.current && videos[currentIndex]) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, videos]);

  // 上下滑动手势
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStart === null || videos.length <= 1) return;

    const diff = touchStart - e.changedTouches[0].clientY;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }
    setTouchStart(null);
  }, [touchStart, currentIndex, videos.length]);

  // 当前视频
  const currentVideo = videos[currentIndex];

  // 如果没有庭院机伴
  if (yardPets.length === 0) {
    return (
      <div className="live-page-empty">
        <div className="live-page-empty-content">
          <div className="live-page-empty-icon">🏠</div>
          <div className="live-page-empty-title">庭院空空如也</div>
          <div className="live-page-empty-subtitle">去藏品库添加宠物，开始你的旅程</div>
          <button
            className="live-page-empty-btn"
            onClick={() => onOpenModal('collection')}
          >
            去藏品库
          </button>
        </div>
        <BottomMenu onOpenModal={onOpenModal} onShowPlayMenu={() => setShowPlayMenu(true)} />
      </div>
    );
  }

  // 加载中
  if (loading) {
    return (
      <div className="live-page-loading">
        <div className="live-page-loading-spinner">🌀</div>
        <div>加载中...</div>
      </div>
    );
  }

  // 占位视频（无视频配置）
  if (!currentVideo) {
    return (
      <div className="live-page">
        <div className="live-page-video-container">
          <div className="live-page-placeholder">
            <div className="live-page-placeholder-icon">🎬</div>
            <div>暂无视频配置</div>
          </div>
        </div>

        {videos.length > 1 && (
          <div className="live-page-swipe-hint">
            <span>↑↓ 滑动切换</span>
          </div>
        )}

        <div className="live-page-info">
          <div className="live-page-info-name">{yardPets[0].nickname || yardPets[0].model_name}</div>
          <div className="live-page-info-time">
            {currentIndex + 1} / {videos.length}
          </div>
        </div>

        <TopRightMenu onOpenModal={onOpenModal} />
        <BottomMenu onOpenModal={onOpenModal} onShowPlayMenu={() => setShowPlayMenu(true)} />
        {showPlayMenu && (
          <PlayMenuModal onClose={() => setShowPlayMenu(false)} onOpenModal={onOpenModal} />
        )}
      </div>
    );
  }

  return (
    <div
      className="live-page"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 视频播放器 */}
      <div className="live-page-video-container">
        <video
          ref={videoRef}
          src={currentVideo.video_url}
          className="live-page-video"
          loop
          autoPlay
          playsInline
          muted
        />

        {/* 切换模式按钮 */}
        <button
          className="live-page-mode-switch-btn"
          onClick={() => setShowModeSwitch(true)}
        >
          🔄
        </button>
      </div>

      {/* 滑动提示 */}
      {videos.length > 1 && (
        <div className="live-page-swipe-hint">
          <span>↑↓ 滑动切换</span>
        </div>
      )}

      {/* 视频信息 */}
      <div className="live-page-info">
        <div className="live-page-info-name">{currentVideo.name}</div>
        <div className="live-page-info-time">
          {currentVideo.time_start} - {currentVideo.time_end}
        </div>
        <div className="live-page-info-progress">
          {currentIndex + 1} / {videos.length}
        </div>
      </div>

      {/* 右上角商店 */}
      <TopRightMenu onOpenModal={onOpenModal} />

      {/* 模式切换弹窗 */}
      {showModeSwitch && (
        <div className="live-page-mode-modal" onClick={() => setShowModeSwitch(false)}>
          <div className="live-page-mode-modal-content" onClick={e => e.stopPropagation()}>
            <div className="live-page-mode-modal-title">切换展示模式</div>
            <button className="live-page-mode-modal-btn" onClick={onSwitchToYard}>
              🏡 切换到庭院画面
            </button>
            <button className="live-page-mode-modal-btn secondary" onClick={() => setShowModeSwitch(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      <BottomMenu onOpenModal={onOpenModal} onShowPlayMenu={() => setShowPlayMenu(true)} />

      {/* 游玩菜单弹窗 */}
      {showPlayMenu && (
        <PlayMenuModal onClose={() => setShowPlayMenu(false)} onOpenModal={onOpenModal} />
      )}
    </div>
  );
}

// ─── 子组件 ───

// 右上角菜单 - 商店
function TopRightMenu({ onOpenModal }: { onOpenModal: (modal: 'shop') => void }) {
  return (
    <div className="live-page-top-right-menu">
      <button className="live-page-top-btn" onClick={() => onOpenModal('shop')}>
        <IconImg iconKey="icon-shop" fallback="🏪" />
      </button>
    </div>
  );
}

// 底部菜单栏
function BottomMenu({ onOpenModal, onShowPlayMenu }: {
  onOpenModal: (modal: 'postcard' | 'travel' | 'drift' | 'shop' | 'game' | 'inventory' | 'collection' | 'fishing' | 'cooking') => void;
  onShowPlayMenu: () => void;
}) {
  return (
    <div className="live-page-bottom-menu">
      <button className="live-page-menu-btn" onClick={() => onOpenModal('postcard')}>
        <IconImg iconKey="icon-postcard" fallback="💌" />
      </button>

      <button className="live-page-menu-btn" onClick={() => onOpenModal('collection')}>
        <IconImg iconKey="icon-collection" fallback="🏠" />
      </button>

      <button className="live-page-menu-btn" onClick={() => onOpenModal('inventory')}>
        <IconImg iconKey="icon-backpack" fallback="🎒" />
      </button>

      <button className="live-page-menu-btn play-btn" onClick={onShowPlayMenu}>
        <IconImg iconKey="icon-minigame" fallback="🎮" />
      </button>
    </div>
  );
}

// 游玩菜单弹窗
function PlayMenuModal({ onClose, onOpenModal }: {
  onClose: () => void;
  onOpenModal: (modal: 'travel' | 'fishing' | 'cooking') => void;
}) {
  return (
    <div className="live-page-play-modal" onClick={onClose}>
      <div className="live-page-play-modal-content" onClick={e => e.stopPropagation()}>
        <div className="live-page-play-modal-title">游玩</div>
        <div className="live-page-play-modal-grid">
          <button className="live-page-play-modal-item" onClick={() => { onClose(); onOpenModal('travel'); }}>
            <IconImg iconKey="icon-travel" fallback="✈️" />
            <span>派遣旅行</span>
          </button>
          <button className="live-page-play-modal-item" onClick={() => { onClose(); onOpenModal('fishing'); }}>
            <IconImg iconKey="icon-fishing" fallback="🎣" />
            <span>钓鱼</span>
          </button>
          <button className="live-page-play-modal-item" onClick={() => { onClose(); onOpenModal('cooking'); }}>
            <IconImg iconKey="icon-cooking" fallback="🍳" />
            <span>料理</span>
          </button>
        </div>
        <button className="live-page-play-modal-close" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}
