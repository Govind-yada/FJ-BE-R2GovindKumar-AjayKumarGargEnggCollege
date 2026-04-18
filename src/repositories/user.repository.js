'use strict';
const { query } = require('../config/database');

async function findByEmail(email) {
  const res = await query('SELECT * FROM users WHERE email=$1 LIMIT 1', [email]);
  return res.rows[0] || null;
}

async function findById(id) {
  const res = await query('SELECT * FROM users WHERE id=$1 LIMIT 1', [id]);
  return res.rows[0] || null;
}

async function findByGoogleId(googleId) {
  const res = await query('SELECT * FROM users WHERE google_id=$1 LIMIT 1', [googleId]);
  return res.rows[0] || null;
}

async function create({ email, passwordHash, googleId, firstName, lastName, preferredCurrency }) {
  const res = await query(
    `INSERT INTO users (email, password_hash, google_id, first_name, last_name, preferred_currency)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [email, passwordHash || null, googleId || null, firstName, lastName, preferredCurrency || 'INR']
  );
  return res.rows[0];
}

async function update(id, fields) {
  const allowed = {
    first_name:             fields.firstName,
    last_name:              fields.lastName,
    preferred_currency:     fields.preferredCurrency,
    notif_budget_overrun:   fields.notifBudgetOverrun,
    notif_budget_warning:   fields.notifBudgetWarning,
    notif_monthly_summary:  fields.notifMonthlySummary,
    updated_at:             new Date(),
  };

  const keys   = Object.keys(allowed).filter(k => allowed[k] !== undefined);
  const values = keys.map(k => allowed[k]);

  if (!keys.length) return findById(id);

  const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
  const res = await query(
    `UPDATE users SET ${setClauses} WHERE id=$${keys.length + 1} RETURNING *`,
    [...values, id]
  );
  return res.rows[0];
}

async function linkGoogleId(id, googleId) {
  const res = await query(
    'UPDATE users SET google_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
    [googleId, id]
  );
  return res.rows[0];
}

module.exports = { findByEmail, findById, findByGoogleId, create, update, linkGoogleId };
