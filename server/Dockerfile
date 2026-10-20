# Лаба 8 — backend (Node.js/Express)
# node:22-alpine: актуальный LTS (mongoose 9 требует Node >= 20; node:18 из примера лабы не подойдёт)
FROM node:22-alpine

WORKDIR /app

# Сначала только манифесты — слой кэшируется, пока lock-файл не меняется
COPY package*.json ./
# Полная установка (включая dev): sequelize-cli нужен для миграций/сидов,
# nodemon — для hot-reload в dev-режиме (профиль compose "dev")
RUN npm ci

COPY . .

# entrypoint: миграции + сиды перед стартом процесса
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
# По умолчанию — прод-запуск; в compose dev-профиль переопределяет command на "npm run dev"
CMD ["node", "src/server.js"]
