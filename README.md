# Simply lovely — F1 Stats & Predictor

SPA для статистики Формулы-1: календарь и история Гран-при, прогнозы по Softmax,
народное голосование в реальном времени, лидерборд и админка.

**Рабочий стенд:** frontend — https://tourmaline-wisp-d2b6de.netlify.app,
backend — https://simply-lovely-api.onrender.com (`GET /api/health`).

---

## Что умеет приложение

**Аналитика**

- Календарь этапов с погодой (Open-Meteo; при лимите IP бэкенда запрос уходит напрямую из браузера) и ссылками на трансляции.
- Карточки пилотов и команд, биографии и фото из Wikipedia, карьерная статистика.
- История Гран-при **2000–2025**: полные результаты, спринты, сезонные фильтры, исторические зачёты.
- Архив новостей RSS (8 источников) с полнотекстовым поиском.

**Прогнозы и рейтинг**

- Алгоритм Softmax: `S = 0.35·P_qual + 0.30·F_driver + 0.20·F_team + 0.15·H_track`, вероятности `e^S / Σ e^S`.
- При нехватке гонок текущего сезона подмешивается прошлый сезон (`FORM_RACES = 5`); в ответе есть `basis` и источник формы каждого пилота.
- Народный прогноз: drag-and-drop расстановка пилотов, комментарии, лайки, агрегация predicted order; события Socket.IO приходят без перезагрузки страницы.
- Лидерборд: баллы за точность прогнозов, обновляются cron-задачей и пушатся клиентам.
- Личный ТОП-3 хранится в MongoDB (`kind='top3'`) и участвует в начислении баллов; отдельной формы в интерфейсе нет — это осознанное решение эпика-13 (блок убран из кабинета, чтобы не дублировать народный прогноз).

**Кабинет и админка**

- JWT-аутентификация, роли `USER` / `ADMIN`, избранные пилоты и команды.
- Админка (`/admin`): CRUD пилотов, команд, гонок, результатов и пользователей; ссылки на трансляции; принудительная синхронизация с Jolpica-F1.
- Светлая и тёмная темы; адаптивный интерфейс (включая мобильный header).

**Интеграции и инфраструктура**

- Источники данных: Jolpica-F1 API, Wikipedia REST API, Open-Meteo, RSS.
- Socket.IO: комнаты по Гран-при, presence, heartbeat, события смены статуса гонки, голосов и комментариев.
- Redis (опционально): кэш внешних API и публичных GET (`X-Cache: HIT|MISS`), общий store rate limiting, Socket.IO adapter и presence. Без Redis работает in-memory fallback.
- Grafana + Loki + Promtail для просмотра логов контейнеров.
- Docker Compose + Nginx, деплой на Netlify/Render, GitHub Actions CI.

---

## Стек

| Слой | Технологии |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4, @dnd-kit, Socket.IO client |
| Backend | Node.js, Express 5, JWT + bcryptjs, node-cron, Nodemailer (код задела; в проде почта выключена) |
| PostgreSQL | Sequelize 6 + PostgreSQL 16 — пользователи, пилоты, команды, гонки, результаты, избранное |
| MongoDB | Mongoose 9 + MongoDB 7 — вложенные документы прогнозов, голосов и комментариев |
| Real-time | Socket.IO 4, Redis 7 (опционально) |
| Infra | Docker Compose, Nginx, Grafana + Loki + Promtail, Makefile |
| Тесты | Jest + Supertest (server), `node --test` (client), oxlint (client), `node --check` (server) |
| CI/CD | GitHub Actions → Netlify (frontend) + Render (backend, Docker) |

Слои сервера: `Routes → Controllers → Services → Repositories` (Clean Architecture).
Клиент: `client/src/{features,components,pages,layout,contexts,hooks,utils}`.

---

## Структура репозитория

```text
server/                  Express API, Sequelize-модели, Mongoose-документы,
                         сервисы, репозитории, cron, скрипты сидов/синхронизации
client/                  React SPA (Vite), configs для nginx и Netlify
docker/                  docker-compose.yml, nginx, promtail, дашборды Grafana
.opencode/               PLAN.md, gen.md, задания эпиков и сценарии тестирования
.github/workflows/ci.yml lint + Jest сервера, сборка клиента
Makefile                 локальные команды (up/dev/app/logs/migrate/seed/sync/...)
render.yaml, netlify.toml  конфигурация деплоя
```

---

## Быстрый старт локально

Потребуется Docker с Compose, Node.js 22 и npm.

```bash
cp .env.example .env          # при необходимости поменять локальные пароли/секреты
make up                       # PostgreSQL, MongoDB, Redis, Mailhog
make migrate                  # миграции PostgreSQL
make seed                     # демо-данные чемпионата
make seedmongo                # демо-документ народного прогноза (опционально)
make dev                      # hot-reload: API :3000 + Vite :5173
```

Либо полный стек в prod-сборке: `make app` → frontend на `http://localhost` (nginx), API внутри сети на `:3000`.

Без контейнеров (нужны запущенные БД):

```bash
cd server && npm ci && npm run db:migrate && npm run db:seed && npm run dev
cd client && npm ci && npm run dev       # Vite проксирует /api и /socket.io на :3000
```

Полезные команды: `make logs`, `make logs-dev`, `make stop`, `make down`, `make reset`,
`make psql | mongo | redis | mailhog`, `make sync`. Синхронизация истории:
`cd server && npm run sync:history -- 2000 2025`; выравнивание состава голосования —
`npm run reconcile:vote-roster` (dry-run) или `npm run reconcile:vote-roster -- --apply`.

| Адрес | Что |
|---|---|
| http://localhost:5173 | клиент в dev-режиме |
| http://localhost | клиент в prod-сборке (nginx) |
| http://localhost:3000/api/health | состояние API и БД |
| http://localhost:8025 | Mailhog (письма локально) |
| http://localhost:3001 | Grafana (логи) |

---

## Демо-учётки

Регистрация в проде отключена (см. «Осознанные решения»), вход — по готовым аккаунтам:

| Email | Пароль | Роль |
|---|---|---|
| `admin@f1stats.test` | `admin123` | ADMIN |
| `maxfan@f1stats.test` | `maxfan123` | USER |
| `ferrarifan@f1stats.test` | `ferrari123` | USER |
| `mclarenfan@f1stats.test` | `mclaren123` | USER |
| `redbullfan@f1stats.test` | `redbull123` | USER |
| `alpinefan@f1stats.test` | `alpine123` | USER |

Обновить их в существующей БД: `cd server && npm run seed:demo-users`.

---

## API и страницы

Базовый префикс API — `/api`. Группы эндпоинтов:

```text
/auth  /drivers  /teams  /races  /history  /race-results  /season-teams
/users  /news  /standings  /probabilities/next  /leaderboard
/predictions  /admin  /health
```

Основные страницы клиента: `/`, `/drivers`, `/teams`, `/calendar`, `/standings`,
`/history`, `/history/races/:raceId`, `/predictions`, `/vote`, `/leaderboard`,
`/login`, `/cabinet` (USER), `/admin/*` (ADMIN).

---

## Проверка

```bash
cd server && npm test && npm run test:coverage && npm run lint
cd server && npm run test:integration      # интеграционные сценарии
cd client && npm test && npm run lint && npm run build
```

Ручные сценарии для браузера — `.opencode/testing/README.md` (`01-smoke` → `06-regression`).
Часть шагов описана для локального стенда с Mailhog и подтверждением email
(`EMAIL_ENABLED=true`); в проде этот флоу не используется.

---

## Деплой

- **Frontend:** Netlify, сборка из `client/` (`netlify.toml` с base `client`, SPA-redirect).
- **Backend:** Render, Docker-образ из `server/`, healthcheck `/api/health` (`render.yaml`).
- **БД:** PostgreSQL — Neon, MongoDB — Atlas M0.
- **CI:** `.github/workflows/ci.yml` — lint и тесты сервера, сборка клиента; деплой по push.
- Секреты задаются только в панелях провайдеров; `.env` не коммитится. В репозитории для `VITE_API_URL` используется нейтральный пример `https://<backend-host>/api`, боевое значение — в Netlify env.
- Render free засыпает после ~15 минут простоя: первый запрос может занять 30–60 с.

Основные переменные прода перечислены в `.env.example`; ключевые:
`NODE_ENV`, `DATABASE_URL`, `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGINS`,
`FRONTEND_URL`, `REDIS_ENABLED=false`, `EMAIL_ENABLED=false`, флаги cron.

---

## Осознанные решения и ограничения

- **Почта в проде не работает намеренно:** Render Free блокирует SMTP-порты 25/465/587. `EMAIL_ENABLED=false`, `POST /api/auth/register` возвращает быстрый `503`, пользователь не создаётся. Код подтверждения (SHA-256 + TTL 24 ч) и напоминания остаются как задел для локального Mailhog; в проде доступ — по демо-учёткам.
- **Redis в проде выключен** (`REDIS_ENABLED=false`): один бэкенд-инстанс, in-memory fallback. Локально Redis поднимается Compose и используется для кэша и rate limiting.
- **UptimeRobot не подключён.**
- **E2E Playwright не ведутся:** покрытие — Jest/Supertest, node-тесты клиента и ручные сценарии `01–06`.
- **Личный ТОП-3 доступен только через API/скоринг**, формы в UI нет (решение эпика-13).
- **Избранное не фильтрует новости:** лента общая, избранные пилоты/команды показываются в кабинете.
- **Cron синхронизации Jolpica выключен по умолчанию** (`SYNC_CRON_ENABLED=false`); синк запускается вручную из админки или `npm run sync:f1`. Cron начисления баллов включён.
- Монго деградирует до `503` на прогнозных эндпоинтах, если БД недоступна; остальное приложение продолжает работать.

---

## Документация

- `.opencode/PLAN.md` — цели, User Stories, Use Cases, статус эпиков.
- `.opencode/gen.md` — архитектура, схемы БД, формула Softmax, кэш и деплой.
- `.opencode/epic-NN/task.md` — задания лабораторных работ.
- `.opencode/testing/` — ручные и агентские сценарии проверки.
