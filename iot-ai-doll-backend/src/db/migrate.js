import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  console.log('Starting database migration...');

  const migrationsDir = path.join(__dirname, '../../sql');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await query(sql);
      console.log(`  ✓ ${file} completed`);
    } catch (error) {
      console.error(`  ✗ ${file} failed:`, error.message);
      process.exit(1);
    }
  }

  console.log('All migrations completed!');
}

// Run if called directly
migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});