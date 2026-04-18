'use strict';
const Joi = require('joi');

const create = Joi.object({
  name:  Joi.string().trim().min(1).max(100).required(),
  type:  Joi.string().valid('income','expense','investment').required(),
  emoji: Joi.string().max(10).allow('','null').default('📊'),
  color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).default('#888888'),
});

const update = Joi.object({
  name:  Joi.string().trim().min(1).max(100),
  emoji: Joi.string().max(10).allow(''),
  color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
}).min(1);

module.exports = { create, update };
