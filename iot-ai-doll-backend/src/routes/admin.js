import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

// Auth middleware for admin routes
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权' });
  }
  next();
};

// Apply auth to all admin routes
router.use(requireAuth);

// ====== Generic Query (for admin pages) ======
router.get('/query', async (req, res) => {
  try {
    const { table, select, order, limit, single } = req.query;
    
    if (!table) return res.status(400).json({ error: 'table参数必填' });

    const selectStr = select || '*';
    
    // Build WHERE from filter_* params
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(req.query)) {
      if (key.startsWith('filter_')) {
        const column = key.replace('filter_', '');
        const filterStr = value;
        const colonIdx = filterStr.indexOf(':');
        if (colonIdx > 0) {
          const op = filterStr.substring(0, colonIdx);
          const val = JSON.parse(filterStr.substring(colonIdx + 1));
          
          if (op === 'eq') {
            conditions.push(`"${column}" = $${paramIdx++}`);
            params.push(val);
          } else if (op === 'neq') {
            conditions.push(`"${column}" != $${paramIdx++}`);
            params.push(val);
          } else if (op === 'in') {
            const placeholders = val.map((_, i) => `$${paramIdx + i}`).join(',');
            conditions.push(`"${column}" IN (${placeholders})`);
            params.push(...val);
            paramIdx += val.length;
          } else if (op === 'like') {
            conditions.push(`"${column}" LIKE $${paramIdx++}`);
            params.push(val);
          }
        }
      }
    }

    // Build ORDER BY
    let orderStr = '';
    if (order) {
      const [col, dir] = order.split(':');
      orderStr = ` ORDER BY "${col}" ${dir === 'desc' ? 'DESC' : 'ASC'}`;
    }

    // Build LIMIT
    let limitStr = '';
    if (limit) {
      limitStr = ` LIMIT ${parseInt(limit)}`;
    }

    const whereStr = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT ${selectStr} FROM "${table}"${whereStr}${orderStr}${limitStr}`;
    
    const result = await query(sql, params);
    
    if (single === 'true') {
      res.json(result.rows[0] || null);
    } else {
      res.json({ rows: result.rows });
    }
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: error.message || '查询失败' });
  }
});

// ====== Generic Insert ======
router.post('/insert', async (req, res) => {
  try {
    const { table, rows } = req.body;
    if (!table || !rows?.length) return res.status(400).json({ error: 'table和rows参数必填' });

    const results = [];
    for (const row of rows) {
      const columns = Object.keys(row).map(k => `"${k}"`).join(',');
      const placeholders = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
      const values = Object.values(row);
      
      const sql = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *`;
      const result = await query(sql, values);
      results.push(result.rows[0]);
    }
    
    res.json({ rows: results });
  } catch (error) {
    console.error('Admin insert error:', error);
    res.status(500).json({ error: error.message || '插入失败' });
  }
});

// ====== Generic Update ======
router.post('/update', async (req, res) => {
  try {
    const { table, data, filters } = req.body;
    if (!table || !data || !filters) return res.status(400).json({ error: 'table, data, filters参数必填' });

    const setClauses = [];
    const params = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`"${key}" = $${paramIdx++}`);
      params.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }

    const whereClauses = [];
    for (const [key, value] of Object.entries(filters)) {
      whereClauses.push(`"${key}" = $${paramIdx++}`);
      params.push(value);
    }

    const sql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} RETURNING *`;
    const result = await query(sql, params);
    res.json({ rows: result.rows });
  } catch (error) {
    console.error('Admin update error:', error);
    res.status(500).json({ error: error.message || '更新失败' });
  }
});

// ====== Generic Delete ======
router.post('/delete', async (req, res) => {
  try {
    const { table, filters } = req.body;
    if (!table || !filters) return res.status(400).json({ error: 'table和filters参数必填' });

    const whereClauses = [];
    const params = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(filters)) {
      whereClauses.push(`"${key}" = $${paramIdx++}`);
      params.push(value);
    }

    const sql = `DELETE FROM "${table}" WHERE ${whereClauses.join(' AND ')} RETURNING *`;
    const result = await query(sql, params);
    res.json({ rows: result.rows });
  } catch (error) {
    console.error('Admin delete error:', error);
    res.status(500).json({ error: error.message || '删除失败' });
  }
});

// ====== Generic Upsert ======
router.post('/upsert', async (req, res) => {
  try {
    const { table, rows, options } = req.body;
    if (!table || !rows?.length) return res.status(400).json({ error: 'table和rows参数必填' });

    const results = [];
    for (const row of rows) {
      const columns = Object.keys(row).map(k => `"${k}"`).join(',');
      const placeholders = Object.keys(row).map((_, i) => `$${i + 1}`).join(',');
      const values = Object.values(row);
      
      const conflictColumns = options?.onConflict ? options.onConflict.split(',').map(c => `"${c.trim()}"`).join(',') : Object.keys(row).map(k => `"${k}"`)[0];
      const updateSet = Object.keys(row).filter(k => !(options?.onConflict || '').split(',').map(c=>c.trim()).includes(k)).map(k => `"${k}" = EXCLUDED."${k}"`).join(',');
      
      let sql = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`;
      if (updateSet) {
        sql += ` ON CONFLICT (${conflictColumns}) DO UPDATE SET ${updateSet}`;
      } else {
        sql += ` ON CONFLICT (${conflictColumns}) DO NOTHING`;
      }
      sql += ' RETURNING *';
      
      const result = await query(sql, values);
      results.push(result.rows[0]);
    }
    
    res.json({ rows: results });
  } catch (error) {
    console.error('Admin upsert error:', error);
    res.status(500).json({ error: error.message || 'Upsert失败' });
  }
});

// ====== File Upload ======
router.post('/upload', async (req, res) => {
  try {
    res.json({ error: 'File upload not yet implemented' });
  } catch (error) {
    res.status(500).json({ error: error.message || '上传失败' });
  }
});

// ====== Function Proxy ======
router.post('/functions/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const body = req.body;

    switch (name) {
      case 'speech-synthesis':
        res.json({ error: 'TTS not configured', audio_hex: null });
        break;
      case 'voice-to-text':
        res.json({ error: 'STT not configured', text: '' });
        break;
      case 'match': {
        const { input, options } = body;
        if (!input || !options?.length) {
          res.json({ matched_id: null });
          return;
        }
        const inputLower = input.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;
        for (const opt of options) {
          const score = opt.text.toLowerCase().split('').filter(c => inputLower.includes(c)).length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = opt;
          }
        }
        res.json({ matched_id: bestMatch?.id || null });
        break;
      }
      case 'check-status-v2':
        res.json({ status: 'active', quota: { used: 0, total: 999999 } });
        break;
      default:
        res.status(404).json({ error: `Function ${name} not found` });
    }
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({ error: error.message || 'Function执行失败' });
  }
});

export default router;
