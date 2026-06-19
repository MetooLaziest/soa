import { Pool } from 'pg';
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'iot_doll',
  user: 'postgres',
  password: 'iot2026pass',
});
try {
  const r = await pool.query("SELECT current_database(), current_user");
  console.log('DB OK:', JSON.stringify(r.rows));
  
  // Try the profiles query
  const r2 = await pool.query("SELECT id, username FROM profiles WHERE username='15622205445'");
  console.log('Profiles:', JSON.stringify(r2.rows));
  
  // Try bcrypt compare
  const bcrypt = await import('bcryptjs');
  const users = r2.rows;
  if (users.length > 0) {
    const valid = await bcrypt.compare('Metoo2026', users[0].password_hash || '');
    console.log('Password valid:', valid);
  }
} catch (e) {
  console.log('DB FAIL:', e.code, e.message);
}
await pool.end();
