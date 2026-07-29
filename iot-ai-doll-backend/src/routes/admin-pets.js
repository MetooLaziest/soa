/**
 * 宠物实体管理 - 改读 epet1 schema (2026-06-19)
 *
 * 数据源切换:
 *   - 老 epet.pets (iot-backend) → 100% 删
 *   - 新 epet1.pet_models + pet_instances (设计正确, model 性格 + entity 记忆分层)
 *
 * 路由:
 *   GET  /         - 列出全部实体 (JOIN pet_models), 按 model 分组
 *   GET  /:id      - 单个实体详情
 *   PUT  /:id      - 更新实体 (nickname, growth_level, growth_exp 等 entity 字段)
 *   POST /         - 创建新实体 (nfc_id 唯一, pet_model_id 必填)
 *   DELETE /:id    - 删除实体
 *   GET  /:id/rags - 实体关联的 RAG 知识库列表 (预留, 待 epet1 schema 扩展)
 */
import express from 'express';
import crypto from 'crypto';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// ─── 列出全部实体 (按 model 分组) ───
// 返回: { success, pets: [...], models: [{ model, instances: [...] }] }
router.get('/', async (_req, res) => {
  try {
    // 1) 全部 active models
    const modelsRes = await poolEpet1.query(
      `SELECT id, name, description, image_url, rarity, mbti,
              personality_template, display_order, is_active
       FROM pet_models
       WHERE is_active = true
       ORDER BY display_order`
    );

    // 2) 全部 instances JOIN user + travel status (含 NFC 烧录字段 · memory #24)
    // 排除 status='merged' 的已合并实例 (合并后已 merge 到 merged_into_id, 不应再出现在列表/统计)
    const instRes = await poolEpet1.query(
      `SELECT pi.id, pi.user_id, pi.pet_model_id, pi.nfc_id, pi.nickname,
              pi.growth_level, pi.growth_exp, pi.total_interactions,
              pi.total_travels, pi.total_postcards, pi.created_at, pi.updated_at,
              pi.activation_code, pi.status, pi.merged_into_id,
              pi.nfc_burned_at, pi.nfc_burn_batch, pi.nfc_burn_device,
              u.nickname as user_nickname,
              pm.name as model_name, pm.image_url as model_image,
              yp.position as yard_position, yp.is_active as in_yard,
              tr.id as travel_id, tr.status as travel_status,
              tr.expected_end_at as travel_return_at, tr.dish_rating as travel_dish_rating
       FROM pet_instances pi
       JOIN pet_models pm ON pm.id = pi.pet_model_id
       LEFT JOIN users u ON u.id = pi.user_id
       LEFT JOIN yard_pets yp ON yp.pet_instance_id = pi.id AND yp.is_active = true
       LEFT JOIN travel_records tr ON tr.pet_instance_id = pi.id AND tr.status = 'traveling'
       WHERE pi.status != 'merged'
       ORDER BY pi.user_id, pm.display_order, pi.id`
    );

    // 3) 按 model 分组
    const byModel = modelsRes.rows.map((m) => ({
      model: m,
      instances: instRes.rows.filter((i) => i.pet_model_id === m.id),
    }));

    res.json({
      success: true,
      pets: instRes.rows,           // 平面列表 (兼容老前端)
      models: byModel,              // 按 model 分组
      summary: {
        totalModels: modelsRes.rowCount,
        totalInstances: instRes.rowCount,
        modelsWithInstances: byModel.filter((g) => g.instances.length > 0).length,
      },
    });
  } catch (err) {
    console.error('admin/pets GET / error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 单个实体详情 ───
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await poolEpet1.query(
      `SELECT pi.*, pi.activation_code, pi.status, pi.merged_into_id, pm.name as model_name, pm.image_url as model_image,
              pm.rarity, pm.mbti, pm.personality_template, pm.display_order,
              u.nickname as user_nickname,
              yp.position as yard_position
       FROM pet_instances pi
       JOIN pet_models pm ON pm.id = pi.pet_model_id
       LEFT JOIN users u ON u.id = pi.user_id
       LEFT JOIN yard_pets yp ON yp.pet_instance_id = pi.id AND yp.is_active = true
       WHERE pi.id = $1 AND pi.status != 'merged'`,
      [id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Pet instance not found' });
    }
    res.json({ success: true, pet: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 更新实体 (entity 级别字段) ───
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, growth_level, growth_exp, total_interactions } = req.body;

    // 只允许改 entity 级别字段 (model 性格/提示词在 pet_models 表)
    const sets = [];
    const vals = [];
    let i = 1;
    if (nickname !== undefined) { sets.push(`nickname = $${i++}`); vals.push(nickname); }
    if (growth_level !== undefined) { sets.push(`growth_level = $${i++}`); vals.push(growth_level); }
    if (growth_exp !== undefined) { sets.push(`growth_exp = $${i++}`); vals.push(growth_exp); }
    if (total_interactions !== undefined) { sets.push(`total_interactions = $${i++}`); vals.push(total_interactions); }
    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    sets.push(`updated_at = NOW()`);
    vals.push(id);

    const r = await poolEpet1.query(
      `UPDATE pet_instances SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    res.json({ success: true, pet: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 创建新实体 ───
router.post('/', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const { nfc_id, pet_model_id, user_id, nickname } = req.body;
    if (!nfc_id || !pet_model_id || !user_id) {
      return res.status(400).json({ success: false, error: 'nfc_id / pet_model_id / user_id 必填' });
    }
    // 检查 nfc_id 是否已存在
    const exist = await client.query('SELECT id FROM pet_instances WHERE nfc_id = $1', [nfc_id]);
    if (exist.rowCount > 0) {
      return res.status(409).json({ success: false, error: `nfc_id=${nfc_id} 已存在 (id=${exist.rows[0].id})` });
    }
    // 检查 model 范围
    const modelRow = await client.query('SELECT name, nfc_range_start, nfc_range_end FROM pet_models WHERE id = $1', [pet_model_id]);
    if (modelRow.rowCount === 0) {
      return res.status(400).json({ success: false, error: `pet_model_id=${pet_model_id} 不存在` });
    }
    const m = modelRow.rows[0];
    const nfcNum = Number(nfc_id);
    if (nfcNum < Number(m.nfc_range_start) || nfcNum > Number(m.nfc_range_end)) {
      return res.status(400).json({
        success: false,
        error: `nfc_id ${nfc_id} 不在 model "${m.name}" 的范围 [${m.nfc_range_start}, ${m.nfc_range_end}]`
      });
    }
    // 每个用户每个 model 最多 1 只（排除已合并的）
    const dup = await client.query(
      'SELECT id FROM pet_instances WHERE user_id = $1 AND pet_model_id = $2 AND status != \'merged\'',
      [user_id, pet_model_id]
    );
    if (dup.rowCount > 0) {
      return res.status(409).json({ success: false, error: `user=${user_id} 已有 model=${pet_model_id} 的实体 (id=${dup.rows[0].id})` });
    }

    const r = await client.query(
      `INSERT INTO pet_instances (user_id, pet_model_id, nfc_id, nickname, activation_code, status)
       VALUES ($1, $2, $3, $4, $5, 'claimed') RETURNING *`,
      [user_id, pet_model_id, nfc_id, nickname || null, crypto.randomBytes(14).toString('base64url')]
    );
    res.json({ success: true, pet: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ─── 删除实体 ───
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 先从 yard 移出
    await poolEpet1.query('DELETE FROM yard_pets WHERE pet_instance_id = $1', [id]);
    const r = await poolEpet1.query('DELETE FROM pet_instances WHERE id = $1 RETURNING *', [id]);
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Pet instance not found' });
    }
    res.json({ success: true, deleted: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 批量生成激活码 (为指定 model 创建 N 个未认领实体) ───
router.post('/generate-codes', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const { pet_model_id, count } = req.body;
    if (!pet_model_id || !count || count < 1 || count > 100) {
      return res.status(400).json({ success: false, error: 'pet_model_id 必填, count 范围 1-100' });
    }

    // 检查 model 存在 (不再读取 nfc_range — 激活码 nfc_id 统一走序列自增)
    const modelRow = await client.query('SELECT id FROM pet_models WHERE id = $1', [pet_model_id]);
    if (modelRow.rowCount === 0) {
      return res.status(400).json({ success: false, error: `pet_model_id=${pet_model_id} 不存在` });
    }

    // 生成 count 个实体
    const results = [];
    for (let i = 0; i < count; i++) {
      const activationCode = crypto.randomBytes(14).toString('base64url');

      // nfc_id: 统一用序列自增, 不再依赖 pet_model 的 nfc_range 锁定
      // (历史 A 路径范围 MAX+1 在 model 之间 nfc_range 重叠时会冲突, B 路径 +100000 偏移
      //  是设计就考虑 "跟 range 内短号错开", 改统一自增后这个偏移天然安全)
      const seqRes = await client.query("SELECT nextval('pet_instances_id_seq') as next_id");
      const nfcId = Number(seqRes.rows[0].next_id) + 100000;

      const r = await client.query(
        `INSERT INTO pet_instances (user_id, pet_model_id, nfc_id, nickname, activation_code, status)
         VALUES (NULL, $1, $2, NULL, $3, 'unclaimed') RETURNING id, nfc_id, activation_code, status`,
        [pet_model_id, nfcId, activationCode]
      );
      results.push(r.rows[0]);
    }

    res.json({ success: true, generated: results, count: results.length });
  } catch (err) {
    console.error('admin/pets generate-codes error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ─── 工厂回灌烧录清单 (CSV → JSON, 前端已解析) ───
// Body: { rows: [{ nfc_id: number|string, batch?: string, device?: string }],
//         skipBurned?: bool (默认 true, 防止误覆盖早期烧录记录) }
// Response: { success, imported, skipped, notFound, invalid, errors: [{row, nfc_id, reason}] }
// 配合 memory #24: 工厂用导出 CSV 第 6 列烧 NFC, 烧完回灌此接口批量标"已烧录"
router.post('/import-burned', async (req, res) => {
  const { rows = [], skipBurned = true } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, error: 'rows 必须是非空数组' });
  }
  if (rows.length > 5000) {
    return res.status(400).json({ success: false, error: '单次最多 5000 行, 请分批' });
  }

  const client = await poolEpet1.connect();
  let imported = 0, skipped = 0, notFound = 0, invalid = 0;
  const errors = [];
  try {
    await client.query('BEGIN');
    for (let i = 0; i < rows.length; i++) {
      const { nfc_id, batch = null, device = null } = rows[i] || {};
      // 校验 nfc_id 必填且是数字或数字字符串
      if (nfc_id === undefined || nfc_id === null || nfc_id === '' || !/^\d+$/.test(String(nfc_id).trim())) {
        invalid++;
        errors.push({ row: i + 1, nfc_id, reason: 'nfc_id 缺失或非数字' });
        continue;
      }
      const nfcIdNum = Number(String(nfc_id).trim());
      const batchStr = batch ? String(batch).trim().slice(0, 64) : null;
      const deviceStr = device ? String(device).trim().slice(0, 64) : null;

      // 跳过策略: 已烧录则跳过 (除非 skipBurned=false 强制覆盖)
      if (skipBurned) {
        const exist = await client.query(
          'SELECT nfc_burned_at FROM pet_instances WHERE nfc_id = $1',
          [nfcIdNum]
        );
        if (exist.rowCount === 0) {
          notFound++;
          errors.push({ row: i + 1, nfc_id: nfcIdNum, reason: '未找到该 nfc_id' });
          continue;
        }
        if (exist.rows[0].nfc_burned_at) {
          skipped++;
          errors.push({ row: i + 1, nfc_id: nfcIdNum, reason: '已烧录, 跳过' });
          continue;
        }
      }
      const r = await client.query(
        `UPDATE pet_instances
            SET nfc_burned_at = NOW(),
                nfc_burn_batch = $2,
                nfc_burn_device = $3
          WHERE nfc_id = $1
        RETURNING id`,
        [nfcIdNum, batchStr, deviceStr]
      );
      if (r.rowCount === 0) {
        notFound++;
        errors.push({ row: i + 1, nfc_id: nfcIdNum, reason: '未找到该 nfc_id' });
      } else {
        imported++;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }

  res.json({
    success: true,
    imported,
    skipped,
    notFound,
    invalid,
    errors: errors.slice(0, 200),  // 上限 200 条, 防 payload 爆炸
  });
});

// ─── 单个实体重新生成激活码 (如码泄露) ───
router.post('/:id/regenerate-code', async (req, res) => {
  try {
    const { id } = req.params;
    const newCode = crypto.randomBytes(14).toString('base64url');
    const r = await poolEpet1.query(
      'UPDATE pet_instances SET activation_code = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nfc_id, activation_code, status',
      [newCode, id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Pet instance not found' });
    }
    res.json({ success: true, instance: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── (预留) 实体 RAG 关联列表 - epet1 schema 暂未实现 ───
router.get('/:id/rags', async (req, res) => {
  res.json({ success: true, rag_kb_ids: [], message: 'epet1 schema 暂无实体级 RAG 关联, 暂返回空' });
});

router.post('/:id/rags/:ragId', async (req, res) => {
  res.json({ success: true, message: 'TODO: epet1 schema 暂未实现' });
});

router.delete('/:id/rags/:ragId', async (req, res) => {
  res.json({ success: true, message: 'TODO: epet1 schema 暂未实现' });
});

export default router;
