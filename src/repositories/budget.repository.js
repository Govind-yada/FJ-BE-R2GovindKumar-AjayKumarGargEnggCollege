'use strict';
const { query } = require('../config/database');

async function findAll(userId) {
  const res = await query(
    `SELECT b.*, c.name AS cat_name, c.emoji AS cat_emoji
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.user_id = $1
     ORDER BY b.created_at ASC`,
    [userId]
  );
  return res.rows;
}

async function findById(id, userId) {
  const res = await query(
    'SELECT * FROM budgets WHERE id=$1 AND user_id=$2',
    [id, userId]
  );
  return res.rows[0] || null;
}

async function findByCategoryName(userId, categoryName) {
  const res = await query(
    'SELECT * FROM budgets WHERE user_id=$1 AND category_name=$2 LIMIT 1',
    [userId, categoryName]
  );
  return res.rows[0] || null;
}

async function create({ userId, categoryId, categoryName, amount, period }) {
  const res = await query(
    `INSERT INTO budgets (user_id, category_id, category_name, amount, period)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, categoryId || null, categoryName, amount, period]
  );
  return res.rows[0];
}

async function update(id, userId, fields) {
  const allowed = {
    category_name: fields.categoryName,
    amount:        fields.amount,
    period:        fields.period,
    updated_at:    new Date(),
  };
  const keys   = Object.keys(allowed).filter(k => allowed[k] !== undefined);
  const values = keys.map(k => allowed[k]);
  const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
  const res = await query(
    `UPDATE budgets SET ${setClauses}
     WHERE id=$${keys.length + 1} AND user_id=$${keys.length + 2} RETURNING *`,
    [...values, id, userId]
  );
  return res.rows[0] || null;
}

async function remove(id, userId) {
  const res = await query(
    'DELETE FROM budgets WHERE id=$1 AND user_id=$2 RETURNING id',
    [id, userId]
  );
  return res.rows[0] || null;
}

/* Alert deduplication */
async function alertAlreadySent(budgetId, alertType, periodKey) {
  const res = await query(
    'SELECT 1 FROM budget_alerts WHERE budget_id=$1 AND alert_type=$2 AND period_key=$3',
    [budgetId, alertType, periodKey]
  );
  return res.rows.length > 0;
}

async function recordAlert(budgetId, userId, alertType, periodKey) {
  await query(
    `INSERT INTO budget_alerts (budget_id, user_id, alert_type, period_key)
     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [budgetId, userId, alertType, periodKey]
  );
}

module.exports = {
  findAll, findById, findByCategoryName,
  create, update, remove,
  alertAlreadySent, recordAlert,
};
