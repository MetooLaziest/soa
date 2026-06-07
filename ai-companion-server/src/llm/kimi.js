/**
 * Kimi (Moonshot AI) LLM Implementation
 */

const config = require('../../config');
const axios = require('axios');

const { apiKey, baseUrl, model, maxTokens, temperature } = config.llm.kimi;

async function kimiChat(message, options = {}) {
    const logger = global.logger;
    
    if (!apiKey) {
        logger.warn('⚠️ Kimi API key not configured');
        throw new Error('Kimi not configured');
    }
    
    const { systemPrompt, history = [] } = options;
    
    const url = `${baseUrl}/chat/completions`;
    
    // Build messages
    const messages = [];
    
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    
    // Add history
    for (const item of history.slice(-10)) {
        messages.push({ role: item.role, content: item.content });
    }
    
    // Add current message
    messages.push({ role: 'user', content: message });
    
    const response = await axios.post(url, {
        model,
        messages,
        max_tokens: maxTokens,
        temperature: temperature
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000
    });
    
    const result = response.data;
    
    if (result.choices && result.choices[0]) {
        return result.choices[0].message.content;
    }
    
    throw new Error('Kimi response empty');
}

module.exports = { kimiChat };
