'use strict';
const { Pool } = require('pg');
const logger   = require('../utils/logger');

function getSSLConfig(connectionString) {
  if (!connectionString) return false;
  try {
    const parsed = new URL(connectionString.replace(/^postgres(ql)?:\/\//, 'http://'));
    const host = (parsed.hostname || '').toLowerCase();
    const sslmode = (parsed.searchParams.get('sslmode') || '').toLowerCase();

    if (sslmode === 'disable') return false;
    if (sslmode === 'require') return { rejectUnauthorized: false };

    // Local / private network addresses
    if (host === 'localhost' || host === '127.0.0.1' || host === 'postgres') return false;

    // Render internal database hostnames (e.g. "dpg-xxxxxx-a" without domain, or ending in ".internal")
    // Render docs: Internal database connections do NOT support SSL.
    if (!host.includes('.') || host.endsWith('.internal')) {
      return false;
    }

    // Remote cloud database hosts (Render external, Neon, Supabase, AWS RDS, ElephantSQL, etc.)
    return { rejectUnauthorized: false };
  } catch (err) {
    return connectionString.includes('localhost') ? false : { rejectUnauthorized: false };
  }
}

function buildConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: getSSLConfig(process.env.DATABASE_URL),
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
  max:                     20,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 15000, // 15s to support cloud cold starts
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

module.exports = { pool, query, withTransaction, getSSLConfig };
