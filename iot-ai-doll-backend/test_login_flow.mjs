// Mimics the exact auth.js login flow using the actual pool
import { query } from './src/db/pool.js';
import bcrypt from 'bcryptjs';

const username = '15622205445';
const password = 'Metoo2026';

try {
  console.log('Starting login flow...');
  const result = await query(
    'SELECT id, username, password_hash FROM profiles WHERE username = $1',
    [username]
  );
  console.log('Query result:', result.rows.length, 'rows');
  
  if (result.rows.length === 0) {
    console.log('FAIL: User not found');
    process.exit(1);
  }
  
  const user = result.rows[0];
  console.log('User found:', user.username);
  console.log('Hash:', user.password_hash ? user.password_hash.substring(0, 20) + '...' : 'NULL');
  
  const valid = await bcrypt.compare(password, user.password_hash);
  console.log('bcrypt.compare result:', valid);
  
  if (!valid) {
    console.log('FAIL: Invalid password');
    process.exit(1);
  }
  
  console.log('SUCCESS: Login would succeed');
} catch (e) {
  console.log('ERROR caught:', e.code, e.message);
  console.log('Stack:', e.stack);
}
