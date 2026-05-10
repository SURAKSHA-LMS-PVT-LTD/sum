'use strict';

module.exports = {
  apps: [
    {
      name: 'lms-api',

      // NestJS build output — try both possible paths
      script: 'dist/main.js',

      cwd: '/home/ubuntu/apps/lms-api',

      // Cluster mode: one worker per CPU core
      instances: 'max',
      exec_mode: 'cluster',

      // Load environment from .env file
      env_file: '/home/ubuntu/apps/lms-api/.env',

      // Memory guard — restart a worker if it leaks past 1.2 GB
      max_memory_restart: '1200M',

      // Graceful shutdown
      kill_timeout:   5000,   // ms to wait for SIGINT before SIGKILL
      listen_timeout: 10000,  // ms to wait for app to be ready after start
      wait_ready:     true,   // wait for process.send('ready') signal

      // Auto-restart on crash
      autorestart:   true,
      restart_delay: 2000,
      max_restarts:  10,
      min_uptime:    '10s',

      // Logging
      out_file:        '/var/log/pm2/lms-api.out.log',
      error_file:      '/var/log/pm2/lms-api.err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:      true,

      // Environment overrides (anything here overrides .env)
      env: {
        NODE_ENV: 'production',
        TZ:       'Asia/Colombo',
        PORT:     '8080',
      },
    },
  ],
};
