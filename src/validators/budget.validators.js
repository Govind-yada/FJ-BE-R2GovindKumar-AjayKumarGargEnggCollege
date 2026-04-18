'use strict';
const Joi = require('joi');

const create = Joi.object({
  categoryName: Joi.string().trim().min(1).max(100).required(),
  categoryId:   Joi.string().uuid().allow(null,'').default(null),
  amount:       Joi.number().positive().required(),
  period:       Joi.string().valid('monthly','weekly').default('monthly'),
});

const update = Joi.object({
  categoryName: Joi.string().trim().min(1).max(100),
  amount:       Joi.number().positive(),
  period:       Joi.string().valid('monthly','weekly'),
}).min(1);

module.exports = { create, update };
