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
         WHERE si.is_active = true AND si.purchasable = true
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
      const user_id = req.user.userId;
      const { shop_item_id, payment = 'emotion' } = req.body;
      if (!shop_item_id) {
        return res.status(400).json({ success: false, error: '缺少 shop_item_id' });
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

      // 不可购买检查
      if (!shopItem.purchasable) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '该物品不可购买' });
      }

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

      // 消消乐通关检查
      if (shopItem.match3_level_id) {
        const passedRes = await client.query(
          `SELECT 1 FROM match3_records WHERE user_id = $1 AND level_id = $2 AND passed = true LIMIT 1`,
          [user_id, shopItem.match3_level_id]
        );
        if (passedRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: '需要先通过消消乐关卡才能购买此物品' });
        }
      }

      // 成长等级检查：用户拥有的任意宠物中，是否有达到要求的等级
      if (shopItem.growth_level_required && shopItem.growth_level_required > 1) {
        const petLevelRes = await client.query(
          `SELECT 1 FROM pet_instances WHERE user_id = $1 AND growth_level >= $2 AND status != 'merged' LIMIT 1`,
          [user_id, shopItem.growth_level_required]
        );
        if (petLevelRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: `需要宠物成长达到 Lv.${shopItem.growth_level_required} 才能购买` });
        }
      }

      // 特定宠物模型检查：用户需要拥有指定宠物模型
      if (shopItem.pet_model_id_required) {
        const petModelRes = await client.query(
          `SELECT 1 FROM pet_instances WHERE user_id = $1 AND pet_model_id = $2 AND status != 'merged' LIMIT 1`,
          [user_id, shopItem.pet_model_id_required]
        );
        if (petModelRes.rows.length === 0) {
          const modelRes = await client.query('SELECT name FROM pet_models WHERE id = $1', [shopItem.pet_model_id_required]);
          const modelName = modelRes.rows[0]?.name || `#${shopItem.pet_model_id_required}`;
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: `需要拥有「${modelName}」才能购买` });
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
        `INSERT INTO user_inventory (user_id, shop_item_id, quantity, item_category, source)
         VALUES ($1, $2, 1, $3, 'shop')
         ON CONFLICT (user_id, shop_item_id) DO UPDATE SET quantity = user_inventory.quantity + 1`,
        [user_id, shop_item_id, shopItem.item_category]
      );

      await client.query('COMMIT');

      // 返回扣款后剩余情绪值
      const afterRes = await client.query(
        'SELECT emotion_points FROM users WHERE id = $1',
        [user_id]
      );
      res.json({ success: true, item: shopItem, remaining_emotion: afterRes.rows[0]?.emotion_points ?? 0 });
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
      if (parseInt(req.params.userId) !== parseInt(req.user.userId)) {
        return res.status(403).json({ error: '无权访问' });
      }
      const result = await pool.query(
        `SELECT ui.*, si.name, si.image_url, si.description, si.item_type, si.item_category,
                si.yard_width, si.yard_height
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
