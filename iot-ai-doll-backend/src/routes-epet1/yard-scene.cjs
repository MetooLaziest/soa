/**
 * Public yard scene API — returns active scene + objects
 * GET /api/epet1/yard/scene
 */
module.exports = (pool) => {
  const router = require('express').Router();

  router.get('/scene', async (_req, res) => {
    try {
      const { rows: [scene] } = await pool.query(
        'SELECT id, name, bg_image_url, walk_bounds FROM yard_scenes WHERE is_active = true LIMIT 1'
      );
      if (!scene) return res.json({ success: true, scene: null, objects: [] });

      const { rows: objects } = await pool.query(
        'SELECT id, label, object_type, layer, pos_x, pos_y, width, height, image_url, collidable, sort_priority FROM yard_scene_objects WHERE scene_id = $1 ORDER BY layer, pos_y, sort_priority',
        [scene.id]
      );
      res.json({ success: true, scene, objects });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
