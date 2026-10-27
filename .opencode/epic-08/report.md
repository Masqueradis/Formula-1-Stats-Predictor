# Отчёт по лабораторной работе №8
## «Контейнеризация приложения с Docker»

**Дисциплина:** Программирование веб-приложений  
**Тема:** Освоение технологии контейнеризации Docker: создание Dockerfile для backend и frontend, сборка образов, запуск контейнеров, настройка многоконтейнерного приложения с помощью Docker Compose для упаковки и развёртывания курсового проекта «Simply lovely» (F1 Stats & Predictor).  
**Выполнил:** студент  
**Преподаватель:**  
**Дата:** 27.10.2026

## Содержание

- [1. Цель работы](#1-цель-работы)
- [2. Теоретические основы контейнеризации](#2-теоретические-основы-контейнеризации)
- [3. Характеристика курсового проекта](#3-характеристика-курсового-проекта)
- [4. Порядок выполнения работы](#4-порядок-выполнения-работы)
- [5. Dockerfile для backend](#5-dockerfile-для-backend)
- [6. Dockerfile для frontend. Многоэтапная сборка](#6-dockerfile-для-frontend-многоэтапная-сборка)
- [7. Конфигурация Nginx для фронтенда](#7-конфигурация-nginx-для-фронтенда)
- [8. Файл docker-compose.yml](#8-файл-docker-composeyml)
- [9. Сборка и запуск приложения](#9-сборка-и-запуск-приложения)
- [10. Проверка работы приложения в контейнерах](#10-проверка-работы-приложения-в-контейнерах)
- [11. Описание выбранных дополнительных требований и их реализации](#11-описание-выбранных-дополнительных-требований-и-их-реализации)
- [12. Ответы на контрольные вопросы](#12-ответы-на-контрольные-вопросы)
- [13. Заключение](#13-заключение)
- [Список использованных источников](#список-использованных-источников)

## 1. Цель работы

Целью лабораторной работы является освоение технологии контейнеризации **Docker**: создание `Dockerfile` для backend и frontend, сборка образов, запуск контейнеров, настройка многоконтейнерного приложения с помощью **Docker Compose** для упаковки и развёртывания курсового проекта «Simply lovely».

## 2. Теоретические основы контейнеризации

**Docker** – платформа для разработки, доставки и запуска приложений в изолированных средах – контейнерах. 

Основные понятия:

- **Образ (Image)** – шаблон только для чтения, содержащий инструкции для создания контейнера. Образ формируется на основе `Dockerfile` и может состоять из нескольких слоёв.
- **Контейнер (Container)** – исполняемый экземпляр образа. Контейнер изолирован от хост-системы, имеет собственную файловую систему, сеть и процессы.
- **Dockerfile** – текстовый файл с набором инструкций (`FROM`, `WORKDIR`, `COPY`, `RUN`, `EXPOSE`, `CMD`, `ENTRYPOINT`) для автоматической сборки образа.
- **Многоэтапная сборка (multi-stage build)** – позволяет использовать несколько стадий сборки в одном `Dockerfile`, в результате чего итоговый образ содержит только необходимые артефакты и имеет меньший размер.
- **Docker Compose** – инструмент для определения и запуска многоконтейнерных приложений с помощью файла `docker-compose.yml`. Позволяет описать сервисы, сети, тома, зависимости между контейнерами.
- **Том (Volume)** – механизм персистентного хранения данных, независимый от жизненного цикла контейнера. Используется для хранения данных баз данных.
- **Сеть (Network)** – виртуальная сеть Docker, позволяющая контейнерам взаимодействовать между собой по имени сервиса.
- **Healthcheck** – проверка работоспособности сервиса. Позволяет управлять запуском зависимых контейнеров при помощи условия `service_healthy`.

## 3. Характеристика курсового проекта

Курсовой проект «Simply lovely» представляет собой веб-приложение (SPA) для агрегации, анализа и визуализации статистики гонок Формулы 1.

**Технологический стек:**

- **Frontend:** React 19, Vite 8, TailwindCSS 4, @dnd-kit, Socket.IO Client
- **Backend:** Node.js 22, Express 5, Sequelize, Mongoose, Socket.IO
- **Базы данных:** PostgreSQL 16 (основные сущности), MongoDB 7 (прогнозы и комментарии к гонке)
- **Дополнительно:** JWT + bcryptjs, Nodemailer, node-cron, fast-xml-parser
- **Инфраструктура разработки:** Docker, Docker Compose, Nginx

## 4. Порядок выполнения работы

В рамках лабораторной работы были выполнены следующие этапы:

1. Создан `Dockerfile` для backend-приложения на Node.js/Express.
2. Создан `Dockerfile` для frontend-приложения с многоэтапной сборкой.
3. Настроен `nginx.conf` для раздачи статики, SPA-fallback и проксирования `API` и `WebSocket` на backend.
4. Расширен существующий файл `docker/docker-compose.yml` для запуска backend, frontend, PostgreSQL, MongoDB и Mailhog.
5. Организованы изоляция сетей, healthcheck'и, использование `.env`-файла.
6. Настроен dev-режим с hot-reload через профиль `dev` в Docker Compose.
7. Произведена сборка и проверка работоспособности приложения в контейнерах.
8. Подготовлен отчёт по лабораторной работе.

## 5. Dockerfile для backend

Для backend-приложения был создан файл `server/Dockerfile`. В качестве базового образа выбран `node:22-alpine`, так как он является актуальной LTS-версией и совместим с используемыми в проекте зависимостями (в частности, `mongoose` 9 требует Node.js не ниже 20).

**Листинг `server/Dockerfile`:**

```dockerfile
# Лаба 8 — backend (Node.js/Express)
FROM node:22-alpine

WORKDIR /app

# Сначала только манифесты — слой кэшируется
COPY package*.json ./
# Установка всех зависимостей (включая dev): sequelize-cli, nodemon
RUN npm ci

COPY . .

# Делаем entrypoint исполняемым
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
```

**Пояснения к инструкциям:**

- `FROM node:22-alpine` – базовый образ с минимальным размером.
- `WORKDIR /app` – установка рабочей директории внутри контейнера.
- `COPY package*.json ./` – копирование файлов зависимостей для эффективного использования кэша слоёв Docker.
- `RUN npm ci` – чистая установка зависимостей по `package-lock.json`.
- `COPY . .` – копирование исходного кода backend в образ.
- `EXPOSE 3000` – информирование о том, что приложение слушает порт 3000.
- `ENTRYPOINT` и `CMD` – запуск скрипта инициализации с последующим стартом сервера.

Для автоматического применения миграций и сидов при старте контейнера реализован скрипт `server/docker-entrypoint.sh`:

```sh
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
```

Сидер демо-данных (`20250101000001-demo-f1-data.js`) был доработан до идемпотентного: при наличии уже заполненных таблиц он пропускает вставку данных, что исключает ошибки при повторном запуске контейнера.

Также добавлен файл `server/.dockerignore` для исключения из контекста сборки `node_modules`, `.env`, логов и прочего лишнего.

## 6. Dockerfile для frontend. Многоэтапная сборка

Для frontend реализована многоэтапная сборка. На первом этапе выполняется сборка React-приложения с помощью Vite, на втором – раздача собранных статических файлов через Nginx.

**Листинг `client/Dockerfile`:**

```dockerfile
# Этап 1: сборка SPA
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Этап 2: раздача статики через Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Пояснения:**

- `AS builder` – именование первого этапа сборки.
- `RUN npm run build` – сборка оптимизированного бандла Vite в директорию `dist`.
- `COPY --from=builder /app/dist /usr/share/nginx/html` – копирование только результатов сборки во второй образ, без исходников и `node_modules`. Благодаря этому итоговый образ `f1stats-frontend` имеет значительно меньший размер.
- `EXPOSE 80` – порт, на котором Nginx будет принимать HTTP-запросы.

## 7. Конфигурация Nginx для фронтенда

В файле `client/nginx.conf` реализованы три ключевых момента:

1. **Reverse-proxy для REST API** – все запросы по пути `/api/` проксируются на backend.
2. **Reverse-proxy для WebSocket (Socket.IO)** – поддержка `Upgrade`/`Connection` для установления WebSocket-соединения.
3. **SPA-fallback** – корректная работа клиентского роутинга React Router при прямом переходе по URL.

**Листинг `client/nginx.conf` (основные блоки):**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # REST API
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Socket.IO
    location /socket.io/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Благодаря такому подходу весь трафик приложения идёт через единый origin `http://localhost`, что избавляет от проблем с CORS и упрощает работу с WebSocket. На клиенте `axios` и `socket.io-client` переведены на использование относительного пути `/api`.

## 8. Файл docker-compose.yml

Файл `docker/docker-compose.yml` был расширен и объединяет в себе инфраструктуру и само приложение. Реализованы два режима работы: **прод-стек** (для демонстрации по заданию лабораторной) и **dev-стек** с hot-reload (для разработки).

### Состав сервисов

- `postgres` – PostgreSQL 16, volume `pgdata`, healthcheck через `pg_isready`
- `mongo` – MongoDB 7, volume `mongodata`, healthcheck через `mongosh`
- `mailhog` – SMTP-сервер для тестовой почты (доступен по `http://localhost:8025`)
- `backend` – backend-контейнер, собирается из `../server`, подключается к внутренним сетям
- `frontend` – frontend-контейнер с Nginx, пробрасывает порт `80:80` на хост
- `backend-dev`, `frontend-dev` – сервисы для dev-режима с профилем `dev` (nodemon + vite, bind-монтирование исходников)

### Изоляция сетей

В Compose описаны две пользовательские сети:

- `frontend` – сеть для взаимодействия `frontend` <-> `backend`
- `backend` – сеть для взаимодействия `backend` <-> `postgres`, `mongo`, `mailhog`

Таким образом, **frontend-контейнер не имеет прямого доступа к базам данных** – изоляция сервисов реализована корректно.

### Healthcheck и зависимости

Для `backend` настроен healthcheck, проверяющий доступность эндпоинта `/api/health` с использованием встроенного в `node:22` `fetch`. Сервис `frontend` запускается только при условии `backend` в состоянии `healthy` (`depends_on` с `condition: service_healthy`).

### Переменные окружения

Для передачи конфигурации используется `env_file: ../.env`. При этом в `docker-compose.yml` заданы контейнерные переопределения: `DATABASE_URL` указывает на сервис `postgres`, `MONGO_URI` – на `mongo`, `SMTP_HOST` – на `mailhog`. Это позволяет контейнерам взаимодействовать друг с другом по именам сервисов, а не по `localhost`.

## 9. Сборка и запуск приложения

Сборка и запуск производились из корня репозитория по команде, требуемой в задании лабораторной:

**Команда для запуска:**

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Либо через Makefile:

```bash
make app
```

В ходе сборки Docker автоматически:

- скачал базовые образы `node:22-alpine`, `nginx:alpine`, `postgres:16-alpine`, `mongo:7`, `mailhog/mailhog`
- собрал образы `docker-backend` и `docker-frontend` (многоэтапная сборка)
- создал сети `docker_frontend`, `docker_backend`
- создал тома `docker_pgdata`, `docker_mongodata`
- поднял и связал все контейнеры

## 10. Проверка работы приложения в контейнерах

### 10.1. Список запущенных контейнеров

После запуска было выполнено:

```bash
docker ps
```

В результате получен следующий список контейнеров:

| NAMES | STATUS | PORTS |
| --- | --- | --- |
| `f1stats-frontend` | Up | `0.0.0.0:80->80/tcp, [::]:80->80/tcp` |
| `f1stats-backend` | Up (healthy) | `3000/tcp` |
| `f1stats-postgres` | Up (healthy) | `0.0.0.0:5432->5432/tcp` |
| `f1stats-mongo` | Up (healthy) | `0.0.0.0:27017->27017/tcp` |
| `f1stats-mailhog` | Up | `0.0.0.0:1025->1025/tcp, 0.0.0.0:8025->8025/tcp` |

Как видно, все сервисы запущены. Backend находится в состоянии `healthy`, что подтверждает успешную работу healthcheck.

### 10.2. Лог запуска backend-контейнера

```text
[entrypoint] Applying migrations...
No migrations were executed, database schema was already up to date.
[entrypoint] Applying seeders...
demo-f1-data: already seeded — skip
[entrypoint] Starting: node src/server.js
F1 Stats server running on http://localhost:3000
Socket.IO ready on ws://localhost:3000/socket.io
MongoDB connected
```

Видно, что entrypoint успешно применил миграции, выполнил проверку сидов (в связи с идемпотентностью пропустил их повторную вставку) и запустил сервер. Подключение к PostgreSQL и MongoDB установлено.

### 10.3. Проверка в браузере

Приложение доступно по адресу [http://localhost](http://localhost).

Были проверены следующие маршруты через Nginx:

- `http://localhost/` – главная страница дашборда с новостями – **200 OK**
- `http://localhost/standings` – турнирные таблицы – **200 OK** (SPA-fallback)
- `http://localhost/predictions` – прогнозы – **200 OK**
- `http://localhost/admin/drivers` – админка – **200 OK**
- `http://localhost/api/health` – проверка состояния – **200 OK**

Ответ `/api/health`:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 10.45,
    "databases": {
      "postgres": "up",
      "mongo": "up"
    }
  }
}
```

Заголовок ответа `Server: nginx/1.31.7` подтверждает, что запрос прошёл через reverse-proxy.

### 10.4. Проверка WebSocket через Nginx

Для проверки проксирования Socket.IO был выполнен запрос на WebSocket-upgrade:

```bash
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     "http://localhost/socket.io/?EIO=4&transport=websocket"
```

**Результат:** `HTTP/1.1 101 Switching Protocols`

Это означает, что Nginx корректно пробросил заголовки `Upgrade` и `Connection`, установив WebSocket-соединение между клиентом и backend-контейнером. Таким образом, реализована поддержка real-time-функционала (live-обновления, онлайн-статус, события голосования) через проксирование.

### 10.5. Проверка авторизации и RBAC

Был успешно протестирован полный цикл аутентификации через прокси:

- Регистрация нового пользователя – письмо с ссылкой подтверждения отправлено в Mailhog
- Переход по ссылке верификации `http://localhost/verify?token=...` – успешная активация аккаунта
- Авторизация через `/api/auth/login` – получен JWT-токен
- Запрос к `/api/auth/me` с Bearer-токеном – данные пользователя получены
- Доступ к защищённому админскому роуту `/api/admin/drivers` под ролью `USER` – **403 Forbidden** (RBAC работает корректно)

После тестирования тестовый пользователь был удалён, почтовый ящик в Mailhog очищен. Состояние БД приведено к исходному.

## 11. Описание выбранных дополнительных требований и их реализации

Согласно заданию лабораторной работы было реализовано несколько дополнительных требований:

| Доп. требование | Реализация | Результат проверки |
| --- | --- | --- |
| **Переменные окружения** | Использован `env_file: ../.env` в `docker-compose.yml`. Контейнерные имена сервисов (`postgres`, `mongo`, `mailhog`) проброшены через переопределения `environment`. | Переменные корректно подтягиваются, приложение подключается к БД по внутренним именам |
| **Healthcheck для backend** | В сервисе `backend` добавлен `healthcheck` на `http://127.0.0.1:3000/api/health` через `node:22` `fetch`. `frontend` зависит от `backend` по `condition: service_healthy`. | `docker ps` показывает `f1stats-backend (healthy)`. Frontend стартует только после готовности backend |
| **Изоляция сетей** | Созданы сети `frontend` и `backend`. `frontend` подключён только к `frontend`. `backend` подключён к `frontend` и `backend`. `postgres/mongo/mailhog` подключены только к `backend`. | `f1stats-frontend` не резолвит `postgres` и `mongo`, видит только `backend`. `f1stats-backend` видит все внутренние сервисы. Базы данных недоступны напрямую из фронтенд-контейнера |
| **Reverse-proxy (Nginx)** | `client/nginx.conf` настроен на проксирование `/api/` и `/socket.io/` на `http://backend:3000` с поддержкой WebSocket (`Upgrade`/`Connection`), `proxy_read_timeout`. Реализован SPA-fallback. | Единый origin `http://localhost`, отсутствуют CORS-ошибки, WS-upgrade проходит по коду `101 Switching Protocols` |

Также реализован **dev-режим в Docker Compose** с профилем `dev`. При помощи `make dev` поднимаются `backend-dev` (nodemon) и `frontend-dev` (Vite dev-server с проксированием на `backend-dev`), при этом исходники монтируются через bind-мountы. Это позволяет разрабатывать с hot-reload, не пересобирая образы при каждом изменении кода.

Клиентское приложение переведено на относительный `baseURL: '/api'`, что делает его унифицированным как для прод-контейнера с Nginx, так и для dev-контейнера с Vite.

## 12. Ответы на контрольные вопросы

**1. Чем отличается Docker-образ от Docker-контейнера?**  
Образ – это неизменяемый шаблон (набор слоёв), из которого создаются контейнеры. Контейнер – это запущенный экземпляр образа, имеющий своё состояние, процессы и изолированное окружение.

**2. Для чего используется инструкция COPY --from=builder в многоэтапной сборке?**  
Она позволяет скопировать только необходимые артефакты (собранные файлы) из предыдущего этапа (`builder`) в итоговый образ, не включая в него инструменты сборки, исходники и `node_modules`. Это значительно уменьшает размер итогового образа.

**3. Как в Docker Compose организовать связь между контейнерами по имени сервиса?**  
Контейнеры, находящиеся в одной сети Docker, могут обращаться друг к другу по имени сервиса, указанному в `docker-compose.yml`. Docker автоматически настраивает внутренний DNS, благодаря чему, например, `frontend` обращается к `backend` по `http://backend:3000`.

**4. Что такое том (volume) и зачем он нужен для базы данных?**  
Том – это персистентное хранилище, управляемое Docker. Данные в томе сохраняются даже при удалении или пересоздании контейнера. Для PostgreSQL и MongoDB это необходимо для сохранения пользовательских данных, миграций и сидов при перезапуске контейнеров.

**5. Как посмотреть логи запущенных контейнеров?**  
С помощью команды `docker logs <имя_контейнера>`. Также можно использовать `docker compose logs -f <сервис>` для просмотра логов в реальном времени или `make logs` в проекте.

**6. Как уменьшить размер Docker-образа? Назовите не менее 3 способов.**  
- **Многоэтапная сборка** – оставить в финальном образе только артефакты сборки.
- **Использование лёгких базовых образов** – например, `alpine`-версии (`node:22-alpine`, `nginx:alpine`).
- **Очистка кэша и лишних файлов** – использование `.dockerignore`, объединение инструкций `RUN`, удаление временных зависимостей.
- **Установка только production-зависимостей** – там, где это уместно.

**7. Какая инструкция Dockerfile задаёт команду по умолчанию при запуске контейнера?**  
Инструкция `CMD`. Также может использоваться `ENTRYPOINT` в связке с `CMD`.

**8. В чём разница между CMD и ENTRYPOINT?**  
`ENTRYPOINT` задаёт неизменяемую команду, которая всегда будет выполнена при старте контейнера. `CMD` задаёт аргументы по умолчанию для `ENTRYPOINT` либо саму команду, если `ENTRYPOINT` не указан. При запуске `docker run` можно переопределить аргументы `CMD`, но с `ENTRYPOINT` поведение иное.

**9. Как в Docker Compose задать зависимость запуска контейнеров (чтобы база данных стартовала раньше backend)?**  
Используется `depends_on` вместе с `condition: service_healthy` и настроенным `healthcheck` у сервиса-зависимости. В данном проекте `backend` зависит от `postgres` и `mongo` именно по условию `service_healthy`.

**10. Как выполнить команду внутри запущенного контейнера (например, зайти в оболочку)?**  
`docker exec -it <имя_контейнера> sh` (для alpine-образов) или `bash`. В проекте также предусмотрены удобные цели `make psql`, `make mongo` для доступа к БД.

**11. Как пробросить порт с хоста в контейнер в Docker Compose?**  
С помощью директивы `ports: - "HOST_PORT:CONTAINER_PORT"`. В проекте `frontend` пробрасывает `80:80`, PostgreSQL – `5432:5432`, MongoDB – `27017:27017`, Mailhog UI – `8025:8025`. Порт `3000` backend-контейнера на хост не пробрасывается – доступ только через Nginx.

**12. Как в Docker Compose использовать файл .env для переменных окружения?**  
Можно использовать `env_file: ./path/.env` для передачи переменных в контейнер, либо подставлять их в `docker-compose.yml` через `${VAR}`. В проекте используется `env_file: ../.env`, а также явные переопределения для внутренних имён сервисов.

**13. Что такое healthcheck в Docker и зачем он нужен?**  
`healthcheck` – инструкция для проверки работоспособности запущенного сервиса (например, HTTP-запрос, проверка порта, команда). Он позволяет определить состояние `healthy/unhealthy` и использовать его в `depends_on` для корректного порядка запуска зависимых сервисов, избегая ошибок подключения при старте.

**14. Как опубликовать собственный образ в альтернативный реестр (например, GitLab Container Registry)?**  
Необходимо выполнить: `docker login registry.gitlab.com`, затем присвоить образу тег `registry.gitlab.com/<namespace>/<project>/<имя_образа>:<тег>` (`docker tag`), после чего опубликовать командой `docker push`. В связи с ограничением доступа к Docker Hub в РБ в задании также упоминаются зеркала и альтернативные реестры.

**15. Что произойдёт, если не смонтировать volume для базы данных? Что будет при перезапуске контейнера?**  
При отсутствии volume все данные БД будут храниться во внутренней файловой системе контейнера. При остановке и удалении контейнера (`docker rm`) эти данные будут **утеряны**. При простом перезапуске (`docker restart`) данные могут сохраниться, но наиболее надёжный и корректный способ – использование именованного volume (`pgdata`, `mongodata`), что и реализовано в проекте.

**16. Как в Docker Compose масштабировать сервис (например, backend) до нескольких экземпляров? Какие ограничения?**  
Можно использовать `docker compose up --scale backend=3`. Однако при этом невозможно использовать фиксированный `container_name`, проброс отдельных портов на хост (конфликт), а также важен механизм балансировки (reverse-proxy/load balancer). В текущей архитектуре использованы in-memory сессии/комнаты Socket.IO, поэтому для нескольких инстансов backend потребовалась бы sticky-сессия или вынесение pub/sub (Redis), что отмечено как отложенное в `PLAN.md`.

## 13. Заключение

В ходе выполнения лабораторной работы были получены практические навыки по контейнеризации веб-приложения с использованием **Docker** и **Docker Compose**.

Были успешно выполнены все задачи работы:

- Созданы `Dockerfile` для backend и frontend с применением многоэтапной сборки.
- Настроен `nginx.conf` с reverse-proxy для `/api` и `/socket.io`, а также с SPA-fallback для корректной работы клиентского роутинга.
- Развёрнут многоконтейнерный стек: `backend`, `frontend`, `PostgreSQL`, `MongoDB`, `Mailhog`.
- Реализованы и проверены дополнительные требования: использование `.env`, `healthcheck` с `service_healthy`, изоляция сетей, reverse-proxy Nginx с поддержкой WebSocket.
- Настроен удобный dev-режим с hot-reload через Docker Compose профиль.
- Приложение успешно собрано и проверено в браузере по адресу `http://localhost`.

Проверка показала: все контейнеры запущены, backend в состоянии `healthy`, фронтенд раздаётся через Nginx, REST API доступен через прокси, WebSocket-соединение устанавливается по коду `101 Switching Protocols`, аутентификация и RBAC работают корректно. Взаимодействие между контейнерами организовано по именам сервисов, базы данных изолированы от фронтенд-контейнера.

Таким образом, цель лабораторной работы достигнута. Полученные навыки контейнеризации могут быть использованы для упаковки, запуска и последующего развёртывания полнофункциональных веб-приложений.

## Список использованных источников

1. Docker Documentation. – Режим доступа: [https://docs.docker.com/](https://docs.docker.com/)
2. Docker Compose Documentation. – Режим доступа: [https://docs.docker.com/compose/](https://docs.docker.com/compose/)
3. Nginx Documentation. – Режим доступа: [https://nginx.org/ru/docs/](https://nginx.org/ru/docs/)
4. Node.js Documentation. – Режим доступа: [https://nodejs.org/docs/](https://nodejs.org/docs/)
5. Vite Documentation. – Режим доступа: [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
6. Express.js Documentation. – Режим доступа: [https://expressjs.com/](https://expressjs.com/)
7. Sequelize Documentation. – Режим доступа: [https://sequelize.org/](https://sequelize.org/)
8. Mongoose Documentation. – Режим доступа: [https://mongoosejs.com/docs/](https://mongoosejs.com/docs/)
9. Socket.IO Documentation. – Режим доступа: [https://socket.io/docs/](https://socket.io/docs/)

**Приложение.** Команды для воспроизведения проверки (скриншоты):

```bash
docker ps
curl -s http://localhost/api/health
curl -i -H "Upgrade: websocket" -H "Connection: Upgrade" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" "http://localhost/socket.io/?EIO=4&transport=websocket" | head -2
# Браузер: http://localhost
```
