/**
 * Prediction orchestration:
 * Case (Mongo) -> ML /predict (XGBoost + SHAP) -> similar cases -> recommendations
 * -> narrative (Gemini or template) -> persist Prediction -> update Case summary fields.
 */
const Case = require('../models/Case');
const Prediction = require('../models/Prediction');
const SimilarCase = require('../models/SimilarCase');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const mlService = require('./mlService');
const similarityService = require('./similarityService');
const recommendationService = require('./recommendationService');
const geminiService = require('./geminiService');

async function runPrediction({ caseId, includeSimilar = true, includeRecommendations = true }, user) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) throw ApiError.notFound('Case not found');

  const ml = await mlService.predict(caseDoc);
  const narrative = await geminiService.explainPrediction(caseDoc, ml);

  const prediction = await Prediction.create({
    caseId: caseDoc._id,
    riskLevel: ml.riskLevel,
    probability: ml.probability,
    classProbabilities: ml.classProbabilities,
    predictedDelayDays: ml.predictedDelayDays,
    modelVersion: ml.modelVersion,
    modelType: ml.modelType,
    featureContributions: ml.features,
    explanation: {
      method: ml.explanation.method,
      label: ml.explanation.label,
      basis: ml.explanation.basis,
      summary: ml.explanation.summary,
      disclaimer: ml.explanation.disclaimer,
      narrative: narrative.text,
      narrativeSource: narrative.source,
    },
    inputFeatures: ml.inputFeatures,
    requestedBy: user?._id,
  });

  caseDoc.riskLevel = ml.riskLevel;
  caseDoc.riskProbability = ml.probability;
  caseDoc.predictedDelayDays = ml.predictedDelayDays;
  caseDoc.lastPredictionId = prediction._id;
  caseDoc.lastPredictedAt = prediction.createdAt;
  await caseDoc.save();

  let similarCases = [];
  let similarError = null;
  if (includeSimilar) {
    try {
      similarCases = await similarityService.findSimilar(caseDoc, { predictionId: prediction._id }, user);
    } catch (err) {
      // Prediction is still valid even if retrieval fails; surface the issue to the client.
      similarError = err.message;
      logger.warn(`Similar-case retrieval failed for ${caseId}: ${err.message}`);
    }
  }

  const recommendations = includeRecommendations
    ? await recommendationService.generateAndSave({ caseDoc, prediction: ml, similarCases, predictionId: prediction._id })
    : [];

  return { prediction: prediction.toJSON(), case: caseDoc.toJSON(), similarCases, recommendations, warnings: similarError ? [similarError] : [] };
}

async function latestForCase(caseId) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) throw ApiError.notFound('Case not found');
  const prediction = await Prediction.findOne({ caseId }).sort({ createdAt: -1 });
  const [similarCases, recommendations, historyCount] = await Promise.all([
    SimilarCase.find({ caseId }).sort({ similarityScore: -1 }).lean(),
    recommendationService.forCase(caseId),
    Prediction.countDocuments({ caseId }),
  ]);
  return {
    case: caseDoc.toJSON(),
    prediction: prediction ? prediction.toJSON() : null,
    // Case edited after the last prediction -> results may be outdated.
    stale: Boolean(prediction && caseDoc.lastPredictedAt && caseDoc.updatedAt - caseDoc.lastPredictedAt > 5000),
    similarCases,
    recommendations,
    historyCount,
  };
}

async function list(q) {
  const filter = {};
  if (q.riskLevel) filter.riskLevel = q.riskLevel;
  if (q.caseId) filter.caseId = q.caseId;
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    Prediction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(q.limit)
      .select('-inputFeatures -featureContributions')
      .populate('caseId', 'caseNumber title caseType court status'),
    Prediction.countDocuments(filter),
  ]);
  return { items: items.map((i) => i.toJSON()), pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) } };
}

async function getById(id) {
  const p = await Prediction.findById(id).populate('caseId', 'caseNumber title caseType court status');
  if (!p) throw ApiError.notFound('Prediction not found');
  return p.toJSON();
}

module.exports = { runPrediction, latestForCase, list, getById };
