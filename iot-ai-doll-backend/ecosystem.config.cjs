/**
 * PM2 ecosystem configuration
 * Usage: pm2 start ecosystem.config.cjs
 *        pm2 start ecosystem.config.cjs --env production
 */
module.exports = {
  apps: [
    {
      name: 'iot-backend',
      script: 'src/index.js',
      cwd: '/var/www/iot-ai-doll/backend',

      // Instance
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'node',

      // Environment
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },

      // Stability
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      autorestart: true,

      // Logging
      error_file: '/root/.pm2/logs/iot-backend-error.log',
      out_file: '/root/.pm2/logs/iot-backend-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
  ],
};
