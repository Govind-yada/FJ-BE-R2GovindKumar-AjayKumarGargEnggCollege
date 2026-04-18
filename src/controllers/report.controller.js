'use strict';
const reportService = require('../services/report.service');

async function monthly(req, res, next) {
  try {
    const year     = parseInt(req.query.year || new Date().getFullYear());
    const currency = req.query.currency || req.user.currency || 'INR';
    const data     = await reportService.monthly(req.user.id, year, currency);
    res.json({ data });
  } catch (err) { next(err); }
}

async function categoryBreakdown(req, res, next) {
  try {
    const year     = parseInt(req.query.year || new Date().getFullYear());
    const currency = req.query.currency || req.user.currency || 'INR';
    const data     = await reportService.categoryBreakdown(req.user.id, year, currency);
    res.json({ data });
  } catch (err) { next(err); }
}

async function netWorth(req, res, next) {
  try {
    const year     = parseInt(req.query.year || new Date().getFullYear());
    const currency = req.query.currency || req.user.currency || 'INR';
    const data     = await reportService.netWorth(req.user.id, year, currency);
    res.json({ data });
  } catch (err) { next(err); }
}

async function dashboardSummary(req, res, next) {
  try {
    const currency = req.query.currency || req.user.currency || 'INR';
    const data     = await reportService.dashboardSummary(req.user.id, currency);
    res.json({ data });
  } catch (err) { next(err); }
}

module.exports = { monthly, categoryBreakdown, netWorth, dashboardSummary };
