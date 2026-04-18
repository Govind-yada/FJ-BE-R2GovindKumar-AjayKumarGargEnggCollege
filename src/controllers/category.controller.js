'use strict';
const catService = require('../services/category.service');

async function getAll(req, res, next) {
  try {
    const cats = await catService.getAll(req.user.id, req.query.type);
    res.json({ data: cats });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const cat = await catService.create(req.user.id, req.body);
    res.status(201).json({ data: cat });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const cat = await catService.update(req.params.id, req.user.id, req.body);
    res.json({ data: cat });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await catService.remove(req.params.id, req.user.id);
    res.json({ data: result });
  } catch (err) { next(err); }
}

module.exports = { getAll, create, update, remove };
