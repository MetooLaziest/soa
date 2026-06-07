/**
 * WebSocket Server Handler
 * Manages device connections and message routing
 */

const { v4: uuidv4 } = require('uuid');
const { processAudio } = require('../asr/processor');
const { synthesize } = require('../tts/processor');
const { chat } = require('../llm/chat');
const { getSession, saveSession, clearSession } = require('../storage/session');

// Connected clients
const clients = new Map();

/**
 * Handle new WebSocket connection
 */
function handleConnection(ws, clientId, clientIp) {
    const logger = global.logger;
    const client = {
        id: clientId,
        ws,
        ip: clientIp,
        deviceId: null,
        connectedAt: new Date().toISOString(),
        lastActivity: Date.now(),
        sessionId: null,
        state: 'handshake'  // handshake -> recording -> playing -> idle
    };
    
    clients.set(clientId, client);
    
    // Handle messages from device
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            await handleMessage(client, message);
        } catch (err) {
            logger.error('❌ Failed to handle message:', err);
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: err.message 
            }));
        }
    });
    
    // Handle disconnection
    ws.on('close', () => {
        logger.info(`📴 Disconnected: ${clientId}`);
        clients.delete(clientId);
    });
    
    // Handle pong (keepalive)
    ws.on('pong', () => {
        client.lastActivity = Date.now();
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        clientId,
        message: 'Connected to AI Companion Server'
    }));
}

/**
 * Handle messages from device
 */
async function handleMessage(client, message) {
    const logger = global.logger;
    const { type, payload } = message;
    
    switch (type) {
        case 'register':
            // Device registration
            client.deviceId = payload.deviceId;
            client.state = 'idle';
            logger.info(`📱 Device registered: ${payload.deviceId}`);
            client.ws.send(JSON.stringify({
                type: 'registered',
                deviceId: payload.deviceId
            }));
            break;
            
        case 'audio':
            // Audio data from device (PCM)
            await handleAudio(client, payload);
            break;
            
        case 'ping':
            client.ws.send(JSON.stringify({ type: 'pong' }));
            break;
            
        case 'reset':
            // Reset conversation
            await clearSession(client.deviceId);
            client.state = 'idle';
            client.ws.send(JSON.stringify({
                type: 'reset',
                message: 'Conversation reset'
            }));
            break;
            
        default:
            logger.warn(`⚠️ Unknown message type: ${type}`);
    }
}

/**
 * Process audio from device: ASR -> LLM -> TTS -> play
 */
async function handleAudio(client, payload) {
    const logger = global.logger;
    const ws = client.ws;
    
    // Check state
    if (client.state === 'recording') {
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Already recording' 
        }));
        return;
    }
    
    if (client.state === 'playing') {
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Currently playing response' 
        }));
        return;
    }
    
    try {
        client.state = 'recording';
        
        // 1. ASR - Speech to text
        logger.info('🎤 Processing ASR...');
        const text = await processAudio(payload.audio);
        
        if (!text || text.trim() === '') {
            ws.send(JSON.stringify({ 
                type: 'asr', 
                text: '' 
            }));
            client.state = 'idle';
            return;
        }
        
        logger.info(`📝 Recognized: ${text}`);
        ws.send(JSON.stringify({ 
            type: 'asr', 
            text 
        }));
        
        // 2. LLM - Get AI response
        logger.info('🤖 Processing LLM...');
        const systemPrompt = require('../config').llm.systemPrompt;
        const response = await chat(text, {
            deviceId: client.deviceId,
            systemPrompt
        });
        
        logger.info(`💬 AI response: ${response}`);
        ws.send(JSON.stringify({ 
            type: 'llm', 
            text: response 
        }));
        
        // 3. TTS - Text to speech
        logger.info('🔊 Processing TTS...');
        const audio = await synthesize(response);
        
        client.state = 'playing';
        
        // Send audio in chunks for streaming playback
        ws.send(JSON.stringify({ 
            type: 'audio', 
            audio: audio.toString('base64'),
            format: 'mp3'
        }));
        
        client.state = 'idle';
        logger.info('✅ Response sent');
        
    } catch (err) {
        client.state = 'idle';
        logger.error('❌ Audio pipeline error:', err);
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: err.message 
        }));
    }
}

module.exports = {
    clients,
    handleConnection
};