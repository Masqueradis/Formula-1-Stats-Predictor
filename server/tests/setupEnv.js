'use strict';

/**
 * Безопасные значения по умолчанию для юнит-тестов (эпик-13, CI).
 *
 * `src/models/index.js` создаёт Sequelize с `process.env.DATABASE_URL` ещё на
 * этапе импорта моделей — даже если тест мокает репозитории. В CI нет
 * `server/.env`, поэтому без URL падают 9 suite с
 * `TypeError: The "url" argument must be of type string`.
 *
 * Тесты не подключаются к PostgreSQL: нужен только синтаксически корректный
 * URL для конструктора. Реальные секреты в GitHub Secrets не нужны.
 * `||=` не перезаписывает значения, заданные локально или в панели провайдера.
 */

process.env.DATABASE_URL ||= 'postgres://f1:f1@127.0.0.1:5432/f1stats_test';
process.env.JWT_SECRET ||= 'test-jwt-secret';
