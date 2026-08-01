/**
 * SettingsModal - C 端用户设置/登出弹窗
 *
 * 用于:
 * - 显示当前登录态 (uid / phone / isDemo)
 * - 退出登录 (清 localStorage + 跳登录页)
 *
 * 触发位置: 庭院 + Live 模式右上角 "⚙ 设置" 按钮
 * 2026-07-30: 初次版本, 根因修在 authStore.ts (demo 不清 stale token)
 */

import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

import { useT } from './i18n/useT';
const t = useT();

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { userId, phone, isDemo, logout } = useAuthStore();
  const [confirming, setConfirming] = useState(false);

  const handleLogout = () => {
    logout();
    // 跳根路径 → App.tsx 看到 isAuthenticated=false → 渲染 LoginOverlay
    window.location.href = '/';
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal-header">
          <span className="settings-modal-title">{t('SettingsModal.s000', '⚙ 设置')}</span>
          <button className="settings-modal-close" onClick={onClose} aria-label={t('SettingsModal.s001', '关闭')}>×</button>
        </div>

        <div className="settings-modal-body">
          <div className="settings-row">
            <span className="settings-label">{t('SettingsModal.s002', '用户ID')}</span>
            <span className="settings-value">{userId ?? '-'}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">{t('SettingsModal.s003', '账号')}</span>
            <span className="settings-value">
              {isDemo ? t('SettingsModal.s004', '演示用户 (免登录)') : (phone || t('SettingsModal.s005', '未绑定'))}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-label">{t('SettingsModal.s006', '模式')}</span>
            <span className="settings-value">
              {isDemo ? t('SettingsModal.s007', '🟢 演示免登录') : t('SettingsModal.s008', '🔵 正式登录')}
            </span>
          </div>
        </div>

        {!confirming ? (
          <button
            className="settings-logout-btn"
            onClick={() => setConfirming(true)}
          >
            退出登录
          </button>
        ) : (
          <div className="settings-confirm">
            <div className="settings-confirm-text">{t('SettingsModal.s009', '确定要退出登录吗？')}</div>
            <div className="settings-confirm-actions">
              <button
                className="settings-btn-cancel"
                onClick={() => setConfirming(false)}
              >{t('SettingsModal.s010', '取消')}</button>
              <button
                className="settings-btn-confirm"
                onClick={handleLogout}
              >{t('SettingsModal.s011', '确认退出')}</button>
            </div>
          </div>
        )}

        <div className="settings-footer">{t('SettingsModal.s012', 'MoMo庭院 v1.0')}</div>
      </div>
    </div>
  );
}
