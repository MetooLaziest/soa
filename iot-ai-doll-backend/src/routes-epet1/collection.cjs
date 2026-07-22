/**
 * collection.cjs - 藏品库系列管理 API
 * GET  /collection/series        - 获取所有系列列表（含进度统计）
 * GET  /collection/series/:id    - 获取系列详情（含机伴列表）
 */

function getSeriesList(pool) {
  return async function(req, res) {
    const userId = req.user.userId;

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT
          s.id,
          s.name,
          s.banner_image_url,
          s.theme_color,
          s.display_order,
          s.silhouette_image_url,
          s.background_style,
          COUNT(sp.model_id) as total_count,
          COUNT(CASE WHEN pi.id IS NOT NULL THEN 1 END) as collected_count
        FROM pet_series s
        LEFT JOIN series_pets sp ON s.id = sp.series_id
        LEFT JOIN pet_instances pi ON sp.model_id = pi.pet_model_id AND pi.user_id = $1
        WHERE s.is_visible = true
        GROUP BY s.id, s.name, s.banner_image_url, s.theme_color, s.display_order,
                 s.silhouette_image_url, s.background_style
        ORDER BY s.display_order ASC, s.id ASC
      `, [userId]);

      res.json({
        series: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          bannerImageUrl: row.banner_image_url,
          themeColor: row.theme_color,
          displayOrder: row.display_order,
          silhouetteImageUrl: row.silhouette_image_url,
          backgroundStyle: row.background_style,
          totalCount: parseInt(row.total_count),
          collectedCount: parseInt(row.collected_count),
        }))
      });
    } catch (err) {
      console.error('getSeriesList error:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  };
}

function getSeriesDetail(pool) {
  return async function(req, res) {
    const userId = req.user.userId;
    const seriesId = req.params.id;

    const client = await pool.connect();
    try {
      const seriesResult = await client.query(`
        SELECT * FROM pet_series WHERE id = $1 AND is_visible = true
      `, [seriesId]);

      if (seriesResult.rows.length === 0) {
        return res.status(404).json({ error: 'Series not found' });
      }

      const series = seriesResult.rows[0];

      const petsResult = await client.query(`
        SELECT
          sp.model_id,
          sp.display_order as pet_order,
          sp.display_config,
          pm.name as model_name,
          pm.image_url as portrait_image_url,
          pm.full_image_url,
          pm.rarity,
          pi.id IS NOT NULL as is_collected,
          pi.growth_level,
          (tr.id IS NOT NULL) as is_traveling
        FROM series_pets sp
        JOIN pet_models pm ON sp.model_id = pm.id
        LEFT JOIN pet_instances pi ON pm.id = pi.pet_model_id AND pi.user_id = $1
        LEFT JOIN travel_records tr ON tr.pet_instance_id = pi.id AND tr.status = 'traveling'
        WHERE sp.series_id = $2
        ORDER BY sp.display_order ASC, sp.model_id ASC
      `, [userId, seriesId]);

      res.json({
        series: {
          id: series.id,
          name: series.name,
          bannerImageUrl: series.banner_image_url,
          themeColor: series.theme_color,
          backgroundStyle: series.background_style,
          silhouetteImageUrl: series.silhouette_image_url,
          displayBackgroundUrl: series.display_background_url,
        },
        pets: petsResult.rows.map(row => ({
          modelId: row.model_id,
          displayOrder: row.pet_order,
          displayConfig: row.display_config,
          modelName: row.model_name,
          portraitImageUrl: row.portrait_image_url,
          fullImageUrl: row.full_image_url,
          rarity: row.rarity,
          isCollected: row.is_collected,
          growthLevel: row.growth_level,
          isTraveling: row.is_traveling,
        })),
        progress: {
          total: petsResult.rows.length,
          collected: petsResult.rows.filter(r => r.is_collected).length,
        }
      });
    } catch (err) {
      console.error('getSeriesDetail error:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  };
}

// Factory function that returns router setup function
module.exports = function(pool) {
  const express = require('express');
  const router = express.Router();

  router.get('/series', getSeriesList(pool));
  router.get('/series/:id', getSeriesDetail(pool));

  return router;
};
