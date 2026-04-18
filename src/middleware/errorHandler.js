'use strict';
const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status  = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    logger.error('Server error', {
      err: { message: err.message, stack: err.stack },
      req: { method: req.method, url: req.url, user: req.user?.id },
    });
  }

  res.status(status).json({
    error:      true,
    statusCode: status,
    message:    process.env.NODE_ENV === 'production' && status === 500
      ? 'Something went wrong. Please try again later.'
      : message,
  });
}

function notFound(req, res, next) {
  next(new AppError(`Route ${req.method} ${req.url} not found`, 404));
}

module.exports = { errorHandler, notFound, AppError };
