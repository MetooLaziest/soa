/**
 * 用户设置路由
 * GET  /api/epet1/user/settings/:userId     - 获取用户设置
 * POST /api/epet1/user/settings/:userId     - 更新用户设置
 * GET  /api/epet1/pet/videos/:petModelId    - 获取机伴所有时间段视频
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 获取用户设置
  router.get('/settings/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(
        `SELECT home_mode, updated_at FROM user_settings WHERE user_id = $1`,
        [userId]
      );
      if (result.rows.length === 0) {
        // 默认设置
        return res.json({ 
          success: true, 
          settings: { home_mode: 'yard', updated_at: null }
        });
      }
      res.json({ success: true, settings: result.rows[0] });
    } catch (err) {
      console.error('get user settings error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 更新用户设置
  router.post('/settings/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { home_mode } = req.body;
      
      if (!home_mode || !['yard', 'live'].includes(home_mode)) {
        return res.status(400).json({ 
          success: false, 
          error: 'home_mode 必须是 yard 或 live' 
        });
      }

      await pool.query(
        `INSERT INTO user_settings (user_id, home_mode, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET home_mode = $2, updated_at = NOW()`,
        [userId, home_mode]
      );
      
      res.json({ success: true, settings: { home_mode } });
    } catch (err) {
      console.error('update user settings error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 获取机伴所有时间段视频
  router.get('/pet/videos/:petModelId', async (req, res) => {
    try {
      const { petModelId } = req.params;
      const { growth_level = 0 } = req.query;
      
      const result = await pool.query(
        `SELECT id, name, time_start, time_end, growth_level, 
                video_url, duration_sec, sort_order
         FROM intro_videos
         WHERE pet_model_id = $1 
           AND is_active = true
           AND (growth_level = $2 OR growth_level = 0)
         ORDER BY sort_order, time_start`,
        [petModelId, growth_level]
      );
      
      res.json({ success: true, videos: result.rows });
    } catch (err) {
      console.error('get pet videos error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
