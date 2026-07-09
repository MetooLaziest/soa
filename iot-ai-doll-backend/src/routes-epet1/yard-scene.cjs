/**
 * Public yard scene API — returns all zones + objects + user furniture
 * GET /api/epet1/yard/scene?user_id=2
 *
 * V2: Multi-zone support. Returns array of zones, each with its own bg + objects.
 * Falls back to single-yard_scenes row if yard_zones table doesn't exist yet.
 */
module.exports = (pool) => {
  const router = require('express').Router();

  router.get('/scene', async (req, res) => {
    try {
      const userId = req.query.user_id;
      let zones = [];
      let useLegacy = false;

      // Try new yard_zones table first
      try {
        const { rows: zoneRows } = await pool.query(
          'SELECT * FROM yard_zones ORDER BY grid_y, grid_x'
        );

        if (zoneRows.length > 0) {
          // New multi-zone mode
          for (const zone of zoneRows) {
            const { rows: objects } = await pool.query(
              'SELECT id, label, object_type, layer, pos_x, pos_y, width, height, image_url, image_url_dawn, image_url_night, collidable, sort_priority FROM yard_scene_objects WHERE zone_id = $1 ORDER BY layer, pos_y, sort_priority',
              [zone.zone_key]
            );
            zones.push({
              ...zone,
              walk_bounds: typeof zone.walk_bounds === 'string' ? JSON.parse(zone.walk_bounds) : zone.walk_bounds,
              objects,
            });
          }
        } else {
          useLegacy = true;
        }
      } catch (e) {
        // yard_zones table doesn't exist yet → legacy mode
        if (e.code === '42P01') {
          useLegacy = true;
        } else {
          throw e;
        }
      }

      // Legacy fallback: single yard_scenes row
      if (useLegacy) {
        const { rows: [scene] } = await pool.query(
          'SELECT id, name, bg_image_url, walk_bounds FROM yard_scenes WHERE is_active = true LIMIT 1'
        );
        if (scene) {
          const { rows: objects } = await pool.query(
            'SELECT id, label, object_type, layer, pos_x, pos_y, width, height, image_url, collidable, sort_priority FROM yard_scene_objects WHERE scene_id = $1 ORDER BY layer, pos_y, sort_priority',
            [scene.id]
          );
          zones.push({
            zone_key: '0,0',
            zone_name: scene.name,
            grid_x: 0,
            grid_y: 0,
            bg_image_dawn: scene.bg_image_url,
            bg_image_day: scene.bg_image_url,
            bg_image_night: scene.bg_image_url,
            walk_bounds: typeof scene.walk_bounds === 'string' ? JSON.parse(scene.walk_bounds) : scene.walk_bounds,
            is_default: true,
            unlock_type: 'free',
            objects,
          });
        }
      }

      // Get user furniture
      let furniture = [];
      if (userId) {
        const furnRes = await pool.query(
          `SELECT yf.id, yf.shop_item_id, yf.pos_x, yf.pos_y, yf.width, yf.height,
                  si.name as label, si.image_url, si.item_category,
                  si.yard_width, si.yard_height
           FROM yard_furniture yf
           JOIN shop_items si ON si.id = yf.shop_item_id
           WHERE yf.user_id = $1
           ORDER BY yf.placed_at`,
          [userId]
        );
        furniture = furnRes.rows.map(f => ({
          id: f.id,
          label: f.label,
          object_type: 'furniture',
          layer: 1,
          pos_x: parseFloat(f.pos_x),
          pos_y: parseFloat(f.pos_y),
          // Use shop_items yard_width/yard_height (live) instead of yard_furniture snapshot
          width: parseFloat(f.yard_width || f.width),
          height: parseFloat(f.yard_height || f.height),
          image_url: f.image_url,
          collidable: true,
          sort_priority: 0,
          is_user_furniture: true,
          shop_item_id: f.shop_item_id,
        }));
      }

      // For backward compatibility: if only one zone, also return top-level scene/objects
      const singleZone = zones.length === 1 ? zones[0] : null;

      // Fetch icon assets for HUD
      let iconsList = [];
      try {
        const iconRes = await pool.query(
          'SELECT icon_key, image_url, label, width, height FROM epet_icons WHERE image_url IS NOT NULL AND image_url != \'\' ORDER BY icon_key'
        );
        iconsList = iconRes.rows;
      } catch (_) { /* icons table may not exist yet */ }

      // Determine time of day based on server local time
      const hour = new Date().getHours();
      let timeSlot = 'day';
      if (hour >= 6 && hour < 9) timeSlot = 'dawn';
      else if (hour >= 9 && hour < 17) timeSlot = 'day';
      else if (hour >= 17 && hour < 20) timeSlot = 'dawn'; // dusk uses dawn bg
      else timeSlot = 'night';

      // Pick bg_image for current time slot
      const bgKey = `bg_image_${timeSlot}`;
      const currentBgImage = singleZone ? (singleZone[bgKey] || singleZone.bg_image_day) : null;

      // Extract light config for current time slot
      let currentLight = { light_angle: 315, shadow_offset: 0.4 };
      if (singleZone?.light_config) {
        const lc = typeof singleZone.light_config === 'string' ? JSON.parse(singleZone.light_config) : singleZone.light_config;
        currentLight = lc[timeSlot] || lc.day || currentLight;
      }

      res.json({
        success: true,
        // New format
        zones,
        furniture,
        // Icon assets for HUD
        icons: iconsList,
        // Current time context
        time_slot: timeSlot,
        // Legacy format (backward compat for existing Game.ts)
        scene: singleZone ? {
          id: 0,
          name: singleZone.zone_name,
          bg_image_url: currentBgImage,
          bg_image_dawn: singleZone.bg_image_dawn,
          bg_image_day: singleZone.bg_image_day,
          bg_image_night: singleZone.bg_image_night,
          walk_bounds: singleZone.walk_bounds,
          light_config: singleZone.light_config,
          current_light: currentLight,
        } : null,
        objects: singleZone ? singleZone.objects : [],
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/epet1/yard/icons — public icon assets
  router.get('/icons', async (_req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT icon_key, image_url, label, width, height FROM epet_icons ORDER BY icon_key'
      );
      // Return as key→url map for easy frontend consumption
      const icons = {};
      for (const row of rows) {
        icons[row.icon_key] = {
          url: row.image_url,
          label: row.label,
          width: row.width,
          height: row.height,
        };
      }
      res.json({ success: true, icons });
    } catch (e) {
      // Table might not exist yet
      if (e.code === '42P01') {
        res.json({ success: true, icons: {} });
      } else {
        res.status(500).json({ error: e.message });
      }
    }
  });

  return router;
};
