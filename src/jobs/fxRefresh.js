'use strict';
const cron   = require('node-cron');
const https  = require('https');
const { query }  = require('../config/database');
const logger = require('../utils/logger');

const CURRENCIES = ['INR','USD','EUR','GBP','JPY','AED','SGD'];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function refreshRates() {
  const appId = process.env.OPENEXCHANGE_APP_ID;
  if (!appId) {
    logger.warn('FX refresh skipped — OPENEXCHANGE_APP_ID not set');
    return;
  }
  try {
    const url  = `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=${CURRENCIES.join(',')}&base=USD`;
    const data = await httpsGet(url);
    const rates = data.rates;   // { INR: 83.4, USD: 1, EUR: 0.92 … }

    for (const base of CURRENCIES) {
      for (const target of CURRENCIES) {
        if (base === target) continue;
        const rate = rates[target] / rates[base];
        await query(
          `INSERT INTO exchange_rates (base, target, rate, fetched_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (base, target)
           DO UPDATE SET rate = $3, fetched_at = NOW()`,
          [base, target, rate.toFixed(8)]
        );
      }
    }
    logger.info('Exchange rates refreshed successfully');
  } catch (err) {
    logger.error('FX rate refresh failed', { message: err.message });
  }
}

// Schedule: every 6 hours
cron.schedule('0 */6 * * *', refreshRates);

// Run once on startup
refreshRates();

module.exports = { refreshRates };
