'use strict';
const txService = require('../services/transaction.service');

async function getAll(req, res, next) {
  try {
    const result = await txService.getAll(req.user.id, req.query);
    res.json({ data: result });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const tx = await txService.getById(req.params.id, req.user.id);
    res.json({ data: tx });
  } catch (err) { next(err); }``
}

async function create(req, res, next) {
  try {
    const tx = await txService.create(req.user.id, req.body, req.file);
    res.status(201).json({ data: tx });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const tx = await txService.update(req.params.id, req.user.id, req.body, req.file);
    res.json({ data: tx });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await txService.remove(req.params.id, req.user.id);
    res.json({ data: result });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove };
