const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB } = require('./config/db');
const mongoose = require('mongoose');
const app = require('./app');
const User = require('./models/User');
const kanoonSyncService = require('./services/kanoonSyncService');

async function start() {
  try {
    await connectDB();
  } catch (err) {
    logger.error(`Failed to connect to MongoDB: ${err.message}`);
    logger.error('Check MONGODB_URI in backend/.env');
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`NyayaAI API listening on http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
    logger.info(`ML service: ${env.ML_SERVICE_URL} | Gemini: ${env.geminiEnabled ? 'enabled' : 'disabled (template fallback)'}`);

    // Keep the ML service awake on Render free tier by pinging it every 10 minutes.
    // Free tier sleeps after 15 min inactivity; this prevents cold-start delays on predictions.
    const ML_PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    const pingMlService = async () => {
      try {
        const mlService = require('./services/mlService');
        const result = await mlService.health();
        if (result.reachable) {
          logger.info(`[KeepAlive] ML service ping OK (modelLoaded=${result.modelLoaded})`);
        } else {
          logger.warn(`[KeepAlive] ML service ping failed: ${result.error}`);
        }
      } catch (e) {
        logger.warn(`[KeepAlive] ML service ping error: ${e.message}`);
      }
    };
    // First ping after 30s (let everything start), then every 10 min
    setTimeout(() => {
      pingMlService();
      setInterval(pingMlService, ML_PING_INTERVAL_MS);
    }, 30000);
    // Auto-fetch real-world court cases from Indian Kanoon on startup (non-blocking)
    if (env.KANOON_AUTO_SYNC_ON_STARTUP) {
      if (kanoonSyncService.isConfigured()) {
        logger.info('[Indian Kanoon] Startup auto-sync scheduled in 3s (background mode)...');
        setTimeout(async () => {
          try {
            logger.info(`[Indian Kanoon] Starting background auto-sync: query="${env.KANOON_DEFAULT_QUERY}", limit=${env.KANOON_AUTO_SYNC_LIMIT}, predict=${env.KANOON_AUTO_SYNC_PREDICT}...`);
            const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@nyaya.local';
            let admin = await User.findOne({ email: adminEmail });
            if (!admin) admin = await User.findOne({ role: 'admin' });

            const summary = await kanoonSyncService.syncFromKanoon({
              query: env.KANOON_DEFAULT_QUERY,
              limit: env.KANOON_AUTO_SYNC_LIMIT,
              runPredict: env.KANOON_AUTO_SYNC_PREDICT,
              adminUser: admin,
            });
            logger.info(`[Indian Kanoon] Startup auto-sync complete: ${summary.inserted} inserted, ${summary.updated} updated, ${summary.predicted} predicted.`);
          } catch (syncErr) {
            logger.warn(`[Indian Kanoon] Startup auto-sync warning (non-fatal): ${syncErr.message}`);
          }
        }, 3000);
      } else {
        logger.info('[Indian Kanoon] Startup auto-sync skipped: KANOON_API_TOKEN is not configured.');
      }
    }
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error(`Unhandled rejection: ${reason?.stack || reason}`));
}

start();
