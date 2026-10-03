'use strict';
require('dotenv').config();

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const cookieParser = require('cookie-parser');

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Route files
const authRoutes        = require('./routes/auth.routes');
const transactionRoutes = require('./routes/transaction.routes');
const budgetRoutes      = require('./routes/budget.routes');
const categoryRoutes    = require('./routes/category.routes');
const reportRoutes      = require('./routes/report.routes');
const aiRoutes          = require('./routes/ai.routes');

const fs = require('fs');
const { query } = require('./config/database');

let migrationsCompleted = false;

async function runMigrations() {
  try {
    const migrationsPath = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsPath).sort();
    let allSuccess = true;
    for (const file of files) {
      if (file.endsWith('.sql')) {
        try {
          const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
          await query(sql);
          logger.info(`✅ Migration done: ${file}`);
        } catch (err) {
          if (err.message && err.message.includes('already exists')) {
            logger.info(`ℹ️ Migration skipped (already exists): ${file}`);
          } else {
            allSuccess = false;
            logger.warn(`⚠️ Migration failed: ${file} → ${err.message}`);
          }
        }
      }
    }
    if (allSuccess) {
      migrationsCompleted = true;
      logger.info('✅ All migrations complete!');
    }
  } catch (err) {
    logger.error('Migration runner error:', err.message);
  }
}

const app = express();
app.set('trust proxy', 1);

/* ── Security ── */
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    // Reflect origin to support credentials from any web origin / localhost / render
    callback(null, true);
  },
  credentials: true,
}));

/* ── General middleware ── */
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

/* ── HTTP Logging ── */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

/* ── Rate limiting ── */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: true, message: 'Too many requests. Please wait and try again.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders:   false,
});

app.use('/api/auth', authLimiter);
app.use('/api',      apiLimiter);

// Retry migrations if previous attempt failed on cold-start
app.use(async (req, _res, next) => {
  if (!migrationsCompleted && req.path.startsWith('/api') && req.path !== '/api/health') {
    try {
      await runMigrations();
    } catch (_) {}
  }
  next();
});

/* ── Static files (frontend + uploads) ── */
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

/* ── API Routes ── */
app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets',      budgetRoutes);
app.use('/api/categories',   categoryRoutes);
app.use('/api/reports',      reportRoutes);
app.use('/api/ai',           aiRoutes);

/* ── Health check with Database status ── */
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  let dbError = null;
  let dbHost = null;

  try {
    if (process.env.DATABASE_URL) {
      try {
        const u = new URL(process.env.DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'http://'));
        dbHost = u.hostname;
      } catch (_) {
        dbHost = 'unparseable';
      }
    } else {
      dbHost = process.env.DB_HOST || 'localhost';
    }

    await query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbError = err.message;
  }

  const isHealthy = dbStatus === 'connected';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    database: {
      status: dbStatus,
      host: dbHost,
      ...(dbError ? { error: dbError } : {}),
      migrations: migrationsCompleted ? 'completed' : 'pending',
    },
    env: process.env.NODE_ENV || 'development',
    ts: new Date().toISOString(),
  });
});

/* ── SPA fallback (serve index.html for all unknown routes) ── */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

/* ── 404 + Error handler ── */
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  runMigrations().then(() => {
    app.listen(PORT, () => {
      logger.info(`✓ Finflow server running → http://localhost:${PORT}`);
      require('./jobs/fxRefresh');
      require('./jobs/budgetNotify');
    });
  });
}

module.exports = app;
