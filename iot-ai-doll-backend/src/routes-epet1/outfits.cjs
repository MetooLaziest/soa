/**
 * 装扮路由 (C 端)
 * GET  /inventory                    - 用户拥有的装扮列表
 * GET  /equipped/:petInstanceId      - 当前宠物装备列表
 * POST /equip                        - 装备装扮
 * POST /unequip                      - 卸下装扮
 * GET  /compatible/:petModelId       - 兼容某机伴的装扮列表
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 用户拥有的装扮列表
  router.get('/inventory', async (req, res) => {
    try {
      const userId = req.user.userId;
      const result = await pool.query(
        `SELECT ui.id as inventory_id, ui.item_id as shop_item_id, ui.quantity,
                si.name, si.image_url, si.description, si.equip_slot, si.item_category
         FROM user_inventory ui
         JOIN shop_items si ON si.id = ui.item_id
         WHERE ui.user_id = $1 AND si.item_category = 'outfit' AND ui.quantity > 0
         ORDER BY si.name`,
        [userId]
      );
      res.json({ success: true, outfits: result.rows });
    } catch (err) {
      console.error('outfit inventory error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 当前宠物装备列表
  router.get('/equipped/:petInstanceId', async (req, res) => {
    try {
      const userId = req.user.userId;
      const petInstanceId = parseInt(req.params.petInstanceId);
      // 校验宠物归属
      const petCheck = await pool.query(
        'SELECT id FROM pet_instances WHERE id = $1 AND user_id = $2 AND status != $3',
        [petInstanceId, userId, 'merged']
      );
      if (!petCheck.rows[0]) {
        return res.status(403).json({ success: false, error: '无权操作此宠物' });
      }
      const result = await pool.query(
        `SELECT peo.id, peo.outfit_shop_item_id, peo.equip_slot, peo.equipped_at,
                si.name, si.image_url, si.description,
                opm.animations, opm.anchor_override
         FROM pet_equipped_outfits peo
         JOIN shop_items si ON si.id = peo.outfit_shop_item_id
         LEFT JOIN outfit_pet_models opm ON opm.outfit_shop_item_id = peo.outfit_shop_item_id
           AND opm.pet_model_id = (SELECT pet_model_id FROM pet_instances WHERE id = $1)
         WHERE peo.pet_instance_id = $1
         ORDER BY peo.equip_slot`,
        [petInstanceId]
      );
      res.json({ success: true, equipped: result.rows });
    } catch (err) {
      console.error('outfit equipped error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 装备装扮
  router.post('/equip', async (req, res) => {
    const client = await pool.connect();
    try {
      const userId = req.user.userId;
      const { pet_instance_id, outfit_shop_item_id, equip_slot } = req.body;
      if (!pet_instance_id || !outfit_shop_item_id || !equip_slot) {
        return res.status(400).json({ success: false, error: 'pet_instance_id, outfit_shop_item_id, equip_slot 必填' });
      }
      const validSlots = ['hat', 'accessory', 'back', 'body'];
      if (!validSlots.includes(equip_slot)) {
        return res.status(400).json({ success: false, error: `equip_slot 必须为 ${validSlots.join('/')}` });
      }

      await client.query('BEGIN');

      // 校验宠物归属
      const pet = await client.query(
        'SELECT id, pet_model_id FROM pet_instances WHERE id = $1 AND user_id = $2 AND status != $3',
        [pet_instance_id, userId, 'merged']
      );
      if (!pet.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, error: '无权操作此宠物' });
      }
      const petModelId = pet.rows[0].pet_model_id;

      // 校验拥有该装扮
      const inv = await client.query(
        `SELECT ui.id FROM user_inventory ui
         JOIN shop_items si ON si.id = ui.item_id
         WHERE ui.user_id = $1 AND ui.item_id = $2 AND ui.quantity > 0 AND si.item_category = 'outfit'`,
        [userId, outfit_shop_item_id]
      );
      if (!inv.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '未拥有此装扮' });
      }

      // 校验装扮兼容该机伴
      const compat = await client.query(
        'SELECT id FROM outfit_pet_models WHERE outfit_shop_item_id = $1 AND pet_model_id = $2',
        [outfit_shop_item_id, petModelId]
      );
      if (!compat.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '此装扮不兼容该机伴' });
      }

      // 校验装扮的 equip_slot 匹配
      const shopItem = await client.query(
        'SELECT equip_slot FROM shop_items WHERE id = $1',
        [outfit_shop_item_id]
      );
      if (shopItem.rows[0]?.equip_slot !== equip_slot) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '装扮槽位不匹配' });
      }

      // 卸下同槽位旧装扮 (如果有)
      await client.query(
        'DELETE FROM pet_equipped_outfits WHERE pet_instance_id = $1 AND equip_slot = $2',
        [pet_instance_id, equip_slot]
      );

      // 装备新装扮
      const result = await client.query(
        `INSERT INTO pet_equipped_outfits (pet_instance_id, outfit_shop_item_id, equip_slot)
         VALUES ($1, $2, $3) RETURNING *`,
        [pet_instance_id, outfit_shop_item_id, equip_slot]
      );

      await client.query('COMMIT');
      res.json({ success: true, equipped: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('outfit equip error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // 卸下装扮
  router.post('/unequip', async (req, res) => {
    try {
      const userId = req.user.userId;
      const { pet_instance_id, equip_slot } = req.body;
      if (!pet_instance_id || !equip_slot) {
        return res.status(400).json({ success: false, error: 'pet_instance_id, equip_slot 必填' });
      }
      // 校验宠物归属
      const pet = await pool.query(
        'SELECT id FROM pet_instances WHERE id = $1 AND user_id = $2 AND status != $3',
        [pet_instance_id, userId, 'merged']
      );
      if (!pet.rows[0]) {
        return res.status(403).json({ success: false, error: '无权操作此宠物' });
      }
      const result = await pool.query(
        'DELETE FROM pet_equipped_outfits WHERE pet_instance_id = $1 AND equip_slot = $2 RETURNING *',
        [pet_instance_id, equip_slot]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ success: false, error: '该槽位无装扮' });
      }
      res.json({ success: true, unequipped: result.rows[0] });
    } catch (err) {
      console.error('outfit unequip error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 兼容某机伴的装扮列表 (商店过滤用)
  router.get('/compatible/:petModelId', async (req, res) => {
    try {
      const petModelId = parseInt(req.params.petModelId);
      const result = await pool.query(
        `SELECT si.id, si.name, si.image_url, si.description, si.equip_slot, si.price_emotion,
                si.price_real, si.shop_tab,
                opm.animations, opm.anchor_override
         FROM outfit_pet_models opm
         JOIN shop_items si ON si.id = opm.outfit_shop_item_id
         WHERE opm.pet_model_id = $1
         ORDER BY si.equip_slot, si.name`,
        [petModelId]
      );
      res.json({ success: true, outfits: result.rows });
    } catch (err) {
      console.error('outfit compatible error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
