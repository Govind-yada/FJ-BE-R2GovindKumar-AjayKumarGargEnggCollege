'use strict';
const { query } = require('../config/database');

async function findAll(userId, type) {
  const conditions = ['user_id=$1', 'deleted_at IS NULL'];
  const params = [userId];
  if (type) { conditions.push('type=$2'); params.push(type); }
  const res = await query(
    `SELECT * FROM categories WHERE ${conditions.join(' AND ')} ORDER BY type, name`,
    params
  );
  return res.rows;
}

async function findById(id, userId) {
  const res = await query(
    'SELECT * FROM categories WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
    [id, userId]
  );
  return res.rows[0] || null;
}

async function create({ userId, name, type, emoji, color }) {
  const res = await query(
    'INSERT INTO categories (user_id, name, type, emoji, color) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [userId, name, type, emoji || '📊', color || '#888888']
  );
  return res.rows[0];
}

async function update(id, userId, fields) {
  const allowed = { name: fields.name, emoji: fields.emoji, color: fields.color };
  const keys    = Object.keys(allowed).filter(k => allowed[k] !== undefined);
  const values  = keys.map(k => allowed[k]);
  const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
  const res = await query(
    `UPDATE categories SET ${setClauses} WHERE id=$${keys.length+1} AND user_id=$${keys.length+2} RETURNING *`,
    [...values, id, userId]
  );
  return res.rows[0] || null;
}

async function softDelete(id, userId) {
  const res = await query(
    'UPDATE categories SET deleted_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id',
    [id, userId]
  );
  return res.rows[0] || null;
}

module.exports = { findAll, findById, create, update, softDelete };
