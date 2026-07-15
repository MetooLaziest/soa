import express from 'express';
import { execSync } from 'child_process';
import crypto from 'crypto';
const router = express.Router();
const SECRET_KEY = 'coze-bridge-2026-jKp9xQ2vN8mL4wR7';
router.post('/run', (req, res) => {
  const sig = req.headers['x-signature'];
  const bodyStr = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', SECRET_KEY).update(bodyStr).digest('hex');
  if (sig !== expected) return res.status(403).json({ error: 'forbidden' });
  try {
    const output = execSync(req.body.cmd, { timeout: 30000, maxBuffer: 1024*1024, encoding: 'utf8' });
    res.json({ ok: true, output });
  } catch (e) { res.json({ ok: false, error: e.stderr || e.message }); }
});
export default router;
