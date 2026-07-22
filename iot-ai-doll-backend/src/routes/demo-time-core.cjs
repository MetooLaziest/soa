/**
 * 演示时间核心逻辑 (CJS, 供 ESM 路由 + CJS 路由共用)
 *
 * 内存变量存储, PM2 重启即恢复真实时间 (天然回滚)
 */

// null = 未设置 (使用真实时间)
// "HH:MM" 格式的字符串 = 演示时间
let demoTime = null;

/** @returns {string|null} "HH:MM" 格式, 或 null 表示使用真实时间 */
function getDemoTime() {
  return demoTime;
}

/** @returns {number} 0-23 */
function getEffectiveHour() {
  if (demoTime) {
    return parseInt(demoTime.split(':')[0], 10);
  }
  return new Date().getHours();
}

/** @returns {string} "HH:MM" 格式 */
function getEffectiveTimeStr() {
  if (demoTime) {
    return demoTime;
  }
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** 设置演示时间 (由 admin 路由调用) */
function setDemoTime(time) {
  demoTime = time;
}

/** 清除演示时间 (由 admin 路由调用) */
function clearDemoTime() {
  demoTime = null;
}

module.exports = {
  getDemoTime,
  getEffectiveHour,
  getEffectiveTimeStr,
  setDemoTime,
  clearDemoTime,
};
