/**
 * Public yard scene API — returns active scene + objects + user furniture
 * GET /api/epet1/yard/scene?user_id=2
 */
module.exports = (pool) => {
  const router = require('express').Router();

  router.get('/scene', async (req, res) => {
    try {
      const { rows: [scene] } = await pool.query(
        'SELECT id, name, bg_image_url, walk_bounds FROM yard_scenes WHERE is_active = true LIMIT 1'
      );
      if (!scene) return res.json({ success: true, scene: null, objects: [], furniture: [] });

      const { rows: objects } = await pool.query(
        'SELECT id, label, object_type, layer, pos_x, pos_y, width, height, image_url, collidable, sort_priority FROM yard_scene_objects WHERE scene_id = $1 ORDER BY layer, pos_y, sort_priority',
        [scene.id]
      );

      // 获取用户已布置的家具（通过 user_id 查询参数）
      let furniture = [];
      const userId = req.query.user_id;
      if (userId) {
        const furnRes = await pool.query(
          `SELECT yf.id, yf.shop_item_id, yf.pos_x, yf.pos_y, yf.width, yf.height,
                  si.name as label, si.image_url, si.item_category
           FROM yard_furniture yf
           JOIN shop_items si ON si.id = yf.shop_item_id
           WHERE yf.user_id = $1
           ORDER BY yf.placed_at`,
          [userId]
        );
        // 转换为与 scene objects 兼容的格式
        furniture = furnRes.rows.map(f => ({
          id: f.id,
          label: f.label,
          object_type: 'furniture',
          layer: 1,
          pos_x: parseFloat(f.pos_x),
          pos_y: parseFloat(f.pos_y),
          width: parseFloat(f.width),
          height: parseFloat(f.height),
          image_url: f.image_url,
          collidable: true,
          sort_priority: 0,
          is_user_furniture: true,
          shop_item_id: f.shop_item_id,
        }));
      }

      res.json({ success: true, scene, objects, furniture });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
