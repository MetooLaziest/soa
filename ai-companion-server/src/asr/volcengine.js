/**
 * Volcano Engine ASR Implementation
 * 火山引擎语音识别 (豆包)
 */

const config = require('../../config');
const axios = require('axios');

const { apiKey } = config.volcengine;
const { engine, format, rate, language } = config.volcengine.asr;

async function volcengineASR(audioBuffer) {
    const logger = global.logger;
    
    if (!apiKey) {
        logger.warn('⚠️ Volcengine API key not configured');
        throw new Error('Volcengine ASR not configured');
    }
    
    // Use Volcano Engine ASR API
    const url = 'https://openspeech.bytedance.com/api/v2/asr';
    
    const response = await axios.post(url, audioBuffer, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Transfer-Encoding': 'chunked'
        },
        params: {
            format: format,
            rate: rate,
            language: language,
            channel: 1,
            codec: 'raw'
        },
        timeout: 15000
    });
    
    const result = response.data;
    
    if (result.text) {
        return result.text;
    }
    
    if (result.result && result.result[0]) {
        return result.result[0].text;
    }
    
    throw new Error('Volcengine ASR result empty');
}

module.exports = { volcengineASR };
