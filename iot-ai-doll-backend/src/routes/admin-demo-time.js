/**
 * 演示时间 (Demo Time) 管理
 *
 * 允许 admin 手动覆盖系统时间，用于演示场景：
 * - 庭院背景切换（dawn/day/night）
 * - 宠物行为匹配（pet_behaviors 按时间匹配）
 * - 直播视频选择（intro_videos 按时间匹配）
 *
 * 存储: 内存变量 (PM2 重启即恢复真实时间 — 天然回滚)
 *
 * 路由:
 *   GET  /api/admin/demo-time  — 获取当前状态
 *   POST /api/admin/demo-time  — 设置演示时间 { time: "HH:MM" } 或清除 { clear: true }
 *   GET  /api/epet1/demo-time  — 公开接口 (C端前端读取)
 */
import express from 'express';

const router = express.Router();

// ─── 内存存储 ───
// null = 未设置 (使用真实时间)
// "HH:MM" 格式的字符串 = 演示时间
let demoTime = null;

/**
 * 获取当前有效的演示时间 (供其他模块调用)
 * @returns {string|null} "HH:MM" 格式, 或 null 表示使用真实时间
 */
export function getDemoTime() {
  return demoTime;
}

/**
 * 获取当前有效的小时数 (供 yard-scene 等按小时判断的场景)
 * @returns {number} 0-23
 */
export function getEffectiveHour() {
  if (demoTime) {
    return parseInt(demoTime.split(':')[0], 10);
  }
  return new Date().getHours();
}

/**
 * 获取当前有效的时间字符串 "HH:MM" (供 SQL 参数化使用)
 * @returns {string} "HH:MM" 格式
 */
export function getEffectiveTimeStr() {
  if (demoTime) {
    return demoTime;
  }
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ─── Admin 路由 ───

// GET / — 获取当前演示时间状态
router.get('/', (_req, res) => {
  const now = new Date();
  const realTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  res.json({
    success: true,
    active: demoTime !== null,
    demo_time: demoTime,
    real_time: realTime,
    effective_time: demoTime || realTime,
  });
});

// POST / — 设置或清除演示时间
router.post('/', (req, res) => {
  const { time, clear } = req.body;

  if (clear) {
    demoTime = null;
    const now = new Date();
    const realTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return res.json({
      success: true,
      message: '已恢复真实时间',
      active: false,
      demo_time: null,
      real_time: realTime,
      effective_time: realTime,
    });
  }

  if (!time) {
    return res.status(400).json({ success: false, error: '需要 time (HH:MM) 或 clear: true' });
  }

  // 验证 HH:MM 格式
  const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return res.status(400).json({ success: false, error: '时间格式应为 HH:MM (如 07:30, 19:00)' });
  }
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return res.status(400).json({ success: false, error: '小时范围 0-23, 分钟范围 0-59' });
  }

  // 标准化为两位数
  demoTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  // 计算对应时段
  let timeSlot = 'day';
  if (hours >= 6 && hours < 9) timeSlot = 'dawn';
  else if (hours >= 9 && hours < 17) timeSlot = 'day';
  else if (hours >= 17 && hours < 20) timeSlot = 'dawn';
  else timeSlot = 'night';

  const now = new Date();
  const realTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  res.json({
    success: true,
    message: `演示时间已设为 ${demoTime}`,
    active: true,
    demo_time: demoTime,
    real_time: realTime,
    effective_time: demoTime,
    time_slot: timeSlot,
  });
});

// ─── 公开路由 (C端前端读取, 不暴露设置能力) ───

const publicRouter = express.Router();
publicRouter.get('/', (_req, res) => {
  const now = new Date();
  const realTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  res.json({
    success: true,
    active: demoTime !== null,
    demo_time: demoTime,
    real_time: realTime,
    effective_time: demoTime || realTime,
  });
});

export default router;
export { publicRouter };
