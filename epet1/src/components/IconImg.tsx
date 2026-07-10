/**
 * IconImg - 共享图标渲染组件
 *
 * 统一从 GameState Zustand store 读取图标数据 (admin/icons 配置),
 * yard 模式和 live 模式共用, 保证图标一致性。
 *
 * - 有 image_url → 渲染 <img>
 * - 无 image_url → 渲染 fallback 文本 (通常是 emoji)
 */

import { useGameStore as usePixiGameStore } from '../game/GameState';

interface IconImgProps {
  iconKey: string;
  fallback: string;
  className?: string;
}

export function IconImg({ iconKey, fallback, className }: IconImgProps) {
  const icons = usePixiGameStore(s => s.icons);
  const icon = icons[iconKey];

  if (icon?.image_url) {
    const base = `${window.location.protocol}//${window.location.host}`;
    const url = icon.image_url.startsWith('/') ? `${base}${icon.image_url}` : icon.image_url;
    return <img src={url} alt={icon.label || iconKey} className={className || 'bottom-bar-icon-img uploaded'} />;
  }

  return <span className="bottom-bar-icon">{fallback}</span>;
}
