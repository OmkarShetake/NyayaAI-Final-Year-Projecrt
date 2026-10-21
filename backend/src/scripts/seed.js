/**
 * Seeds the database with an admin account and SYNTHETIC sample cases taken from
 * ml-service/data/sample/sample_cases.csv (clearly marked isSample=true, case numbers "SYN/...").
 *
 *   npm run seed                 # admin + 120 sample cases
 *   npm run seed -- --count 300  # more cases
 *   npm run seed:predict         # also run ML predictions for every seeded case (ML service must be running)
 *   npm run seed -- --reset      # delete previously seeded sample cases first
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const mongoose = require('mongoose');

const env = require('../config/env');
const logger = require('../config/logger');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Case = require('../models/Case');
const Prediction = require('../models/Prediction');
const SimilarCase = require('../models/SimilarCase');
const Recommendation = require('../models/Recommendation');
const predictionService = require('../services/predictionService');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };

const defaultSamplePath = path.resolve(__dirname, '../../../ml-service/data/sample/sample_cases.csv');
const realPath = path.resolve(__dirname, '../../../ml-service/data/raw/real_cases.csv');
const CSV_PATH = process.env.SAMPLE_CSV_PATH || (fs.existsSync(realPath) ? realPath : defaultSamplePath);

async function main() {
  await connectDB();
  const count = Number(opt('count', 120));

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@nyaya.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({ name: 'System Admin', email: adminEmail, password: adminPassword, role: 'admin' });
    logger.info(`Created admin ${adminEmail} / ${adminPassword}  (change this password!)`);
  } else {
    logger.info(`Admin ${adminEmail} already exists`);
  }

  if (flag('reset')) {
    const ids = (await Case.find({ isSample: true }).select('_id').lean()).map((c) => c._id);
    await Promise.all([
      Prediction.deleteMany({ caseId: { $in: ids } }),
      SimilarCase.deleteMany({ caseId: { $in: ids } }),
      Recommendation.deleteMany({ caseId: { $in: ids } }),
      Case.deleteMany({ _id: { $in: ids } }),
    ]);
    logger.info(`Removed ${ids.length} previously seeded sample cases`);
  }

  if (!fs.existsSync(CSV_PATH)) throw new Error(`Sample CSV not found at ${CSV_PATH}. Run: cd ml-service && python -m training.generate_sample_data`);
  const rows = parse(fs.readFileSync(CSV_PATH), { columns: true, skip_empty_lines: true });
  // Take an evenly spaced subset so case types/courts are mixed.
  const step = Math.max(1, Math.floor(rows.length / count));
  const subset = rows.filter((_, i) => i % step === 0).slice(0, count);

  const date = (v) => (v ? new Date(v) : undefined);
  let inserted = 0;
  const created = [];
  for (const r of subset) {
    if (await Case.exists({ caseNumber: r.caseNumber })) continue;
    const isSynthetic = String(r.caseNumber).startsWith('SYN/');
    const doc = await Case.create({
      caseNumber: r.caseNumber,
      title: r.title,
      court: r.court,
      state: r.state,
      district: r.district || '',
      caseType: r.caseType,
      filingDate: date(r.filingDate),
      currentStage: r.currentStage,
      status: r.status,
      priority: r.priority,
      petitioner: r.petitioner,
      respondent: r.respondent,
      judge: r.judge,
      numberOfHearings: Number(r.numberOfHearings),
      numberOfAdjournments: Number(r.numberOfAdjournments),
      lastHearingDate: date(r.lastHearingDate),
      nextHearingDate: date(r.nextHearingDate),
      legalSections: (r.legalSections || '').split(';').map((s) => s.trim()).filter(Boolean),
      description: isSynthetic ? `${r.description || ''} [SYNTHETIC SAMPLE RECORD]`.trim() : (r.description || '').trim(),
      isSample: isSynthetic,
      createdBy: admin._id,
    });
    created.push(doc);
    inserted += 1;
  }
  logger.info(`Inserted ${inserted} ${isSynthetic ? 'synthetic sample' : 'real-world'} cases (${subset.length - inserted} already existed)`);

  if (flag('predict')) {
    const targets = created.length ? created : await Case.find({ riskLevel: null }).limit(count);
    let ok = 0;
    for (const c of targets) {
      try {
        await predictionService.runPrediction({ caseId: c._id, includeSimilar: true, includeRecommendations: true }, admin);
        ok += 1;
        if (ok % 20 === 0) logger.info(`  predicted ${ok}/${targets.length}`);
      } catch (err) {
        logger.error(`Prediction failed for ${c.caseNumber}: ${err.message}`);
        if (err.statusCode === 503) { logger.error('ML service unavailable - stopping. Start it and rerun with --predict.'); break; }
      }
    }
    logger.info(`Generated ${ok} predictions`);
  }

  await mongoose.connection.close();
  logger.info(`Seeding complete (env: ${env.NODE_ENV})`);
}

main().catch(async (err) => {
  logger.error(err.stack || err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
