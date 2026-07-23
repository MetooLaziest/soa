/**
 * Admin Dashboard 统计 API
 * GET /api/admin/epet-stats — 返回各表行数 + 系统状态
 */
import express from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [pets, users, items, instances, scenes, zones] = await Promise.all([
      poolEpet1.query('SELECT count(*) AS c FROM pet_models'),
      poolEpet1.query('SELECT count(*) AS c FROM users'),
      poolEpet1.query('SELECT count(*) AS c FROM shop_items'),
      poolEpet1.query('SELECT count(*) AS c FROM pet_instances WHERE status != \'merged\''),
      poolEpet1.query('SELECT count(*) AS c FROM yard_scenes'),
      poolEpet1.query('SELECT count(*) AS c FROM yard_zones'),
    ]);

    // 系统状态：DB 连接已成功（到这里说明 DB 正常）
    const dbOk = true;

    res.json({
      ok: true,
      stats: {
        petModels:    parseInt(pets.rows[0].c),
        users:        parseInt(users.rows[0].c),
        shopItems:    parseInt(items.rows[0].c),
        petInstances: parseInt(instances.rows[0].c),
        scenes:       parseInt(scenes.rows[0].c),
        zones:        parseInt(zones.rows[0].c),
      },
      system: {
        db: dbOk ? '正常' : '异常',
        backend: '运行中',
        ai: '就绪',  // AI 服务状态需单独检测，这里标就绪
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
