'use strict';
const txRepo      = require('../repositories/transaction.repository');
const { convert } = require('../utils/currency');

async function monthly(userId, year, currency = 'INR') {
  const rows = await txRepo.monthlySummary(userId, year);

  const months = Array.from({ length: 12 }, (_, i) => ({
    month:      i + 1,
    income:     0,
    expense:    0,
    investment: 0,
  }));

  for (const row of rows) {
    const m = months[row.month - 1];
    const amount = await convert(parseFloat(row.total_inr || 0), 'INR', currency);
    m[row.type] += amount;
  }

  return months.map(m => ({
    ...m,
    net: m.income - m.expense - m.investment,
  }));
}

async function categoryBreakdown(userId, year, currency = 'INR') {
  const rows = await txRepo.categoryBreakdown(userId, year);
  const result = [];
  for (const row of rows) {
    const amount = await convert(parseFloat(row.total_inr || 0), 'INR', currency);
    result.push({
      category: row.category || 'Uncategorised',
      emoji:    row.emoji    || '📊',
      type:     row.type,
      amount,
    });
  }
  return result;
}

async function netWorth(userId, year, currency = 'INR') {
  const months = await monthly(userId, year, currency);
  let running = 0;
  return months.map(m => {
    running += m.income - m.expense;
    return { month: m.month, netWorth: running };
  });
}

async function dashboardSummary(userId, currency = 'INR') {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  // Current month rows
  const rows = await txRepo.monthlySummary(userId, year);
  const cur  = rows.filter(r => r.month === month);

  let income = 0, expense = 0, investment = 0;
  for (const r of cur) {
    const amt = await convert(parseFloat(r.total_inr || 0), 'INR', currency);
    if (r.type === 'income')     income     += amt;
    if (r.type === 'expense')    expense    += amt;
    if (r.type === 'investment') investment += amt;
  }

  return {
    income, expense, investment,
    savings: income - expense - investment,
    currency,
    month, year,
  };
}

module.exports = { monthly, categoryBreakdown, netWorth, dashboardSummary };
