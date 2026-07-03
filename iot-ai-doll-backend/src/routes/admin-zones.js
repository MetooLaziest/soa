/**
 * Zone Manager API — CRUD for yard_zones + per-zone scene objects + time-slot backgrounds
 */
import { Router } from 'express';
import { poolEpet1 } from '../lib/db.js';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// ===================== Zones =====================

/** GET /api/admin/zones — list all zones */
router.get('/', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      'SELECT * FROM yard_zones ORDER BY grid_y, grid_x'
    );
    res.json({ success: true, zones: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/admin/zones/:id — get zone with objects */
router.get('/:id', async (req, res) => {
  try {
    const zoneId = Number(req.params.id);
    const { rows: [zone] } = await poolEpet1.query(
      'SELECT * FROM yard_zones WHERE id = $1', [zoneId]
    );
    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    const { rows: objects } = await poolEpet1.query(
      'SELECT * FROM yard_scene_objects WHERE zone_id = $1 ORDER BY layer, pos_y, sort_priority',
      [zone.zone_key]
    );
    res.json({ success: true, zone, objects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/admin/zones — create zone */
router.post('/', async (req, res) => {
  try {
    const { zone_key, zone_name, grid_x, grid_y, walk_bounds,
            bg_image_dawn, bg_image_day, bg_image_night,
            is_default, unlock_type, unlock_value, unlock_shop_item_id } = req.body;

    if (!zone_key) return res.status(400).json({ error: 'zone_key required (e.g. "0,0")' });

    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO yard_zones (zone_key, zone_name, grid_x, grid_y, walk_bounds,
        bg_image_dawn, bg_image_day, bg_image_night,
        is_default, unlock_type, unlock_value, unlock_shop_item_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [zone_key, zone_name || '新区域', grid_x || 0, grid_y || 0,
       JSON.stringify(walk_bounds || { xMin: 0.05, xMax: 0.88, yMin: 0.45, yMax: 0.78 }),
       bg_image_dawn || '/epet/static/yard-bg-dawn.png',
       bg_image_day || '/epet/static/yard-bg.png',
       bg_image_night || '/epet/static/yard-bg-night.png',
       is_default || false,
       unlock_type || 'free',
       unlock_value || '',
       unlock_shop_item_id || null]
    );
    res.json({ success: true, zone: row });
  } catch (e) {
    // Handle duplicate zone_key
    if (e.code === '23505') {
      return res.status(409).json({ error: `区域 ${req.body.zone_key} 已存在` });
    }
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/zones/:id — update zone */
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fields = ['zone_name', 'grid_x', 'grid_y', 'walk_bounds',
      'bg_image_dawn', 'bg_image_day', 'bg_image_night',
      'is_default', 'unlock_type', 'unlock_value', 'unlock_shop_item_id'];
    const sets = [];
    const vals = [];
    let idx = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === 'walk_bounds') {
          sets.push(`walk_bounds = $${idx++}`);
          vals.push(JSON.stringify(req.body[f]));
        } else {
          sets.push(`${f} = $${idx++}`);
          vals.push(req.body[f]);
        }
      }
    }
    sets.push('updated_at = now()');

    if (sets.length === 1) return res.status(400).json({ error: 'No fields to update' });
    vals.push(id);

    const { rows: [row] } = await poolEpet1.query(
      `UPDATE yard_zones SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!row) return res.status(404).json({ error: 'Zone not found' });

    // If setting as default, unset others
    if (req.body.is_default) {
      await poolEpet1.query('UPDATE yard_zones SET is_default = false WHERE id != $1', [id]);
    }

    res.json({ success: true, zone: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/admin/zones/:id */
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rows: [zone] } = await poolEpet1.query('SELECT * FROM yard_zones WHERE id = $1', [id]);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    if (zone.is_default) return res.status(400).json({ error: '不能删除默认区域' });

    // Delete objects in this zone
    await poolEpet1.query('DELETE FROM yard_scene_objects WHERE zone_id = $1', [zone.zone_key]);
    // Delete zone
    await poolEpet1.query('DELETE FROM yard_zones WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================== Zone Objects =====================

/** POST /api/admin/zones/:zoneDbId/objects — add object to zone */
router.post('/:zoneDbId/objects', async (req, res) => {
  try {
    const zoneDbId = Number(req.params.zoneDbId);
    const { rows: [zone] } = await poolEpet1.query('SELECT * FROM yard_zones WHERE id = $1', [zoneDbId]);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    const { label, object_type, layer, pos_x, pos_y, width, height,
            image_url, image_url_dawn, image_url_night,
            collidable, sort_priority } = req.body;

    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO yard_scene_objects (scene_id, zone_id, label, object_type, layer, pos_x, pos_y, width, height,
        image_url, image_url_dawn, image_url_night, collidable, sort_priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [0, zone.zone_key, label || '新物体', object_type || 'decoration', layer ?? 1,
       pos_x ?? 0.5, pos_y ?? 0.5, width ?? 0.08, height ?? 0.1,
       image_url || '', image_url_dawn || '', image_url_night || '',
       collidable ?? false, sort_priority ?? 0]
    );
    res.json({ success: true, object: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/zones/:zoneDbId/objects/:objId — update object */
router.put('/:zoneDbId/objects/:objId', async (req, res) => {
  try {
    const objId = Number(req.params.objId);
    const fields = ['label', 'object_type', 'layer', 'pos_x', 'pos_y', 'width', 'height',
      'image_url', 'image_url_dawn', 'image_url_night', 'collidable', 'sort_priority'];
    const sets = [];
    const vals = [];
    let idx = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = $${idx++}`);
        vals.push(req.body[f]);
      }
    }

    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(objId);

    const { rows: [row] } = await poolEpet1.query(
      `UPDATE yard_scene_objects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!row) return res.status(404).json({ error: 'Object not found' });
    res.json({ success: true, object: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/admin/zones/:zoneDbId/objects/:objId */
router.delete('/:zoneDbId/objects/:objId', async (req, res) => {
  try {
    const objId = Number(req.params.objId);
    const { rowCount } = await poolEpet1.query('DELETE FROM yard_scene_objects WHERE id = $1', [objId]);
    if (!rowCount) return res.status(404).json({ error: 'Object not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/zones/:zoneDbId/objects — batch update positions */
router.put('/:zoneDbId/objects', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const objects = req.body.objects;
    if (!Array.isArray(objects)) return res.status(400).json({ error: 'objects array required' });

    await client.query('BEGIN');
    for (const obj of objects) {
      await client.query(
        `UPDATE yard_scene_objects SET pos_x = $1, pos_y = $2, width = $3, height = $4, layer = $5, collidable = $6
         WHERE id = $7`,
        [obj.pos_x, obj.pos_y, obj.width, obj.height, obj.layer, obj.collidable, obj.id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, updated: objects.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ===================== Upload =====================

/** Upload background image for a zone time-slot */
router.post('/upload-bg', async (req, res) => {
  try {
    const { zone_id, time_slot, image_data } = req.body;
    if (!image_data || !time_slot) return res.status(400).json({ error: 'image_data and time_slot required' });

    const validSlots = ['dawn', 'day', 'night'];
    if (!validSlots.includes(time_slot)) return res.status(400).json({ error: 'time_slot must be dawn/day/night' });

    const match = image_data.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });

    const ext = match[2].replace('jpeg', 'jpg');
    const base64 = match[3];
    const buffer = Buffer.from(base64, 'base64');

    const dir = '/var/www/iot-ai-doll/epet-assets/zone-bgs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `zone-${zone_id || 'default'}-${time_slot}-${Date.now()}.${ext}`;
    const filepath = join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    const url = `/epet/static/zone-bgs/${filename}`;

    // Update zone record if zone_id provided
    if (zone_id) {
      const col = `bg_image_${time_slot}`;
      await poolEpet1.query(
        `UPDATE yard_zones SET ${col} = $1, updated_at = now() WHERE zone_key = $2`,
        [url, zone_id]
      );
    }

    res.json({ success: true, url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Upload image for a scene object (with optional time-slot variant) */
router.post('/upload-obj-image', async (req, res) => {
  try {
    const { object_id, time_slot, image_data } = req.body;
    if (!image_data) return res.status(400).json({ error: 'image_data required' });

    const match = image_data.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });

    const ext = match[2].replace('jpeg', 'jpg');
    const base64 = match[3];
    const buffer = Buffer.from(base64, 'base64');

    const dir = '/var/www/iot-ai-doll/epet-assets/scene-assets';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const slotSuffix = time_slot ? `-${time_slot}` : '';
    const filename = `obj-${object_id || 'new'}${slotSuffix}-${Date.now()}.${ext}`;
    const filepath = join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    const url = `/epet/static/scene-assets/${filename}`;

    // Update object's image_url field
    if (object_id) {
      let col = 'image_url';
      if (time_slot === 'dawn') col = 'image_url_dawn';
      else if (time_slot === 'night') col = 'image_url_night';

      await poolEpet1.query(
        `UPDATE yard_scene_objects SET ${col} = $1 WHERE id = $2`,
        [url, object_id]
      );
    }

    res.json({ success: true, url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
