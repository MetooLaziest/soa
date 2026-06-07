/**
 * Configuration Module
 */

const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';

// Load environment variables from .env file
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
}

const config = {
    env,
    
    server: {
        port: parseInt(process.env.PORT || '8080', 10),
        host: process.env.HOST || '0.0.0.0',
        pingInterval: 30000,
        pingTimeout: 10000
    },

    logging: {
        pretty: process.env.LOG_PRETTY !== 'false'
    },

    // AI Service Provider: 'tencent' | 'volcengine' | '讯飞' | 'debug'
    aiProvider: process.env.AI_PROVIDER || 'tencent',

    // Tencent Cloud ASR/TTS (优先)
    tencent: {
        secretId: process.env.TENCENT_SECRET_ID || '',
        secretKey: process.env.TENCENT_SECRET_KEY || '',
        region: process.env.TENCENT_REGION || 'ap-guangzhou',
        appId: process.env.TENCENT_APP_ID || '',
        
        // ASR
        asr: {
            engineType: '16k_zh',     // 8k_zh, 16k_zh
            projectId: 0,
            subServiceType: 2,
            convServiceType: 0
        },
        
        // TTS
        tts: {
            voiceType: 101001,        // 基础音色
            speed: 0,
            volume: 0,
            pitch: 0,
            codec: 'mp3'
        }
    },

    // 火山引擎 (备选)
    volcengine: {
        apiKey: process.env.VOLCENGINE_API_KEY || '',
        appId: process.env.VOLCENGINE_APP_ID || '',
        
        // ASR - 豆包语音识别
        asr: {
            engine: 'saas',          // saas
            format: 'wav',
            rate: 16000,
            language: 'zh-CN'
        },
        
        // TTS - Seed-TTS
        tts: {
            model: 'speech_tts01',   // speech_tts01
            voiceId: 'female-yujia',
            speed: 1.0,
            volume: 1.0,
            pitch: 0
        }
    },

    // 讯飞语音 (备选)
    xunfei: {
        appId: process.env.XUNFEI_APP_ID || '',
        apiKey: process.env.XUNFEI_API_KEY || '',
        apiSecret: process.env.XUNFEI_API_SECRET || '',
        
        asr: {
            domain: 'iat',
            language: 'zh_cn',
            accent: 'mandarin',
            format: 'wav',
            rate: 16000
        },
        
        tts: {
            voiceName: 'xiaoyan',
            speed: 50,
            volume: 50,
            pitch: 50,
            tte: 'UTF8'
        }
    },

    // Kimi/ChatGPT LLM (优先)
    llm: {
        provider: process.env.LLM_PROVIDER || 'kimi',  // 'kimi' | 'openai' | 'debug'
        
        // Kimi (Moonshot AI)
        kimi: {
            apiKey: process.env.KIMI_API_KEY || '',
            baseUrl: 'https://api.moonshot.cn/v1',
            model: 'moonshot-v1-8k',
            maxTokens: 1024,
            temperature: 0.3
        },
        
        // OpenAI (备选)
        openai: {
            apiKey: process.env.OPENAI_API_KEY || '',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-3.5-turbo',
            maxTokens: 1024,
            temperature: 0.3
        },
        
        // System prompt for AI companion
        systemPrompt: process.env.SYSTEM_PROMPT || `你是一个温暖友好的AI陪伴机器人。你可以：
- 进行自然的对话交流
- 理解和回应用户的情感需求
- 提供陪伴和情绪价值
- 保持简洁友好的回复风格

请用简短自然的语言回复，每次回复控制在100字以内。`
    },

    // Storage (Redis)
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB || '0', 10)
    },
    
    // Session
    session: {
        ttl: 3600 * 24,        // 24 hours
        maxHistory: 20          // max conversation history
    }
};

module.exports = config;