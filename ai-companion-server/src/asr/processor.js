/**
 * ASR Processor
 * Speech-to-Text using Tencent/Voclean/讯飞
 */

const config = require('../config');
const { tencentASR } = require('./tencent');
const { volcengineASR } = require('./volcengine');
const { xunfeiASR } = require('./xunfei');

/**
 * Convert audio buffer to text
 * @param {Buffer} audio - PCM audio data
 * @returns {Promise<string>} - Recognized text
 */
async function processAudio(audio) {
    const logger = global.logger;
    const provider = config.aiProvider;
    
    // Handle base64 audio
    let audioBuffer;
    if (typeof audio === 'string') {
        audioBuffer = Buffer.from(audio, 'base64');
    } else if (Buffer.isBuffer(audio)) {
        audioBuffer = audio;
    } else {
        throw new Error('Invalid audio format');
    }
    
    // Debug mode - return mock response
    if (provider === 'debug') {
        logger.info('🔧 Debug mode: returning mock ASR');
        await new Promise(r => setTimeout(r, 500));
        return '这是调试模式的语音识别结果';
    }
    
    // Route to provider
    switch (provider) {
        case 'tencent':
            return await tencentASR(audioBuffer);
            
        case 'volcengine':
            return await volcengineASR(audioBuffer);
            
        case 'xunfei':
            return await xunfeiASR(audioBuffer);
            
        default:
            // Default to Tencent
            try {
                return await tencentASR(audioBuffer);
            } catch (err) {
                logger.error('❌ Tencent ASR failed:', err.message);
                // Fallback to Volcengine
                return await volcengineASR(audioBuffer);
            }
    }
}

module.exports = {
    processAudio
};