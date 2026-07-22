/**
 * 演示时间 (Demo Time) 管理 — ESM 路由层
 *
 * 核心逻辑在 demo-time-core.cjs (CJS, 供 CJS/ESM 共用)
 *
 * 路由:
 *   GET  /api/admin/demo-time  — 获取当前状态
 *   POST /api/admin/demo-time  — 设置演示时间 { time: "HH:MM" } 或清除 { clear: true }
 *   GET  /api/epet1/demo-time  — 公开接口 (C端前端读取)
 */
import express from 'express';
import { createRequire } from 'module';

// 用 createRequire 在 ESM 中加载 CJS 核心模块
const require = createRequire(import.meta.url);
const core = require('./demo-time-core.cjs');

const { getDemoTime, getEffectiveHour, getEffectiveTimeStr, setDemoTime, clearDemoTime } = core;

// 重新导出供其他 ESM 模块使用
export { getDemoTime, getEffectiveHour, getEffectiveTimeStr };

const router = express.Router();

// ─── Admin 路由 ───

// GET / — 获取当前演示时间状态
router.get('/', (_req, res) => {
  const now = new Date();
  const realTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  res.json({
    success: true,
    active: getDemoTime() !== null,
    demo_time: getDemoTime(),
    real_time: realTime,
    effective_time: getDemoTime() || realTime,
  });
});

// POST / — 设置或清除演示时间
router.post('/', (req, res) => {
  const { time, clear } = req.body;

  if (clear) {
    clearDemoTime();
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
  const normalized = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  setDemoTime(normalized);

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
    message: `演示时间已设为 ${normalized}`,
    active: true,
    demo_time: normalized,
    real_time: realTime,
    effective_time: normalized,
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
    active: getDemoTime() !== null,
    demo_time: getDemoTime(),
    real_time: realTime,
    effective_time: getDemoTime() || realTime,
  });
});

export default router;
export { publicRouter };
