'use strict';
const authService = require('../services/auth.service');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    res.cookie('refreshToken', result.refreshToken, cookieOpts());
    res.status(201).json({ data: { user: result.user, accessToken: result.accessToken } });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.cookie('refreshToken', result.refreshToken, cookieOpts());
    res.json({ data: { user: result.user, accessToken: result.accessToken } });
  } catch (err) { next(err); }
}

async function googleCallback(req, res, next) {
  try {
    const { googleId, email, firstName, lastName } = req.googleProfile;
    const result = await authService.googleOAuth({ googleId, email, firstName, lastName });
    res.cookie('refreshToken', result.refreshToken, cookieOpts());
    // Redirect to frontend with token in query (SPA picks it up)
    res.redirect(`${process.env.CLIENT_URL || '/'}?token=${result.accessToken}`);
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const token  = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await authService.refresh(token);
    res.cookie('refreshToken', result.refreshToken, cookieOpts());
    res.json({ data: { accessToken: result.accessToken } });
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logout(token);
    res.clearCookie('refreshToken');
    res.json({ data: { message: 'Logged out successfully' } });
  } catch (err) { next(err); }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ data: user });
  } catch (err) { next(err); }
}

async function updateMe(req, res, next) {
  try {
    const user = await authService.updateMe(req.user.id, req.body);
    res.json({ data: user });
  } catch (err) { next(err); }
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  };
}

module.exports = { register, login, googleCallback, refresh, logout, getMe, updateMe };
