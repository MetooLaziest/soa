import express from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.EPET_DB_URL || 'postgresql://postgres:postgres@localhost/epet'
});

function calcHunger(lastInteract) {
  if (!lastInteract) return 100;
  const diff = (Date.now() - new Date(lastInteract)) / (1000 * 60);
  const decay = Math.floor(diff / 10) * (100 / 144);
  return Math.max(0, 100 - decay);
}

// GET /api/epet/:id - 获取或创建宠物
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先查是否存在
    let result = await pool.query('SELECT * FROM pets WHERE pet_id = $1', [id]);
    
    // 不存在则创建
    if (result.rows.length === 0) {
      await pool.query('INSERT INTO pets (pet_id, hunger) VALUES ($1, $2)', [id, 100]);
      result = await pool.query('SELECT * FROM pets WHERE pet_id = $1', [id]);
    }
    
    const pet = result.rows[0];
    res.json({
      success: true,
      pet: {
        petId: pet.pet_id,
        hunger: calcHunger(pet.last_interact_at),
        totalFeeds: pet.total_feeds,
        totalPoops: pet.total_poops,
        totalPets: pet.total_pets,
        lastFeedAt: pet.last_feed_at,
        lastPoopAt: pet.last_poop_at,
        createdAt: pet.created_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/epet/:id/feed - 喂食
router.post('/:id/feed', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE pets SET hunger = 100, total_feeds = total_feeds + 1, last_feed_at = NOW(), last_interact_at = NOW() WHERE pet_id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }
    res.json({ success: true, message: 'Fed!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/epet/:id/pet - 抚摸
router.post('/:id/pet', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE pets SET total_pets = total_pets + 1, last_interact_at = NOW() WHERE pet_id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }
    res.json({ success: true, message: 'Petted!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/epet/:id/clean - 铲屎
router.post('/:id/clean', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE pets SET total_poops = total_poops + 1, last_poop_at = NOW(), last_interact_at = NOW() WHERE pet_id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }
    res.json({ success: true, message: 'Cleaned!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;