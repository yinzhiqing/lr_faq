module.exports = {
  apps: [{
    name: 'faq-kb',
    script: 'server.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // 生产必须设置，与 Docker 部署一致
      // SESSION_SECRET: 'openssl rand -base64 48',
      // 在 Nginx 后: TRUST_PROXY: '1', SESSION_COOKIE_SECURE: 'true'
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
