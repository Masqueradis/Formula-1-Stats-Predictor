# Лаба 8 — backend (Node.js/Express)
# node:22-alpine: актуальный LTS (mongoose 9 требует Node >= 20; node:18 из примера лабы не подойдёт)
FROM node:22-alpine

WORKDIR /app

# Диагностика контекста сборки: в логах Render видно, что именно попало в контекст.
# Если здесь видны package.json и package-lock.json — Root Directory выставлен верно.
RUN echo "[docker] build context contents:" && ls -la

# Явно копируем оба манифеста ДО установки зависимостей.
# npm ci строго требует package-lock.json: если файлов нет в контексте сборки,
# ошибка будет видна на этом шаге, а не как непонятный сбой npm ci.
COPY package.json package-lock.json ./

# Диагностика для логов Render: видно, что попало в /app перед npm ci
RUN echo "[docker] /app contents before npm ci:" && ls -la

# Полная установка (включая dev): sequelize-cli нужен для миграций/сидов,
# nodemon — для hot-reload в dev-режиме (профиль compose "dev")
RUN npm ci

# Только после установки копируем остальной код
COPY . .

# entrypoint: миграции + сиды перед стартом процесса
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
# По умолчанию — прод-запуск; в compose dev-профиль переопределяет command на "npm run dev"
CMD ["node", "src/server.js"]
