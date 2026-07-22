/**
 * 情绪值掉落 API
 * GET  /api/epet1/emotion-drops?user_id=X   — 获取未收取掉落（含懒生成）
 * POST /api/epet1/emotion-drops/:id/collect  — 收取单个掉落
 */
module.exports = (pool) => {
  const router = require('express').Router();
  const MAX_DROPS = 10;

  /**
   * 计算用户当前情绪值加成百分比
   * bonus = SUM(shop_items.emotion_bonus_pct) WHERE 已放置家具
   */
  async function calcBonusPct(userId) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(si.emotion_bonus_pct), 0) AS bonus
       FROM yard_furniture yf
       JOIN shop_items si ON si.id = yf.shop_item_id
       WHERE yf.user_id = $1`,
      [userId]
    );
    return parseFloat(rows[0].bonus) || 0;
  }

  /**
   * 获取用户 walk_bounds（用于随机位置）
   */
  async function getWalkBounds(userId) {
    const { rows } = await pool.query(
      `SELECT walk_bounds FROM yard_zones WHERE is_default = true LIMIT 1`
    );
    if (rows.length > 0) {
      const wb = typeof rows[0].walk_bounds === 'string' ? JSON.parse(rows[0].walk_bounds) : rows[0].walk_bounds;
      return wb;
    }
    return { xMin: 0.02, xMax: 0.98, yMin: 0.02, yMax: 0.98 };
  }

  /**
   * 懒生成：根据 last_emotion_drop_at，补生成遗漏的小时掉落
   */
  async function lazyGenerate(userId) {
    // 获取用户 last_emotion_drop_at
    const userRes = await pool.query(
      'SELECT last_emotion_drop_at FROM users WHERE id = $1',
      [userId]
    );
    if (!userRes.rows.length) return;

    const lastDrop = userRes.rows[0].last_emotion_drop_at;

    // 当前未收取数量
    const cntRes = await pool.query(
      'SELECT count(*) AS cnt FROM yard_emotion_drops WHERE user_id = $1 AND collected_at IS NULL',
      [userId]
    );
    const currentCount = parseInt(cntRes.rows[0].cnt);

    // 计算应生成的数量
    const now = new Date();
    let lastHour;
    if (lastDrop) {
      lastHour = new Date(lastDrop);
      // 向上取整到下一个整点
      lastHour.setMinutes(0, 0, 0);
      lastHour.setHours(lastHour.getHours() + 1);
    } else {
      // 首次，设为当前整点前1小时，只生成1个
      lastHour = new Date(now);
      lastHour.setMinutes(0, 0, 0);
    }

    let toGenerate = 0;
    const cursor = new Date(lastHour);
    while (cursor <= now && (currentCount + toGenerate) < MAX_DROPS) {
      toGenerate++;
      cursor.setHours(cursor.getHours() + 1);
    }

    if (toGenerate <= 0) return;

    // 计算金额
    const baseRes = await pool.query(
      "SELECT value FROM shop_config WHERE key = 'emotion_drop_base'"
    );
    const base = parseInt(baseRes.rows?.[0]?.value) || 10;
    const bonusPct = await calcBonusPct(userId);
    const amount = Math.floor(base * (1 + bonusPct / 100));

    // 获取 walk_bounds
    const wb = await getWalkBounds(userId);

    // 批量插入
    const inserts = [];
    for (let i = 0; i < toGenerate; i++) {
      const px = (wb.xMin + Math.random() * (wb.xMax - wb.xMin)).toFixed(6);
      const py = (wb.yMin + Math.random() * (wb.yMax - wb.yMin)).toFixed(6);
      inserts.push(pool.query(
        'INSERT INTO yard_emotion_drops (user_id, pos_x, pos_y, amount) VALUES ($1, $2, $3, $4)',
        [userId, px, py, amount]
      ));
    }
    await Promise.all(inserts);

    // 更新 last_emotion_drop_at 到当前整点
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);
    await pool.query(
      'UPDATE users SET last_emotion_drop_at = $1 WHERE id = $2',
      [currentHour.toISOString(), userId]
    );
  }

  // GET /api/epet1/emotion-drops?user_id=X
  router.get('/', async (req, res) => {
    try {
      const userId = req.user.userId;

      // 懒生成
      await lazyGenerate(userId);

      // 查询未收取的掉落
      const { rows } = await pool.query(
        'SELECT id, pos_x, pos_y, amount, created_at FROM yard_emotion_drops WHERE user_id = $1 AND collected_at IS NULL ORDER BY created_at',
        [userId]
      );
      res.json({ ok: true, drops: rows });
    } catch (err) {
      console.error('emotion-drops list error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // POST /api/epet1/emotion-drops/:id/collect
  router.post('/:id/collect', async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const user_id = req.user.userId;

      await client.query('BEGIN');

      // 获取掉落记录
      const dropRes = await client.query(
        'SELECT * FROM yard_emotion_drops WHERE id = $1 AND user_id = $2 AND collected_at IS NULL',
        [id, user_id]
      );
      if (!dropRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: '掉落不存在或已收取' });
      }

      const drop = dropRes.rows[0];

      // 标记已收取
      await client.query(
        'UPDATE yard_emotion_drops SET collected_at = now() WHERE id = $1',
        [id]
      );

      // 增加情绪值
      const updRes = await client.query(
        'UPDATE users SET emotion_points = emotion_points + $1, updated_at = now() WHERE id = $2 RETURNING emotion_points',
        [drop.amount, user_id]
      );

      await client.query('COMMIT');
      res.json({
        ok: true,
        amount: drop.amount,
        new_emotion_points: updRes.rows[0].emotion_points,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('emotion-drops collect error:', err);
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};
