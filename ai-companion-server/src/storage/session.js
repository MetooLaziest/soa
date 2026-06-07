/**
 * Session Management
 * In-memory + optional Redis
 */

const config = require('../config');
const clients = require('./clients');

// In-memory storage
const sessions = new Map();

async function getSession(deviceId) {
    if (!deviceId) return [];
    
    try {
        const { getRedis } = require('./redis');
        const redis = getRedis();
        if (redis) {
            const key = `session:${deviceId}`;
            const data = await redis.lrange(key, 0, -1);
            return data.map(item => JSON.parse(item));
        }
    } catch (err) {
        // Use in-memory
    }
    
    return sessions.get(deviceId) || [];
}

async function saveSession(deviceId, message, role) {
    if (!deviceId) return;
    
    const entry = { role, content: message, timestamp: Date.now() };
    
    try {
        const { getRedis } = require('./redis');
        const redis = getRedis();
        if (redis) {
            const key = `session:${deviceId}`;
            await redis.rpush(key, JSON.stringify(entry));
            await redis.expire(key, config.session.ttl);
            return;
        }
    } catch (err) {
        // Use in-memory
    }
    
    if (!sessions.has(deviceId)) {
        sessions.set(deviceId, []);
    }
    const history = sessions.get(deviceId);
    history.push(entry);
    
    if (history.length > config.session.maxHistory) {
        history.shift();
    }
}

async function clearSession(deviceId) {
    if (!deviceId) return;
    
    sessions.delete(deviceId);
    
    try {
        const { getRedis } = require('./redis');
        const redis = getRedis();
        if (redis) {
            await redis.del(`session:${deviceId}`);
        }
    } catch (err) {
        // Ignore
    }
}

module.exports = { getSession, saveSession, clearSession };
