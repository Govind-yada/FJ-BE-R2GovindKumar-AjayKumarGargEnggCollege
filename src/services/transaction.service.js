'use strict';
const txRepo     = require('../repositories/transaction.repository');
const budgetSvc  = require('./budget.service');
const { toINR }  = require('../utils/currency');
const { AppError } = require('../middleware/errorHandler');

async function getAll(userId, filters) {
  return txRepo.findAll(userId, filters);
}

async function getById(id, userId) {
  const tx = await txRepo.findById(id, userId);
  if (!tx) throw new AppError('Transaction not found', 404);
  return tx;
}

async function create(userId, data, file) {
  const amountInr = await toINR(data.amount, data.currency || 'INR');

  const tx = await txRepo.create({
    userId,
    type:        data.type,
    description: data.description,
    amount:      data.amount,
    currency:    data.currency || 'INR',
    amountInr,
    categoryId:  data.categoryId || null,
    date:        data.date,
    receiptUrl:  file ? `/uploads/${file.filename}` : null,
  });

  // Check budget alerts after every expense
  if (data.type === 'expense') {
    await budgetSvc.checkAndNotify(userId, data.categoryId).catch(() => {});
  }

  return tx;
}

async function update(id, userId, data, file) {
  const existing = await txRepo.findById(id, userId);
  if (!existing) throw new AppError('Transaction not found', 404);

  const amount   = data.amount   ?? existing.amount;
  const currency = data.currency ?? existing.currency;
  const amountInr = await toINR(amount, currency);

  const tx = await txRepo.update(id, userId, {
    ...data,
    amountInr,
    receiptUrl: file ? `/uploads/${file.filename}` : undefined,
  });

  if (!tx) throw new AppError('Transaction not found', 404);
  return tx;
}

async function remove(id, userId) {
  const deleted = await txRepo.remove(id, userId);
  if (!deleted) throw new AppError('Transaction not found', 404);
  return { message: 'Transaction deleted' };
}

module.exports = { getAll, getById, create, update, remove };
