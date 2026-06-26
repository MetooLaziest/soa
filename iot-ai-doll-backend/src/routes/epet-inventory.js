import express from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// GET /api/epet1/inventory/:userId - 获取用户背包
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { rows: rows } = await poolEpet1.query(
      `SELECT ui.id, ui.quantity, ui.item_category, ui.source, ui.dish_rating,
              si.id as shop_item_id, si.name, si.item_type, si.image_url, si.description,
              si.price_emotion, si.yard_width, si.yard_height
       FROM user_inventory ui
       JOIN shop_items si ON si.id = ui.shop_item_id
       WHERE ui.user_id = $1 AND ui.quantity > 0
       ORDER BY ui.item_category, si.name`,
      [userId]
    );

    // 按分类分组
    const categories = { food: [], furniture: [], dish: [], postcard: [] };
    for (const row of rows) {
      const cat = row.item_category || 'food';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({
        id: row.id,
        shop_item_id: row.shop_item_id,
        name: row.name,
        quantity: row.quantity,
        image_url: row.image_url,
        description: row.description,
        source: row.source,
        price_emotion: row.price_emotion,
        yard_width: row.yard_width,
        yard_height: row.yard_height,
        dish_rating: row.dish_rating || null,
      });
    }

    // 明信片单独查
    const { rows: postcards } = await poolEpet1.query(
      `SELECT up.id, p.id as postcard_id, p.name, p.image_url, p.description, up.obtained_at, up.duplicate_count, up.is_new
       FROM user_postcards up
       JOIN postcards p ON p.id = up.postcard_id
       WHERE up.user_id = $1
       ORDER BY up.obtained_at DESC`,
      [userId]
    );
    categories.postcard = postcards.map(p => ({
      id: p.id,
      name: p.name,
      image_url: p.image_url,
      description: p.description,
      obtained_at: p.obtained_at,
      duplicate_count: p.duplicate_count,
      is_new: p.is_new,
      obtained: true,
    }));

    res.json({ ok: true, categories });
  } catch (err) {
    console.error('[inventory] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
