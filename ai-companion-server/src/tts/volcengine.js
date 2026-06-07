/**
 * Volcano Engine TTS Implementation
 * 火山引擎语音合成 (Seed-TTS)
 */

const config = require('../../config');
const axios = require('axios');

const { apiKey } = config.volcengine;
const { model, voiceId, speed, volume, pitch } = config.volcengine.tts;

async function volcengineTTS(text) {
    const logger = global.logger;
    
    if (!apiKey) {
        logger.warn('⚠️ Volcengine API key not configured');
        throw new Error('Volcengine TTS not configured');
    }
    
    const url = 'https://openspeech.bytedance.com/api/v1/tts';
    
    const response = await axios.post(url, {
        text: text,
        model: model,
        voice_id: voiceId,
        speed_ratio: speed,
        volume_ratio: volume,
        pitch_ratio: pitch,
        encoding: 'mp3',
        format: 'mp3'
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        responseType: 'arraybuffer',
        timeout: 15000
    });
    
    if (response.data) {
        return Buffer.from(response.data);
    }
    
    throw new Error('Volcengine TTS result empty');
}

module.exports = { volcengineTTS };
