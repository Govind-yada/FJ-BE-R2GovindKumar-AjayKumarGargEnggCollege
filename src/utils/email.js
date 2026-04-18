'use strict';
const nodemailer = require('nodemailer');
const logger     = require('./logger');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('Email skipped — SMTP not configured', { to, subject });
    return;
  }
  try {
    const info = await getTransporter().sendMail({
      from: process.env.MAIL_FROM || '"Finflow" <noreply@finflow.app>',
      to, subject, html, text,
    });
    logger.info('Email sent', { messageId: info.messageId, to });
  } catch (err) {
    logger.error('Email failed', { err: err.message, to });
  }
}

function budgetWarningHtml(user, category, pct, spent, limit, currency) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f1520;color:#eef1f7;border-radius:12px;overflow:hidden">
      <div style="background:#d4a843;padding:24px 32px">
        <h1 style="margin:0;font-size:22px;color:#08090d">⚠️ Budget Alert — Finflow</h1>
      </div>
      <div style="padding:32px">
        <p style="font-size:16px">Hi ${user.first_name},</p>
        <p style="font-size:15px;color:#8a94a8">Your <strong style="color:#eef1f7">${category}</strong> budget has reached <strong style="color:#f59e0b">${pct}%</strong> of your monthly limit.</p>
        <div style="background:#1c2538;border-radius:8px;padding:20px;margin:20px 0">
          <div style="display:flex;justify-content:space-between"><span>Spent</span><strong style="color:#ff5c5c">${spent}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px"><span>Budget</span><strong style="color:#d4a843">${limit}</strong></div>
        </div>
        <p style="color:#8a94a8;font-size:13px">Log in to Finflow to review your spending.</p>
      </div>
    </div>`;
}

function budgetOverrunHtml(user, category, spent, limit) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f1520;color:#eef1f7;border-radius:12px;overflow:hidden">
      <div style="background:#ff5c5c;padding:24px 32px">
        <h1 style="margin:0;font-size:22px;color:#fff">🚨 Budget Overrun — Finflow</h1>
      </div>
      <div style="padding:32px">
        <p style="font-size:16px">Hi ${user.first_name},</p>
        <p style="font-size:15px;color:#8a94a8">You have <strong style="color:#ff5c5c">exceeded</strong> your <strong style="color:#eef1f7">${category}</strong> budget this month.</p>
        <div style="background:#1c2538;border-radius:8px;padding:20px;margin:20px 0">
          <div style="display:flex;justify-content:space-between"><span>Spent</span><strong style="color:#ff5c5c">${spent}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px"><span>Budget</span><strong style="color:#d4a843">${limit}</strong></div>
        </div>
      </div>
    </div>`;
}

module.exports = { sendMail, budgetWarningHtml, budgetOverrunHtml };
