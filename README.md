# Simply lovely — F1 Stats & Predictor

SPA для статистики Формулы-1, исторических Гран-при, прогнозов Softmax, народного прогноза и live-обновлений.

## Деплой (Эпик-12)

- **Frontend:** https://tourmaline-wisp-d2b6de.netlify.app (Netlify, SPA; конфиг `netlify.toml` в корне + `client/netlify.toml`, fallback `client/public/_redirects`)
- **Backend API:** https://simply-lovely-api.onrender.com (Render, Docker, healthcheck `/api/health`)
- **Базы данных:** PostgreSQL — Neon, MongoDB — Atlas M0 (managed)
- **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`), деплой по push

### Решения и ограничения (free tier)
- **Redis не используется:** `REDIS_ENABLED=false`, приложение работает на in-memory fallback (Upstash не подключён). Статус: `GET /api/health` → `databases.redis`.
- **UptimeRobot не используется:** Render free засыпает после ~15 мин простоя, первый запрос может занимать 30–60 с.
- **Почта/подтверждение e-mail в проде не используется:** Render Free блокирует исходящие SMTP-порты 25/465/587, поэтому отправка писем отключена (`EMAIL_ENABLED=false`). Регистрация возвращает быстрый `503` с подсказкой использовать демо-аккаунты; «висячие» не подтверждённые пользователи не создаются. Переход на HTTP API почты (Resend/Brevo API) — отдельная задача.
- **Демо-учётки для входа:**
  - `admin@f1stats.test` / `admin123` (ADMIN)
  - `maxfan@f1stats.test` / `maxfan123`
  - `ferrarifan@f1stats.test` / `ferrari123`
  - `mclarenfan@f1stats.test` / `mclaren123`
  - `redbullfan@f1stats.test` / `redbull123`
  - `alpinefan@f1stats.test` / `alpine123`

  Добавить/обновить их в уже существующей БД можно командой `npm run seed:demo-users`.
- **Бэкфилл истории 2000–2025:** выполняется локально против прод-БД (`npm run sync:history -- 2000 2025`).
- **Render free:** эфемерная ФС, 512 МБ, нет shell/job’ов (миграции/сиды Postgres выполняет `server/docker-entrypoint.sh`; `seed:mongo` и тяжёлый бэкфилл — локально), 750 инстанс-часов/мес, WebSocket на одном инстансе.

### Переменные окружения (production)
Задаются в панелях Render/Netlify (секреты не коммитить). Минимум для backend: `NODE_ENV=production`, `DATABASE_URL`, `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGINS=https://tourmaline-wisp-d2b6de.netlify.app`, `FRONTEND_URL=https://tourmaline-wisp-d2b6de.netlify.app`, `REDIS_ENABLED=false`, `EMAIL_ENABLED=false`. Frontend (Netlify build env): `VITE_API_URL=https://<backend-host>/api`. Полный список — `.env.example`.

## Стек

- **Frontend:** React + Vite, TailwindCSS, Recharts, Socket.IO client.
- **Backend:** Node.js + Express, Sequelize/PostgreSQL, Mongoose/MongoDB, Socket.IO.
- **Инфраструктура:** Docker Compose, Nginx, Redis 7 (локально/опц.), Grafana + Loki + Promtail.

## Быстрый старт (локально)

```bash
cp .env.example .env
make up          # PostgreSQL, MongoDB, Redis, Mailhog
make migrate
make seed
make dev         # hot-reload backend + frontend
```

Полный стек в Docker:

```bash
make app         # production-сборка и запуск всех контейнеров
make logs
make down
```

## Redis

Redis используется как деградируемая зависимость: кэш внешних API и публичных GET, общий store rate limiter'ов, Socket.IO adapter и presence.

```bash
# переменные (.env)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# запуск только Redis / redis-cli
make redis
docker compose -f docker/docker-compose.yml up -d redis
docker compose -f docker/docker-compose.yml exec redis redis-cli ping
```

Если `REDIS_ENABLED=false`, `REDIS_URL` не задан или Redis недоступен, приложение продолжает работать на in-memory fallback. Статус виден в `GET /api/health` → `databases.redis` (`up` / `down` / `disabled`).

## Проверка

```bash
cd server && npm test
cd client && npm run build
```

Подробности архитектуры и решений — в `.opencode/gen.md` и `.opencode/PLAN.md`.
