/**
 * 商店路由
 * GET  /api/epet1/shop/items     - 获取商店物品列表
 * POST /api/epet1/shop/buy       - 购买物品
 * GET  /api/epet1/shop/inventory - 获取用户背包
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 获取商店物品
  router.get('/items', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT si.*, pm.name as required_pet_name
         FROM shop_items si
         LEFT JOIN pet_models pm ON pm.id = si.pet_model_id_required
         WHERE si.is_active = true
         ORDER BY si.item_type, si.price_emotion`
      );
      res.json({ success: true, items: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 购买物品
  router.post('/buy', async (req, res) => {
    const client = await pool.connect();
    try {
      const { user_id, shop_item_id, payment = 'emotion' } = req.body;
      if (!user_id || !shop_item_id) {
        return res.status(400).json({ success: false, error: '缺少参数' });
      }

      await client.query('BEGIN');

      // 获取物品
      const item = await client.query(
        'SELECT * FROM shop_items WHERE id = $1 AND is_active = true',
        [shop_item_id]
      );
      if (!item.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: '物品不存在' });
      }

      const shopItem = item.rows[0];

      // 家具唯一性检查：已拥有则不能再次购买
      if (shopItem.item_category === 'furniture') {
        const owned = await client.query(
          'SELECT id FROM user_inventory WHERE user_id = $1 AND shop_item_id = $2 AND quantity > 0',
          [user_id, shop_item_id]
        );
        if (owned.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: '该家具已拥有，不能重复购买' });
        }
      }

      // 检查库存
      if (shopItem.stock === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '库存不足' });
      }

      // 扣款
      if (payment === 'emotion') {
        const price = shopItem.price_emotion;
        if (price > 0) {
          const userRes = await client.query(
            'SELECT emotion_points FROM users WHERE id = $1 FOR UPDATE',
            [user_id]
          );
          if (userRes.rows[0].emotion_points < price) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: '情绪值不足' });
          }
          await client.query(
            'UPDATE users SET emotion_points = emotion_points - $1 WHERE id = $2',
            [price, user_id]
          );
        }
      }
      // TODO: 微信支付（实物商品）后续接入

      // 库存扣减
      if (shopItem.stock > 0) {
        await client.query(
          'UPDATE shop_items SET stock = stock - 1 WHERE id = $1',
          [shop_item_id]
        );
      }

      // 加入背包
      await client.query(
        `INSERT INTO user_inventory (user_id, shop_item_id, quantity)
         VALUES ($1, $2, 1)
         ON CONFLICT (user_id, shop_item_id) DO UPDATE SET quantity = user_inventory.quantity + 1`,
        [user_id, shop_item_id]
      );

      await client.query('COMMIT');
      res.json({ success: true, item: shopItem });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('shop buy error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // 获取用户背包
  router.get('/inventory/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT ui.*, si.name, si.image_url, si.description, si.item_type
         FROM user_inventory ui
         JOIN shop_items si ON si.id = ui.shop_item_id
         WHERE ui.user_id = $1 AND ui.quantity > 0
         ORDER BY ui.id DESC`,
        [req.params.userId]
      );
      res.json({ success: true, inventory: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
