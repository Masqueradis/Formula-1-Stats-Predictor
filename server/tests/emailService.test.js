'use strict';

/**
 * Эпик-12: почтовый транспорт и ссылка подтверждения.
 * Никаких реальных отправок — проверяем только конфигурацию и формирование URL.
 */

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

describe('emailService.smtpConfig / isEmailConfigured', () => {
  test('dev по умолчанию — локальный MailHog, отправка разрешена', () => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.MAIL_FROM;

    const service = require('../src/services/emailService');
    expect(service.smtpConfig()).toMatchObject({ host: 'localhost', port: 1025, secure: false });
    expect(service.isEmailConfigured()).toBe(true);
  });

  test('prod по умолчанию — Brevo SMTP', () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;

    const service = require('../src/services/emailService');
    expect(service.smtpConfig()).toMatchObject({ host: 'smtp.brevo.com', port: 587, secure: false });
  });

  test('prod без SMTP_USER/PASS/MAIL_FROM не считается настроенным и не шлёт письмо', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.MAIL_FROM;

    const service = require('../src/services/emailService');
    expect(service.isEmailConfigured()).toBe(false);
    expect(service.missingMailConfig()).toEqual(['SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']);
    await expect(service.sendMail({ to: 'fan@test.local', subject: 'test', html: '<b>test</b>' }))
      .resolves.toEqual({
        ok: false,
        error: 'SMTP is not configured (missing: SMTP_USER, SMTP_PASS, MAIL_FROM)',
      });
  });

  test('prod с полным набором переменных считается настроенным', () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.SMTP_USER = 'user@example.test';
    process.env.SMTP_PASS = 'not-a-real-secret';
    process.env.MAIL_FROM = 'F1 Stats <noreply@example.test>';

    const service = require('../src/services/emailService');
    expect(service.isEmailConfigured()).toBe(true);
  });

  test('verificationLink не создаёт двойной слеш и кодирует токен', () => {
    jest.resetModules();
    process.env.FRONTEND_URL = 'https://tourmaline-wisp-d2b6de.netlify.app/';

    const service = require('../src/services/emailService');
    expect(service.verificationLink('tok en'))
      .toBe('https://tourmaline-wisp-d2b6de.netlify.app/verify?token=tok%20en');
  });
});
