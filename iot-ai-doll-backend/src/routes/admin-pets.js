import express from 'express';
import { Pool } from 'pg';

const router = express.Router();

const pool = new Pool({
  host: 'localhost',
  database: 'epet',
  user: 'postgres',
  password: 'iot2026pass',
});

// ==================== 宠物实体管理（nfc = 实体ID）====================

// 1. 获取所有宠物实体（包含 rag_kb_ids 和模板信息）
router.get('/', async (req, res) => {
  try {
    const petsResult = await pool.query(
      `SELECT p.*, m.name as model_name, m.temperature as model_temperature
       FROM pets p
       LEFT JOIN models m ON p.model_id = m.model_id
       ORDER BY p.created_at DESC`
    );

    // 获取每个 pet 的 rag_kb_ids
    const pets = [];
    for (const pet of petsResult.rows) {
      const ragResult = await pool.query(
        'SELECT rag_kb_id FROM pet_rag_kbs WHERE pet_nfc = $1',
        [pet.nfc]
      );
      pets.push({
        ...pet,
        rag_kb_ids: ragResult.rows.map(r => r.rag_kb_id),
        temperature: pet.temperature ?? pet.model_temperature ?? 0.3
      });
    }

    res.json({ success: true, pets });
  } catch (error) {
    console.error('获取宠物列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 获取单个宠物实体
router.get('/:nfc', async (req, res) => {
  try {
    const { nfc } = req.params;

    const petResult = await pool.query(
      `SELECT p.*, m.name as model_name, m.temperature as model_temperature
       FROM pets p
       LEFT JOIN models m ON p.model_id = m.model_id
       WHERE p.nfc = $1`,
      [nfc]
    );

    if (!petResult.rows.length) {
      return res.status(404).json({ success: false, error: '宠物不存在' });
    }

    const pet = petResult.rows[0];

    const ragResult = await pool.query(
      'SELECT rag_kb_id FROM pet_rag_kbs WHERE pet_nfc = $1',
      [nfc]
    );

    res.json({
      success: true,
      pet: {
        ...pet,
        rag_kb_ids: ragResult.rows.map(r => r.rag_kb_id),
        temperature: pet.temperature ?? pet.model_temperature ?? 0.3
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. 更新宠物实体（system_prompt, temperature, rag_kb_ids, display_name 等）
router.put('/:nfc', async (req, res) => {
  const client = await pool.connect();
  try {
    const { nfc } = req.params;
    const { display_name, system_prompt, temperature, rag_kb_ids, hunger, is_visible } = req.body;

    await client.query('BEGIN');

    // 更新 pets 表
    const fields = [];
    const values = [];
    let idx = 1;

    if (display_name !== undefined) { fields.push(`display_name = $${idx++}`); values.push(display_name); }
    if (system_prompt !== undefined) { fields.push(`system_prompt = $${idx++}`); values.push(system_prompt || null); }
    if (hunger !== undefined) { fields.push(`hunger = $${idx++}`); values.push(hunger); }
    if (is_visible !== undefined) { fields.push(`is_visible = $${idx++}`); values.push(is_visible); }

    if (fields.length > 0) {
      values.push(nfc);
      await client.query(
        `UPDATE pets SET ${fields.join(', ')} WHERE nfc = $${idx}`,
        values
      );
    }

    // 更新 temperature（写到 pets 表，如果字段存在的话）
    if (temperature !== undefined) {
      // 先检查 pets 表是否有 temperature 字段
      const colCheck = await client.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='temperature'"
      );
      if (colCheck.rows.length) {
        await client.query('UPDATE pets SET temperature = $1 WHERE nfc = $2', [temperature, nfc]);
      } else {
        // 没有 temperature 字段，跳过（temperature 从 models 读取）
      }
    }

    // 同步 rag_kb_ids
    if (rag_kb_ids !== undefined) {
      // 删除旧关联
      await client.query('DELETE FROM pet_rag_kbs WHERE pet_nfc = $1', [nfc]);
      // 插入新关联
      for (const ragId of rag_kb_ids) {
        await client.query(
          'INSERT INTO pet_rag_kbs (pet_nfc, rag_kb_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [nfc, ragId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('更新宠物失败:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// 4. 创建宠物实体
router.post('/', async (req, res) => {
  try {
    const { nfc, model_id, user_id, display_name, monster_type } = req.body;

    if (!nfc) {
      return res.status(400).json({ success: false, error: 'NFC ID 必填' });
    }

    await pool.query(
      `INSERT INTO pets (nfc, model_id, user_id, display_name, monster_type, last_interact_at, last_feed_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [nfc, model_id || 1, user_id || 1, display_name || '', monster_type || 'white']
    );

    res.json({ success: true });
  } catch (error) {
    console.error('创建宠物失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. 删除宠物实体
router.delete('/:nfc', async (req, res) => {
  try {
    const { nfc } = req.params;
    await pool.query('DELETE FROM pets WHERE nfc = $1', [nfc]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// 获取宠物关联的 RAG 知识库列表
router.get('/:nfc/rags', async (req, res) => {
  try {
    const { nfc } = req.params;
    const result = await pool.query(
      `SELECT r.* FROM rag_knowledge_bases r
       INNER JOIN pet_rag_kbs pr ON r.id = pr.rag_kb_id
       WHERE pr.pet_nfc = $1
       ORDER BY r.id`,
      [nfc]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新宠物 RAG 关联（POST=添加关联，DELETE=删除关联）
router.post('/:nfc/rags/:ragId', async (req, res) => {
  try {
    const { nfc, ragId } = req.params;
    await pool.query(
      'INSERT INTO pet_rag_kbs (pet_nfc, rag_kb_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [nfc, ragId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:nfc/rags/:ragId', async (req, res) => {
  try {
    const { nfc, ragId } = req.params;
    await pool.query('DELETE FROM pet_rag_kbs WHERE pet_nfc = $1 AND rag_kb_id = $2', [nfc, ragId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;