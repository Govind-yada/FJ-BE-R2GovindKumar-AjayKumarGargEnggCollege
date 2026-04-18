'use strict';
const { query } = require('../config/database');

async function findAll(userId, filters = {}) {
  const conditions = ['t.user_id = $1'];
  const params     = [userId];
  let   idx        = 2;

  if (filters.type) {
    conditions.push(`t.type = $${idx++}`);
    params.push(filters.type);
  }
  if (filters.currency) {
    conditions.push(`t.currency = $${idx++}`);
    params.push(filters.currency);
  }
  if (filters.categoryId) {
    conditions.push(`t.category_id = $${idx++}`);
    params.push(filters.categoryId);
  }
  if (filters.dateFrom) {
    conditions.push(`t.date >= $${idx++}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`t.date <= $${idx++}`);
    params.push(filters.dateTo);
  }
  if (filters.search) {
    conditions.push(`(t.description ILIKE $${idx} OR c.name ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const where = conditions.join(' AND ');

  // Pagination
  const page    = Math.max(parseInt(filters.page  || '1'),  1);
  const perPage = Math.min(parseInt(filters.limit || '20'), 100);
  const offset  = (page - 1) * perPage;

  const countRes = await query(
    `SELECT COUNT(*) FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${where}`,
    params
  );

  const rows = await query(
    `SELECT t.*, c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${where}
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, perPage, offset]
  );

  return {
    data:       rows.rows,
    total:      parseInt(countRes.rows[0].count),
    page,
    perPage,
    totalPages: Math.ceil(parseInt(countRes.rows[0].count) / perPage),
  };
}

async function findById(id, userId) {
  const res = await query(
    `SELECT t.*, c.name AS category_name, c.emoji AS category_emoji
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.id=$1 AND t.user_id=$2`,
    [id, userId]
  );
  return res.rows[0] || null;
}

async function create({ userId, type, description, amount, currency, amountInr, categoryId, date, receiptUrl }) {
  const res = await query(
    `INSERT INTO transactions
       (user_id, type, description, amount, currency, amount_inr, category_id, date, receipt_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [userId, type, description, amount, currency, amountInr || null, categoryId || null, date, receiptUrl || null]
  );
  return res.rows[0];
}

async function update(id, userId, fields) {
  const allowed = {
    type:        fields.type,
    description: fields.description,
    amount:      fields.amount,
    currency:    fields.currency,
    amount_inr:  fields.amountInr,
    category_id: fields.categoryId,
    date:        fields.date,
    receipt_url: fields.receiptUrl,
    updated_at:  new Date(),
  };

  const keys   = Object.keys(allowed).filter(k => allowed[k] !== undefined);
  const values = keys.map(k => allowed[k]);

  if (!keys.length) return findById(id, userId);

  const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
  const res = await query(
    `UPDATE transactions SET ${setClauses}
     WHERE id=$${keys.length + 1} AND user_id=$${keys.length + 2}
     RETURNING *`,
    [...values, id, userId]
  );
  return res.rows[0] || null;
}

async function remove(id, userId) {
  const res = await query(
    'DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id',
    [id, userId]
  );
  return res.rows[0] || null;
}

/* Aggregation helpers for reports */
async function monthlySummary(userId, year) {
  const res = await query(
    `SELECT
       EXTRACT(MONTH FROM date)::int AS month,
       type,
       SUM(amount_inr) AS total_inr
     FROM transactions
     WHERE user_id=$1 AND EXTRACT(YEAR FROM date)=$2
     GROUP BY month, type
     ORDER BY month`,
    [userId, year]
  );
  return res.rows;
}

async function categoryBreakdown(userId, year) {
  const res = await query(
    `SELECT
       c.name        AS category,
       c.emoji,
       t.type,
       SUM(ABS(t.amount_inr)) AS total_inr
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id=$1 AND EXTRACT(YEAR FROM t.date)=$2
     GROUP BY c.name, c.emoji, t.type
     ORDER BY total_inr DESC`,
    [userId, year]
  );
  return res.rows;
}

async function currentMonthByCategory(userId, categoryName, month, year) {
  const res = await query(
    `SELECT COALESCE(SUM(amount_inr), 0) AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id=$1
       AND t.type='expense'
       AND (c.name=$2 OR ($2 IS NULL AND c.name IS NULL))
       AND EXTRACT(MONTH FROM t.date)=$3
       AND EXTRACT(YEAR  FROM t.date)=$4`,
    [userId, categoryName, month, year]
  );
  return parseFloat(res.rows[0].total);
}

module.exports = {
  findAll, findById, create, update, remove,
  monthlySummary, categoryBreakdown, currentMonthByCategory,
};
