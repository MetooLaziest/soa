/**
 * LLM Chat
 * AI Dialog using Kimi/OpenAI
 */

const config = require('../config');
const axios = require('axios');
const { kimiChat } = require('./kimi');
const { openaiChat } = require('./openai');

/**
 * Chat with AI
 * @param {string} userMessage - User input
 * @param {object} options - { deviceId, systemPrompt }
 * @returns {Promise<string>} - AI response
 */
async function chat(userMessage, options = {}) {
    const logger = global.logger;
    const { deviceId, systemPrompt } = options;
    
    const provider = config.llm.provider;
    
    // Debug mode
    if (provider === 'debug') {
        logger.info('🔧 Debug mode: returning mock response');
        await new Promise(r => setTimeout(r, 500));
        return '你好！我是你的AI陪伴伙伴，有什么想聊的吗？';
    }
    
    // Get conversation history
    const history = await getSession(deviceId);
    
    // Route to provider
    switch (provider) {
        case 'kimi':
            return await kimiChat(userMessage, { systemPrompt, history });
        case 'openai':
            return await openaiChat(userMessage, { systemPrompt, history });
        default:
            return await kimiChat(userMessage, { systemPrompt, history });
    }
}

module.exports = { chat };
