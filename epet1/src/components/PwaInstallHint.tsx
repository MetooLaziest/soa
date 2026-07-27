import { useEffect, useState } from 'react';
import './PwaInstallHint.css';

/**
 * iOS Safari PWA 安装提示横幅
 *
 * 问题: iOS Safari 17+ 浮层 tab bar (~110px) 始终覆盖在 viewport 之上,
 * env(safe-area-inset-bottom) 和 visualViewport 都不包含它.
 * 唯一根治办法: 用户「添加到主屏幕」后启动 standalone PWA 模式, 无 Safari chrome.
 *
 * 浏览器检测 (精准识别 Safari, 排除 iOS 上其他浏览器):
 *   - UA 包含 iPhone/iPad/iPod
 *   - UA 包含 AppleWebKit (所有 iOS 浏览器都有)
 *   - 排除 iOS Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS), Opera (OPiOS)
 *   - 排除微信/QQ/微博 in-app 浏览器
 *
 * 显示条件:
 *  1. 浏览器 = iOS Safari
 *  2. 不是 standalone 模式 (没添加到主屏幕)
 *  3. 用户没主动关闭过提示 (localStorage pwa-hint-dismissed)
 *
 * 位置模式:
 *  - 登录界面 (placement='login'): 顶部提示, 不遮挡表单
 *  - 主界面 (placement='main'): 顶部提示, 不遮挡内容
 */

type Placement = 'login' | 'main';

interface PwaInstallHintProps {
  placement?: Placement;
}

export default function PwaInstallHint({ placement = 'main' }: PwaInstallHintProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 精准识别 iOS Safari
    // (iOS 上所有浏览器 UA 都含 AppleWebKit, 但只有 Safari 不含其他关键字)
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    // iPadOS 13+ 在桌面模式 UA 不再含 iPad, 需用触屏判断
    const isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const isIOSDevice = isIOS || isIPadOS;
    // 是 iOS Safari, 不是 iOS 上的其他浏览器
    const isSafari =
      isIOSDevice &&
      /AppleWebKit/.test(ua) &&
      !/CriOS/.test(ua) &&    // Chrome on iOS
      !/FxiOS/.test(ua) &&    // Firefox on iOS
      !/EdgiOS/.test(ua) &&   // Edge on iOS
      !/OPiOS/.test(ua) &&    // Opera on iOS
      !/MicroMessenger/.test(ua) && // 微信
      !/QQ\//.test(ua) &&     // QQ
      !/Weibo/.test(ua);      // 微博
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    const dismissed = localStorage.getItem('pwa-hint-dismissed') === '1';

    if (isSafari && !isStandalone && !dismissed) {
      // 延迟出现, 避免遮挡
      // 登录页: 800ms, 让用户先看到表单
      // 主界面: 1500ms, 让首屏渲染完成
      const delay = placement === 'login' ? 800 : 1500;
      const t = setTimeout(() => setShow(true), delay);
      return () => clearTimeout(t);
    }
  }, [placement]);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-hint-dismissed', '1');
  };

  if (!show) return null;

  return (
    <div className={`pwa-install-hint pwa-hint-${placement}`}>
      <div className="pwa-hint-content">
        <div className="pwa-hint-icon">📱</div>
        <div className="pwa-hint-text">
          <div className="pwa-hint-title">获得最佳体验</div>
          <div className="pwa-hint-desc">
            点击底部 <span className="pwa-hint-share-icon">⎙</span>「分享」→{' '}
            <b>添加到主屏幕</b>, 全屏启动无遮挡
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
      {placement === 'main' && <div className="pwa-hint-arrow">↑</div>}
    </div>
  );
}
