'use strict';
const { query } = require('../config/database');

// Fallback static rates relative to INR (used if DB lookup fails)
const FALLBACK = {
  INR: 1, USD: 0.01199, EUR: 0.01104,
  GBP: 0.00953, JPY: 1.793, AED: 0.04402, SGD: 0.01611,
};

async function getRate(from, to) {
  if (from === to) return 1;
  try {
    const res = await query(
      'SELECT rate FROM exchange_rates WHERE base=$1 AND target=$2',
      [from, to]
    );
    if (res.rows.length) return parseFloat(res.rows[0].rate);
  } catch (_) { /* fall through */ }
  // Fallback: convert via INR pivot
  const fromRate = FALLBACK[from] || 1;
  const toRate   = FALLBACK[to]   || 1;
  return toRate / fromRate;
}

async function convert(amount, from, to) {
  if (from === to) return parseFloat(amount);
  const rate = await getRate(from, to);
  return parseFloat((amount * rate).toFixed(2));
}

async function toINR(amount, currency) {
  return convert(amount, currency, 'INR');
}

function formatCurrency(amount, currency = 'INR') {
  const symbols = { INR:'₹', USD:'$', EUR:'€', GBP:'£', JPY:'¥', AED:'د.إ', SGD:'S$' };
  const sym = symbols[currency] || currency + ' ';
  const abs = Math.abs(amount);
  const formatted = currency === 'INR'
    ? abs.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
    : abs.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  return (amount < 0 ? '-' : '') + sym + formatted;
}

module.exports = { getRate, convert, toINR, formatCurrency };
