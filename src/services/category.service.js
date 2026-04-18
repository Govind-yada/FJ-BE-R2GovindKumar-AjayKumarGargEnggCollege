'use strict';
const catRepo  = require('../repositories/category.repository');
const { AppError } = require('../middleware/errorHandler');

async function getAll(userId, type) {
  return catRepo.findAll(userId, type);
}

async function create(userId, data) {
  return catRepo.create({ userId, ...data });
}

async function update(id, userId, data) {
  const cat = await catRepo.update(id, userId, data);
  if (!cat) throw new AppError('Category not found', 404);
  return cat;
}

async function remove(id, userId) {
  const deleted = await catRepo.softDelete(id, userId);
  if (!deleted) throw new AppError('Category not found', 404);
  // Note: transactions with this category_id are preserved (SET NULL via FK)
  return { message: 'Category deleted. Existing transactions are retained.' };
}

module.exports = { getAll, create, update, remove };
