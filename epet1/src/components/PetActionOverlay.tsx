/**
 * PetActionOverlay — 庭院点击机伴后弹出的 2 选项浮层
 *
 * 装扮 / 派出旅行 两个按钮，图标可由 admin/icons 管理页替换
 * - 定位在机伴上方
 * - 5秒自动关闭 / 点击外部关闭 / 选择后关闭
 */

import { useEffect, useRef } from 'react';
import { IconImg } from './IconImg';
import { useGameStore } from '../store/gameStore';

interface PetActionOverlayProps {
  petId: number;
  petName: string;
  position: { x: number; y: number };
  onOutfit: () => void;
  onTravel: () => void;
  onClose: () => void;
}

export function PetActionOverlay({ petName, position, onOutfit, onTravel, onClose }: PetActionOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Auto-close after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout to avoid the same click that opened the overlay
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClick);
    };
  }, [onClose]);

  // Clamp position to viewport
  const x = Math.min(Math.max(position.x - 80, 10), window.innerWidth - 170);
  const y = Math.max(position.y - 70, 10);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 100,
        display: 'flex',
        gap: '8px',
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        animation: 'fadeInUp 0.2s ease-out',
        pointerEvents: 'auto',
      }}
    >
      {/* Arrow pointing down to pet */}
      <div style={{
        position: 'absolute',
        bottom: -6,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid rgba(255,255,255,0.95)',
      }} />

      <button
        onClick={onOutfit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 14px',
          border: 'none',
          borderRadius: '8px',
          background: '#f0f4ff',
          cursor: 'pointer',
          fontSize: '12px',
          color: '#333',
          minWidth: '64px',
        }}
      >
        <IconImg iconKey="icon-outfit" fallback="👔" className="bottom-bar-icon-img" />
        <span>装扮</span>
      </button>

      <button
        onClick={onTravel}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 14px',
          border: 'none',
          borderRadius: '8px',
          background: '#f0fff4',
          cursor: 'pointer',
          fontSize: '12px',
          color: '#333',
          minWidth: '64px',
        }}
      >
        <IconImg iconKey="icon-travel-send" fallback="✈️" className="bottom-bar-icon-img" />
        <span>派出旅行</span>
      </button>
    </div>
  );
}
