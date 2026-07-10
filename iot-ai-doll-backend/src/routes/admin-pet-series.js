/**
 * admin-pet-series.js - 机伴系列管理 API (Admin)
 */
import { Router } from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = Router();

// GET /api/admin/pet-series - 获取所有系列
router.get('/', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const result = await client.query(`
      SELECT id, name, banner_image_url, theme_color, display_order,
             silhouette_image_url, background_style, is_visible,
             display_background_url
      FROM pet_series
      ORDER BY display_order ASC, id ASC
    `);
    res.json({ series: result.rows });
  } catch (err) {
    console.error('admin-pet-series list error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/admin/pet-series - 创建系列
router.post('/', async (req, res) => {
  const { name, banner_image_url, theme_color, display_order, silhouette_image_url, background_style, is_visible, display_background_url } = req.body;
  const client = await poolEpet1.connect();
  try {
    const result = await client.query(`
      INSERT INTO pet_series (name, banner_image_url, theme_color, display_order, silhouette_image_url, background_style, is_visible, display_background_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, banner_image_url, theme_color, display_order || 0, silhouette_image_url, background_style || {}, is_visible !== false, display_background_url]);
    res.json({ series: result.rows[0] });
  } catch (err) {
    console.error('admin-pet-series create error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/admin/pet-series/:id - 更新系列
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, banner_image_url, theme_color, display_order, silhouette_image_url, background_style, is_visible, display_background_url } = req.body;
  const client = await poolEpet1.connect();
  try {
    const result = await client.query(`
      UPDATE pet_series
      SET name = $1, banner_image_url = $2, theme_color = $3, display_order = $4,
          silhouette_image_url = $5, background_style = $6, is_visible = $7,
          display_background_url = $8
      WHERE id = $9
      RETURNING *
    `, [name, banner_image_url, theme_color, display_order, silhouette_image_url, background_style, is_visible, display_background_url, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }
    res.json({ series: result.rows[0] });
  } catch (err) {
    console.error('admin-pet-series update error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/pet-series/:id - 删除系列
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await poolEpet1.connect();
  try {
    await client.query('DELETE FROM series_pets WHERE series_id = $1', [id]);
    const result = await client.query('DELETE FROM pet_series WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('admin-pet-series delete error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/admin/pet-series/:id/pets - 获取系列内机伴
router.get('/:id/pets', async (req, res) => {
  const { id } = req.params;
  const client = await poolEpet1.connect();
  try {
    const result = await client.query(`
      SELECT sp.id, sp.series_id, sp.model_id, sp.display_order, sp.display_config,
             pm.name as model_name,
             pm.image_url as portrait_image_url
      FROM series_pets sp
      JOIN pet_models pm ON sp.model_id = pm.id
      WHERE sp.series_id = $1
      ORDER BY sp.display_order ASC, sp.model_id ASC
    `, [id]);
    res.json({ pets: result.rows });
  } catch (err) {
    console.error('admin-pet-series pets error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/admin/pet-series/:id/pets - 添加机伴到系列
router.post('/:id/pets', async (req, res) => {
  const { id } = req.params;
  const { model_id, display_order } = req.body;
  const client = await poolEpet1.connect();
  try {
    const result = await client.query(`
      INSERT INTO series_pets (series_id, model_id, display_order)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, model_id, display_order || 0]);
    res.json({ pet: result.rows[0] });
  } catch (err) {
    console.error('admin-pet-series add pet error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/pet-series/:id/pets/:petId - 从系列移除机伴
router.delete('/:id/pets/:petId', async (req, res) => {
  const { id, petId } = req.params;
  const client = await poolEpet1.connect();
  try {
    await client.query('DELETE FROM series_pets WHERE id = $1 AND series_id = $2', [petId, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('admin-pet-series remove pet error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/admin/pet-series/:id/pets/:petId/position - 更新机伴展示位置
router.put('/:id/pets/:petId/position', async (req, res) => {
  const { id, petId } = req.params;
  const { x, y, scale } = req.body;
  const client = await poolEpet1.connect();
  try {
    const displayConfig = { x: x ?? 50, y: y ?? 50, scale: scale ?? 1 };
    const result = await client.query(`
      UPDATE series_pets
      SET display_config = $1
      WHERE id = $2 AND series_id = $3
      RETURNING id, series_id, model_id, display_order, display_config
    `, [JSON.stringify(displayConfig), petId, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Series pet not found' });
    }
    res.json({ pet: result.rows[0] });
  } catch (err) {
    console.error('admin-pet-series update position error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
