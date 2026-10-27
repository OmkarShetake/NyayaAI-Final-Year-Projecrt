const caseService = require('../services/caseService');
const similarityService = require('../services/similarityService');
const kanoonSyncService = require('../services/kanoonSyncService');
const { asyncHandler, sendSuccess } = require('../utils/http');

exports.create = asyncHandler(async (req, res) => {
  const doc = await caseService.createCase(req.validated.body, req.user);
  sendSuccess(res, { status: 201, data: { case: doc.toJSON() }, message: 'Case created' });
});

exports.list = asyncHandler(async (req, res) => {
  const { items, pagination } = await caseService.listCases(req.validated.query);
  sendSuccess(res, { data: { cases: items }, meta: { pagination }, message: 'Cases' });
});

exports.get = asyncHandler(async (req, res) => {
  const doc = await caseService.getCase(req.validated.params.id);
  sendSuccess(res, { data: { case: doc.toJSON() }, message: 'Case' });
});

exports.update = asyncHandler(async (req, res) => {
  const doc = await caseService.updateCase(req.validated.params.id, req.validated.body, req.user);
  sendSuccess(res, { data: { case: doc.toJSON() }, message: 'Case updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  const result = await caseService.deleteCase(req.validated.params.id, req.user);
  sendSuccess(res, { data: result, message: 'Case deleted' });
});

/** POST /api/cases/:id/similar - computes (and stores) top-K similar cases. */
exports.findSimilar = asyncHandler(async (req, res) => {
  const doc = await caseService.getCase(req.validated.params.id);
  const similar = await similarityService.findSimilar(doc, req.validated.body, req.user);
  sendSuccess(res, { data: { caseId: doc._id, similarCases: similar }, message: `Found ${similar.length} similar cases` });
});

/** GET /api/cases/:id/similar - previously computed similar cases. */
exports.getSimilar = asyncHandler(async (req, res) => {
  const similar = await caseService.getStoredSimilar(req.validated.params.id);
  sendSuccess(res, { data: { caseId: req.validated.params.id, similarCases: similar }, message: 'Stored similar cases' });
});

/** POST /api/cases/sync-kanoon - trigger on-demand Indian Kanoon sync. */
exports.syncKanoon = asyncHandler(async (req, res) => {
  const { query, limit, predict } = req.body || {};
  const result = await kanoonSyncService.syncFromKanoon({
    query,
    limit: limit ? Number(limit) : undefined,
    runPredict: Boolean(predict),
    adminUser: req.user,
  });
  sendSuccess(res, { data: result, message: 'Indian Kanoon sync finished' });
});

/** GET /api/cases/sync-kanoon/status - get Indian Kanoon sync status. */
exports.getKanoonStatus = asyncHandler(async (req, res) => {
  const status = kanoonSyncService.getSyncStatus();
  sendSuccess(res, { data: status, message: 'Indian Kanoon sync status' });
});
