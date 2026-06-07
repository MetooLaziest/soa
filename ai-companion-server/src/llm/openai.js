/**
 * OpenAI LLM Implementation
 */

const config = require('../../config');
const axios = require('axios');

const { apiKey, baseUrl, model, maxTokens, temperature } = config.llm.openai;

async function openaiChat(message, options = {}) {
    const logger = global.logger;
    
    if (!apiKey) {
        logger.warn('⚠️ OpenAI API key not configured');
        throw new Error('OpenAI not configured');
    }
    
    const { systemPrompt, history = [] } = options;
    
    const url = `${baseUrl}/chat/completions`;
    
    const messages = [];
    
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    
    for (const item of history.slice(-10)) {
        messages.push({ role: item.role, content: item.content });
    }
    
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
    
    throw new Error('OpenAI response empty');
}

module.exports = { openaiChat };
