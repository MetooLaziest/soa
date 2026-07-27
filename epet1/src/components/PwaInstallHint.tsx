import { useEffect, useState } from 'react';
import './PwaInstallHint.css';

/**
 * iOS Safari PWA 安装提示横幅
 *
 * 问题: iOS Safari 17+ 浮层 tab bar (~110px) 始终覆盖在 viewport 之上,
 * env(safe-area-inset-bottom) 和 visualViewport 都不包含它.
 * 唯一根治办法: 用户「添加到主屏幕」后启动 standalone PWA 模式, 无 Safari chrome.
 *
 * 显示条件:
 *  1. iOS 设备 (iPhone/iPad)
 *  2. 不是 standalone 模式 (没添加到主屏幕)
 *  3. 不是 in-app 浏览器 (微信/QQ 等)
 *  4. 用户没主动关闭过提示
 *  5. 用户已经登录过 (避免首次启动就提示)
 */
export default function PwaInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    const isInApp = /MicroMessenger|QQ\/|Weibo/.test(navigator.userAgent);
    const dismissed = localStorage.getItem('pwa-hint-dismissed') === '1';
    const seenLogin = localStorage.getItem('pwa-hint-seen-after-login') === '1';

    if (isIOS && !isStandalone && !isInApp && !dismissed && seenLogin) {
      // 延迟 1.5s 出现, 避免遮挡登录流程
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-hint-dismissed', '1');
  };

  if (!show) return null;

  return (
    <div className="pwa-install-hint">
      <div className="pwa-hint-content">
        <div className="pwa-hint-icon">📱</div>
        <div className="pwa-hint-text">
          <div className="pwa-hint-title">获得最佳体验</div>
          <div className="pwa-hint-desc">
            点击底部 <span className="pwa-hint-share-icon">⎙</span>「分享」→ <b>添加到主屏幕</b>，
            全屏启动无遮挡
          </div>
        </div>
        <button
          className="pwa-hint-close"
          onClick={handleDismiss}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <div className="pwa-hint-arrow">↑</div>
    </div>
  );
}
