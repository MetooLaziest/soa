import express from 'express';
import ky from 'ky';

const router = express.Router();

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_TTS_URL = process.env.MINIMAX_TTS_URL || 'https://api.minimaxi.com/v1/t2a_v2';

// MiniMax 语音合成 (TTS)
router.post('/synthesize', async (req, res) => {
  try {
    const { text, voice_id = 'male-qn-qingse' } = req.body;
    if (!text) return res.status(400).json({ error: '缺少 text 参数' });
    if (!MINIMAX_API_KEY) return res.status(500).json({ error: '缺少 MINIMAX_API_KEY' });

    const response = await ky.post(MINIMAX_TTS_URL, {
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'speech-01-turbo',
        text,
        stream: false,
        voice_setting: {
          voice_id,
          speed: 1.0,
          vol: 1.0,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1,
        },
      }),
      timeout: 15000,
    });

    const data = await response.json();

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax TTS Error: ${data.base_resp.status_msg}`);
    }

    if (data.data && data.data.audio) {
      res.json({ audio_hex: data.data.audio });
    } else {
      throw new Error('No audio data received');
    }
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;