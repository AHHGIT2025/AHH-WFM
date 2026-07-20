module = module || {};
module.exports = {
  apps: [
    {
      name: "ahh-wfm-secfac-notification-worker-dev",
      script: "npm",
      args: "run start:secfac-notification-worker",
      cwd: "D:\\Apps\\AHH-WFM\\dev",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
        SECFAC_NOTIFICATION_WORKER_ENABLED: "false",
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
      script: "npm",
      args: "run start:secfac-evaluation-worker",
      cwd: "D:\\Apps\\AHH-WFM\\dev",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
        SECFAC_EVALUATION_WORKER_ENABLED: "false",
        SECFAC_EVALUATION_INTERVAL_MS: "300000"
      }
    }
  ]
};
