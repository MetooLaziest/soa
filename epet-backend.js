const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:@localhost/iot_doll'
});

// 生成随机 ID
function generatePetId() {
  return crypto.randomBytes(4).toString('hex');
}

// 计算当前饥饿度
function calcHunger(lastInteract) {
  if (!lastInteract) return 100;
  const now = new Date();
  const diff = (now - new Date(lastInteract)) / (1000 * 60);
  const decay = Math.floor(diff / 10) * (100 / 144);
  return Math.max(0, 100 - decay);
}

// GET /epet/init - 初始化宠物
router.get('/init', async (req, res) => {
  try {
    const petId = generatePetId();
    await pool.query(
      'INSERT INTO pets (pet_id, hunger) VALUES ($1, $2)',
      [petId, 100]
    );
    res.json({ success: true, petId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /epet/:id - 获取宠物状态
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM pets WHERE pet_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
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

// POST /epet/:id/feed - 喂食
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
    res.json({ success: true, message: 'Pet fed!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /epet/:id/pet - 抚摸
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
    res.json({ success: true, message: 'Pet petted!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /epet/:id/clean - 铲屎
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

module.exports = router;