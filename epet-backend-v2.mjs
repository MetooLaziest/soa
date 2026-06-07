import express from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.EPET_DB_URL || 'postgresql://postgres:postgres@localhost/epet'
});

// 计算实时饥饿度（基于时间衰减）
function calcHunger(lastInteractAt) {
  if (!lastInteractAt) return 100;
  
  const now = new Date();
  const last = new Date(lastInteractAt);
  const diffMs = now - last;
  const diffMinutes = diffMs / (1000 * 60);
  
  // 每10分钟衰减 (100/144) ≈ 0.694
  const decay = (diffMinutes / 10) * (100 / 144);
  const hunger = Math.max(0, 100 - decay);
  
  return Math.round(hunger * 100) / 100;
}

// GET /api/epet/:id - 获取或自动创建宠物
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 尝试查询宠物
    let result = await pool.query(
      'SELECT * FROM pets WHERE pet_id = $1',
      [id]
    );
    
    // 如果不存在，自动创建（NFC首次访问）
    if (result.rows.length === 0) {
      await pool.query(
        'INSERT INTO pets (pet_id, hunger, last_interact_at) VALUES ($1, $2, NOW())',
        [id, 100]
      );
      
      result = await pool.query(
        'SELECT * FROM pets WHERE pet_id = $1',
        [id]
      );
    }
    
    const pet = result.rows[0];
    
    // 计算实时饥饿度
    const currentHunger = calcHunger(pet.last_interact_at);
    
    res.json({
      success: true,
      pet: {
        id: pet.pet_id,
        hunger: currentHunger,
        totalFeeds: pet.total_feeds,
        totalPoops: pet.total_poops,
        totalPets: pet.total_pets,
        lastInteractAt: pet.last_interact_at,
        createdAt: pet.created_at
      }
    });
  } catch (err) {
    console.error('Error in GET /:id:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/epet/:id/feed - 喂食
router.post('/:id/feed', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE pets 
       SET hunger = 100, 
           total_feeds = total_feeds + 1, 
           last_feed_at = NOW(),
           last_interact_at = NOW()
       WHERE pet_id = $1 
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }
    
    res.json({ success: true, message: 'Fed successfully' });
  } catch (err) {
    console.error('Error in POST /:id/feed:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/epet/:id/pet - 抚摸
router.post('/:id/pet', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE pets 
       SET total_pets = total_pets + 1, 
           last_interact_at = NOW()
       WHERE pet_id = $1 
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }
    
    res.json({ success: true, message: 'Petted successfully' });
  } catch (err) {
    console.error('Error in POST /:id/pet:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/epet/:id/clean - 铲屎
router.post('/:id/clean', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE pets 
       SET total_poops = total_poops + 1, 
           last_poop_at = NOW(),
           last_interact_at = NOW()
       WHERE pet_id = $1 
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }
    
    res.json({ success: true, message: 'Cleaned successfully' });
  } catch (err) {
    console.error('Error in POST /:id/clean:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;