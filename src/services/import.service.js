'use strict';
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const { query, withTransaction } = require('../config/database');
const openai   = require('../utils/openai');
const { toINR }  = require('../utils/currency');
const logger   = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

/* ── Hash a transaction for duplicate detection ── */
function hashTransaction(date, amount, description) {
  return crypto
    .createHash('sha256')
    .update(`${date}|${parseFloat(amount).toFixed(2)}|${description.trim().toLowerCase()}`)
    .digest('hex');
}

/* ── Parse CSV text into row objects ── */
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new AppError('CSV file is empty or has no data rows', 400);

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
    if (vals.length < 3) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function normaliseRow(row) {

  const dateKey   = Object.keys(row).find(k => k.includes('date') || k === 'date');
  const descKey   = Object.keys(row).find(k => k.includes('narration') || k.includes('description') || k.includes('particulars') || k.includes('details'));
  const debitKey  = Object.keys(row).find(k => k.includes('debit') || k.includes('withdrawal'));
  const creditKey = Object.keys(row).find(k => k.includes('credit') || k.includes('deposit'));
  const amtKey    = Object.keys(row).find(k => k === 'amount' || k === 'amt');

  const rawDate = row[dateKey] || '';
  const desc    = row[descKey] || row[Object.keys(row)[1]] || 'Unknown';

  // Parse date — try DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  let date = rawDate;
  const dmyMatch = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  const ymdMatch = rawDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const yr = y.length === 2 ? '20' + y : y;
    date = `${yr}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  } else if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // Determine amount and type
  let amount = 0;
  let type   = 'expense';

  if (debitKey || creditKey) {
    const debit  = parseFloat((row[debitKey]  || '0').replace(/,/g, '')) || 0;
    const credit = parseFloat((row[creditKey] || '0').replace(/,/g, '')) || 0;
    if (credit > 0) { amount = credit; type = 'income'; }
    else            { amount = debit;  type = 'expense'; }
  } else if (amtKey) {
    amount = parseFloat((row[amtKey] || '0').replace(/,/g, '')) || 0;
    type   = amount >= 0 ? 'income' : 'expense';
    amount = Math.abs(amount);
  }

  if (amount <= 0) return null;
  if (!date || date === 'Invalid Date') return null;

  return { date, description: desc.trim(), amount, type, currency: 'INR' };
}

/* ── Get categories for AI categorisation ── */
async function getUserCategories(userId) {
  const res = await query(
    'SELECT name, type FROM categories WHERE user_id=$1 AND deleted_at IS NULL',
    [userId]
  );
  return res.rows;
}

/* ── Process an imported file ── */
async function processImport(userId, importId, filePath, fileType) {
  await query("UPDATE bank_imports SET status='processing' WHERE id=$1", [importId]);

  try {
    let rows = [];

    if (fileType === 'csv') {
      const text = fs.readFileSync(filePath, 'utf8');
      rows = parseCSV(text).map(normaliseRow).filter(Boolean);
    } else if (fileType === 'pdf') {
      // pdf-parse extracts text — look for tabular data
      const pdfParse = require('pdf-parse');
      const buffer   = fs.readFileSync(filePath);
      const pdfData  = await pdfParse(buffer);
      // Try to extract lines that look like transactions (date + amount pattern)
      const lines = pdfData.text.split('\n').map(l => l.trim()).filter(Boolean);
      const txPattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
      const amtPattern = /[\d,]+\.\d{2}/;
      for (const line of lines) {
        if (txPattern.test(line) && amtPattern.test(line)) {
          const parts = line.split(/\s{2,}/); // split on 2+ spaces
          if (parts.length >= 3) {
            const fakeRow = {
              date:        parts[0],
              description: parts.slice(1, -1).join(' '),
              amount:      parts[parts.length - 1],
            };
            const norm = normaliseRow(fakeRow);
            if (norm) rows.push(norm);
          }
        }
      }
    }

    if (!rows.length) {
      await query(
        "UPDATE bank_imports SET status='failed', error_msg=$2 WHERE id=$1",
        [importId, 'No valid transactions found in file']
      );
      return;
    }

    const categories = await getUserCategories(userId);
    let imported = 0, duplicates = 0;

    for (const row of rows) {
      const hash = hashTransaction(row.date, row.amount, row.description);

      // Check duplicate
      const dupCheck = await query(
        'SELECT 1 FROM import_hashes WHERE user_id=$1 AND tx_hash=$2',
        [userId, hash]
      );
      if (dupCheck.rows.length) { duplicates++; continue; }

      // Auto-categorise with AI (with fallback)
      let categoryId = null;
      let categoryName = null;
      try {
        if (process.env.OPENAI_API_KEY) {
          const aiResult  = await openai.categorise(row.description, categories);
          const matchedCat = categories.find(c =>
            c.name.toLowerCase() === (aiResult.category || '').toLowerCase()
          );
          if (matchedCat) {
            const catRes = await query(
              'SELECT id FROM categories WHERE user_id=$1 AND name=$2 AND deleted_at IS NULL LIMIT 1',
              [userId, matchedCat.name]
            );
            if (catRes.rows.length) {
              categoryId   = catRes.rows[0].id;
              categoryName = matchedCat.name;
              row.type     = aiResult.type || row.type;
            }
          }
        }
      } catch (_) { /* fallback: no category */ }

      const amountInr = await toINR(row.amount, row.currency);

      await withTransaction(async client => {
        await client.query(
          `INSERT INTO transactions
             (user_id, type, description, amount, currency, amount_inr, category_id, date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [userId, row.type, row.description, row.amount, row.currency, amountInr, categoryId, row.date]
        );
        await client.query(
          'INSERT INTO import_hashes (user_id, tx_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, hash]
        );
      });

      imported++;
    }

    await query(
      `UPDATE bank_imports
       SET status='done', total_rows=$2, imported_rows=$3, duplicate_rows=$4
       WHERE id=$1`,
      [importId, rows.length, imported, duplicates]
    );

    logger.info('Bank import complete', { userId, importId, imported, duplicates });
  } catch (err) {
    logger.error('Bank import failed', { importId, err: err.message });
    await query(
      "UPDATE bank_imports SET status='failed', error_msg=$2 WHERE id=$1",
      [importId, err.message]
    );
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

/* ── Start an import (called from controller) ── */
async function startImport(userId, file) {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (!['csv', 'pdf'].includes(ext)) {
    throw new AppError('Only CSV and PDF bank statements are supported', 400);
  }

  const res = await query(
    `INSERT INTO bank_imports (user_id, filename, file_type)
     VALUES ($1,$2,$3) RETURNING *`,
    [userId, file.originalname, ext]
  );
  const importRecord = res.rows[0];

  // Process asynchronously — don't block the HTTP response
  setImmediate(() => processImport(userId, importRecord.id, file.path, ext));

  return importRecord;
}

/* ── Get import status ── */
async function getImportStatus(userId, importId) {
  const res = await query(
    'SELECT * FROM bank_imports WHERE id=$1 AND user_id=$2',
    [importId, userId]
  );
  if (!res.rows.length) throw new AppError('Import not found', 404);
  return res.rows[0];
}

/* ── Get import history ── */
async function getImportHistory(userId) {
  const res = await query(
    'SELECT * FROM bank_imports WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',
    [userId]
  );
  return res.rows;
}

module.exports = { startImport, getImportStatus, getImportHistory };
