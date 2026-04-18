'use strict';
const budgetService = require('../services/budget.service');

async function getAll(req, res, next) {
  try {
    const budgets = await budgetService.getAll(req.user.id);
    res.json({ data: budgets });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const b = await budgetService.getById(req.params.id, req.user.id);
    res.json({ data: b });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const b = await budgetService.create(req.user.id, req.body);
    res.status(201).json({ data: b });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const b = await budgetService.update(req.params.id, req.user.id, req.body);
    res.json({ data: b });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await budgetService.remove(req.params.id, req.user.id);
    res.json({ data: result });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove };
