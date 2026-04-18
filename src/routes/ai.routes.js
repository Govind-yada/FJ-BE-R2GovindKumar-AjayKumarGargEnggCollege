'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/ai.controller');
const { authenticateJWT } = require('../middleware/auth');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

router.use(authenticateJWT);

/* ── Upload config for bank statements ── */
const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'imports');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const importUpload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB for bank statements
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.pdf'].includes(ext)) cb(null, true);
    else cb(new Error('Only CSV and PDF files are supported'), false);
  },
});

/* ── AI Chat ── */
router.post('/chat',           ctrl.chat);
router.get('/chat/history',    ctrl.getHistory);
router.delete('/chat/history', ctrl.clearHistory);
router.get('/insight',         ctrl.getInsight);

/* ── Bank Statement Import ── */
router.post('/import',              importUpload.single('statement'), ctrl.importStatement);
router.get('/import/history',       ctrl.importHistory);
router.get('/import/:id/status',    ctrl.importStatus);

/* ── Anomaly Detection ── */
router.post('/anomalies/detect',    ctrl.detectAnomalies);
router.get('/anomalies',            ctrl.getAnomalies);
router.patch('/anomalies/:id/dismiss', ctrl.dismissAnomaly);

module.exports = router;
