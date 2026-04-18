'use strict';
const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return next(new AppError('Unauthorised — no token provided', 401));
  }
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    req.user = payload;   // { id, email, firstName, currency }
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Token expired — please sign in again'
      : 'Token invalid';
    return next(new AppError(msg, 401));
  }
}

module.exports = { authenticateJWT };
