/**
 * admin-waves.js - 量产波段管理 API (Admin)
 *
 * 业务流程:
 *   factory_burned (工厂烧录中)
 *      ↓  QC 通过
 *   in_qc
 *      ↓  admin 手动上市
 *   published    ← C 端扫码可激活
 *      ↓  用户激活
 *   claimed
 *      ↓  admin 归档
 *   archived
 *
 * 路由:
 *   GET    /              - 列出所有波段
 *   POST   /              - 创建波段 (预生成 N 个 pet_instance)
 *   GET    /:id           - 波段详情 (含 sample codes)
 *   POST   /:id/launch    - 上市 (factory_burned/in_qc → published)
 *   POST   /:id/archive   - 归档 (任意 → archived)
 *   GET    /:id/codes.csv - 下载所有激活码 (UTF-8 BOM, 给工厂烧录)
 *   POST   /:id/upload-burned - 上传工厂回灌 CSV (nfc_burned_at/batch/device)
 *   POST   /:id/regenerate-code/:instanceId - 单个重发激活码
 */
import { Router } from 'express';
import crypto from 'crypto';
import { poolEpet1 } from '../lib/db.js';

const router = Router();

// ── 工具: 生成 URL-safe 随机激活码 (12 字符, base64url) ──
function genActivationCode() {
  return crypto.randomBytes(9).toString('base64url'); // 9 bytes = 12 chars
}

// ── 工具: 计算波段的实时计数 ──
// wave 行里有 4 个 count 字段, 但 create wave 时不知道 N, 所以
// 用 SQL 实时 GROUP BY 算一遍更可靠
async function recomputeWaveCounts(client, waveId) {
  const r = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE pi.status = 'factory_burned')::int AS factory_burned_count,
       COUNT(*) FILTER (WHERE pi.status = 'in_qc')::int         AS in_qc_count,
       COUNT(*) FILTER (WHERE pi.status = 'unclaimed')::int      AS published_count,
       COUNT(*) FILTER (WHERE pi.status = 'claimed')::int        AS claimed_count
     FROM pet_instances pi
     WHERE pi.wave_id = $1`,
    [waveId]
  );
  const c = r.rows[0];
  await client.query(
    `UPDATE production_waves
        SET factory_burned_count = $1,
            in_qc_count          = $2,
            published_count      = $3,
            claimed_count        = $4,
            updated_at           = NOW()
      WHERE id = $5`,
    [c.factory_burned_count, c.in_qc_count, c.published_count, c.claimed_count, waveId]
  );
  return c;
}

// ──────────────  GET /  - 列出所有波段 ──────────────
router.get('/', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      `SELECT w.*, pm.name as model_name, pm.image_url as model_image,
              pm.rarity as model_rarity
       FROM production_waves w
       JOIN pet_models pm ON pm.id = w.pet_model_id
       ORDER BY w.id DESC`
    );
    res.json({ success: true, waves: rows });
  } catch (e) {
    console.error('admin/waves list error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ──────────────  POST /  - 创建波段 ──────────────
// body: { pet_model_id, batch_code, total_count, nfc_id_start, notes? }
router.post('/', async (req, res) => {
  const { pet_model_id, batch_code, total_count, nfc_id_start, notes } = req.body || {};

  if (!pet_model_id || !batch_code || !total_count || !nfc_id_start) {
    return res.status(400).json({
      error: 'pet_model_id, batch_code, total_count, nfc_id_start 必填',
    });
  }
  if (total_count < 1 || total_count > 500) {
    return res.status(400).json({ error: 'total_count 必须在 1~500 之间' });
  }

  const client = await poolEpet1.connect();
  try {
    await client.query('BEGIN');

    // 校验型号存在
    const m = await client.query(`SELECT id, nfc_range_start, nfc_range_end FROM pet_models WHERE id = $1`, [pet_model_id]);
    if (!m.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'pet_model_id 不存在' });
    }

    // 校验 batch_code 不重复
    const dup = await client.query(`SELECT id FROM production_waves WHERE batch_code = $1`, [batch_code]);
    if (dup.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `batch_code "${batch_code}" 已存在` });
    }

    // 校验 nfc_id 范围不冲突
    const nfcStart = parseInt(nfc_id_start, 10);
    const nfcEnd = nfcStart + total_count - 1;
    const conflict = await client.query(
      `SELECT nfc_id FROM pet_instances WHERE nfc_id BETWEEN $1 AND $2 LIMIT 1`,
      [nfcStart, nfcEnd]
    );
    if (conflict.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `nfc_id 范围 [${nfcStart}, ${nfcEnd}] 已被占用 (例如已存在 nfc_id=${conflict.rows[0].nfc_id})`,
      });
    }

    // 1) 创建 wave
    const waveRes = await client.query(
      `INSERT INTO production_waves
         (pet_model_id, batch_code, total_count, factory_burned_count, notes)
       VALUES ($1, $2, $3, $3, $4)
       RETURNING *`,
      [pet_model_id, batch_code, total_count, notes || null]
    );
    const wave = waveRes.rows[0];

    // 2) 预生成 N 个 pet_instance (factory_burned 状态)
    // 一次 INSERT 完事, 用 generate_series + 子查询避免 N 次往返
    const instRes = await client.query(
      `INSERT INTO pet_instances
         (pet_model_id, nfc_id, activation_code, status, wave_id)
       SELECT $1, gs.nfc_id, encode(gen_random_bytes(9), 'base64'), 'factory_burned', $2
       FROM generate_series($3::bigint, $4::bigint) AS gs(nfc_id)
       RETURNING id, nfc_id, activation_code`,
      [pet_model_id, wave.id, nfcStart, nfcEnd]
    );

    // 3) 把 wave 的 factory_burned_count 写到 N
    await client.query(
      `UPDATE production_waves SET factory_burned_count = $1, updated_at = NOW() WHERE id = $2`,
      [instRes.rows.length, wave.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      wave: { ...wave, factory_burned_count: instRes.rows.length },
      sample_codes: instRes.rows.slice(0, 3),
      total_created: instRes.rows.length,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('admin/waves create error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ──────────────  GET /:id  - 详情 ──────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await poolEpet1.query(
      `SELECT w.*, pm.name as model_name, pm.image_url as model_image,
              pm.rarity as model_rarity, pm.nfc_range_start, pm.nfc_range_end
       FROM production_waves w
       JOIN pet_models pm ON pm.id = w.pet_model_id
       WHERE w.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: '波段不存在' });

    // 取前 5 个 sample (admin 用来复制 URL 验真)
    const samples = await poolEpet1.query(
      `SELECT id, nfc_id, activation_code, status, nfc_burned_at, nfc_burn_device
       FROM pet_instances
       WHERE wave_id = $1
       ORDER BY nfc_id
       LIMIT 5`,
      [id]
    );

    res.json({ success: true, wave: rows[0], sample_instances: samples.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────  POST /:id/launch  - 上市 ──────────────
// 仅允许 factory_burned / in_qc → published
router.post('/:id/launch', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const client = await poolEpet1.connect();
  try {
    await client.query('BEGIN');

    const w = await client.query(`SELECT status FROM production_waves WHERE id = $1 FOR UPDATE`, [id]);
    if (!w.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '波段不存在' });
    }
    if (w.rows[0].status === 'published') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: '波段已上市' });
    }
    if (w.rows[0].status === 'archived') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: '波段已归档, 不能上市' });
    }

    // 1) wave 状态
    await client.query(
      `UPDATE production_waves
          SET status = 'published', launched_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [id]
    );

    // 2) 所有 pet_instance 状态: factory_burned/in_qc → unclaimed
    const up = await client.query(
      `UPDATE pet_instances
          SET status = 'unclaimed'
        WHERE wave_id = $1 AND status IN ('factory_burned', 'in_qc')
        RETURNING id`,
      [id]
    );

    // 3) 重算计数
    await recomputeWaveCounts(client, id);

    await client.query('COMMIT');

    res.json({
      success: true,
      launched: true,
      transitioned_count: up.rows.length,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('admin/waves launch error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ──────────────  POST /:id/archive  - 归档 ──────────────
router.post('/:id/archive', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const client = await poolEpet1.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query(`SELECT status FROM production_waves WHERE id = $1 FOR UPDATE`, [id]);
    if (!w.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '波段不存在' });
    }
    if (w.rows[0].status === 'archived') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: '波段已归档' });
    }
    await client.query(
      `UPDATE production_waves
          SET status = 'archived', archived_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [id]
    );
    await client.query('COMMIT');
    res.json({ success: true, archived: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ──────────────  GET /:id/codes.csv  - 工厂烧录 CSV ──────────────
// UTF-8 BOM + CSV, 列: nfc_id, activation_code, claim_url
router.get('/:id/codes.csv', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const w = await poolEpet1.query(
      `SELECT batch_code, pm.name as model_name FROM production_waves w
       JOIN pet_models pm ON pm.id = w.pet_model_id
       WHERE w.id = $1`,
      [id]
    );
    if (!w.rows[0]) return res.status(404).send('波段不存在');

    const base = process.env.CLAIM_URL_BASE || 'https://soa.laziestlife.com/epet/?code=';
    const inst = await poolEpet1.query(
      `SELECT nfc_id, activation_code, status
       FROM pet_instances
       WHERE wave_id = $1
       ORDER BY nfc_id`,
      [id]
    );

    // UTF-8 BOM
    const BOM = '﻿';
    const lines = ['nfc_id,activation_code,status,claim_url'];
    for (const r of inst.rows) {
      lines.push(`${r.nfc_id},${r.activation_code},${r.status},${base}${r.activation_code}`);
    }
    const csv = BOM + lines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',
      `attachment; filename="wave-${id}-${w.rows[0].batch_code}.csv"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────  POST /:id/upload-burned  - 工厂回灌 CSV ──────────────
// CSV: nfc_id,batch,device (factory 烧录后回填, 跟 memory #24 闭环)
router.post('/:id/upload-burned', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows 必填 (CSV 解析后数组)' });
  }

  const client = await poolEpet1.connect();
  try {
    await client.query('BEGIN');
    let updated = 0, skipped = 0, notFound = 0;
    for (const r of rows) {
      const nfc = parseInt(r.nfc_id, 10);
      if (!nfc) { skipped++; continue; }
      const r2 = await client.query(
        `UPDATE pet_instances
            SET nfc_burned_at  = COALESCE(nfc_burned_at, NOW()),
                nfc_burn_batch = COALESCE(NULLIF($1, ''), nfc_burn_batch),
                nfc_burn_device = COALESCE(NULLIF($2, ''), nfc_burn_device)
          WHERE wave_id = $3 AND nfc_id = $4
          RETURNING id`,
        [r.batch || null, r.device || null, id, nfc]
      );
      if (r2.rows[0]) updated++; else notFound++;
    }
    await client.query('COMMIT');
    res.json({ success: true, updated, skipped, not_found: notFound, total: rows.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ──────────────  POST /:id/regenerate-code/:instanceId  - 单个重发激活码 ──────────────
// 用于: 用户丢码 / 重置 demo 演示
router.post('/:id/regenerate-code/:instanceId', async (req, res) => {
  const waveId = parseInt(req.params.id, 10);
  const instanceId = parseInt(req.params.instanceId, 10);
  const client = await poolEpet1.connect();
  try {
    const r = await client.query(
      `SELECT id, activation_code, status FROM pet_instances
        WHERE id = $1 AND wave_id = $2 FOR UPDATE`,
      [instanceId, waveId]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ error: '实例不存在或不属于该波段' });
    }
    if (r.rows[0].status === 'claimed') {
      return res.status(409).json({ error: '该实例已被认领, 不能重发激活码' });
    }
    const newCode = genActivationCode();
    await client.query(
      `UPDATE pet_instances SET activation_code = $1, updated_at = NOW() WHERE id = $2`,
      [newCode, instanceId]
    );
    res.json({ success: true, instance_id: instanceId, old_code: r.rows[0].activation_code, new_code: newCode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

export default router;
