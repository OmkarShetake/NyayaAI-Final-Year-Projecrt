const { z } = require('zod');
const { RISK_LEVELS, REC_PRIORITIES, CASE_TYPES, COURTS, STATUSES } = require('../constants/enums');

const objectId = (label) => z.string().regex(/^[a-f\d]{24}$/i, `Invalid ${label}`);
const optionalDate = z.preprocess((v) => (v === '' || v == null ? undefined : v),
  z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date').transform((v) => new Date(v)).optional());

const createPredictionSchema = z.object({
  caseId: objectId('case id'),
  includeSimilar: z.boolean().optional().default(true),
  includeRecommendations: z.boolean().optional().default(true),
}).strict();

const similarBodySchema = z.object({
  topK: z.coerce.number().int().min(1).max(20).optional().default(5),
  includeHistorical: z.boolean().optional().default(true),
  source: z.enum(['kanoon', 'all', 'database']).optional().default('kanoon'),
  query: z.string().trim().max(300).optional(),
}).strict();

const listPredictionsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  caseId: objectId('case id').optional(),
});

const analyticsQuery = z.object({
  from: optionalDate,
  to: optionalDate,
  caseType: z.enum(CASE_TYPES).optional(),
  riskLevel: z.enum([...RISK_LEVELS, 'UNASSESSED']).optional(),
  court: z.enum(COURTS).optional(),
  state: z.string().trim().max(60).optional(),
  status: z.enum(STATUSES).optional(),
});

const recommendationsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  priority: z.enum(REC_PRIORITIES).optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  caseId: objectId('case id').optional(),
});

module.exports = { createPredictionSchema, similarBodySchema, listPredictionsQuery, analyticsQuery, recommendationsQuery };
