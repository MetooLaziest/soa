/**
 * 量产波段公开接口 (C 端, 无需登录)
 * GET /api/epet1/wave/preview?code=xxx
 *   → 状态机, 给 C 端在用户登录前展示正确分支
 *   - invalid:         激活码不存在
 *   - not_launched:    波段未上市 (factory_burned / in_qc / archived)
 *   - launchable:      可认领 (wave published + pet_instance unclaimed, 或无 wave_id 的历史 demo)
 *   - already_claimed: 已被认领
 */
const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET /preview?code=xxx
  router.get('/preview', async (req, res) => {
    const code = (req.query.code || '').toString().trim();
    if (!code) {
      return res.status(400).json({ state: 'invalid', error: '缺少 code 参数' });
    }

    try {
      const r = await pool.query(
        `SELECT pi.id AS pet_instance_id, pi.status AS pet_status, pi.user_id,
                pi.wave_id, w.status AS wave_status, w.batch_code,
                pm.id AS model_id, pm.name AS model_name, pm.image_url AS model_image,
                pm.rarity AS model_rarity
         FROM pet_instances pi
         LEFT JOIN production_waves w ON w.id = pi.wave_id
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE pi.activation_code = $1
         LIMIT 1`,
        [code]
      );

      if (!r.rows[0]) {
        return res.json({ state: 'invalid' });
      }

      const row = r.rows[0];

      // 1) 已认领
      if (row.pet_status === 'claimed') {
        return res.json({
          state: 'already_claimed',
          model: {
            id: row.model_id,
            name: row.model_name,
            image_url: row.model_image,
            rarity: row.model_rarity,
          },
        });
      }

      // 2) 无 wave_id 的历史 demo / 旧数据: 兼容路径, 直接 launchable
      if (!row.wave_id) {
        return res.json({
          state: 'launchable',
          model: {
            id: row.model_id,
            name: row.model_name,
            image_url: row.model_image,
            rarity: row.model_rarity,
          },
          pet_instance_id: row.pet_instance_id,
        });
      }

      // 3) 有 wave: 看 wave.status
      if (row.wave_status === 'published' && row.pet_status === 'unclaimed') {
        return res.json({
          state: 'launchable',
          model: {
            id: row.model_id,
            name: row.model_name,
            image_url: row.model_image,
            rarity: row.model_rarity,
          },
          pet_instance_id: row.pet_instance_id,
          wave: { batch_code: row.batch_code },
        });
      }

      // 4) 波段未上市 (factory_burned / in_qc / archived)
      return res.json({
        state: 'not_launched',
        wave: {
          batch_code: row.batch_code,
          status: row.wave_status,
        },
        model: {
          id: row.model_id,
          name: row.model_name,
          image_url: row.model_image,
          rarity: row.model_rarity,
        },
      });
    } catch (err) {
      console.error('wave preview error:', err);
      res.status(500).json({ state: 'invalid', error: err.message });
    }
  });

  return router;
};
