import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'iot_doll',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'iot2026pass',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

export const query = (text, params) => pool.query(text, params);

export default pool;