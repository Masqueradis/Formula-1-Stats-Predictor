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

function isEmailEnabled() {
  return process.env.EMAIL_ENABLED === 'true';
}

function smtpConfig() {
  return {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  };
}

function missingMailConfig() {
  if (!isEmailEnabled()) return ['EMAIL_ENABLED'];
  const config = smtpConfig();
  const missing = [];
  if (!config.host) missing.push('SMTP_HOST');
  if (!config.port) missing.push('SMTP_PORT');
  if (config.host !== 'localhost' && config.host !== '127.0.0.1') {
    if (!config.user) missing.push('SMTP_USER');
    if (!config.pass) missing.push('SMTP_PASS');
  }
  if (!process.env.MAIL_FROM) missing.push('MAIL_FROM');
  return missing;
}

function isEmailConfigured() {
  return missingMailConfig().length === 0;
}

function getTransport() {
  if (!transport) {
    const config = smtpConfig();
    transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      auth: config.user
        ? {
            user: config.user,
            pass: config.pass,
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
  const missing = missingMailConfig();
  if (missing.length) {
    return { ok: false, error: `SMTP is not configured (missing: ${missing.join(', ')})` };
  }
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
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
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

function sendRaceReminderEmail(to, username, race, favoriteDrivers = []) {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  const voteUrl = `${base}/vote`;
  const date = race.date
    ? new Date(`${race.date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'дата неизвестна';
  const driversList = favoriteDrivers
    .map((driver) => htmlEscape(driver.abbreviation ? `${driver.firstName} ${driver.lastName} (${driver.abbreviation})` : `${driver.firstName} ${driver.lastName}`))
    .join(', ');

  const body = `
    <p>Здравствуйте, <strong>${htmlEscape(username)}</strong>!</p>
    <p>Скоро старт Гран-при — не забудьте сделать прогноз:</p>
    <p style="font-size:16px;margin:16px 0">
      <strong>${htmlEscape(race.name)}</strong><br>
      ${htmlEscape(date)}${race.circuit ? `<br>${htmlEscape(race.circuit)}, ${htmlEscape(race.country)}` : ''}
    </p>
    ${driversList ? `<p>Ваши избранные пилоты: <strong>${driversList}</strong></p>` : ''}
    <p style="text-align:center;margin:24px 0">
      <a href="${voteUrl}"
         style="background:#e80020;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block">
        Сделать прогноз
      </a>
    </p>
    <p style="color:#64748b;font-size:13px">Голосование закрывается с началом гонки. Если кнопка не работает — откройте ссылку: <a href="${voteUrl}">${htmlEscape(voteUrl)}</a></p>
    <p style="color:#64748b;font-size:13px">Письмо отправлено автоматически. Отписаться можно, убрав пилотов из избранного в кабинете.</p>
  `;
  return sendMail({ to, subject: `Скоро Гран-при: ${race.name} — Simply Lovely`, html: layout('Не забудьте прогноз!', body) });
}

module.exports = {
  isEmailEnabled,
  isEmailConfigured,
  missingMailConfig,
  smtpConfig,
  verificationLink,
  sendMail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendRaceReminderEmail,
};