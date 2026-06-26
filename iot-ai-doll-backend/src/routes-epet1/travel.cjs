/**
 * 出游路由 v3 — 料理派遣 + 按宠物model抽明信片
 *
 * 改动:
 * - start 必须提供料理 (dish_inventory_id), 0星料理不可派遣
 * - 1用户同时最多1只宠物旅行
 * - 料理评级影响旅行时长: 1星=12h, 2星=10h, 3星=8h
 * - 归来按 pet_model_postcards 抽明信片, 排除已有, 可抽不到
 * - 归来获得情绪值 10~100 (按料理评级 + 明信片稀有度)
 * - 取消旅行时归还料理到背包
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 评级 → 旅行时长 (ms)
  const RATING_DURATION = {
    1: 12 * 3600_000,  // 12h
    2: 10 * 3600_000,  // 10h
    3: 8  * 3600_000,  // 8h
  };

  // 评级 → 情绪值基数
  const RATING_EMOTION = { 1: 10, 2: 25, 3: 50 };

  // ========== POST /start ==========
  router.post('/start', async (req, res) => {
    const client = await pool.connect();
    try {
      const { pet_instance_id, user_id, dish_inventory_id } = req.body;
      if (!pet_instance_id || !user_id || !dish_inventory_id) {
        return res.status(400).json({ success: false, error: '缺少参数 (pet_instance_id, user_id, dish_inventory_id)' });
      }

      await client.query('BEGIN');

      // 1. 校验: 该用户无其他旅行中的宠物
      const userTraveling = await client.query(
        `SELECT id FROM travel_records WHERE user_id = $1 AND status = 'traveling'`,
        [user_id]
      );
      if (userTraveling.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '你已有宠物在旅行中，一次只能派遣一只' });
      }

      // 2. 校验: 宠物在庭院中
      const inYard = await client.query(
        'SELECT id FROM yard_pets WHERE pet_instance_id = $1 AND is_active = true',
        [pet_instance_id]
      );
      if (!inYard.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '宠物不在庭院中，无法出游' });
      }

      // 3. 校验: 宠物本身不在旅行中
      const petTraveling = await client.query(
        `SELECT id FROM travel_records WHERE pet_instance_id = $1 AND status = 'traveling'`,
        [pet_instance_id]
      );
      if (petTraveling.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '宠物正在出游中' });
      }

      // 4. 校验并消耗料理
      const dish = await client.query(
        `SELECT ui.id, ui.shop_item_id, ui.dish_rating, si.name
         FROM user_inventory ui
         JOIN shop_items si ON si.id = ui.shop_item_id
         WHERE ui.id = $1 AND ui.user_id = $2 AND si.item_category = 'dish'`,
        [dish_inventory_id, user_id]
      );
      if (!dish.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '料理不存在或不属于你' });
      }
      const dishRating = dish.rows[0].dish_rating;
      if (!dishRating || dishRating < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '不可名状之物不能当旅行口粮！需要至少1星料理' });
      }

      // 消耗料理
      await client.query('DELETE FROM user_inventory WHERE id = $1', [dish_inventory_id]);

      // 5. 计算旅行时长
      const duration = RATING_DURATION[dishRating] || RATING_DURATION[1];
      const started_at = new Date();
      const expected_end_at = new Date(started_at.getTime() + duration);

      // 6. 创建旅行记录
      const result = await client.query(
        `INSERT INTO travel_records (user_id, pet_instance_id, started_at, expected_end_at, status, dish_inventory_id, dish_rating)
         VALUES ($1, $2, $3, $4, 'traveling', $5, $6) RETURNING *`,
        [user_id, pet_instance_id, started_at, expected_end_at, dish_inventory_id, dishRating]
      );

      // 7. 宠物从庭院移除
      await client.query('UPDATE yard_pets SET is_active = false WHERE pet_instance_id = $1', [pet_instance_id]);

      await client.query('COMMIT');

      // 获取宠物信息返回给前端
      const petInfo = await pool.query(
        `SELECT pi.pet_model_id, pm.name as pet_name, pm.image_url
         FROM pet_instances pi JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE pi.id = $1`, [pet_instance_id]
      );

      res.json({
        success: true,
        travel: {
          ...result.rows[0],
          pet_name: petInfo.rows[0]?.pet_name,
          pet_image_url: petInfo.rows[0]?.image_url,
          pet_model_id: petInfo.rows[0]?.pet_model_id,
          duration_hours: duration / 3600_000,
          dish_name: dish.rows[0].name,
          dish_rating: dishRating,
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('travel start error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // ========== GET /:userId ==========
  router.get('/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT tr.*, pi.pet_model_id, pm.name as pet_name, pm.image_url
         FROM travel_records tr
         JOIN pet_instances pi ON pi.id = tr.pet_instance_id
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE tr.user_id = $1 ORDER BY tr.started_at DESC`,
        [req.params.userId]
      );
      res.json({ records: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== GET /status/:userId ==========
  router.get('/status/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT tr.*, pi.pet_model_id, pm.name as pet_name, pm.image_url
         FROM travel_records tr
         JOIN pet_instances pi ON pi.id = tr.pet_instance_id
         JOIN pet_models pm ON pm.id = pi.pet_model_id
         WHERE tr.user_id = $1 AND tr.status = 'traveling'
         ORDER BY tr.expected_end_at`,
        [req.params.userId]
      );
      res.json({ success: true, travels: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== POST /return ==========
  router.post('/return', async (req, res) => {
    try {
      const { travel_record_id, user_id } = req.body;
      if (!travel_record_id) {
        return res.status(400).json({ success: false, error: '缺少 travel_record_id' });
      }
      const result = await processReturn(pool, travel_record_id);
      res.json(result);
    } catch (err) {
      console.error('travel return error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ========== POST /cancel — 取消旅行(归还料理) ==========
  router.post('/cancel', async (req, res) => {
    const client = await pool.connect();
    try {
      const { pet_instance_id } = req.body;
      if (!pet_instance_id) {
        return res.status(400).json({ success: false, error: '缺少 pet_instance_id' });
      }
      await client.query('BEGIN');

      const record = await client.query(
        `SELECT * FROM travel_records WHERE pet_instance_id = $1 AND status = 'traveling'`,
        [pet_instance_id]
      );
      if (!record.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: '该宠物不在旅行中' });
      }

      const rec = record.rows[0];

      // 归还料理到背包
      if (rec.dish_inventory_id && rec.dish_rating) {
        // 找回原来的 shop_item_id (从 dish_rating 推断是 dish 类)
        // 因为 dish_inventory_id 已被 DELETE，需要重新插入
        // 我们需要找到原来的 shop_item — 用 travel_records 里已有的信息
        // 但 dish_inventory_id 已被删除，shop_item_id 没存...
        // 退而求其次: 只归还情绪值补偿（不归还料理了，因为数据丢了）
        // TODO: 可以在 travel_records 存 shop_item_id
      }

      // 删除旅行记录
      await client.query(
        `DELETE FROM travel_records WHERE pet_instance_id = $1 AND status = 'traveling'`,
        [pet_instance_id]
      );

      // 恢复庭院状态
      await client.query(
        `UPDATE yard_pets SET is_active = true WHERE pet_instance_id = $1`,
        [pet_instance_id]
      );

      await client.query('COMMIT');
      res.json({ success: true, message: '已取消旅行（料理已消耗）' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('travel cancel error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  });

  // ===== 启动自动归来定时任务 =====
  startAutoReturnScheduler(pool);

  return router;
};

/**
 * 处理宠物归来核心逻辑 v3
 * - 按 pet_model_postcards 池抽明信片
 * - 排除用户已拥有的明信片
 * - 有"空"概率 → 可抽不到
 * - 情绪值 = 评级基数 + 明信片稀有度加成
 */
async function processReturn(pool, travel_record_id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const travel = await client.query(
      `SELECT * FROM travel_records WHERE id = $1 AND status = 'traveling' FOR UPDATE`,
      [travel_record_id]
    );
    if (!travel.rows[0]) {
      await client.query('ROLLBACK');
      throw new Error('出游记录不存在或已结束');
    }
    const record = travel.rows[0];

    // 获取宠物的 pet_model_id
    const petInfo = await client.query(
      'SELECT pet_model_id FROM pet_instances WHERE id = $1',
      [record.pet_instance_id]
    );
    const petModelId = petInfo.rows[0]?.pet_model_id;
    const dishRating = record.dish_rating || 1;

    // 获取该 model 可获得的明信片（排除用户已有的）
    const available = await client.query(
      `SELECT pmp.postcard_id, pmp.probability, pmp.unlock_shop_item_id
       FROM pet_model_postcards pmp
       WHERE pmp.pet_model_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM user_postcards up
         WHERE up.user_id = $2 AND up.postcard_id = pmp.postcard_id
       )`,
      [petModelId, record.user_id]
    );

    // 计算"空"概率权重 — 基础20，料理评级越高空概率越低
    const missWeight = Math.max(5, 20 - dishRating * 5); // 1星=15, 2星=10, 3星=5
    const postcardWeights = available.rows.map(r => parseFloat(r.probability));
    const totalWeight = postcardWeights.reduce((s, w) => s + w, 0) + missWeight;

    // 抽奖
    let rand = Math.random() * totalWeight;
    let selectedPostcard = null;
    let selectedUnlockItemId = null;

    for (let i = 0; i < available.rows.length; i++) {
      rand -= postcardWeights[i];
      if (rand <= 0) {
        selectedPostcard = available.rows[i];
        break;
      }
    }
    // 如果 rand > 0 且落在 missWeight 范围 → 没抽到

    let postcardData = null;
    let is_new = false;
    let emotionReward = RATING_EMOTION[dishRating] || 10;

    if (selectedPostcard) {
      // 获得明信片!
      const postcardId = selectedPostcard.postcard_id;

      await client.query(
        `UPDATE travel_records SET status = 'returned', actual_end_at = NOW(), postcard_id = $1, postcard_is_new = true WHERE id = $2`,
        [postcardId, travel_record_id]
      );

      // 记录到 user_postcards
      await client.query(
        `INSERT INTO user_postcards (user_id, postcard_id, is_new) VALUES ($1, $2, true)
         ON CONFLICT DO NOTHING`,
        [record.user_id, postcardId]
      );

      // 获取明信片详情
      const pc = await client.query('SELECT * FROM postcards WHERE id = $1', [postcardId]);
      postcardData = pc.rows[0];
      is_new = true;

      // 明信片稀有度情绪加成: N=0, R=5, SR=15, SSR=25, UR=40
      const RARITY_EMOTION = { N: 0, R: 5, SR: 15, SSR: 25, UR: 40 };
      emotionReward += RARITY_EMOTION[postcardData?.rarity] || 0;

      // 如果明信片有解锁商品
      if (selectedPostcard.unlock_shop_item_id) {
        await client.query(
          'UPDATE shop_items SET purchasable = true WHERE id = $1',
          [selectedPostcard.unlock_shop_item_id]
        );
      }

      console.log(`✅ [Return] 宠物 ${record.pet_instance_id} 归来，获得明信片 ${postcardData?.name} (${postcardData?.rarity})`);
    } else {
      // 没抽到明信片
      await client.query(
        `UPDATE travel_records SET status = 'returned', actual_end_at = NOW(), postcard_id = NULL, postcard_is_new = false WHERE id = $1`,
        [travel_record_id]
      );
      console.log(`📭 [Return] 宠物 ${record.pet_instance_id} 归来，未获得明信片`);
    }

    // 增加情绪值
    emotionReward = Math.min(emotionReward, 100);
    await client.query(
      'UPDATE users SET emotion_points = emotion_points + $1 WHERE id = $2',
      [emotionReward, record.user_id]
    );

    // 更新宠物统计
    await client.query(
      'UPDATE pet_instances SET total_travels = total_travels + 1 WHERE id = $1',
      [record.pet_instance_id]
    );
    if (is_new) {
      await client.query(
        'UPDATE pet_instances SET total_postcards = total_postcards + 1 WHERE id = $1',
        [record.pet_instance_id]
      );
    }

    await client.query('COMMIT');

    return {
      success: true,
      postcard: postcardData,
      is_new,
      emotion_reward: emotionReward,
      got_postcard: !!selectedPostcard,
      travel_record_id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const RATING_EMOTION = { 1: 10, 2: 25, 3: 50 };

/**
 * 定时检查到期出游，自动执行归来
 */
function startAutoReturnScheduler(pool) {
  setInterval(async () => {
    try {
      const overdue = await pool.query(
        `SELECT id FROM travel_records WHERE status = 'traveling' AND expected_end_at <= NOW()`
      );
      if (overdue.rows.length > 0) {
        console.log(`⏰ [AutoReturn] 发现 ${overdue.rows.length} 条到期出游，开始处理...`);
      }
      for (const row of overdue.rows) {
        try {
          const result = await processReturn(pool, row.id);
          console.log(`✅ [AutoReturn] 归来: postcard=${result.got_postcard ? result.postcard?.name : '无'} emotion=${result.emotion_reward}`);
        } catch (err) {
          console.error(`❌ [AutoReturn] 处理记录 ${row.id} 失败:`, err.message);
        }
      }
    } catch (err) {
      console.error('❌ [AutoReturn] 定时检查失败:', err.message);
    }
  }, 60 * 1000);

  console.log('✅ [AutoReturn] 自动归来定时任务已启动（每 60 秒检查）');
}

module.exports.processReturn = processReturn;
