import express from 'express';
import ky from 'ky';
import crypto from 'crypto';

const router = express.Router();

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_STT_URL = process.env.MINIMAX_STT_URL || 'https://api.minimaxi.com/v1/asr';

// MiniMax 语音转文字 (STT)
router.post('/recognize', async (req, res) => {
  try {
    const { speech, len } = req.body;
    if (!speech || !len) return res.status(400).json({ error: '缺少 speech 或 len 参数' });
    if (!MINIMAX_API_KEY) return res.status(500).json({ error: '缺少 MINIMAX_API_KEY' });

    const cuid = crypto.randomUUID();

    const response = await ky.post(MINIMAX_STT_URL, {
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'speech-01',
        audio_file: speech,
        audio_format: 'wav',
        sample_rate: 16000,
        request_id: cuid,
      }),
      timeout: 15000,
    });

    const data = await response.json();
    console.log('STT result:', data);

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax STT Error: ${data.base_resp.status_msg}`);
    }

    const text = data.text || data.result?.text || '';
    res.json({ text });
  } catch (error) {
    console.error('STT error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;