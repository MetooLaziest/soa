import express from 'express';
import { Pool } from 'pg';

const router = express.Router();

const pool = new Pool({
  host: 'localhost',
  database: 'epet',
  user: 'postgres',
  password: 'iot2026pass',
});

// ==================== 宠物型号管理 ====================

// 1. 获取所有型号（包含 RAG 关联 IDs）
router.get('/', async (req, res) => {
  try {
    // 获取所有型号
    const modelResult = await pool.query(
      'SELECT model_id, name, description, system_prompt, image_url, nfc_range_start, nfc_range_end, temperature, created_at FROM models ORDER BY model_id ASC'
    );

    // 获取所有 RAG 知识库
    const ragResult = await pool.query('SELECT id, name FROM rag_knowledge_bases ORDER BY id');

    // 获取所有型号-RAG 关联
    const assocResult = await pool.query('SELECT model_id, rag_kb_id FROM model_rag_kbs');

    // 组装数据：给每个型号附加 rag_kb_ids
    const models = modelResult.rows.map(m => ({
      ...m,
      rag_kb_ids: assocResult.rows
        .filter(a => a.model_id === m.model_id)
        .map(a => a.rag_kb_id)
    }));

    res.json({
      success: true,
      models,
      ragOptions: ragResult.rows // 前端下拉框用
    });
  } catch (error) {
    console.error('获取型号列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 获取单个型号（支持 epet.model_id 或 companion_models UUID）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let epetModelId = id;

    // If id looks like a UUID (not a number), try to resolve via companion_models → epet_model_id
    if (!/^[0-9]+$/.test(id)) {
      try {
        const iotPool = new Pool({
          host: 'localhost',
          database: 'iot_doll',
          user: 'postgres',
          password: 'iot2026pass',
        });
        const cmRow = await iotPool.query(
          'SELECT epet_model_id FROM companion_models WHERE id = $1',
          [id]
        );
        await iotPool.end();
        if (cmRow.rows.length > 0 && cmRow.rows[0].epet_model_id) {
          epetModelId = String(cmRow.rows[0].epet_model_id);
        } else {
          return res.status(404).json({ success: false, error: '模板不存在' });
        }
      } catch (bridgeErr) {
        console.error('UUID桥接查询失败:', bridgeErr);
        return res.status(500).json({ success: false, error: '桥接查询失败' });
      }
    }

    const modelResult = await pool.query(
      'SELECT * FROM models WHERE model_id = $1',
      [epetModelId]
    );

    if (modelResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: '型号不存在' });
    }

    // 获取关联的 RAG IDs
    const assocResult = await pool.query(
      'SELECT rag_kb_id FROM model_rag_kbs WHERE model_id = $1',
      [epetModelId]
    );

    const model = modelResult.rows[0];
    model.rag_kb_ids = assocResult.rows.map(a => a.rag_kb_id);

    res.json({ success: true, data: model });
  } catch (error) {
    console.error('获取型号详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. 创建型号
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, system_prompt, image_url, nfc_range_start, nfc_range_end, temperature, rag_kb_ids } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '名称必填' });
    }

    await client.query('BEGIN');

    // 插入型号
    const modelResult = await client.query(
      `INSERT INTO models (name, description, system_prompt, image_url, nfc_range_start, nfc_range_end, temperature)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING model_id`,
      [name, description || '', system_prompt || '', image_url || '', nfc_range_start, nfc_range_end, temperature || 0.3]
    );

    const modelId = modelResult.rows[0].model_id;

    // 插入 RAG 关联
    if (rag_kb_ids?.length > 0) {
      for (const ragId of rag_kb_ids) {
        await client.query(
          'INSERT INTO model_rag_kbs (model_id, rag_kb_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [modelId, ragId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, model_id: modelId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('创建型号失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// 4. 更新型号（支持 UUID 桥接）
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    let id = req.params.id;

    // If id looks like a UUID, bridge to epet_model_id via companion_models
    if (!/^[0-9]+$/.test(id)) {
      try {
        const iotPool = new Pool({
          host: 'localhost',
          database: 'iot_doll',
          user: 'postgres',
          password: 'iot2026pass',
        });
        const cmRow = await iotPool.query(
          'SELECT epet_model_id FROM companion_models WHERE id = $1',
          [id]
        );
        await iotPool.end();
        if (cmRow.rows.length > 0 && cmRow.rows[0].epet_model_id) {
          id = String(cmRow.rows[0].epet_model_id);
        } else {
          return res.status(404).json({ success: false, error: '模板不存在' });
        }
      } catch (bridgeErr) {
        console.error('PUT UUID桥接查询失败:', bridgeErr);
        return res.status(500).json({ success: false, error: '桥接查询失败' });
      }
    }

    const { name, description, system_prompt, image_url, nfc_range_start, nfc_range_end, temperature, rag_kb_ids } = req.body;

    await client.query('BEGIN');

    // 更新型号（字段可选，只更新传入的字段）
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name=$${idx}`); values.push(name); idx++; }
    if (description !== undefined) { fields.push(`description=$${idx}`); values.push(description || ''); idx++; }
    if (system_prompt !== undefined) { fields.push(`system_prompt=$${idx}`); values.push(system_prompt || ''); idx++; }
    if (image_url !== undefined) { fields.push(`image_url=$${idx}`); values.push(image_url || ''); idx++; }
    if (nfc_range_start !== undefined) { fields.push(`nfc_range_start=$${idx}`); values.push(nfc_range_start); idx++; }
    if (nfc_range_end !== undefined) { fields.push(`nfc_range_end=$${idx}`); values.push(nfc_range_end); idx++; }
    if (temperature !== undefined) { fields.push(`temperature=$${idx}`); values.push(temperature || 0.3); idx++; }

    if (fields.length === 0) {
      await client.query('COMMIT');
      return res.json({ success: true });
    }

    values.push(id);
    await client.query(
      `UPDATE models SET ${fields.join(', ')} WHERE model_id=$${idx}`,
      values
    );

    // 删除旧的 RAG 关联
    await client.query('DELETE FROM model_rag_kbs WHERE model_id = $1', [id]);

    // 插入新的 RAG 关联
    if (rag_kb_ids?.length > 0) {
      for (const ragId of rag_kb_ids) {
        await client.query(
          'INSERT INTO model_rag_kbs (model_id, rag_kb_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, ragId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('更新型号失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// 5. 删除型号
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM models WHERE model_id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除型号失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 知识库管理 (RAG) ====================

// 获取所有知识库
router.get('/rag-kbs/list', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description FROM rag_knowledge_bases ORDER BY id');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
