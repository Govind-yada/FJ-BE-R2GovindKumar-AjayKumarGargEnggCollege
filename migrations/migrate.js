'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    const explicit = {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'finflow_db',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

    console.log('\n⚠  DATABASE_URL not set. Trying individual DB_* variables:');
    console.log('   Host:     ' + explicit.host);
    console.log('   Port:     ' + explicit.port);
    console.log('   Database: ' + explicit.database);
    console.log('   User:     ' + explicit.user);
    console.log('   Password: ' + (explicit.password ? '(set)' : '(EMPTY — fix this!)'));

    if (!explicit.password) {
      console.error('\n❌ No password found. Set one of:\n');
      console.error('   Option A — DATABASE_URL in .env:');
      console.error('     DATABASE_URL=postgresql://postgres:YourPassword@localhost:5432/finflow_db\n');
      console.error('   Option B — individual vars in .env:');
      console.error('     DB_HOST=localhost');
      console.error('     DB_PORT=5432');
      console.error('     DB_NAME=finflow_db');
      console.error('     DB_USER=postgres');
      console.error('     DB_PASSWORD=YourPassword\n');
      process.exit(1);
    }

    await runMigrations(explicit);
  } else {
    console.log('✓ DATABASE_URL found');
    await runMigrations(process.env.DATABASE_URL);
  }
}

async function runMigrations(connectionConfig) {
  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL\n');
  } catch (err) {
    console.error('\n❌ Could not connect to PostgreSQL:');
    console.error('   ' + err.message);
    console.error('\nCommon fixes:');
    console.error('  1. Is PostgreSQL running?  Open services.msc and check "postgresql-x64-*"');
    console.error('  2. Is the password correct in your .env?');
    console.error('  3. Does the database exist?  Run: createdb finflow_db\n');
    process.exit(1);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const dir   = path.join(__dirname);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  if (!files.length) {
    console.log('No .sql files found.');
    await client.end();
    return;
  }

  let applied = 0;
  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM _migrations WHERE filename=$1', [file]
    );
    if (rows.length) { console.log('  skip  ' + file); continue; }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations(filename) VALUES($1)', [file]);
      console.log('  ✓ ran  ' + file);
      applied++;
    } catch (err) {
      console.error('\n❌ Failed on ' + file + ':');
      console.error('   ' + err.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('\n✓ Done — ' + applied + ' migration(s) applied.\n');
}

migrate();
