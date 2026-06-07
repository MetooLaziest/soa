/**
 * AI Companion Robot Server - Main Entry
 * WebSocket Server with ASR + LLM + TTS integration
 */

require('dotenv').config();
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const pino = require('pino');
const config = require('./config');
const { handleConnection } = require('./websocket/server');
const { initRedis } = require('./storage/redis');

// Logger
const logger = pino(config.logging.pretty ? {
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
} : {});

// Global logger
global.logger = logger;

async function main() {
    logger.info('🤖 AI Companion Server starting...');
    logger.info(`Environment: ${config.env}`);
    logger.info(`Port: ${config.server.port}`);

    // Initialize Redis (optional, gracefully handle failure)
    try {
        await initRedis();
        logger.info('✅ Redis connected');
    } catch (err) {
        logger.warn('⚠️ Redis not available, using in-memory storage');
    }

    // Create WebSocket server
    const wss = new WebSocketServer({
        port: config.server.port,
        host: config.server.host
    });

    // Handle new connections
    wss.on('connection', (ws, req) => {
        const clientId = uuidv4();
        const clientIp = req.socket.remoteAddress;
        
        logger.info(`📱 New connection: ${clientId} from ${clientIp}`);
        
        // Handle this connection
        handleConnection(ws, clientId, clientIp);
    });

    wss.on('error', (err) => {
        logger.error('❌ WebSocket server error:', err);
    });

    // Health check endpoint (HTTP)
    const http = require('http');
    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                clients: wss.clients.size 
            }));
        } else if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('AI Companion Server is running');
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.listen(config.server.port + 1, config.server.host, () => {
        logger.info(`✅ HTTP server on http://${config.server.host}:${config.server.port + 1}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        logger.info('🛑 Shutting down...');
        wss.close(() => {
            logger.info('✅ Server closed');
            process.exit(0);
        });
    });

    logger.info(`🚀 Server ready on ws://${config.server.host}:${config.server.port}`);
}

main().catch(err => {
    logger.error('❌ Failed to start server:', err);
    process.exit(1);
});