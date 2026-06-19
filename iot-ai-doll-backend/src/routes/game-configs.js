/**
 * 小游戏配置管理 - 游戏素材分配路由
 *
 * API:
 *   GET    /api/game-configs           - 获取所有游戏配置
 *   PUT    /api/game-configs/:gameId   - 更新指定游戏的素材配置
 *   DELETE /api/game-configs/:gameId   - 删除指定游戏的素材配置
 */
import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

// 启动时确保表存在
async function ensureTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS game_configs (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(32) UNIQUE NOT NULL,
        config JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('[game-configs] ensureTable error:', err.message);
  }
}
ensureTable();

// GET /api/game-configs - 获取所有游戏配置
router.get('/', async (_req, res) => {
  try {
    const result = await query(
      'SELECT game_id, config, updated_at FROM game_configs ORDER BY game_id'
    );
    // 转成 { gameId: config } 形式
    const configs = {};
    for (const row of result.rows) {
      configs[row.game_id] = row.config;
    }
    res.json({ ok: true, configs });
  } catch (err) {
    console.error('[game-configs] GET error:', err.message);
    res.status(500).json({ error: '获取配置失败' });
  }
});

// PUT /api/game-configs/:gameId - 更新单个游戏配置
router.put('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'config 必须是对象' });
    }

    await query(`
      INSERT INTO game_configs (game_id, config, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (game_id)
      DO UPDATE SET config = $2, updated_at = CURRENT_TIMESTAMP
    `, [gameId, JSON.stringify(config)]);

    res.json({ ok: true, message: '配置已保存' });
  } catch (err) {
    console.error('[game-configs] PUT error:', err.message);
    res.status(500).json({ error: '保存配置失败' });
  }
});

// DELETE /api/game-configs/:gameId - 删除游戏配置
router.delete('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    await query('DELETE FROM game_configs WHERE game_id = $1', [gameId]);
    res.json({ ok: true, message: '配置已删除' });
  } catch (err) {
    console.error('[game-configs] DELETE error:', err.message);
    res.status(500).json({ error: '删除配置失败' });
  }
});

export default router;
