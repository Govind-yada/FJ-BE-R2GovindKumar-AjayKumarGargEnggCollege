'use strict';
const aiService      = require('../services/ai.service');
const importService  = require('../services/import.service');
const anomalyService = require('../services/anomaly.service');

/* ── AI CHAT ── */
async function chat(req, res, next) {
  try {
    const result = await aiService.chat(req.user.id, req.body.question);
    res.json({ data: result });
  } catch (err) { next(err); }
}

async function getHistory(req, res, next) {
  try {
    const history = await aiService.getHistory(req.user.id);
    res.json({ data: history });
  } catch (err) { next(err); }
}

async function clearHistory(req, res, next) {
  try {
    await aiService.clearHistory(req.user.id);
    res.json({ data: { message: 'Conversation cleared' } });
  } catch (err) { next(err); }
}

async function getInsight(req, res, next) {
  try {
    const insight = await aiService.getInsight(req.user.id);
    res.json({ data: insight });
  } catch (err) { next(err); }
}

/* ── BANK IMPORT ── */
async function importStatement(req, res, next) {
  try {
    if (!req.file) return next(require('../middleware/errorHandler').AppError('No file uploaded', 400));
    const record = await importService.startImport(req.user.id, req.file);
    res.status(202).json({ data: record, message: 'Import started. Check status endpoint for progress.' });
  } catch (err) { next(err); }
}

async function importStatus(req, res, next) {
  try {
    const status = await importService.getImportStatus(req.user.id, req.params.id);
    res.json({ data: status });
  } catch (err) { next(err); }
}

async function importHistory(req, res, next) {
  try {
    const history = await importService.getImportHistory(req.user.id);
    res.json({ data: history });
  } catch (err) { next(err); }
}

/* ── ANOMALY DETECTION ── */
async function detectAnomalies(req, res, next) {
  try {
    const anomalies = await anomalyService.runDetection(req.user.id);
    res.json({ data: anomalies, count: anomalies.length });
  } catch (err) { next(err); }
}

async function getAnomalies(req, res, next) {
  try {
    const anomalies = await anomalyService.getAnomalies(req.user.id);
    res.json({ data: anomalies });
  } catch (err) { next(err); }
}

async function dismissAnomaly(req, res, next) {
  try {
    const result = await anomalyService.dismiss(req.user.id, req.params.id);
    res.json({ data: result });
  } catch (err) { next(err); }
}

module.exports = {
  chat, getHistory, clearHistory, getInsight,
  importStatement, importStatus, importHistory,
  detectAnomalies, getAnomalies, dismissAnomaly,
};
