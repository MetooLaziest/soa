/**
 * TTS Processor
 * Text-to-Speech using Tencent/Voclean/讯飞
 */

const config = require('../config');
const { tencentTTS } = require('./tencent');
const { volcengineTTS } = require('./volcengine');
const { xunfeiTTS } = require('./xunfei');

/**
 * Convert text to audio
 * @param {string} text - Text to synthesize
 * @returns {Promise<Buffer>} - Audio buffer (MP3/WAV)
 */
async function synthesize(text) {
    const logger = global.logger;
    const provider = config.aiProvider;
    
    if (!text || text.trim() === '') {
        throw new Error('Empty text');
    }
    
    // Debug mode
    if (provider === 'debug') {
        logger.info('🔧 Debug mode: returning mock TTS');
        await new Promise(r => setTimeout(r, 300));
        return Buffer.alloc(1024, 0);
    }
    
    // Route to provider
    switch (provider) {
        case 'tencent':
            return await tencentTTS(text);
        case 'volcengine':
            return await volcengineTTS(text);
        case 'xunfei':
            return await xunfeiTTS(text);
        default:
            try {
                return await tencentTTS(text);
            } catch (err) {
                logger.error('❌ Tencent TTS failed:', err.message);
                return await volcengineTTS(text);
            }
    }
}

module.exports = { synthesize };
