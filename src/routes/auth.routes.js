'use strict';
const router  = require('express').Router();
const ctrl    = require('../controllers/auth.controller');
const { validate }         = require('../middleware/validate');
const { authenticateJWT }  = require('../middleware/auth');
const schemas = require('../validators/auth.validators');

// Public
router.post('/register', validate(schemas.register), ctrl.register);
router.post('/login',    validate(schemas.login),    ctrl.login);
router.post('/refresh',  ctrl.refresh);
router.post('/logout',   ctrl.logout);

// Google OAuth — browser redirects
router.get('/google', (req, res) => {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  process.env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'offline',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const axios = require('axios');
    const { code } = req.query;
    if (!code) return res.redirect(`${process.env.CLIENT_URL}?error=oauth_failed`);

    // Exchange code for tokens
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  process.env.GOOGLE_CALLBACK_URL,
      grant_type:    'authorization_code',
    });

    const profileRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const profile = profileRes.data;
    req.googleProfile = {
      googleId:  profile.sub,
      email:     profile.email,
      firstName: profile.given_name  || '',
      lastName:  profile.family_name || '',
    };
    ctrl.googleCallback(req, res, next);
  } catch (err) {
    res.redirect(`${process.env.CLIENT_URL}?error=oauth_failed`);
  }
});

// Protected
router.get('/me',  authenticateJWT, ctrl.getMe);
router.put('/me',  authenticateJWT, validate(schemas.updateProfile), ctrl.updateMe);

module.exports = router;
