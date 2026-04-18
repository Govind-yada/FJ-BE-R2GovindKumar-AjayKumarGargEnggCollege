'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const userRepo = require('../repositories/user.repository');
const { query }  = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const ACCESS_EXPIRES  = process.env.JWT_EXPIRES_IN          || '15m';
const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/* ── Token helpers ── */
function signAccess(user) {
  return jwt.sign(
    { id: user.id, email: user.email, firstName: user.first_name, currency: user.preferred_currency },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

async function issueRefresh(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const hash  = crypto.createHash('sha256').update(token).digest('hex');
  const exp   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [userId, hash, exp]
  );
  return token;
}

async function verifyRefresh(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const res  = await query(
    'SELECT * FROM refresh_tokens WHERE token_hash=$1 AND expires_at > NOW()',
    [hash]
  );
  return res.rows[0] || null;
}

async function revokeRefresh(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM refresh_tokens WHERE token_hash=$1', [hash]);
}

/* ── Register ── */
async function register({ firstName, lastName, email, password, preferredCurrency }) {
  const existing = await userRepo.findByEmail(email);
  if (existing) throw new AppError('An account with this email already exists', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await userRepo.create({ email, passwordHash, firstName, lastName, preferredCurrency });

  const accessToken  = signAccess(user);
  const refreshToken = await issueRefresh(user.id);
  return { user: sanitize(user), accessToken, refreshToken };
}

/* ── Login ── */
async function login({ email, password }) {
  const user = await userRepo.findByEmail(email);
  if (!user || !user.password_hash) {
    throw new AppError('Invalid email or password', 401);
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new AppError('Invalid email or password', 401);

  const accessToken  = signAccess(user);
  const refreshToken = await issueRefresh(user.id);
  return { user: sanitize(user), accessToken, refreshToken };
}

/* ── Google OAuth ── */
async function googleOAuth({ googleId, email, firstName, lastName }) {
  let user = await userRepo.findByGoogleId(googleId);
  if (!user) {
    // Try to merge with existing email account
    user = await userRepo.findByEmail(email);
    if (user) {
      user = await userRepo.linkGoogleId(user.id, googleId);
    } else {
      user = await userRepo.create({ email, googleId, firstName, lastName, preferredCurrency: 'INR' });
    }
  }
  const accessToken  = signAccess(user);
  const refreshToken = await issueRefresh(user.id);
  return { user: sanitize(user), accessToken, refreshToken };
}

/* ── Refresh tokens ── */
async function refresh(token) {
  if (!token) throw new AppError('Refresh token required', 401);
  const record = await verifyRefresh(token);
  if (!record) throw new AppError('Refresh token invalid or expired', 401);

  const user = await userRepo.findById(record.user_id);
  if (!user) throw new AppError('User not found', 404);

  await revokeRefresh(token);
  const accessToken  = signAccess(user);
  const refreshToken = await issueRefresh(user.id);
  return { accessToken, refreshToken };
}

/* ── Logout ── */
async function logout(token) {
  if (token) await revokeRefresh(token);
}

/* ── Profile ── */
async function getMe(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  return sanitize(user);
}

async function updateMe(userId, fields) {
  const user = await userRepo.update(userId, fields);
  if (!user) throw new AppError('User not found', 404);
  return sanitize(user);
}

function sanitize(u) {
  const { password_hash, ...safe } = u;
  return safe;
}

module.exports = { register, login, googleOAuth, refresh, logout, getMe, updateMe };
