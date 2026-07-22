import express from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// ─── 钓鱼 API ────────────────────────────────────────

const DAILY_FISH_LIMIT = 3;

// GET /api/epet1/fishing/maps - 获取钓鱼地图列表
router.get('/maps', async (req, res) => {
  try {
    const { rows: maps } = await poolEpet1.query(
      'SELECT id, name, description, image_url, sort_order FROM fishing_maps WHERE is_active = true ORDER BY sort_order'
    );
    // 每个地图附带可钓到的鱼
    for (const map of maps) {
      const { rows: fish } = await poolEpet1.query(
        'SELECT id, name, rarity, description, image_url, weight, item_category FROM fish_items WHERE fishing_map_id = $1 AND is_active = true ORDER BY sort_order',
        [map.id]
      );
      map.fish = fish;
    }
    res.json({ ok: true, maps });
  } catch (err) {
    console.error('[fishing] maps error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/epet1/fishing/daily-status - 获取今日钓鱼次数
router.get('/daily-status', async (req, res) => {
  try {
    const userId = req.user.userId;

    const today = new Date().toISOString().slice(0, 10);
    const { rows: rows } = await poolEpet1.query(
      `SELECT COUNT(*)::int as count FROM fishing_daily_records
       WHERE user_id = $1 AND caught_at::date = $2::date`,
      [userId, today]
    );
    const used = rows[0].count;
    res.json({ ok: true, used, limit: DAILY_FISH_LIMIT, remaining: Math.max(0, DAILY_FISH_LIMIT - used) });
  } catch (err) {
    console.error('[fishing] daily-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/fishing/cast - 钓鱼（投竿）
router.post('/cast', async (req, res) => {
  try {
    const user_id = req.user.userId;
    const { pet_instance_id, fishing_map_id } = req.body;
    if (!fishing_map_id) return res.status(400).json({ error: '缺少参数' });

    // 检查今日次数
    const today = new Date().toISOString().slice(0, 10);
    const { rows: countRows } = await poolEpet1.query(
      `SELECT COUNT(*)::int as count FROM fishing_daily_records
       WHERE user_id = $1 AND caught_at::date = $2::date`,
      [user_id, today]
    );
    if (countRows[0].count >= DAILY_FISH_LIMIT) {
      return res.json({ ok: false, error: '今日钓鱼次数已用完', remaining: 0 });
    }

    // 根据地图随机抽鱼
    const { rows: fishRows } = await poolEpet1.query(
      'SELECT id, name, rarity, description, image_url, weight, item_category, shop_item_id FROM fish_items WHERE fishing_map_id = $1 AND is_active = true',
      [fishing_map_id]
    );
    if (fishRows.length === 0) {
      return res.json({ ok: false, error: '该地图没有鱼' });
    }

    const totalWeight = fishRows.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * totalWeight;
    let caught = fishRows[0];
    for (const fish of fishRows) {
      r -= fish.weight;
      if (r <= 0) { caught = fish; break; }
    }

    // 记录钓鱼
    await poolEpet1.query(
      `INSERT INTO fishing_daily_records (user_id, pet_instance_id, fishing_map_id, fish_item_id) VALUES ($1, $2, $3, $4)`,
      [user_id, pet_instance_id || null, fishing_map_id, caught.id]
    );

    // 加入背包 — 使用鱼自身关联的 shop_item_id，或按名称查找
    const itemCategory = caught.item_category || 'food';
    let shopItemId = caught.shop_item_id;

    // 如果鱼没有关联 shop_item_id，按名称查找
    if (!shopItemId) {
      const { rows: existingRows } = await poolEpet1.query(
        "SELECT id FROM shop_items WHERE name = $1 AND item_type = 'virtual' LIMIT 1",
        [caught.name]
      );
      if (existingRows.length > 0) {
        shopItemId = existingRows[0].id;
        // 回写 shop_item_id 到 fish_items，避免下次再查
        await poolEpet1.query(
          'UPDATE fish_items SET shop_item_id = $1 WHERE id = $2',
          [shopItemId, caught.id]
        );
      }
    }

    // 仍然没有则自动创建
    if (!shopItemId) {
      const { rows: insertedRows } = await poolEpet1.query(
        `INSERT INTO shop_items (name, item_type, item_category, price_emotion, image_url, description, purchasable, shop_tab)
         VALUES ($1, 'virtual', $2, 0, $3, $4, false, 'hidden') RETURNING id`,
        [caught.name, itemCategory, caught.image_url, `钓鱼获得的${caught.name}`]
      );
      shopItemId = insertedRows[0].id;
      // 回写 shop_item_id
      await poolEpet1.query(
        'UPDATE fish_items SET shop_item_id = $1 WHERE id = $2',
        [shopItemId, caught.id]
      );
    }

    // 更新背包
    const { rows: invRows } = await poolEpet1.query(
      'SELECT id, quantity FROM user_inventory WHERE user_id = $1 AND shop_item_id = $2',
      [user_id, shopItemId]
    );
    if (invRows.length > 0) {
      await poolEpet1.query(
        'UPDATE user_inventory SET quantity = quantity + 1, item_category = $1, source = $2 WHERE id = $3',
        [itemCategory, 'fishing', invRows[0].id]
      );
    } else {
      await poolEpet1.query(
        'INSERT INTO user_inventory (user_id, shop_item_id, quantity, item_category, source) VALUES ($1, $2, 1, $3, $4)',
        [user_id, shopItemId, itemCategory, 'fishing']
      );
    }

    const remaining = DAILY_FISH_LIMIT - countRows[0].count - 1;
    res.json({
      ok: true,
      fish: {
        id: caught.id,
        name: caught.name,
        rarity: caught.rarity,
        description: caught.description,
        image_url: caught.image_url,
        item_category: itemCategory,
      },
      remaining: Math.max(0, remaining),
    });
  } catch (err) {
    console.error('[fishing] cast error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/epet1/fishing/history - 钓鱼历史
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 20;

    const { rows: rows } = await poolEpet1.query(
      `SELECT r.caught_at, f.name, f.rarity, f.image_url, fm.name as map_name
       FROM fishing_daily_records r
       JOIN fish_items f ON f.id = r.fish_item_id
       JOIN fishing_maps fm ON fm.id = r.fishing_map_id
       WHERE r.user_id = $1
       ORDER BY r.caught_at DESC LIMIT $2`,
      [userId, limit]
    );
    res.json({ ok: true, history: rows });
  } catch (err) {
    console.error('[fishing] history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin 钓鱼管理 ──────────────────────────────────

// GET /api/epet1/fishing/admin/fish - 管理鱼类列表
router.get('/admin/fish', async (_req, res) => {
  try {
    const { rows: rows } = await poolEpet1.query(
      `SELECT f.*, fm.name as map_name, si.name as shop_item_name, si.item_category as shop_item_category, si.is_active as shop_item_active
       FROM fish_items f
       LEFT JOIN fishing_maps fm ON fm.id = f.fishing_map_id
       LEFT JOIN shop_items si ON si.id = f.shop_item_id
       ORDER BY f.sort_order`
    );
    res.json({ ok: true, fish: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/fishing/admin/fish - 新增鱼类
router.post('/admin/fish', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const { name, rarity, description, image_url, fishing_map_id, weight, sort_order, item_category } = req.body;
    if (!name) return res.status(400).json({ error: '缺少鱼名' });
    const cat = item_category || 'food';

    await client.query('BEGIN');

    // 1. 创建 shop_item（放在 hidden tab，不可购买，仅通过钓鱼获得）
    const { rows: shopRows } = await client.query(
      `INSERT INTO shop_items (name, item_type, item_category, price_emotion, image_url, description, purchasable, shop_tab)
       VALUES ($1, 'virtual', $2, 0, $3, $4, false, 'hidden') RETURNING id`,
      [name, cat, image_url || '', `钓鱼获得的${name}`]
    );
    const shopItemId = shopRows[0].id;

    // 2. 创建 fish_items 并关联 shop_item_id
    const { rows: insertedRows } = await client.query(
      `INSERT INTO fish_items (name, rarity, description, image_url, fishing_map_id, weight, sort_order, item_category, shop_item_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, rarity || 'common', description || '', image_url || '', fishing_map_id || null, weight || 10, sort_order || 0, cat, shopItemId]
    );

    await client.query('COMMIT');
    const fish = insertedRows[0];
    fish.shop_item_name = name;
    fish.shop_item_category = cat;
    fish.shop_item_active = true;
    res.json({ ok: true, fish });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/epet1/fishing/admin/fish/:id - 更新鱼类
router.put('/admin/fish/:id', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const { id } = req.params;
    const { name, rarity, description, image_url, fishing_map_id, weight, sort_order, is_active, item_category } = req.body;

    await client.query('BEGIN');

    // 1. 更新 fish_items
    const cat = item_category || null;
    const { rows: updated } = await client.query(
      `UPDATE fish_items SET name=COALESCE($1,name), rarity=COALESCE($2,rarity), description=COALESCE($3,description),
       image_url=COALESCE($4,image_url), fishing_map_id=COALESCE($5,fishing_map_id), weight=COALESCE($6,weight),
       sort_order=COALESCE($7,sort_order), is_active=COALESCE($8,is_active), item_category=COALESCE($9,item_category)
       WHERE id=$10 RETURNING *`,
      [name, rarity, description, image_url, fishing_map_id, weight, sort_order, is_active, cat, id]
    );
    if (!updated.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '鱼不存在' });
    }

    const fish = updated[0];

    // 2. 同步更新关联的 shop_item
    if (fish.shop_item_id) {
      const shopSets = [];
      const shopVals = [];
      let idx = 1;
      if (name) { shopSets.push(`name = $${idx++}`); shopVals.push(name); }
      if (image_url) { shopSets.push(`image_url = $${idx++}`); shopVals.push(image_url); }
      if (cat) { shopSets.push(`item_category = $${idx++}`); shopVals.push(cat); }
      if (description) { shopSets.push(`description = $${idx++}`); shopVals.push(`钓鱼获得的${name || fish.name}`); }
      if (is_active !== undefined) { shopSets.push(`is_active = $${idx++}`); shopVals.push(is_active); }
      if (shopSets.length) {
        shopVals.push(fish.shop_item_id);
        await client.query(
          `UPDATE shop_items SET ${shopSets.join(', ')} WHERE id = $${idx}`,
          shopVals
        );
      }
    } else if (name) {
      // 如果鱼没有关联 shop_item，自动创建一个并关联
      const resolvedCat = cat || fish.item_category || 'food';
      const { rows: shopRows } = await client.query(
        `INSERT INTO shop_items (name, item_type, item_category, price_emotion, image_url, description, purchasable, shop_tab)
         VALUES ($1, 'virtual', $2, 0, $3, $4, false, 'hidden') RETURNING id`,
        [name, resolvedCat, image_url || fish.image_url || '', `钓鱼获得的${name}`]
      );
      await client.query(
        'UPDATE fish_items SET shop_item_id = $1 WHERE id = $2',
        [shopRows[0].id, id]
      );
      fish.shop_item_id = shopRows[0].id;
    }

    await client.query('COMMIT');

    // 附加 shop_item 信息
    fish.shop_item_name = name || fish.name;
    fish.shop_item_category = cat || fish.item_category || 'food';
    fish.shop_item_active = is_active !== undefined ? is_active : true;
    res.json({ ok: true, fish });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/epet1/fishing/admin/fish/:id
router.delete('/admin/fish/:id', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    await client.query('BEGIN');

    // 1. 查出 fish 的 shop_item_id
    const { rows: fishRows } = await client.query(
      'SELECT shop_item_id FROM fish_items WHERE id = $1',
      [req.params.id]
    );

    // 2. 停用鱼
    await client.query('UPDATE fish_items SET is_active = false WHERE id = $1', [req.params.id]);

    // 3. 同步停用 shop_item
    if (fishRows.length > 0 && fishRows[0].shop_item_id) {
      await client.query(
        'UPDATE shop_items SET is_active = false WHERE id = $1',
        [fishRows[0].shop_item_id]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/epet1/fishing/admin/maps - 管理地图列表
router.get('/admin/maps', async (_req, res) => {
  try {
    const { rows: rows } = await poolEpet1.query('SELECT * FROM fishing_maps ORDER BY sort_order');
    res.json({ ok: true, maps: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/fishing/admin/maps - 新增地图
router.post('/admin/maps', async (req, res) => {
  try {
    const { name, description, image_url, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: '缺少地图名' });
    const { rows: insertedRows } = await poolEpet1.query(
      `INSERT INTO fishing_maps (name, description, image_url, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description || '', image_url || '', sort_order || 0]
    );
    res.json({ ok: true, map: insertedRows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/epet1/fishing/admin/maps/:id - 更新地图
router.put('/admin/maps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url, sort_order, is_active } = req.body;
    const { rows: updated } = await poolEpet1.query(
      `UPDATE fishing_maps SET name=COALESCE($1,name), description=COALESCE($2,description),
       image_url=COALESCE($3,image_url), sort_order=COALESCE($4,sort_order), is_active=COALESCE($5,is_active)
       WHERE id=$6 RETURNING *`,
      [name, description, image_url, sort_order, is_active, id]
    );
    if (!updated.length) return res.status(404).json({ error: '地图不存在' });
    res.json({ ok: true, map: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/epet1/fishing/admin/maps/:id
router.delete('/admin/maps/:id', async (req, res) => {
  try {
    await poolEpet1.query('UPDATE fishing_maps SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 钓鱼素材 & 地图配置 ─────────────────────────────

// GET /api/epet1/fishing/maps/:mapId/assets — 公开，获取某地图全部素材 + 配置
router.get('/maps/:mapId/assets', async (req, res) => {
  try {
    const { mapId } = req.params;

    // 素材 → key-value 对象
    const { rows: assetRows } = await poolEpet1.query(
      'SELECT asset_key, asset_url FROM fishing_assets WHERE fishing_map_id = $1 ORDER BY sort_order',
      [mapId]
    );
    const assets = {};
    for (const row of assetRows) {
      assets[row.asset_key] = row.asset_url;
    }

    // 配置 → 默认值兜底
    const { rows: cfgRows } = await poolEpet1.query(
      'SELECT * FROM fishing_map_config WHERE fishing_map_id = $1',
      [mapId]
    );
    const config = cfgRows[0] || {
      lake_top_pct: 55, lake_left_pct: 0, lake_width_pct: 100, lake_height_pct: 45,
      green_start_pct: 40, green_end_pct: 70,
      cast_duration_ms: 800, pull_duration_ms: 1200,
      waiting_min_ms: 1000, waiting_max_ms: 4000,
    };

    res.json({ ok: true, assets, config });
  } catch (err) {
    console.error('[fishing] map-assets error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/epet1/fishing/admin/assets/:mapId — 管理端，获取素材列表
router.get('/admin/assets/:mapId', async (req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      'SELECT id, asset_key, asset_url, sort_order, created_at FROM fishing_assets WHERE fishing_map_id = $1 ORDER BY sort_order, asset_key',
      [req.params.mapId]
    );
    res.json({ ok: true, assets: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/fishing/admin/assets/:mapId — 管理端，upsert 单个素材 (by key)
router.post('/admin/assets/:mapId', async (req, res) => {
  try {
    const { mapId } = req.params;
    const { asset_key, asset_url, sort_order } = req.body;
    if (!asset_key || !asset_url) return res.status(400).json({ error: '缺少 asset_key 或 asset_url' });

    const { rows } = await poolEpet1.query(
      `INSERT INTO fishing_assets (fishing_map_id, asset_key, asset_url, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (fishing_map_id, asset_key)
       DO UPDATE SET asset_url = EXCLUDED.asset_url, sort_order = EXCLUDED.sort_order
       RETURNING *`,
      [mapId, asset_key, asset_url, sort_order || 0]
    );
    res.json({ ok: true, asset: rows[0] });
  } catch (err) {
    console.error('[fishing] admin assets upsert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/epet1/fishing/admin/assets/:mapId/:assetKey — 管理端，删除单个素材
router.delete('/admin/assets/:mapId/:assetKey', async (req, res) => {
  try {
    const { mapId, assetKey } = req.params;
    const { rowCount } = await poolEpet1.query(
      'DELETE FROM fishing_assets WHERE fishing_map_id = $1 AND asset_key = $2',
      [mapId, assetKey]
    );
    if (rowCount === 0) return res.status(404).json({ error: '素材不存在' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/epet1/fishing/admin/map-config/:mapId — 管理端，获取地图配置
router.get('/admin/map-config/:mapId', async (req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      'SELECT * FROM fishing_map_config WHERE fishing_map_id = $1',
      [req.params.mapId]
    );
    // 无配置时返回默认值
    const config = rows[0] || {
      fishing_map_id: Number(req.params.mapId),
      lake_top_pct: 55, lake_left_pct: 0, lake_width_pct: 100, lake_height_pct: 45,
      green_start_pct: 40, green_end_pct: 70,
      cast_duration_ms: 800, pull_duration_ms: 1200,
      waiting_min_ms: 1000, waiting_max_ms: 4000,
    };
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/epet1/fishing/admin/map-config/:mapId — 管理端，更新地图配置
router.put('/admin/map-config/:mapId', async (req, res) => {
  try {
    const { mapId } = req.params;
    const {
      lake_top_pct, lake_left_pct, lake_width_pct, lake_height_pct,
      green_start_pct, green_end_pct,
      cast_duration_ms, pull_duration_ms,
      waiting_min_ms, waiting_max_ms,
    } = req.body;

    // Upsert: 先尝试更新，无行则插入
    const { rowCount } = await poolEpet1.query(
      `UPDATE fishing_map_config SET
         lake_top_pct = COALESCE($1, lake_top_pct),
         lake_left_pct = COALESCE($2, lake_left_pct),
         lake_width_pct = COALESCE($3, lake_width_pct),
         lake_height_pct = COALESCE($4, lake_height_pct),
         green_start_pct = COALESCE($5, green_start_pct),
         green_end_pct = COALESCE($6, green_end_pct),
         cast_duration_ms = COALESCE($7, cast_duration_ms),
         pull_duration_ms = COALESCE($8, pull_duration_ms),
         waiting_min_ms = COALESCE($9, waiting_min_ms),
         waiting_max_ms = COALESCE($10, waiting_max_ms)
       WHERE fishing_map_id = $11`,
      [lake_top_pct, lake_left_pct, lake_width_pct, lake_height_pct,
       green_start_pct, green_end_pct,
       cast_duration_ms, pull_duration_ms,
       waiting_min_ms, waiting_max_ms, mapId]
    );

    if (rowCount === 0) {
      // 首次创建配置行
      await poolEpet1.query(
        `INSERT INTO fishing_map_config (
           fishing_map_id, lake_top_pct, lake_left_pct, lake_width_pct, lake_height_pct,
           green_start_pct, green_end_pct,
           cast_duration_ms, pull_duration_ms,
           waiting_min_ms, waiting_max_ms
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [mapId,
         lake_top_pct ?? 55, lake_left_pct ?? 0, lake_width_pct ?? 100, lake_height_pct ?? 45,
         green_start_pct ?? 40, green_end_pct ?? 70,
         cast_duration_ms ?? 800, pull_duration_ms ?? 1200,
         waiting_min_ms ?? 1000, waiting_max_ms ?? 4000]
      );
    }

    // 返回最终配置
    const { rows } = await poolEpet1.query(
      'SELECT * FROM fishing_map_config WHERE fishing_map_id = $1',
      [mapId]
    );
    res.json({ ok: true, config: rows[0] });
  } catch (err) {
    console.error('[fishing] admin map-config upsert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
