const mongoose = require('mongoose');

const similarCaseSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    // Null when the match comes from the historical (synthetic sample) corpus instead of the database.
    similarCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', default: null },
    referenceId: { type: String, required: true },
    source: { type: String, enum: ['database', 'historical-sample', 'kanoon'], required: true },
    caseNumber: String,
    title: String,
    caseType: String,
    court: String,
    state: String,
    currentStage: String,
    status: String,
    riskLevel: String,
    delayDays: Number,
    similarityScore: { type: Number, min: 0, max: 1, required: true },
    explanation: String,
    method: String,
    docUrl: String,
    citation: String,
    headline: String,
    kanoonTid: Number,
    predictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prediction', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

similarCaseSchema.index({ caseId: 1, similarityScore: -1 });
similarCaseSchema.set('toJSON', { transform: (_d, r) => { delete r.__v; return r; } });

module.exports = mongoose.model('SimilarCase', similarCaseSchema);
