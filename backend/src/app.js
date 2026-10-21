const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const env = require('./config/env');
const logger = require('./config/logger');
const { dbState } = require('./config/db');
const mlService = require('./services/mlService');
const geminiService = require('./services/geminiService');
const kanoonSyncService = require('./services/kanoonSyncService');
const { sendSuccess, asyncHandler } = require('./utils/http');

const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const notFound = require('./middleware/notFoundMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin(origin, cb) {
    // Allow same-origin / server-to-server (no Origin header) and configured origins.
    if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(mongoSanitize({ replaceWith: '_' })); // strips $ and . operators from user input
app.use(morgan(env.isProduction ? 'combined' : 'dev', { stream: logger.stream, skip: () => env.NODE_ENV === 'test' }));
app.use('/api', rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.', error: 'RATE_LIMITED' },
}));

app.get('/api/health', asyncHandler(async (_req, res) => {
  const ml = await mlService.health();
  const db = dbState();
  const healthy = db === 'connected' && ml.reachable && ml.modelLoaded;
  sendSuccess(res, {
    status: db === 'connected' ? 200 : 503,
    data: {
      status: healthy ? 'ok' : 'degraded',
      api: 'ok',
      database: db,
      mlService: ml,
      gemini: geminiService.isEnabled() ? 'configured' : 'not configured (template fallback)',
      indianKanoon: kanoonSyncService.isConfigured() ? 'configured' : 'not configured',
      uptimeSeconds: Math.round(process.uptime()),
    },
    message: healthy ? 'All systems operational' : 'Some services are degraded',
  });
}));

// Friendly root + short health alias so opening the bare service URL doesn't look like an error.
app.get('/', (_req, res) => sendSuccess(res, {
  data: { name: 'NyayaAI API', health: '/api/health', docs: 'See docs/api.md in the repository' },
  message: 'NyayaAI API is running',
}));
app.get(['/health', '/api'], (_req, res) => res.redirect(302, '/api/health'));

app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/recommendations', recommendationRoutes);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;