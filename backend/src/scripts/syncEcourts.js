/**
 * Manual eCourts sync script.
 * 
 * Run with:
 *   npm run sync:ecourts
 *
 * Make sure ECOURTS_SYNC_ENABLED=true and ECOURTS_API_KEY is set in your .env
 */
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const logger = require('../config/logger');
const { syncAll } = require('../services/ecourtsSyncService');

async function main() {
  await connectDB();
  logger.info('Connected to MongoDB. Starting eCourts sync...');

  const result = await syncAll();

  if (!result.enabled) {
    logger.warn('Sync skipped — ECOURTS_SYNC_ENABLED is false in .env');
  } else if (result.error) {
    logger.error(`Sync failed: ${result.error}`);
  } else {
    const totals = result.results.reduce(
      (acc, r) => ({ inserted: acc.inserted + r.inserted, updated: acc.updated + r.updated, errors: acc.errors + r.errors }),
      { inserted: 0, updated: 0, errors: 0 },
    );
    logger.info(`Sync complete — inserted: ${totals.inserted}, updated: ${totals.updated}, errors: ${totals.errors}`);
  }

  await mongoose.connection.close();
}

main().catch(async (err) => {
  logger.error(err.stack || err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
