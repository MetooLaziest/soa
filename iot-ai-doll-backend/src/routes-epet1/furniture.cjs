/**
 * 家具布置路由
 * GET  /api/epet1/furniture/yard/:userId   - 获取用户庭院已布置的家具
 * POST /api/epet1/furniture/place          - 放置家具到庭院
 * POST /api/epet1/furniture/remove         - 从庭院收回家具（回背包）
 * POST /api/epet1/furniture/move           - 移动已放置家具的位置
 */
module.exports = (pool) => {
  const router = require('express').Router();
  const MAX_YARD_FURNITURE = 8;

  // 获取用户庭院已布置的家具
  router.get('/yard/:userId', async (req, res) => {
    try {
      if (parseInt(req.params.userId) !== parseInt(req.user.userId)) {
        return res.status(403).json({ error: '无权访问' });
      }
      const { userId } = req.params;
      const result = await pool.query(
        `SELECT yf.*, si.name, si.image_url, si.item_type, si.item_category
         FROM yard_furniture yf
         JOIN shop_items si ON si.id = yf.shop_item_id
         WHERE yf.user_id = $1
         ORDER BY yf.placed_at DESC`,
        [userId]
      );
      res.json({ success: true, furniture: result.rows });
    } catch (err) {
      console.error('furniture yard list error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 放置家具到庭院
  router.post('/place', async (req, res) => {
    const client = await pool.connect();
    try {
      const user_id = req.user.userId;
      const { shop_item_id, pos_x, pos_y, width, height } = req.body;
      if (!shop_item_id) {
        return res.status(400).json({ success: false, error: '缺少 shop_item_id' });
      }

      await client.query('BEGIN');

      // 检查庭院家具数量上限
      const countRes = await client.query(
        'SELECT COUNT(*) as cnt FROM yard_furniture WHERE user_id = $1',
        [user_id]
      );
      if (parseInt(countRes.rows[0].cnt) >= MAX_YARD_FURNITURE) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: `庭院最多放置 ${MAX_YARD_FURNITURE} 件家具` });
      }

      // 唯一性检查：同一家具不能重复放置到庭院
      const dupRes = await client.query(
        'SELECT id FROM yard_furniture WHERE user_id = $1 AND shop_item_id = $2',
        [user_id, shop_item_id]
      );
      if (dupRes.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '该家具已在庭院中，不能重复放置' });
      }

      // 检查背包中是否有该家具且数量足够
      const invRes = await client.query(
        'SELECT id, quantity FROM user_inventory WHERE user_id = $1 AND shop_item_id = $2 AND quantity > 0',
        [user_id, shop_item_id]
      );
      if (invRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '背包中没有该家具' });
      }

      // 扣减背包数量
      const inv = invRes.rows[0];
      if (inv.quantity <= 1) {
        await client.query(
          'DELETE FROM user_inventory WHERE id = $1',
          [inv.id]
        );
      } else {
        await client.query(
          'UPDATE user_inventory SET quantity = quantity - 1 WHERE id = $1',
          [inv.id]
        );
      }

      // 获取商店物品信息用于默认尺寸
      const itemRes = await client.query(
        'SELECT name, image_url FROM shop_items WHERE id = $1',
        [shop_item_id]
      );
      if (itemRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: '家具不存在' });
      }

      // 放置到庭院
      const insertRes = await client.query(
        `INSERT INTO yard_furniture (user_id, shop_item_id, pos_x, pos_y, width, height)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          user_id,
          shop_item_id,
          pos_x ?? 0.5,
          pos_y ?? 0.6,
          width ?? 0.08,
          height ?? 0.12,
        ]
      );

      await client.query('COMMIT');

      // 返回完整的家具数据（含 shop_items 信息）
      const placed = insertRes.rows[0];
      placed.name = itemRes.rows[0].name;
      placed.image_url = itemRes.rows[0].image_url;

      res.json({ success: true, furniture: placed });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('furniture place error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // 从庭院收回家具（回背包）
  router.post('/remove', async (req, res) => {
    const client = await pool.connect();
    try {
      const user_id = req.user.userId;
      const { furniture_id } = req.body;
      if (!furniture_id) {
        return res.status(400).json({ success: false, error: '缺少 furniture_id' });
      }

      await client.query('BEGIN');

      // 获取家具记录
      const furnRes = await client.query(
        'SELECT * FROM yard_furniture WHERE id = $1 AND user_id = $2',
        [furniture_id, user_id]
      );
      if (furnRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: '家具不存在' });
      }

      const furniture = furnRes.rows[0];

      // 删除庭院家具记录
      await client.query(
        'DELETE FROM yard_furniture WHERE id = $1',
        [furniture_id]
      );

      // 归还背包
      await client.query(
        `INSERT INTO user_inventory (user_id, shop_item_id, quantity, item_category, source)
         VALUES ($1, $2, 1, 'furniture', 'yard_reclaim')
         ON CONFLICT (user_id, shop_item_id) DO UPDATE SET quantity = user_inventory.quantity + 1`,
        [user_id, furniture.shop_item_id]
      );

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('furniture remove error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // 移动已放置家具的位置
  router.post('/move', async (req, res) => {
    try {
      const user_id = req.user.userId;
      const { furniture_id, pos_x, pos_y } = req.body;
      if (!furniture_id || pos_x == null || pos_y == null) {
        return res.status(400).json({ success: false, error: '缺少参数' });
      }

      const result = await pool.query(
        `UPDATE yard_furniture SET pos_x = $3, pos_y = $4
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [furniture_id, user_id, pos_x, pos_y]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: '家具不存在' });
      }

      res.json({ success: true, furniture: result.rows[0] });
    } catch (err) {
      console.error('furniture move error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
