/**
 * 统一后端 - 集中管理两个 PostgreSQL 连接池
 * - poolIot: iot_doll 库（iot-backend 用）
 * - poolEpet1: epet1 库（epet1-backend 用）
 */
import pg from 'pg';
const { Pool } = pg;

const PG_USER = 'postgres';
const PG_PASS = 'iot2026pass';
const PG_HOST = 'localhost';
const PG_PORT = 5432;

export const poolIot = new Pool({
  host: PG_HOST,
  port: PG_PORT,
  database: 'iot_doll',
  user: PG_USER,
  password: PG_PASS,
  max: 10,
});

export const poolEpet1 = new Pool({
  host: PG_HOST,
  port: PG_PORT,
  database: 'epet1',
  user: PG_USER,
  password: PG_PASS,
  max: 10,
});

// 健康检查
export async function checkAllPools() {
  const results = {};
  for (const [name, pool] of [['iot_doll', poolIot], ['epet1', poolEpet1]]) {
    try {
      const r = await pool.query('SELECT 1 AS ok');
      results[name] = r.rows[0].ok === 1 ? 'ok' : 'fail';
    } catch (e) {
      results[name] = `error: ${e.message}`;
    }
  }
  return results;
}
