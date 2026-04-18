'use strict';
const { AppError } = require('./errorHandler');

/**
 * Middleware factory — validates req.body against a Joi schema.
 * Returns 422 with a human-readable message on failure.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const msg = error.details.map(d => d.message).join('; ');
      return next(new AppError(msg, 422));
    }
    req.body = value;
    next();
  };
}

module.exports = { validate };
