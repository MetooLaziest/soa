import { useEffect, useCallback } from 'react';

/**
 * 全屏游戏容器 - 所有游戏都应该用这个包裹
 */
export default function GameFullscreen({ 
  children, 
  onClose 
}: { 
  children: React.ReactNode;
  onClose: () => void;
}) {
  // 禁止背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // ESC 或返回键关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Backspace') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'env(safe-area-inset-top) 16px env(safe-area-inset-bottom) 16px',
    }}>
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: '#fff',
          fontSize: 20,
          cursor: 'pointer',
          zIndex: 10,
        }}
      >
        ✕
      </button>

      {children}
    </div>
  );
}
