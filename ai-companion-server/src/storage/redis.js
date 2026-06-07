/**
 * Redis Storage Module
 */

const config = require('../config');
const Redis = require('ioredis');

let redis = null;

/**
 * Initialize Redis connection
 */
async function initRedis() {
    const { host, port, password, db } = config.redis;
    
    if (!host) {
        throw new Error('Redis not configured');
    }
    
    redis = new Redis({
        host,
        port,
        password: password || undefined,
        db,
        retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
        }
    });
    
    redis.on('error', (err) => {
        global.logger.warn('⚠️ Redis error:', err.message);
    });
    
    await redis.ping();
    
    return redis;
}

/**
 * Get Redis instance
 */
function getRedis() {
    return redis;
}

module.exports = { initRedis, getRedis };
