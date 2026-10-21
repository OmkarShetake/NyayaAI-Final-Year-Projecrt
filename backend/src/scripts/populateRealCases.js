/**
 * Populate Real World Cases
 * -------------------------
 * Normalizes existing case dates & statuses, then fetches 60+ real cases from
 * the Indian Kanoon API and runs ML predictions for all unassessed cases.
 */

require('../config/env');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const logger = require('../config/logger');
const Case = require('../models/Case');
const User = require('../models/User');
const { syncFromKanoon } = require('../services/kanoonSyncService');

async function main() {
  await connectDB();
  logger.info('Connected to MongoDB.');

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@nyaya.local';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) admin = await User.findOne({ role: 'admin' });

  // 1. Normalize dates and statuses for existing cases so age is realistic
  const today = new Date();
  const existingCases = await Case.find({});
  logger.info(`Normalizing dates and statuses for existing ${existingCases.length} cases...`);

  for (let i = 0; i < existingCases.length; i++) {
    const c = existingCases[i];
    const estDays = 350 + ((i * 37) % 700);
    const filingDate = new Date(today.getTime() - estDays * 86400000);
    const lastHearingDate = new Date(today.getTime() - (15 + (i % 40)) * 86400000);
    const nextHearingDate = (i % 5 === 0) ? null : new Date(today.getTime() + (10 + (i % 30)) * 86400000);
    const status = (i % 5 === 0) ? 'Disposed' : (i % 5 === 1 ? 'Pending' : (i % 5 === 2 ? 'Pending' : (i % 5 === 3 ? 'Adjourned' : 'Pending')));
    const currentStage = (i % 5 === 0) ? 'Judgment Reserved' : (i % 5 === 1 ? 'Evidence' : (i % 5 === 2 ? 'Arguments' : (i % 5 === 3 ? 'Pleadings' : 'Notice Issued')));

    await Case.updateOne(
      { _id: c._id },
      {
        $set: {
          filingDate,
          lastHearingDate,
          nextHearingDate,
          status,
          currentStage,
          priority: estDays > 650 ? 'High' : (estDays > 450 ? 'Normal' : 'Low'),
        },
      },
    );
  }
  logger.info('Existing cases normalized.');

  // 2. Fetch up to 60 real cases from Indian Kanoon
  logger.info('Fetching live cases from Indian Kanoon API (target: 60 records)...');
  const res = await syncFromKanoon({
    query: 'civil suit doctypes:judgments',
    limit: 60,
    runPredict: true,
    adminUser: admin,
  });
  logger.info(`Kanoon sync result: inserted=${res.inserted}, updated=${res.updated}, predicted=${res.predicted}`);

  const total = await Case.countDocuments();
  logger.info(`===============================================`);
  logger.info(`TOTAL CASES IN MONGODB DATABASE: ${total}`);
  logger.info(`===============================================`);

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error(`Error during populate: ${err.message}`);
  process.exit(1);
});
