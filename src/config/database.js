'use strict';
const { Pool } = require('pg');
const logger   = require('../utils/logger');

function buildConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }
  return {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'finflow_db',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl:      false,
  };
}

const pool = new Pool({
  ...buildConfig(),
  max:                  20,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => logger.debug('DB pool: new client connected'));
pool.on('error',   (err) => { logger.error('Unexpected DB client error', { err: err.message }); });

const query = (text, params) => pool.query(text, params);

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
