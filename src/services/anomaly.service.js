'use strict';
const { query }    = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger       = require('../utils/logger');

/* ── Statistical helpers ── */
function mean(arr)   { return arr.length ? arr.reduce((s,v) => s+v, 0) / arr.length : 0; }
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s,v) => s + Math.pow(v-m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}
function zScore(value, m, sd) { return sd === 0 ? 0 : (value - m) / sd; }

/* ── Z-SCORE ANOMALY: Unusual transaction amount in a category ── */
async function detectAmountAnomalies(userId) {
  const anomalies = [];

  // Get all expense categories with their transaction history
  const catRes = await query(
    `SELECT DISTINCT c.name AS category, c.id AS category_id
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id=$1 AND t.type='expense'`,
    [userId]
  );

  for (const cat of catRes.rows) {
    // Get historical amounts for this category (last 90 days, excluding last 7 days)
    const histRes = await query(
      `SELECT amount_inr FROM transactions
       WHERE user_id=$1 AND category_id=$2 AND type='expense'
         AND date < NOW() - INTERVAL '7 days'
         AND date > NOW() - INTERVAL '90 days'`,
      [userId, cat.category_id]
    );

    if (histRes.rows.length < 3) continue; // need at least 3 data points

    const historical = histRes.rows.map(r => parseFloat(r.amount_inr));
    const m  = mean(historical);
    const sd = stdDev(historical);
    if (sd === 0) continue;

    // Check recent transactions (last 7 days)
    const recentRes = await query(
      `SELECT t.id, t.description, t.amount, t.currency, t.amount_inr, t.date
       FROM transactions t
       WHERE t.user_id=$1 AND t.category_id=$2 AND t.type='expense'
         AND t.date >= NOW() - INTERVAL '7 days'`,
      [userId, cat.category_id]
    );

    for (const tx of recentRes.rows) {
      const txAmt = parseFloat(tx.amount_inr);
      const z     = zScore(txAmt, m, sd);

      if (Math.abs(z) >= 2.0) {
        const severity = Math.abs(z) >= 3.5 ? 'high' : Math.abs(z) >= 2.5 ? 'medium' : 'low';
        const direction = txAmt > m ? 'higher' : 'lower';

        anomalies.push({
          transactionId: tx.id,
          anomalyType:   'unusual_amount',
          severity,
          category:      cat.category,
          amount:        parseFloat(tx.amount),
          zScore:        parseFloat(z.toFixed(4)),
          description:   `"${tx.description}" (₹${parseFloat(tx.amount).toFixed(2)}) is significantly ${direction} than your usual ${cat.category} spending (avg ₹${m.toFixed(2)}).`,
        });
      }
    }
  }

  return anomalies;
}

/* ── FREQUENCY ANOMALY: More transactions than usual in a category ── */
async function detectFrequencyAnomalies(userId) {
  const anomalies = [];
  const now       = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear  = now.getFullYear();

  const res = await query(
    `SELECT
       COALESCE(c.name,'Uncategorised') AS category,
       EXTRACT(MONTH FROM t.date)::int  AS month,
       EXTRACT(YEAR  FROM t.date)::int  AS year,
       COUNT(*) AS tx_count
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id=$1 AND t.type='expense'
       AND t.date >= NOW() - INTERVAL '6 months'
     GROUP BY c.name, month, year
     ORDER BY category, year, month`,
    [userId]
  );

  // Group by category
  const byCategory = {};
  for (const row of res.rows) {
    if (!byCategory[row.category]) byCategory[row.category] = [];
    byCategory[row.category].push({ month: row.month, year: row.year, count: parseInt(row.tx_count) });
  }

  for (const [cat, months] of Object.entries(byCategory)) {
    const historicalCounts = months
      .filter(m => !(m.month === thisMonth && m.year === thisYear))
      .map(m => m.count);

    if (historicalCounts.length < 2) continue;

    const thisMonthData = months.find(m => m.month === thisMonth && m.year === thisYear);
    if (!thisMonthData) continue;

    const m  = mean(historicalCounts);
    const sd = stdDev(historicalCounts);
    if (sd === 0) continue;

    const z = zScore(thisMonthData.count, m, sd);
    if (z >= 2.0) {
      anomalies.push({
        transactionId: null,
        anomalyType:   'high_frequency',
        severity:      z >= 3 ? 'high' : 'medium',
        category:      cat,
        amount:        null,
        zScore:        parseFloat(z.toFixed(4)),
        description:   `You've made ${thisMonthData.count} ${cat} transactions this month, which is unusually high compared to your average of ${m.toFixed(1)} per month.`,
      });
    }
  }

  return anomalies;
}

/* ── LARGE TRANSACTION: Single transaction > 3x category average ── */
async function detectLargeTransactions(userId) {
  const anomalies = [];

  const res = await query(
  `SELECT
     t.id, t.description, t.amount, t.amount_inr, t.date,
     COALESCE(c.name,'Uncategorised') AS category,
     AVG(t.amount_inr) OVER (PARTITION BY t.category_id) AS cat_avg
   FROM transactions t
   LEFT JOIN categories c ON c.id = t.category_id
   WHERE t.user_id=$1 AND t.type='expense'
     AND t.date >= NOW() - INTERVAL '30 days'`,
  [userId]
);

  const seen = new Set();
  for (const row of res.rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);

    const txAmt  = parseFloat(row.amount_inr);
    const catAvg = parseFloat(row.cat_avg);

    if (catAvg > 0 && txAmt > catAvg * 3 && txAmt > 5000) {
      anomalies.push({
        transactionId: row.id,
        anomalyType:   'large_transaction',
        severity:      txAmt > catAvg * 5 ? 'high' : 'medium',
        category:      row.category,
        amount:        parseFloat(row.amount),
        zScore:        null,
        description:   `"${row.description}" (₹${parseFloat(row.amount).toFixed(2)}) is more than 3× your average ${row.category} transaction (avg ₹${catAvg.toFixed(2)}).`,
      });
    }
  }

  return anomalies;
}

/* ── Save detected anomalies to DB (skip already existing ones) ── */
async function saveAnomalies(userId, anomalies) {
  for (const a of anomalies) {
    // Skip if an identical anomaly for this tx already exists
    if (a.transactionId) {
      const exists = await query(
        'SELECT 1 FROM anomalies WHERE user_id=$1 AND transaction_id=$2 AND anomaly_type=$3 AND is_dismissed=FALSE',
        [userId, a.transactionId, a.anomalyType]
      );
      if (exists.rows.length) continue;
    }

    await query(
      `INSERT INTO anomalies
         (user_id, transaction_id, anomaly_type, severity, description, category, amount, z_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, a.transactionId || null, a.anomalyType, a.severity, a.description, a.category, a.amount, a.zScore]
    );
  }
}

/* ── Run full anomaly detection for a user ── */
async function runDetection(userId) {
  try {
    const [amountAnomalies, freqAnomalies, largeAnomalies] = await Promise.all([
      detectAmountAnomalies(userId),
      detectFrequencyAnomalies(userId),
      detectLargeTransactions(userId),
    ]);

    const all = [...amountAnomalies, ...freqAnomalies, ...largeAnomalies];
    await saveAnomalies(userId, all);

    logger.info('Anomaly detection complete', { userId, found: all.length });
    return all;
  } catch (err) {
    logger.error('Anomaly detection failed', { userId, err: err.message });
    throw err;
  }
}

/* ── Get saved anomalies ── */
async function getAnomalies(userId) {
  const res = await query(
    `SELECT * FROM anomalies
     WHERE user_id=$1 AND is_dismissed=FALSE
     ORDER BY
       CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       detected_at DESC`,
    [userId]
  );
  return res.rows;
}

/* ── Dismiss an anomaly ── */
async function dismiss(userId, anomalyId) {
  const res = await query(
    'UPDATE anomalies SET is_dismissed=TRUE WHERE id=$1 AND user_id=$2 RETURNING id',
    [anomalyId, userId]
  );
  if (!res.rows.length) throw new AppError('Anomaly not found', 404);
  return { message: 'Anomaly dismissed' };
}

module.exports = { runDetection, getAnomalies, dismiss };
