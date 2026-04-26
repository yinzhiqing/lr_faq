module.exports = {
  apps: [{
    name: 'faq-kb',
    script: 'server.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // 日志
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    // 自动重启
    max_memory_restart: '512M',
    // 崩溃重启延迟
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000
  }]
};
