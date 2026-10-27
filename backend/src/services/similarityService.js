/**
 * Similar case retrieval orchestration.
 * Queries Indian Kanoon API for live judicial precedents (default),
 * with intelligent fallback/augmentation from MongoDB and ML service retriever.
 */
const Case = require('../models/Case');
const SimilarCase = require('../models/SimilarCase');
const env = require('../config/env');
const mlService = require('./mlService');
const logger = require('../config/logger');

const getKanoonSyncService = () => require('./kanoonSyncService');

const CANDIDATE_FIELDS = 'caseNumber title court state district caseType filingDate currentStage status priority '
  + 'numberOfHearings numberOfAdjournments lastHearingDate nextHearingDate legalSections description riskLevel predictedDelayDays';

async function findSimilar(caseDoc, { topK = 5, includeHistorical = true, source = 'kanoon', query = null, predictionId = null } = {}, user = null) {
  let docs = [];
  let kanoonSuccess = false;
  const kanoonSyncService = getKanoonSyncService();

  // 1. If source is 'kanoon' (default) or 'all', search Indian Kanoon API for real precedents
  if (source !== 'database' && kanoonSyncService && typeof kanoonSyncService.isConfigured === 'function' && kanoonSyncService.isConfigured()) {
    try {
      const kanoonResults = await kanoonSyncService.searchSimilarJudgments(caseDoc, {
        topK,
        customQuery: query,
        adminUser: user,
      });
      if (kanoonResults && kanoonResults.length > 0) {
        kanoonSuccess = true;
        docs = kanoonResults.map((r) => ({
          ...r,
          caseId: caseDoc._id,
          predictionId,
        }));
      }
    } catch (err) {
      logger.warn(`[SimilarCases] Indian Kanoon query failed, falling back to database/ML service: ${err.message}`);
    }
  }

  // 2. If source is 'database', or 'all', or Kanoon returned no results, query local DB + ML service
  if (source === 'database' || source === 'all' || !kanoonSuccess || docs.length < topK) {
    const needed = source === 'all' ? topK : Math.max(1, topK - docs.length);
    try {
      const candidates = await Case.find({ _id: { $ne: caseDoc._id } })
        .select(CANDIDATE_FIELDS)
        .sort({ createdAt: -1 })
        .limit(env.SIMILARITY_CANDIDATE_LIMIT)
        .lean();

      if (candidates.length > 0) {
        const { method, results } = await mlService.similar(caseDoc, candidates, { topK: needed, includeHistorical });

        const dbDocs = results.map((r) => ({
          caseId: caseDoc._id,
          similarCaseId: r.source === 'database' ? r.caseId : null,
          referenceId: r.referenceId,
          source: r.source,
          caseNumber: r.caseNumber,
          title: r.title,
          caseType: r.caseType,
          court: r.court,
          state: r.state,
          currentStage: r.currentStage,
          status: r.status,
          riskLevel: r.riskLevel,
          delayDays: r.delayDays,
          similarityScore: Math.min(1, Math.max(0, r.similarityScore)),
          explanation: r.explanation,
          method,
          predictionId,
        }));

        if (source === 'all') {
          // Merge Kanoon + DB results, sort by similarityScore descending
          const combined = [...docs, ...dbDocs].sort((a, b) => b.similarityScore - a.similarityScore);
          docs = combined.slice(0, topK);
        } else if (!kanoonSuccess) {
          docs = dbDocs;
        } else {
          docs = [...docs, ...dbDocs].slice(0, topK);
        }
      }
    } catch (dbErr) {
      logger.warn(`[SimilarCases] DB/ML similarity search error: ${dbErr.message}`);
    }
  }

  // Save to database
  await SimilarCase.deleteMany({ caseId: caseDoc._id });
  const saved = docs.length ? await SimilarCase.insertMany(docs) : [];
  return saved.map((d) => (d.toJSON ? d.toJSON() : d));
}

module.exports = { findSimilar };
