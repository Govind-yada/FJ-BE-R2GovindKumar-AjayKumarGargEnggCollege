'use strict';
const cron       = require('node-cron');
const { query }  = require('../config/database');
const { sendMail } = require('../utils/email');
const { formatCurrency } = require('../utils/currency');
const logger     = require('../utils/logger');

async function sendMonthlySummaries() {
  try {
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    // Find users who opted in
    const { rows: users } = await query(
      'SELECT * FROM users WHERE notif_monthly_summary = TRUE'
    );

    for (const user of users) {
      const { rows } = await query(
        `SELECT type, SUM(amount_inr) AS total
         FROM transactions
         WHERE user_id = $1
           AND EXTRACT(MONTH FROM date) = $2
           AND EXTRACT(YEAR  FROM date) = $3
         GROUP BY type`,
        [user.id, month, year]
      );

      let income = 0, expense = 0, investment = 0;
      for (const r of rows) {
        if (r.type === 'income')     income     = parseFloat(r.total);
        if (r.type === 'expense')    expense    = parseFloat(r.total);
        if (r.type === 'investment') investment = parseFloat(r.total);
      }
      const net = income - expense - investment;

      const monthName = now.toLocaleString('en-IN', { month: 'long' });

      await sendMail({
        to:      user.email,
        subject: `Your ${monthName} ${year} Financial Summary — Finflow`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f1520;color:#eef1f7;border-radius:12px;overflow:hidden">
            <div style="background:#d4a843;padding:24px 32px">
              <h1 style="margin:0;font-size:22px;color:#08090d">📊 Monthly Summary — ${monthName} ${year}</h1>
            </div>
            <div style="padding:32px">
              <p>Hi ${user.first_name},</p>
              <p style="color:#8a94a8">Here's your financial summary for ${monthName} ${year}:</p>
              <div style="background:#1c2538;border-radius:8px;padding:20px;margin:20px 0">
                <div style="display:flex;justify-content:space-between;margin-bottom:12px">
                  <span>Total Income</span><strong style="color:#2dd4a0">${formatCurrency(income)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:12px">
                  <span>Total Expenses</span><strong style="color:#ff5c5c">${formatCurrency(expense)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:12px">
                  <span>Investments</span><strong style="color:#4a9eff">${formatCurrency(investment)}</strong>
                </div>
                <div style="border-top:1px solid #2d3748;padding-top:12px;display:flex;justify-content:space-between">
                  <span>Net Savings</span><strong style="color:${net >= 0 ? '#d4a843' : '#ff5c5c'}">${formatCurrency(net)}</strong>
                </div>
              </div>
              <p style="color:#8a94a8;font-size:13px">Keep up the great work! Log in to Finflow for detailed reports.</p>
            </div>
          </div>`,
      });
      logger.info('Monthly summary sent', { userId: user.id });
    }
  } catch (err) {
    logger.error('Monthly summary job failed', { message: err.message });
  }
}

// Run on the 1st of every month at 08:00 AM
cron.schedule('0 8 1 * *', sendMonthlySummaries);

module.exports = { sendMonthlySummaries };
