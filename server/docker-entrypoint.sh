#!/bin/sh
# Старт backend-контейнера: подготовить БД и только потом запускать процесс.
# Сиды отслеживаются sequelize-cli в таблице SequelizeData, повторный запуск — no-op.
set -e

echo "[entrypoint] Applying migrations..."
npx sequelize-cli db:migrate

echo "[entrypoint] Applying seeders..."
if ! npx sequelize-cli db:seed:all; then
  # Не убиваем контейнер: данные могли быть вставлены частично (нет записи в SequelizeData),
  # но приложение работоспособно. Повторный прогон — make seed / make reset.
  echo "[entrypoint] WARN: seeders skipped/failed — check 'make seed'"
fi

echo "[entrypoint] Starting: $*"
exec "$@"
