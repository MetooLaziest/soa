import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'iot_doll',
  user: 'postgres',
  password: 'iot2026pass'
});

const router = express.Router();

// GET /api/admin/chat-styles - 列表
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chat_styles ORDER BY mbti');
    res.json({ success: true, styles: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/admin/chat-styles/:id - 单条
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chat_styles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, style: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/admin/chat-styles - 新建
router.post('/', async (req, res) => {
  const { mbti, name, description } = req.body;
  if (!mbti || !name || !description) return res.status(400).json({ success: false, error: 'Missing fields' });
  try {
    const result = await pool.query(
      'INSERT INTO chat_styles (mbti, name, description) VALUES ($1, $2, $3) RETURNING *',
      [mbti.toUpperCase(), name, description]
    );
    res.json({ success: true, style: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/admin/chat-styles/:id - 更新
router.put('/:id', async (req, res) => {
  const { mbti, name, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE chat_styles SET mbti=$1, name=$2, description=$3 WHERE id=$4 RETURNING *',
      [mbti?.toUpperCase(), name, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, style: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/admin/chat-styles/:id - 删除
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM chat_styles WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
