'use strict';
const Joi = require('joi');

const register = Joi.object({
  firstName:         Joi.string().trim().min(1).max(100).required(),
  lastName:          Joi.string().trim().min(1).max(100).required(),
  email:             Joi.string().email().lowercase().trim().required(),
  password:          Joi.string().min(8).max(128).required(),
  preferredCurrency: Joi.string().length(3).uppercase().default('INR'),
});

const login = Joi.object({
  email:    Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

const updateProfile = Joi.object({
  firstName:         Joi.string().trim().min(1).max(100),
  lastName:          Joi.string().trim().min(1).max(100),
  preferredCurrency: Joi.string().length(3).uppercase(),
  notifBudgetOverrun:  Joi.boolean(),
  notifBudgetWarning:  Joi.boolean(),
  notifMonthlySummary: Joi.boolean(),
}).min(1);

module.exports = { register, login, updateProfile };
