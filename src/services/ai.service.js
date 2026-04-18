'use strict';
const { query }       = require('../config/database');
const openai          = require('../utils/openai');
const txRepo          = require('../repositories/transaction.repository');
const { convert }     = require('../utils/currency');
const { AppError }    = require('../middleware/errorHandler');
const logger          = require('../utils/logger');

/* ── Save a conversation turn ── */
async function saveMessage(userId, role, content) {
  await query(
    'INSERT INTO ai_conversations (user_id, role, content) VALUES ($1,$2,$3)',
    [userId, role, content]
  );
}

/* ── Get conversation history ── */
async function getHistory(userId, limit = 20) {
  const res = await query(
    `SELECT role, content, created_at
     FROM ai_conversations
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  // Return in chronological order
  return res.rows.reverse().map(r => ({ role: r.role, content: r.content }));
}

/* ── Clear conversation ── */
async function clearHistory(userId) {
  await query('DELETE FROM ai_conversations WHERE user_id=$1', [userId]);
}

/* ── Build financial context string for the AI ── */
async function buildFinancialContext(userId) {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const monthData = await txRepo.monthlySummary(userId, year);
  const curMonth  = monthData.filter(r => r.month === month);

  let income = 0, expense = 0, investment = 0;
  for (const r of curMonth) {
    const amt = parseFloat(r.total_inr || 0);
    if (r.type === 'income')     income     += amt;
    if (r.type === 'expense')    expense    += amt;
    if (r.type === 'investment') investment += amt;
  }

  const catData = await txRepo.categoryBreakdown(userId, year);
  const topCats = catData
    .filter(c => c.type === 'expense')
    .slice(0, 5)
    .map(c => `${c.category} (₹${parseFloat(c.total_inr).toFixed(0)})`);

  const savings     = income - expense - investment;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  return `Month: ${now.toLocaleString('en-IN',{month:'long'})} ${year}
Income: ₹${income.toFixed(2)}
Expenses: ₹${expense.toFixed(2)}
Investments: ₹${investment.toFixed(2)}
Net Savings: ₹${savings.toFixed(2)}
Savings Rate: ${savingsRate.toFixed(1)}%
Top Expense Categories: ${topCats.join(', ') || 'none yet'}`;
}

/* ── Main chat function ── */
async function chat(userId, question) {
  if (!question?.trim()) throw new AppError('Question cannot be empty', 400);

  const [history, context] = await Promise.all([
    getHistory(userId),
    buildFinancialContext(userId),
  ]);

  const answer = await openai.answerQuestion(question, history, context);

  // Save both turns
  await saveMessage(userId, 'user',      question);
  await saveMessage(userId, 'assistant', answer);

  return { question, answer };
}

/* ── Generate monthly insight ── */
async function getInsight(userId) {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const monthData = await txRepo.monthlySummary(userId, year);
  const curMonth  = monthData.filter(r => r.month === month);

  let income = 0, expense = 0, investment = 0;
  for (const r of curMonth) {
    const amt = parseFloat(r.total_inr || 0);
    if (r.type === 'income')     income     += amt;
    if (r.type === 'expense')    expense    += amt;
    if (r.type === 'investment') investment += amt;
  }

  const catData      = await txRepo.categoryBreakdown(userId, year);
  const topCategories = catData.filter(c => c.type === 'expense').slice(0,5).map(c => c.category);
  const savings       = income - expense - investment;
  const savingsRate   = income > 0 ? (savings / income) * 100 : 0;

  // Check budget overruns
  const budgetRes = await query(
    `SELECT b.category_name,
            COALESCE(SUM(t.amount_inr),0) AS spent,
            b.amount AS limit_amt
     FROM budgets b
     LEFT JOIN transactions t ON t.user_id=b.user_id
       AND t.type='expense'
       AND EXTRACT(MONTH FROM t.date)=$2
       AND EXTRACT(YEAR FROM t.date)=$3
     WHERE b.user_id=$1
     GROUP BY b.category_name, b.amount
     HAVING COALESCE(SUM(t.amount_inr),0) > b.amount`,
    [userId, month, year]
  );
  const overruns = budgetRes.rows.map(r => r.category_name);

  const insight = await openai.generateInsight({ income, expense, savings, savingsRate, topCategories, overruns });
  return { insight, generatedAt: new Date().toISOString() };
}

module.exports = { chat, getInsight, getHistory, clearHistory };
