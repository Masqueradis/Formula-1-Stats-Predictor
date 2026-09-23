const nodemailer = require('nodemailer');

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let transport;

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT || 1025),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });
  }
  return transport;
}

function fromAddress() {
  return process.env.MAIL_FROM || 'noreply@f1stats.local';
}

async function sendMail({ to, subject, html }) {
  try {
    await getTransport().sendMail({
      from: fromAddress(),
      to,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error(`[mail] failed to send "${subject}" to ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}

function layout(title, body) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
      <div style="background:#e80020;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <strong>Simply Lovely — F1 Stats & Predictor</strong>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 12px">${title}</h2>
        ${body}
      </div>
    </div>
  `;
}

function verificationLink(token) {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${base}/verify?token=${encodeURIComponent(token)}`;
}

function sendVerificationEmail(to, token) {
  const url = verificationLink(token);
  const body = `
    <p>Почти готово! Подтвердите email, чтобы активировать аккаунт:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${url}"
         style="background:#e80020;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block">
        Подтвердить email
      </a>
    </p>
    <p style="color:#64748b;font-size:13px">Если кнопка не работает — откройте ссылку: <a href="${url}">${htmlEscape(url)}</a></p>
    <p style="color:#64748b;font-size:13px">Ссылка действительна 24 часа.</p>
  `;
  return sendMail({ to, subject: 'Подтверждение регистрации — Simply Lovely', html: layout('Добро пожаловать!', body) });
}

function sendWelcomeEmail(to, username) {
  const body = `
    <p>Здравствуйте, <strong>${htmlEscape(username)}</strong>!</p>
    <p>Ваш email подтверждён. Теперь вы можете войти в аккаунт, добавлять пилотов и команды в избранное
       и участвовать в предсказаниях гонок.</p>
    <p style="color:#64748b;font-size:13px">Если вы не регистрировались в F1 Stats & Predictor — проигнорируйте это письмо.</p>
  `;
  return sendMail({ to, subject: 'Аккаунт подтверждён — Simply Lovely', html: layout('Почта подтверждена', body) });
}

module.exports = { sendVerificationEmail, sendWelcomeEmail };