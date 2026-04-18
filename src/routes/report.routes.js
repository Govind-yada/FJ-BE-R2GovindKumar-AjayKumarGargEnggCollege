'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/report.controller');
const { authenticateJWT } = require('../middleware/auth');

router.use(authenticateJWT);

router.get('/dashboard',          ctrl.dashboardSummary);
router.get('/monthly',            ctrl.monthly);
router.get('/category-breakdown', ctrl.categoryBreakdown);
router.get('/net-worth',          ctrl.netWorth);

module.exports = router;
