import { Pool } from 'pg';
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'iot_doll',
  user: 'postgres',
  password: 'iot2026pass',
});
try {
  const r = await pool.query('SELECT 1 as test');
  console.log('DB OK:', r.rows);
} catch (e) {
  console.log('DB FAIL:', e.code, e.message);
}
await pool.end();
