import express from 'express';
import { query } from '../db/pool.js';
import { jwtAuth } from '../middleware/auth.js';

const router = express.Router();

// All routes require JWT auth
router.use(jwtAuth);

// ====== Devices ======
router.get('/devices', async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await query(
      `SELECT ud.*, cm.name as companion_name, cm.model_code, cm.voice_id
       FROM user_devices ud
       LEFT JOIN companion_models cm ON ud.companion_model_id = cm.id
       WHERE ud.user_id = $1
       ORDER BY ud.last_active DESC`,
      [userId]
    );
    res.json({ devices: result.rows });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: '获取设备列表失败' });
  }
});

router.post('/devices/bind', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sn, deviceName } = req.body;
    if (!sn) return res.status(400).json({ error: 'SN不能为空' });

    const reg = await query('SELECT id, companion_model_id FROM device_registry WHERE sn = $1', [sn]);
    if (reg.rows.length === 0) return res.status(404).json({ error: '设备SN不存在' });

    const existing = await query('SELECT id FROM user_devices WHERE sn = $1', [sn]);
    if (existing.rows.length > 0) {
      await query('UPDATE user_devices SET user_id = $1, last_active = NOW() WHERE sn = $2', [userId, sn]);
    } else {
      await query(
        `INSERT INTO user_devices (user_id, sn, device_name, companion_model_id)
         VALUES ($1, $2, $3, $4)`,
        [userId, sn, deviceName || '新的机伴', reg.rows[0].companion_model_id]
      );
    }
    res.json({ success: true, sn });
  } catch (error) {
    console.error('Bind device error:', error);
    res.status(500).json({ error: '绑定设备失败' });
  }
});

// Full bind with attribute inheritance
router.post('/devices/bind-full', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sn, deviceName, modelId, attrs, mbti, emotions } = req.body;
    if (!sn || !modelId) return res.status(400).json({ error: '缺少必要参数' });

    // Check existing binding
    const existing = await query('SELECT id FROM user_devices WHERE sn = $1', [sn]);
    if (existing.rows.length > 0) {
      await query(
        `UPDATE user_devices SET user_id=$1, device_name=$2, current_attributes=$3, current_mbti=$4, mastered_emotions=$5 WHERE sn=$6`,
        [userId, deviceName || '机伴', JSON.stringify(attrs || {}), JSON.stringify(mbti || {}), (emotions && emotions.length ? emotions : null), sn]
      );
    } else {
      await query(
        `INSERT INTO user_devices (user_id, sn, device_name, companion_model_id, current_attributes, current_mbti, mastered_emotions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, sn, deviceName || '新的机伴', modelId, JSON.stringify(attrs || {}), JSON.stringify(mbti || {}), (emotions && emotions.length ? emotions : null)]
      );
    }
    res.json({ success: true, sn });
  } catch (error) {
    console.error('Bind full error:', error);
    res.status(500).json({ error: '绑定失败' });
  }
});

router.get('/devices/current-sn', async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await query(
      'SELECT sn FROM user_devices WHERE user_id = $1 ORDER BY last_active DESC LIMIT 1',
      [userId]
    );
    res.json({ sn: result.rows[0]?.sn || null });
  } catch (error) {
    res.status(500).json({ error: '获取当前设备失败' });
  }
});

// ====== Story ======
router.get('/story/node/:nodeId', async (req, res) => {
  try {
    const result = await query(
      `SELECT sn.*, ms.name as main_story_name, ms.description as main_story_description,
              ms.era_background, ms.history_background
       FROM story_nodes sn
       LEFT JOIN main_stories ms ON sn.main_story_id = ms.id
       WHERE sn.id = $1`,
      [req.params.nodeId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '节点不存在' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '获取节点失败' });
  }
});

router.post('/story/progress', async (req, res) => {
  try {
    const { sn, nodeId, optionId } = req.body;
    if (!sn || !nodeId) return res.status(400).json({ error: '缺少参数' });
    const existing = await query('SELECT sn FROM user_progress WHERE sn = $1', [sn]);
    if (existing.rows.length > 0) {
      await query(
        "UPDATE user_progress SET current_node_id = $2, history = COALESCE(history, '[]'::jsonb) || $3::jsonb, updated_at = NOW() WHERE sn = $1",
        [sn, nodeId, JSON.stringify([nodeId])]
      );
    } else {
      await query(
        "INSERT INTO user_progress (sn, current_node_id, history) VALUES ($1, $2, $3)",
        [sn, nodeId, JSON.stringify([nodeId])]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '保存进度失败' });
  }
});

router.get('/story/progress/:sn', async (req, res) => {
  try {
    const result = await query('SELECT * FROM user_progress WHERE sn = $1', [req.params.sn]);
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: '获取进度失败' });
  }
});

// ====== Inventory ======
router.post('/inventory/gain', async (req, res) => {
  try {
    const { sn, itemId, count } = req.body;
    if (!sn || !itemId) return res.status(400).json({ error: '缺少参数' });
    const existing = await query(
      'SELECT id FROM user_inventory WHERE sn = $1 AND item_id = $2',
      [sn, itemId]
    );
    if (existing.rows.length > 0) {
      // Already have this item
    } else {
      await query(
        'INSERT INTO user_inventory (sn, item_id) VALUES ($1, $2)',
        [sn, itemId]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '获得物品失败' });
  }
});

router.get('/inventory/:sn', async (req, res) => {
  try {
    const result = await query(
      `SELECT ui.id, ui.sn, ui.item_id, ui.obtained_at,
              it.name as item_name, it.description as item_description, it.icon_asset_id
       FROM user_inventory ui
       JOIN items it ON ui.item_id = it.id
       WHERE ui.sn = $1`,
      [req.params.sn]
    );
    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取物品栏失败' });
  }
});

// ====== Device MBTI & Attributes ======
router.get('/attributes/:sn', async (req, res) => {
  try {
    const result = await query(
      'SELECT current_mbti, current_attributes, mastered_emotions FROM user_devices WHERE sn = $1',
      [req.params.sn]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: '获取属性失败' });
  }
});

router.post('/attributes/update', async (req, res) => {
  try {
    const { sn, current_mbti, current_attributes, mastered_emotions } = req.body;
    if (!sn) return res.status(400).json({ error: '缺少sn' });
    await query(
      `UPDATE user_devices SET
       current_mbti = COALESCE($2, current_mbti),
       current_attributes = COALESCE($3, current_attributes),
       mastered_emotions = COALESCE($4, mastered_emotions)
       WHERE sn = $1`,
      [sn, current_mbti ? JSON.stringify(current_mbti) : null,
       current_attributes ? JSON.stringify(current_attributes) : null,
       mastered_emotions ? JSON.stringify(mastered_emotions) : null]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新属性失败' });
  }
});

// ====== CG ======
router.post('/cg/unlock', async (req, res) => {
  try {
    const { userId, cgId } = req.body;
    if (!userId || !cgId) return res.status(400).json({ error: '缺少参数' });
    const existing = await query('SELECT id FROM user_cgs WHERE user_id = $1 AND cg_id = $2', [userId, cgId]);
    if (existing.rows.length === 0) {
      await query('INSERT INTO user_cgs (user_id, cg_id) VALUES ($1, $2)', [userId, cgId]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '解锁CG失败' });
  }
});

router.get('/cg/unlocked/:userId', async (req, res) => {
  try {
    console.error('[CG] Querying user_id:', req.params.userId);
    const result = await query('SELECT cg_id FROM user_cgs WHERE user_id = $1', [req.params.userId]);
    console.error('[CG] Result rows:', result.rows.length);
    res.json({ rows: result.rows.map(r => ({ cg_id: r.cg_id })) });
  } catch (error) {
    console.error('[CG] Error:', error.message);
    res.status(500).json({ error: '获取已解锁CG失败: ' + error.message });
  }
});

router.get('/cg/list/:userId', async (req, res) => {
  try {
    const result = await query('SELECT cg_id FROM user_cgs WHERE user_id = $1', [req.params.userId]);
    res.json(result.rows.map(r => ({ cg_id: r.cg_id })));
  } catch (error) {
    res.status(500).json({ error: '获取CG列表失败' });
  }
});

// ====== Device Registry ======
router.post('/registry/status', async (req, res) => {
  try {
    const { sn, status } = req.body;
    if (!sn || !status) return res.status(400).json({ error: '缺少参数' });
    await query('UPDATE device_registry SET status = $1 WHERE sn = $2', [status, sn]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新状态失败' });
  }
});

// ====== Story Context ======
router.get('/context/:nodeId', async (req, res) => {
  try {
    const nodeResult = await query(
      `SELECT sn.*, ms.era_background, ms.history_background, ms.main_story_description
       FROM story_nodes sn
       LEFT JOIN main_stories ms ON sn.main_story_id = ms.id
       WHERE sn.id = $1`,
      [req.params.nodeId]
    );
    if (nodeResult.rows.length === 0) return res.json({ context: null });
    const node = nodeResult.rows[0];
    res.json({ context: node });
  } catch (error) {
    res.status(500).json({ error: '获取上下文失败' });
  }
});

// ====== Generic Query ======
router.post('/query', async (req, res) => {
  try {
    const { table, select, filters, order, limit: limitCount } = req.body;
    if (!table) return res.status(400).json({ error: '缺少 table 参数' });
    
    const allowedTables = [
      'emotion_definitions', 'locations', 'main_stories', 'story_nodes', 'story_options',
      'items', 'companion_models', 'assets', 'device_registry', 'cg_definitions',
      'mbti_definitions', 'sys_configs', 'user_devices', 'user_inventory', 'user_progress',
      'user_cgs', 'profiles', 'cgs', 'sub_stories', 'story_rewards'
    ];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: '不允许查询该表' });
    }

    let sql = `SELECT ${select || '*'} FROM ${table}`;
    const params = [];
    let paramIdx = 1;

    if (filters) {
      const conditions = [];
      for (const [col, spec] of Object.entries(filters)) {
        if (typeof spec === 'string') {
          const [op, val] = spec.split(':');
          params.push(val);
          conditions.push(`${col} = $${paramIdx++}`);
        }
      }
      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    }

    if (order) {
      const [col, dir] = order.split(':');
      sql += ` ORDER BY ${col} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
    }

    if (limitCount) {
      sql += ` LIMIT ${parseInt(limitCount)}`;
    }

    const result = await query(sql, params);
    res.json({ rows: result.rows });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: '查询失败' });
  }
});

// ====== Admin: Companion Models ======
router.get('/companion-models', async (req, res) => {
  try {
    const result = await query('SELECT * FROM companion_models ORDER BY created_at DESC');
    res.json({ models: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取机伴模型失败' });
  }
});

router.put('/companion-models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const cols = Object.keys(updates).filter(k => k !== 'id');
    if (cols.length === 0) return res.status(400).json({ error: '没有更新字段' });
    const setClause = cols.map((c, i) => `${c} = $${i+1}`).join(', ');
    const vals = cols.map(c => updates[c]);
    await query(`UPDATE companion_models SET ${setClause} WHERE id = $${cols.length+1}`, [...vals, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新机伴模型失败' });
  }
});

// ====== Admin: Assets ======
router.get('/assets', async (req, res) => {
  try {
    const typeFilter = req.query.type;
    let sql = 'SELECT * FROM assets';
    const params = [];
    if (typeFilter) {
      sql += ' WHERE asset_type = $1';
      params.push(typeFilter);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json({ assets: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取资源失败' });
  }
});

router.get('/locations', async (req, res) => {
  try {
    const result = await query('SELECT * FROM locations ORDER BY id');
    res.json({ locations: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取地点失败' });
  }
});

router.post('/locations', async (req, res) => {
  try {
    const { name, description, parent_id } = req.body;
    const result = await query(
      'INSERT INTO locations (id, name, description, parent_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *',
      [name, description, parent_id]
    );
    res.json({ location: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: '创建地点失败' });
  }
});

router.put('/locations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    await query('UPDATE locations SET name = $1, description = $2 WHERE id = $3', [name, description, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新地点失败' });
  }
});

router.delete('/locations/:id', async (req, res) => {
  try {
    await query('DELETE FROM locations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除地点失败' });
  }
});

router.get('/items', async (req, res) => {
  try {
    const result = await query('SELECT id, name, description, icon_asset_id FROM items ORDER BY name');
    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取物品类型失败' });
  }
});

router.post('/items', async (req, res) => {
  try {
    const { name, description, icon_asset_id } = req.body;
    const result = await query(
      'INSERT INTO items (id, name, description, icon_asset_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *',
      [name, description, icon_asset_id]
    );
    res.json({ item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: '创建物品类型失败' });
  }
});

router.put('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon_asset_id } = req.body;
    await query('UPDATE items SET name = $1, description = $2, icon_asset_id = $3 WHERE id = $4',
      [name, description, icon_asset_id, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新物品类型失败' });
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    await query('DELETE FROM item_types WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除物品类型失败' });
  }
});

// ====== Admin: Nodes ======
router.get('/nodes/start', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM story_nodes ORDER BY created_at ASC LIMIT 1'
    );
    res.json({ node: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: '获取起始节点失败' });
  }
});

router.get('/nodes/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM story_nodes WHERE id = $1', [req.params.id]);
    res.json({ node: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: '获取节点失败' });
  }
});

router.post('/nodes', async (req, res) => {
  try {
    const { main_story_id, location_id, title, content, node_type } = req.body;
    const result = await query(
      `INSERT INTO story_nodes (id, main_story_id, location_id, title, content, node_type)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING *`,
      [main_story_id, location_id, title, content, node_type || 'story']
    );
    res.json({ node: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: '创建节点失败' });
  }
});

router.put('/nodes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { main_story_id, location_id, title, content, node_type } = req.body;
    await query(
      'UPDATE story_nodes SET main_story_id=$1, location_id=$2, title=$3, content=$4, node_type=$5 WHERE id=$6',
      [main_story_id, location_id, title, content, node_type, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新节点失败' });
  }
});

router.delete('/nodes/:id', async (req, res) => {
  try {
    await query('DELETE FROM story_nodes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除节点失败' });
  }
});

// ====== Admin: Main Stories ======
router.get('/main-stories', async (req, res) => {
  try {
    const result = await query('SELECT * FROM main_stories ORDER BY created_at DESC');
    res.json({ stories: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取主线失败' });
  }
});

router.post('/main-stories', async (req, res) => {
  try {
    const { name, description, era_background, history_background, main_story_description } = req.body;
    const result = await query(
      `INSERT INTO main_stories (id, name, description, era_background, history_background, main_story_description)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING *`,
      [name, description, era_background, history_background, main_story_description]
    );
    res.json({ story: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: '创建主线失败' });
  }
});

router.put('/main-stories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'era_background', 'history_background', 'main_story_description'];
    const cols = fields.filter(f => req.body[f] !== undefined);
    if (cols.length === 0) return res.status(400).json({ error: '没有更新字段' });
    const setClause = cols.map((c, i) => `${c} = $${i+1}`).join(', ');
    const vals = cols.map(c => req.body[c]);
    await query(`UPDATE main_stories SET ${setClause} WHERE id = $${cols.length+1}`, [...vals, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新主线失败' });
  }
});

router.delete('/main-stories/:id', async (req, res) => {
  try {
    await query('DELETE FROM main_stories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除主线失败' });
  }
});

// ====== Admin: CGs ======
router.get('/cgs', async (req, res) => {
  try {
    const result = await query('SELECT * FROM cgs ORDER BY created_at DESC');
    res.json({ cgs: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取CG列表失败' });
  }
});

router.post('/cgs', async (req, res) => {
  try {
    const { name, description, asset_id, unlock_condition, main_story_id } = req.body;
    const result = await query(
      `INSERT INTO cg_definitions (id, name, description, asset_id, unlock_condition, main_story_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING *`,
      [name, description, asset_id, unlock_condition, main_story_id]
    );
    res.json({ cg: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: '创建CG失败' });
  }
});

router.put('/cgs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, asset_id, unlock_condition, main_story_id } = req.body;
    await query(
      `UPDATE cg_definitions SET name=$1, description=$2, asset_id=$3, unlock_condition=$4, main_story_id=$5 WHERE id=$6`,
      [name, description, asset_id, unlock_condition, main_story_id, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新CG失败' });
  }
});

router.delete('/cgs/:id', async (req, res) => {
  try {
    await query('DELETE FROM cg_definitions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除CG失败' });
  }
});

// ====== Admin: Devices ======
router.get('/admin/devices', async (req, res) => {
  try {
    const result = await query('SELECT * FROM device_registry ORDER BY created_at DESC');
    res.json({ devices: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取设备列表失败' });
  }
});

// ====== Admin: MBTI Definitions ======
router.get('/mbti-definitions', async (req, res) => {
  try {
    const result = await query('SELECT * FROM mbti_definitions ORDER BY key');
    res.json({ definitions: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取MBTI定义失败' });
  }
});

router.put('/mbti-definitions/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { style_prompt, description } = req.body;
    await query('UPDATE mbti_definitions SET style_prompt = $1, description = $2 WHERE key = $3',
      [style_prompt, description, key]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新MBTI定义失败' });
  }
});

// ====== Admin: Emojis / Emotion Definitions ======
router.get('/emotion-definitions', async (req, res) => {
  try {
    const result = await query('SELECT * FROM emotion_definitions ORDER BY key');
    res.json({ emotions: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取情绪定义失败' });
  }
});

router.put('/emotion-definitions/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { description } = req.body;
    await query('UPDATE emotion_definitions SET description = $1 WHERE key = $2', [description, key]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新情绪定义失败' });
  }
});

// ====== Admin: Sub Stories ======
router.get('/sub-stories', async (req, res) => {
  try {
    const result = await query(
      `SELECT ss.*, ms.name as main_story_name
       FROM sub_stories ss
       LEFT JOIN main_stories ms ON ss.main_story_id = ms.id
       ORDER BY ss.ordering ASC, ss.created_at DESC`
    );
    res.json({ subStories: result.rows });
  } catch (error) {
    res.status(500).json({ error: '获取支线失败' });
  }
});

router.post('/sub-stories', async (req, res) => {
  try {
    const { location_id, title, description, trigger_condition } = req.body;
    const result = await query(
      `INSERT INTO sub_stories (id, location_id, title, description, trigger_condition)
       VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING *`,
      [location_id, title, description, trigger_condition]
    );
    res.json({ subStory: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: '创建支线失败' });
  }
});

router.put('/sub-stories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { location_id, title, description, trigger_condition } = req.body;
    await query(
      'UPDATE sub_stories SET location_id=$1, title=$2, description=$3, trigger_condition=$4 WHERE id=$5',
      [location_id, title, description, trigger_condition, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新支线失败' });
  }
});

router.delete('/sub-stories/:id', async (req, res) => {
  try {
    await query('DELETE FROM sub_stories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除支线失败' });
  }
});

// ====== Functions (TTS/STT/Match) ======
router.post('/functions/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const body = req.body;

    switch (name) {
      case 'speech-synthesis':
        res.json({ error: 'TTS not configured', audio_hex: null });
        break;
      case 'voice-to-text':
        res.json({ error: 'STT not configured', text: '' });
        break;
      case 'match': {
        const { input, options } = body;
        if (!input || !options?.length) return res.json({ matched_id: null });
        const inputLower = input.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;
        for (const opt of options) {
          const score = opt.text.toLowerCase().split('').filter(c => inputLower.includes(c)).length;
          if (score > bestScore) { bestScore = score; bestMatch = opt; }
        }
        res.json({ matched_id: bestMatch?.id || null });
        break;
      }
      default:
        res.status(404).json({ error: `Function ${name} not found` });
    }
  } catch (error) {
    res.status(500).json({ error: 'Function error' });
  }
});

export default router;