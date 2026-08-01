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
 *
 * i18n: 12 中文硬编码 → t('LivePage.sNNN', '原文') 模式
 *       t 是纯函数,可在 module 顶层 import 调用,见 i18n/useT.ts
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { fetchPetVideos, fetchDemoTime, type IntroVideo } from '../api/epet1';
import { IconImg } from './IconImg';
import { t } from '../i18n/useT';

// ─── 主组件 ───

interface LivePageProps {
  onOpenModal: (modal: 'postcard' | 'travel' | 'drift' | 'shop' | 'inventory' | 'collection' | 'fishing' | 'cooking' | 'settings') => void;
}

export function LivePage({ onOpenModal }: LivePageProps) {
  const { userId, yardPets } = useGameStore();
  const [videos, setVideos] = useState<IntroVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);
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

        // 根据当前时间计算默认视频索引 (优先使用演示时间)
        let currentMinutes: number;
        try {
          const demoState = await fetchDemoTime();
          if (demoState?.demoMode && demoState.demoTime) {
            const parts = demoState.demoTime.split(':');
            currentMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
          } else {
            const now = new Date();
            currentMinutes = now.getHours() * 60 + now.getMinutes();
          }
        } catch {
          const now = new Date();
          currentMinutes = now.getHours() * 60 + now.getMinutes();
        }

        // 找最接近当前时间的视频
        const threshold = 120; // 分钟
        let bestIndex = 0;
        let bestDiff = Infinity;
        petVideos.forEach((v, idx) => {
          const startParts = v.time_start.split(':');
          const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
          const endParts = v.time_end.split(':');
          const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
          // 计算与时间段中点的距离
          const mid = (startMin + endMin) / 2;
          const diff = Math.abs(currentMinutes - mid);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIndex = idx;
          }
        });
        setCurrentIndex(bestIndex);
      } catch (err) {
        console.error('[LivePage] load videos failed', err);
      } finally {
        setLoading(false);
      }
    };

    loadVideos();
  }, [userId, yardPets]);

  // 触摸滑动
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientY - touchStart;
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
          <div className="live-page-empty-title">{t('LivePage.s000', '庭院空空如也')}</div>
          <div className="live-page-empty-subtitle">{t('LivePage.s001', '去藏品库添加宠物，开始你的旅程')}</div>
          <button
            className="live-page-empty-btn"
            onClick={() => onOpenModal('collection')}
          >
            {t('LivePage.s002', '去藏品库')}
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
        <div>{t('LivePage.s003', '加载中...')}</div>
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
            <div>{t('LivePage.s004', '暂无视频配置')}</div>
          </div>
        </div>

        {videos.length > 1 && (
          <div className="live-page-swipe-hint">
            <span>{t('LivePage.s005', '↑↓ 滑动切换')}</span>
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
      </div>

      {/* 滑动提示 */}
      {videos.length > 1 && (
        <div className="live-page-swipe-hint">
          <span>{t('LivePage.s005', '↑↓ 滑动切换')}</span>
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
function TopRightMenu({ onOpenModal }: { onOpenModal: (modal: 'shop' | 'settings') => void }) {
  return (
    <div className="live-page-top-right-menu">
      <button className="live-page-top-btn" onClick={() => onOpenModal('shop')} aria-label={t('LivePage.s006', '商店')}>
        <IconImg iconKey="icon-shop" fallback="🏪" />
      </button>
      <button className="live-page-top-btn" onClick={() => onOpenModal('settings')} aria-label={t('LivePage.s007', '设置')}>
        <IconImg iconKey="icon-settings" fallback="⚙️" />
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
        <div className="live-page-play-modal-title">{t('LivePage.s008', '游玩')}</div>
        <div className="live-page-play-modal-grid">
          <button className="live-page-play-modal-item" onClick={() => { onClose(); onOpenModal('travel'); }}>
            <IconImg iconKey="icon-travel" fallback="✈️" />
            <span>{t('LivePage.s009', '派遣旅行')}</span>
          </button>
          <button className="live-page-play-modal-item" onClick={() => { onClose(); onOpenModal('fishing'); }}>
            <IconImg iconKey="icon-fishing" fallback="🎣" />
            <span>{t('LivePage.s010', '钓鱼')}</span>
          </button>
          <button className="live-page-play-modal-item" onClick={() => { onClose(); onOpenModal('cooking'); }}>
            <IconImg iconKey="icon-cooking" fallback="🍳" />
            <span>{t('LivePage.s011', '料理')}</span>
          </button>
        </div>
        <button className="live-page-play-modal-close" onClick={onClose}>{t('LivePage.s012', '关闭')}</button>
      </div>
    </div>
  );
}
