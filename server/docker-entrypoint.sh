#!/bin/sh
set -e

echo "[entrypoint] Applying migrations..."
npx sequelize-cli db:migrate

echo "[entrypoint] Applying seeders..."
if ! npx sequelize-cli db:seed:all; then
  echo "[entrypoint] WARN: seeders skipped/failed — check 'make seed'"
fi

echo "[entrypoint] Starting: $*"
exec "$@"
