/**
 * E-Pet 宠物旅行模块
 * POST /api/epet/travel/start    — 开始旅行
 * GET  /api/epet/travel/:nfc    — 查询宠物旅行状态
 * POST /api/epet/travel/:nfc/cancel — 取消旅行
 */
import express from 'express';
const router = express.Router();

export default (pool) => {

  // POST /api/epet/travel/start — 派宠物去旅行
  router.post('/start', async (req, res) => {
    try {
      const { nfc } = req.body;
      if (!nfc) return res.status(400).json({ success: false, error: '缺少 nfc 参数' });

      const pet = await pool.query('SELECT nfc, display_name, is_traveling FROM pets WHERE nfc = $1', [nfc]);
      if (!pet.rows.length) return res.status(404).json({ success: false, error: '宠物不存在' });
      if (pet.rows[0].is_traveling) return res.status(400).json({ success: false, error: '宠物正在旅行中' });

      const destinations = [
        '🏔️ 雪山顶峰', '🏖️ 阳光海滩', '🌲 魔法森林', '🏙️ 霓虹都市',
        '🌸 樱花小镇', '🌙 星空营地', '🌈 彩虹乐园', '🍃 清风草原',
        '🗼 水晶高塔', '🌋 火山温泉'
      ];
      const destination = destinations[Math.floor(Math.random() * destinations.length)];
      const startedAt = new Date();
      const returnsAt = new Date(startedAt.getTime() + 12 * 60 * 60 * 1000);

      await pool.query(`
        UPDATE pets
        SET is_traveling = true,
            travel_started_at = $1,
            travel_returns_at = $2,
            travel_destination = $3
        WHERE nfc = $4
      `, [startedAt, returnsAt, destination, nfc]);

      res.json({
        success: true,
        record: {
          nfc,
          pet_nickname: pet.rows[0].display_name,
          destination,
          started_at: startedAt.toISOString(),
          returns_at: returnsAt.toISOString(),
          status: 'traveling'
        }
      });
    } catch (err) {
      console.error('travel/start error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/epet/travel/:nfc — 查询旅行状态（含自动归来检测）
  router.get('/:nfc', async (req, res) => {
    try {
      const { nfc } = req.params;
      const pet = await pool.query(
        `SELECT nfc, display_name, is_traveling, travel_started_at,
                travel_returns_at, travel_destination
         FROM pets WHERE nfc = $1`, [nfc]
      );
      if (!pet.rows.length) return res.status(404).json({ success: false, error: '宠物不存在' });

      const p = pet.rows[0];
      if (p.is_traveling && p.travel_returns_at && new Date() >= new Date(p.travel_returns_at)) {
        await pool.query(
          `UPDATE pets SET is_traveling=false, travel_started_at=NULL,
           travel_returns_at=NULL, travel_destination=NULL WHERE nfc=$1`, [nfc]
        );
        p.is_traveling = false;
      }

      const records = [];
      if (p.is_traveling) {
        records.push({
          status: 'traveling',
          nfc: p.nfc,
          pet_nickname: p.display_name,
          destination: p.travel_destination,
          started_at: p.travel_started_at,
          returns_at: p.travel_returns_at,
          remaining_ms: Math.max(0, new Date(p.travel_returns_at).getTime() - Date.now())
        });
      }
      res.json({ success: true, records });
    } catch (err) {
      console.error('travel/:nfc error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/epet/travel/:nfc/cancel — 取消旅行
  router.post('/:nfc/cancel', async (req, res) => {
    try {
      const { nfc } = req.params;
      const pet = await pool.query('SELECT nfc, display_name, is_traveling FROM pets WHERE nfc = $1', [nfc]);
      if (!pet.rows.length) return res.status(404).json({ success: false, error: '宠物不存在' });
      if (!pet.rows[0].is_traveling) return res.status(400).json({ success: false, error: '宠物不在旅行中' });

      await pool.query(`
        UPDATE pets SET is_traveling=false, travel_started_at=NULL,
         travel_returns_at=NULL, travel_destination=NULL WHERE nfc=$1
      `, [nfc]);

      res.json({ success: true, message: pet.rows[0].display_name + ' 已取消旅行' });
    } catch (err) {
      console.error('travel/cancel error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
