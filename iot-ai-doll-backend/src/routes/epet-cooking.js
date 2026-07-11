import express from 'express';
import { poolEpet1 } from '../lib/db.js';

const router = express.Router();

// ─── 用户接口 ────────────────────────────────────────

// GET /api/epet1/cooking/methods - 获取所有烹饪方式
router.get('/methods', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      `SELECT id, name, description, kitchen_bg_url, page_bg_url, cook_btn_url,
              img_empty, img_loaded, img_0, img_1, img_2, img_3, img_4, img_5,
              sort_order
       FROM cooking_methods
       WHERE is_active = true
       ORDER BY sort_order`
    );
    res.json({ ok: true, methods: rows });
  } catch (err) {
    console.error('[cooking] methods error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/cooking/cook - 提交料理
router.post('/cook', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const { user_id, method_id, ingredients, rating } = req.body;
    if (!user_id || !method_id || !Array.isArray(ingredients) || ingredients.length < 2) {
      return res.status(400).json({ error: '参数不完整（至少2种食材）' });
    }
    if (ingredients.length > 3) {
      return res.status(400).json({ error: '最多3种食材' });
    }

    // rating: 3=完美, 2=不错, 1=还行, 0=失败(焦炭) → 产出不可名状之物
    const ratingLevel = typeof rating === 'number' ? rating : 1;
    const ratingNames = { 3: '完美', 2: '不错', 1: '还行', 0: '失败' };

    await client.query('BEGIN');

    // 1. 校验并扣减食材
    for (const ing of ingredients) {
      const { rows: invRows } = await client.query(
        'SELECT id, quantity FROM user_inventory WHERE user_id = $1 AND shop_item_id = $2 AND item_category = $3',
        [user_id, ing.shop_item_id, 'food']
      );
      if (invRows.length === 0 || invRows[0].quantity < (ing.quantity || 1)) {
        await client.query('ROLLBACK');
        return res.json({ ok: false, error: `食材不足（shop_item_id=${ing.shop_item_id}）` });
      }
      const newQty = invRows[0].quantity - (ing.quantity || 1);
      if (newQty <= 0) {
        await client.query('DELETE FROM user_inventory WHERE id = $1', [invRows[0].id]);
      } else {
        await client.query('UPDATE user_inventory SET quantity = $1 WHERE id = $2', [newQty, invRows[0].id]);
      }
    }

    // 2. 如果是失败(焦炭)，直接产出不可名状之物
    if (ratingLevel === 0) {
      const { rows: monsterRows } = await client.query(
        "SELECT id FROM shop_items WHERE name = '不可名状之物' AND item_category = 'dish' LIMIT 1"
      );
      if (monsterRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: '未配置不可名状之物' });
      }
      const dishShopItemId = monsterRows[0].id;
      await _addDishToInventory(client, user_id, dishShopItemId, ratingLevel);
      await client.query('COMMIT');

      const { rows: dishInfo } = await poolEpet1.query(
        'SELECT id, name, image_url, description FROM shop_items WHERE id = $1', [dishShopItemId]
      );
      return res.json({
        ok: true,
        dish: {
          name: dishInfo[0]?.name || '不可名状之物',
          image_url: dishInfo[0]?.image_url || '',
          description: dishInfo[0]?.description || '',
          rating: ratingLevel,
          rating_name: ratingNames[0],
        },
      });
    }

    // 3. 查菜谱匹配（精确匹配：食材种类和数量必须完全一致）
    // 先找该烹饪方式下的所有菜谱
    const { rows: recipes } = await client.query(
      'SELECT id, name, description, image_url, dish_shop_item_id FROM cooking_recipes WHERE cooking_method_id = $1 AND is_active = true',
      [method_id]
    );

    let matchedRecipe = null;
    for (const recipe of recipes) {
      const { rows: reqIngs } = await client.query(
        'SELECT ingredient_shop_item_id, quantity FROM cooking_recipe_ingredients WHERE recipe_id = $1',
        [recipe.id]
      );

      // 精确匹配：数量相同 + 每种食材/数量都匹配
      if (reqIngs.length !== ingredients.length) continue;

      let match = true;
      for (const reqIng of reqIngs) {
        const userIng = ingredients.find(
          i => String(i.shop_item_id) === String(reqIng.ingredient_shop_item_id) && (i.quantity || 1) === reqIng.quantity
        );
        if (!userIng) { match = false; break; }
      }
      if (match) { matchedRecipe = recipe; break; }
    }

    let dishShopItemId;
    let dishName, dishImage, dishDesc;

    if (matchedRecipe) {
      // 命中菜谱
      dishShopItemId = matchedRecipe.dish_shop_item_id;
      dishName = matchedRecipe.name;
      dishImage = matchedRecipe.image_url;
      dishDesc = matchedRecipe.description;

      // 如果菜谱没有关联 shop_item，自动创建
      if (!dishShopItemId) {
        const { rows: inserted } = await client.query(
          `INSERT INTO shop_items (name, item_type, item_category, price_emotion, image_url, description, purchasable, shop_tab)
           VALUES ($1, 'virtual', 'dish', 0, $2, $3, false, 'hidden') RETURNING id`,
          [matchedRecipe.name, matchedRecipe.image_url, matchedRecipe.description || '']
        );
        dishShopItemId = inserted[0].id;
        await client.query(
          'UPDATE cooking_recipes SET dish_shop_item_id = $1 WHERE id = $2',
          [dishShopItemId, matchedRecipe.id]
        );
      }
    } else {
      // 未命中 → 不可名状之物
      const { rows: monsterRows } = await client.query(
        "SELECT id FROM shop_items WHERE name = '不可名状之物' AND item_category = 'dish' LIMIT 1"
      );
      if (monsterRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: '未配置不可名状之物' });
      }
      dishShopItemId = monsterRows[0].id;
      dishName = '不可名状之物';
      dishImage = '';
      dishDesc = '';
    }

    // 4. 料理加入背包（含评级）
    await _addDishToInventory(client, user_id, dishShopItemId, ratingLevel);
    await client.query('COMMIT');

    // 获取 shop_item 信息
    const { rows: dishInfo } = await poolEpet1.query(
      'SELECT name, image_url, description FROM shop_items WHERE id = $1', [dishShopItemId]
    );

    res.json({
      ok: true,
      dish: {
        name: dishName || dishInfo[0]?.name || '未知料理',
        image_url: dishImage || dishInfo[0]?.image_url || '',
        description: dishDesc || dishInfo[0]?.description || '',
        rating: ratingLevel,
        rating_name: ratingNames[ratingLevel] || '还行',
        matched_recipe: !!matchedRecipe,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[cooking] cook error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 内部函数：添加料理到背包，支持评级
async function _addDishToInventory(client, userId, shopItemId, rating) {
  // 查找同 shop_item_id + 同评级的背包条目
  const { rows: existing } = await client.query(
    'SELECT id, quantity FROM user_inventory WHERE user_id = $1 AND shop_item_id = $2 AND item_category = $3 AND dish_rating = $4',
    [userId, shopItemId, 'dish', rating]
  );
  if (existing.length > 0) {
    await client.query(
      'UPDATE user_inventory SET quantity = quantity + 1 WHERE id = $1',
      [existing[0].id]
    );
  } else {
    await client.query(
      `INSERT INTO user_inventory (user_id, shop_item_id, quantity, item_category, source, dish_rating)
       VALUES ($1, $2, 1, 'dish', 'cooking', $3)`,
      [userId, shopItemId, rating]
    );
  }
}

// GET /api/epet1/cooking/ingredients - 获取可作为食材的 shop_items（food 类别）
router.get('/ingredients', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      `SELECT id, name, image_url, description, item_type
       FROM shop_items
       WHERE item_category = 'food' AND is_active = true
       ORDER BY name`
    );
    res.json({ ok: true, ingredients: rows });
  } catch (err) {
    console.error('[cooking] ingredients error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin 接口 ──────────────────────────────────────

// ===== 烹饪方式 CRUD =====

// GET /api/epet1/cooking/admin/methods
router.get('/admin/methods', async (_req, res) => {
  try {
    const { rows } = await poolEpet1.query(
      'SELECT * FROM cooking_methods ORDER BY sort_order'
    );
    res.json({ ok: true, methods: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/cooking/admin/methods
router.post('/admin/methods', async (req, res) => {
  try {
    const { name, description, kitchen_bg_url, page_bg_url, cook_btn_url, img_empty, img_loaded,
            img_0, img_1, img_2, img_3, img_4, img_5, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: '缺少名称' });
    const { rows: inserted } = await poolEpet1.query(
      `INSERT INTO cooking_methods (name, description, kitchen_bg_url, page_bg_url, cook_btn_url,
        img_empty, img_loaded, img_0, img_1, img_2, img_3, img_4, img_5, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [name, description || '', kitchen_bg_url || '', page_bg_url || '', cook_btn_url || '',
       img_empty || '', img_loaded || '',
       img_0 || '', img_1 || '', img_2 || '', img_3 || '', img_4 || '', img_5 || '',
       sort_order || 0]
    );
    res.json({ ok: true, method: inserted[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/epet1/cooking/admin/methods/:id
router.put('/admin/methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'kitchen_bg_url', 'page_bg_url', 'cook_btn_url', 'img_empty', 'img_loaded',
      'img_0', 'img_1', 'img_2', 'img_3', 'img_4', 'img_5', 'sort_order', 'is_active'];
    const sets = [];
    const vals = [];
    let idx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`"${f}" = $${idx++}`);
        vals.push(req.body[f]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: '无更新字段' });
    vals.push(id);
    const { rows: updated } = await poolEpet1.query(
      `UPDATE cooking_methods SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!updated.length) return res.status(404).json({ error: '不存在' });
    res.json({ ok: true, method: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/epet1/cooking/admin/methods/:id
router.delete('/admin/methods/:id', async (req, res) => {
  try {
    await poolEpet1.query('UPDATE cooking_methods SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 菜谱 CRUD =====

// GET /api/epet1/cooking/admin/recipes
router.get('/admin/recipes', async (_req, res) => {
  try {
    const { rows: recipes } = await poolEpet1.query(
      `SELECT r.*, m.name as method_name
       FROM cooking_recipes r
       LEFT JOIN cooking_methods m ON m.id = r.cooking_method_id
       ORDER BY r.cooking_method_id, r.sort_order`
    );
    // 附带食材
    for (const recipe of recipes) {
      const { rows: ings } = await poolEpet1.query(
        `SELECT cri.*, si.name as ingredient_name, si.image_url as ingredient_image
         FROM cooking_recipe_ingredients cri
         JOIN shop_items si ON si.id = cri.ingredient_shop_item_id
         WHERE cri.recipe_id = $1`,
        [recipe.id]
      );
      recipe.ingredients = ings;
    }
    res.json({ ok: true, recipes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/epet1/cooking/admin/recipes
router.post('/admin/recipes', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const { cooking_method_id, name, description, image_url, sort_order, ingredients } = req.body;
    if (!cooking_method_id || !name) return res.status(400).json({ error: '缺少烹饪方式或名称' });
    if (!Array.isArray(ingredients) || ingredients.length < 2) return res.status(400).json({ error: '至少2种食材' });

    await client.query('BEGIN');

    // 自动创建 shop_item
    const { rows: shopInserted } = await client.query(
      `INSERT INTO shop_items (name, item_type, item_category, price_emotion, image_url, description, purchasable, shop_tab)
       VALUES ($1, 'virtual', 'dish', 0, $2, $3, false, 'hidden') RETURNING id`,
      [name, image_url || '', description || '']
    );
    const dishShopItemId = shopInserted[0].id;

    const { rows: inserted } = await client.query(
      `INSERT INTO cooking_recipes (cooking_method_id, name, description, image_url, dish_shop_item_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [cooking_method_id, name, description || '', image_url || '', dishShopItemId, sort_order || 0]
    );

    const recipeId = inserted[0].id;
    for (const ing of ingredients) {
      await client.query(
        `INSERT INTO cooking_recipe_ingredients (recipe_id, ingredient_shop_item_id, quantity)
         VALUES ($1, $2, $3)`,
        [recipeId, ing.shop_item_id, ing.quantity || 1]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, recipe: inserted[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/epet1/cooking/admin/recipes/:id
router.put('/admin/recipes/:id', async (req, res) => {
  const client = await poolEpet1.connect();
  try {
    const { id } = req.params;
    const { cooking_method_id, name, description, image_url, sort_order, is_active, ingredients } = req.body;

    await client.query('BEGIN');

    // 更新菜谱基本信息
    const fields = ['cooking_method_id', 'name', 'description', 'image_url', 'sort_order', 'is_active'];
    const sets = [];
    const vals = [];
    let idx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`"${f}" = $${idx++}`);
        vals.push(req.body[f]);
      }
    }
    if (sets.length > 0) {
      vals.push(id);
      await client.query(
        `UPDATE cooking_recipes SET ${sets.join(', ')} WHERE id = $${idx}`,
        vals
      );
    }

    // 如果提供了 ingredients，替换食材列表
    if (Array.isArray(ingredients)) {
      await client.query('DELETE FROM cooking_recipe_ingredients WHERE recipe_id = $1', [id]);
      for (const ing of ingredients) {
        await client.query(
          `INSERT INTO cooking_recipe_ingredients (recipe_id, ingredient_shop_item_id, quantity)
           VALUES ($1, $2, $3)`,
          [id, ing.shop_item_id, ing.quantity || 1]
        );
      }
    }

    // 同步更新关联的 shop_item
    if (name || image_url || description) {
      const { rows: recipe } = await client.query('SELECT dish_shop_item_id FROM cooking_recipes WHERE id = $1', [id]);
      if (recipe[0]?.dish_shop_item_id) {
        const shopSets = [];
        const shopVals = [];
        let si = 1;
        if (name) { shopSets.push(`name = $${si++}`); shopVals.push(name); }
        if (image_url) { shopSets.push(`image_url = $${si++}`); shopVals.push(image_url); }
        if (description) { shopSets.push(`description = $${si++}`); shopVals.push(description); }
        if (shopSets.length) {
          shopVals.push(recipe[0].dish_shop_item_id);
          await client.query(`UPDATE shop_items SET ${shopSets.join(', ')} WHERE id = $${si}`, shopVals);
        }
      }
    }

    await client.query('COMMIT');
    const { rows: updated } = await poolEpet1.query('SELECT * FROM cooking_recipes WHERE id = $1', [id]);
    res.json({ ok: true, recipe: updated[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/epet1/cooking/admin/recipes/:id
router.delete('/admin/recipes/:id', async (req, res) => {
  try {
    await poolEpet1.query('UPDATE cooking_recipes SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
