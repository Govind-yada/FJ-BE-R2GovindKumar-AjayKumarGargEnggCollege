'use strict';
const Joi = require('joi');

const CURRENCIES = ['INR','USD','EUR','GBP','JPY','AED','SGD'];
const TYPES      = ['income','expense','investment'];

const create = Joi.object({
  type:        Joi.string().valid(...TYPES).required(),
  description: Joi.string().trim().min(1).max(500).required(),
  amount:      Joi.number().not(0).required(),   // negative allowed (refunds)
  currency:    Joi.string().valid(...CURRENCIES).default('INR'),
  categoryId:  Joi.string().uuid().allow(null,'').default(null),
  date:        Joi.string().isoDate().required(),
});

const update = Joi.object({
  type:        Joi.string().valid(...TYPES),
  description: Joi.string().trim().min(1).max(500),
  amount:      Joi.number().not(0),
  currency:    Joi.string().valid(...CURRENCIES),
  categoryId:  Joi.string().uuid().allow(null,''),
  date:        Joi.string().isoDate(),
}).min(1);

module.exports = { create, update };
