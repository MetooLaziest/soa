/**
 * Yard Scene Editor API
 * CRUD for yard_scenes + yard_scene_objects
 */
import { Router } from 'express';
import { poolEpet1 } from '../lib/db.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// ===================== Scenes =====================

/** GET /api/admin/yard-scenes — list all scenes */
router.get('/', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      'SELECT * FROM yard_scenes ORDER BY id'
    );
    res.json({ success: true, scenes: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/admin/yard-scenes/:id — get scene with objects */
router.get('/:id', async (req, res) => {
  try {
    const sceneId = Number(req.params.id);
    const { rows: [scene] } = await poolEpet1.query(
      'SELECT * FROM yard_scenes WHERE id = $1', [sceneId]
    );
    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    const { rows: objects } = await poolEpet1.query(
      'SELECT * FROM yard_scene_objects WHERE scene_id = $1 ORDER BY layer, pos_y, sort_priority',
      [sceneId]
    );
    res.json({ success: true, scene, objects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/admin/yard-scenes/active/scene — get the active scene + objects (public) */
router.get('/active/scene', async (_req, res) => {
  try {
    const { rows: [scene] } = await poolEpet1.query(
      'SELECT * FROM yard_scenes WHERE is_active = true LIMIT 1'
    );
    if (!scene) return res.json({ success: true, scene: null, objects: [] });

    const { rows: objects } = await poolEpet1.query(
      'SELECT * FROM yard_scene_objects WHERE scene_id = $1 ORDER BY layer, pos_y, sort_priority',
      [scene.id]
    );
    res.json({ success: true, scene, objects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/admin/yard-scenes — create scene */
router.post('/', async (req, res) => {
  try {
    const { name, bg_image_url, walk_bounds } = req.body;
    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO yard_scenes (name, bg_image_url, walk_bounds)
       VALUES ($1, $2, $3) RETURNING *`,
      [name || '新庭院', bg_image_url || '/epet/yard-bg.png', JSON.stringify(walk_bounds || { xMin: 0.05, xMax: 0.88, yMin: 0.45, yMax: 0.78 })]
    );
    res.json({ success: true, scene: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/yard-scenes/:id — update scene */
router.put('/:id', async (req, res) => {
  try {
    const sceneId = Number(req.params.id);
    const { name, bg_image_url, walk_bounds, is_active } = req.body;
    const sets = [];
    const vals = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (bg_image_url !== undefined) { sets.push(`bg_image_url = $${idx++}`); vals.push(bg_image_url); }
    if (walk_bounds !== undefined) { sets.push(`walk_bounds = $${idx++}`); vals.push(JSON.stringify(walk_bounds)); }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(is_active); }
    sets.push('updated_at = now()');

    if (sets.length === 1) return res.status(400).json({ error: 'No fields to update' });
    vals.push(sceneId);

    const { rows: [row] } = await poolEpet1.query(
      `UPDATE yard_scenes SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!row) return res.status(404).json({ error: 'Scene not found' });

    // If setting active, deactivate others
    if (is_active) {
      await poolEpet1.query('UPDATE yard_scenes SET is_active = false WHERE id != $1', [sceneId]);
    }

    res.json({ success: true, scene: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/admin/yard-scenes/:id */
router.delete('/:id', async (req, res) => {
  try {
    const sceneId = Number(req.params.id);
    const { rowCount } = await poolEpet1.query('DELETE FROM yard_scenes WHERE id = $1', [sceneId]);
    if (!rowCount) return res.status(404).json({ error: 'Scene not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================== Scene Objects =====================

/** POST /api/admin/yard-scenes/:sceneId/objects — add object */
router.post('/:sceneId/objects', async (req, res) => {
  try {
    const sceneId = Number(req.params.sceneId);
    const { label, object_type, layer, pos_x, pos_y, width, height, image_url, collidable, sort_priority } = req.body;
    const { rows: [row] } = await poolEpet1.query(
      `INSERT INTO yard_scene_objects (scene_id, label, object_type, layer, pos_x, pos_y, width, height, image_url, collidable, sort_priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [sceneId, label || '新物体', object_type || 'decoration', layer ?? 1,
       pos_x ?? 0.5, pos_y ?? 0.5, width ?? 0.08, height ?? 0.1,
       image_url || '', collidable ?? false, sort_priority ?? 0]
    );
    res.json({ success: true, object: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/yard-scenes/:sceneId/objects/:objId — update object */
router.put('/:sceneId/objects/:objId', async (req, res) => {
  try {
    const objId = Number(req.params.objId);
    const sceneId = Number(req.params.sceneId);
    const fields = ['label', 'object_type', 'layer', 'pos_x', 'pos_y', 'width', 'height', 'image_url', 'collidable', 'sort_priority'];
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
    vals.push(sceneId);

    const { rows: [row] } = await poolEpet1.query(
      `UPDATE yard_scene_objects SET ${sets.join(', ')} WHERE id = $${idx} AND scene_id = $${idx + 1} RETURNING *`,
      vals
    );
    if (!row) return res.status(404).json({ error: 'Object not found' });
    res.json({ success: true, object: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/admin/yard-scenes/:sceneId/objects/:objId */
router.delete('/:sceneId/objects/:objId', async (req, res) => {
  try {
    const objId = Number(req.params.objId);
    const sceneId = Number(req.params.sceneId);
    const { rowCount } = await poolEpet1.query(
      'DELETE FROM yard_scene_objects WHERE id = $1 AND scene_id = $2',
      [objId, sceneId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Object not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/yard-scenes/:sceneId/objects — batch update positions */
router.put('/:sceneId/objects', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const sceneId = Number(req.params.sceneId);
    const objects = req.body.objects;
    if (!Array.isArray(objects)) return res.status(400).json({ error: 'objects array required' });

    await client.query('BEGIN');
    for (const obj of objects) {
      await client.query(
        `UPDATE yard_scene_objects SET pos_x = $1, pos_y = $2, width = $3, height = $4, layer = $5, collidable = $6
         WHERE id = $7 AND scene_id = $8`,
        [obj.pos_x, obj.pos_y, obj.width, obj.height, obj.layer, obj.collidable, obj.id, sceneId]
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

/** Upload image for scene object */
router.post('/upload-image', async (req, res) => {
  try {
    const { scene_id, object_id, image_data } = req.body;
    if (!image_data) return res.status(400).json({ error: 'image_data required' });

    // image_data is a base64 data URL
    const match = image_data.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });

    const ext = match[2].replace('jpeg', 'jpg');
    const base64 = match[3];
    const buffer = Buffer.from(base64, 'base64');

    // Save to frontend dist/epet/scene-assets/
    // __dirname = .../backend/src/routes/ → need ../../../frontend/dist/epet/scene-assets/
    const dir = join(__dirname, '../../../frontend/dist/epet/scene-assets');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `obj-${object_id || 'new'}-${Date.now()}.${ext}`;
    const filepath = join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    const url = `/epet/scene-assets/${filename}`;

    // Update object's image_url if object_id provided
    if (object_id && scene_id) {
      await poolEpet1.query(
        'UPDATE yard_scene_objects SET image_url = $1 WHERE id = $2 AND scene_id = $3',
        [url, object_id, scene_id]
      );
    }

    res.json({ success: true, url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
