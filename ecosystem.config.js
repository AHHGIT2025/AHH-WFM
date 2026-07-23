module.exports = {
  apps: [
    {
      name: "ahh-wfm-web-dev",
      script: "node_modules/next/dist/bin/next",
      args: "start apps/web -p 3000",
      cwd: "D:\\Apps\\AHH-WFM\\dev",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000
      }
    },
    {
      name: "ahh-wfm-mobile-dev",
      script: "node_modules/next/dist/bin/next",
      args: "start apps/mobile -p 3001",
      cwd: "D:\\Apps\\AHH-WFM\\dev",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3001
      }
    },
    {
      name: "ahh-wfm-secfac-notification-worker-dev",
      script: "dist/workers/apps/web/workers/secfac-notification-worker.js",
      cwd: "D:\\Apps\\AHH-WFM\\dev",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
        SECFAC_EVALUATION_WORKER_ENABLED: "true",
        SECFAC_NOTIFICATION_WORKER_ENABLED: "true",
        SECFAC_EMAIL_ENABLED: "false",
        SECFAC_PUSH_ENABLED: "false",
        SECFAC_WHATSAPP_ENABLED: "false",
        SECFAC_SMS_ENABLED: "false",
        SECFAC_NOTIFICATION_BATCH_SIZE: "20",
        SECFAC_NOTIFICATION_POLL_INTERVAL_MS: "10000"
      }
    },
    {
      name: "ahh-wfm-secfac-evaluation-worker-dev",
      script: "dist/workers/apps/web/workers/secfac-evaluation-worker.js",
      cwd: "D:\\Apps\\AHH-WFM\\dev",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
        SECFAC_EVALUATION_WORKER_ENABLED: "true",
        SECFAC_EVALUATION_INTERVAL_MS: "300000"
      }
    },
    {
      name: "ahh-wfm-secfac-monitoring-worker-dev",
      script: "dist/workers/apps/web/workers/secfac-monitoring-worker.js",
      cwd: "D:\\Apps\\AHH-WFM\\dev",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
        SECFAC_EVALUATION_WORKER_ENABLED: "true",
        SECFAC_NOTIFICATION_WORKER_ENABLED: "true",
        SECFAC_MONITORING_WORKER_ENABLED: "true",
        SECFAC_MONITORING_INTERVAL_MS: "300000"
      }
    }
  ]
};
