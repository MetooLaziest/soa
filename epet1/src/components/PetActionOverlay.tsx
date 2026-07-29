/**
 * PetActionOverlay — 庭院点击机伴后弹出的 2 选项浮层
 *
 * 装扮 / 派出旅行 两个按钮，图标可由 admin/icons 管理页替换
 * - 定位在机伴上方
 * - 5秒自动关闭 / 点击外部关闭 / 选择后关闭
 *
 * 历史 BUG (2026-07-29):
 *   之前用 setTimeout(50ms) 后再 addEventListener('pointerdown') 的方式防"同一点击关闭"
 *   但 iOS Safari 在 tap 后会触发 follow-up pointerdown (gesture/zoom candidate) 经常 >50ms,
 *   触发 onClose() → 浮层瞬间关闭 → 用户看到"菜单没弹出"+"机伴变小"(其实是 idle bob 帧).
 *   修复: 改用 ref-based 200ms 守卫 + 同时监听 mousedown/touchend (忽略 pointerdown 触摸伪事件).
 */

import { useEffect, useRef } from 'react';
import { IconImg } from './IconImg';

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
  // 守卫: overlay mount 后 200ms 内的外部点击一律忽略, 防 iOS touch 二次事件关 overlay
  const justOpenedRef = useRef(true);

  // 5s 自动关闭
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  // 点击外部关闭 — ref 守卫模式 (替代旧的 50ms setTimeout)
  useEffect(() => {
    justOpenedRef.current = true;
    const releaseGuard = setTimeout(() => {
      justOpenedRef.current = false;
    }, 200);

    const isOutside = (target: EventTarget | null) => {
      if (!overlayRef.current) return false;
      return !overlayRef.current.contains(target as Node);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (justOpenedRef.current) return;
      if (isOutside(e.target)) onClose();
    };
    // 用 touchend 替代 pointerdown, 避开 iOS Safari 的 pointerdown 触摸伪事件
    const handleTouchEnd = (e: TouchEvent) => {
      if (justOpenedRef.current) return;
      if (isOutside(e.target)) onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      clearTimeout(releaseGuard);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onClose]);

  // 钳制到视口 (overlay 宽 ~168px, 2 按钮 + 间距 + padding)
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
      {/* 箭头指向机伴 */}
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
