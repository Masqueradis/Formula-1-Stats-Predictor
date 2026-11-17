'use strict';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  delete process.env.EMAIL_ENABLED;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.MAIL_FROM;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

describe('emailService — почта отключена по умолчанию', () => {
  test('без EMAIL_ENABLED отправка запрещена и не пытается подключиться к SMTP', async () => {
    const service = require('../src/services/emailService');
    expect(service.isEmailEnabled()).toBe(false);
    expect(service.missingMailConfig()).toEqual(['EMAIL_ENABLED']);
    expect(service.isEmailConfigured()).toBe(false);
    await expect(service.sendMail({ to: 'fan@test.local', subject: 'test', html: '<b>test</b>' }))
      .resolves.toEqual({
        ok: false,
        error: 'SMTP is not configured (missing: EMAIL_ENABLED)',
      });
  });

  test('SMTP_HOST/PORT по умолчанию — локальный MailHog, но он не используется без флага', () => {
    const service = require('../src/services/emailService');
    expect(service.smtpConfig()).toMatchObject({ host: 'localhost', port: 1025, secure: false });
    expect(service.isEmailConfigured()).toBe(false);
  });

  test('EMAIL_ENABLED=true + локальный MailHog достаточно для dev', () => {
    process.env.EMAIL_ENABLED = 'true';
    process.env.MAIL_FROM = 'noreply@f1stats.local';
    const service = require('../src/services/emailService');
    expect(service.isEmailConfigured()).toBe(true);
    expect(service.smtpConfig()).toMatchObject({ host: 'localhost', port: 1025 });
  });

  test('EMAIL_ENABLED=true + внешний SMTP требует USER/PASS/MAIL_FROM', () => {
    process.env.EMAIL_ENABLED = 'true';
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    const service = require('../src/services/emailService');
    expect(service.missingMailConfig()).toEqual(['SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']);

    process.env.SMTP_USER = 'user@example.test';
    process.env.SMTP_PASS = 'not-a-real-secret';
    process.env.MAIL_FROM = 'F1 Stats <noreply@example.test>';
    jest.resetModules();
    expect(require('../src/services/emailService').isEmailConfigured()).toBe(true);
  });

  test('verificationLink не создаёт двойной слеш и кодирует токен', () => {
    process.env.FRONTEND_URL = 'https://tourmaline-wisp-d2b6de.netlify.app/';
    const service = require('../src/services/emailService');
    expect(service.verificationLink('tok en'))
      .toBe('https://tourmaline-wisp-d2b6de.netlify.app/verify?token=tok%20en');
  });
});
