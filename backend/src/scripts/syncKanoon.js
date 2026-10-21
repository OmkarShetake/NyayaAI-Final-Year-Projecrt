/**
 * Indian Kanoon CLI Ingestion Script
 * ----------------------------------
 * Run with:
 *   npm run sync:kanoon
 *   npm run sync:kanoon -- --query "cheque bounce" --limit 50 --predict
 *   node src/scripts/syncKanoon.js --query "property dispute high court" --limit 100
 */

require('../config/env');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const logger = require('../config/logger');
const User = require('../models/User');
const { syncFromKanoon, isConfigured } = require('../services/kanoonSyncService');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

async function main() {
  if (!isConfigured()) {
    logger.error('KANOON_API_TOKEN is not configured in your .env file.');
    logger.error('To get a free token:');
    logger.error('  1. Register at https://api.indiankanoon.org/');
    logger.error('  2. Add KANOON_API_TOKEN=your_token_here in your .env');
    process.exit(1);
  }

  await connectDB();
  logger.info('Connected to MongoDB.');

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@nyaya.local';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.findOne({ role: 'admin' });
  }

  const query = opt('query', 'doctypes:judgments');
  const limit = Number(opt('limit', 50));
  const runPredict = flag('predict');

  logger.info(`Starting Indian Kanoon sync: query="${query}", limit=${limit}, predict=${runPredict}...`);

  const summary = await syncFromKanoon({
    query,
    limit,
    runPredict,
    adminUser: admin,
  });

  logger.info('=== Indian Kanoon Sync Summary ===');
  logger.info(`  Cases inserted:  ${summary.inserted}`);
  logger.info(`  Cases updated:   ${summary.updated}`);
  logger.info(`  Predictions run: ${summary.predicted}`);
  logger.info(`  Skipped/errors:  ${summary.errors}`);
  logger.info('===================================');

  await mongoose.connection.close();
}

main().catch(async (err) => {
  logger.error(err.stack || err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
