COMPOSE = docker compose -f docker/docker-compose.yml
# Полный стек (включая dev-профиль: nodemon + vite)
COMPOSE_ALL = $(COMPOSE) --profile dev
DGREEN := \033[32m
RESET := \033[0m

.PHONY: help up app dev down stop logs logs-dev psql mongo mailhog migrate seed seedmongo reset sync

help: ## Показать все команды
	@echo "$(DGREEN)Доступные команды:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Поднять только инфраструктуру (БД + Mailhog)
	$(COMPOSE) up -d postgres mongo mailhog

app: ## Прод-стек как в лабе 8: backend + frontend (nginx) + БД
	$(COMPOSE) up -d --build

dev: ## Dev-стек с hot-reload: nodemon (:3000 внутри) + vite на http://localhost:5173
	$(COMPOSE_ALL) up -d --build backend-dev frontend-dev

down: ## Остановить и удалить все контейнеры проекта (вкл. dev-профиль)
	$(COMPOSE_ALL) down

stop: ## Остановить контейнеры приложения (инфраструктура остаётся)
	$(COMPOSE_ALL) stop backend frontend backend-dev frontend-dev

logs: ## Логи прод-контейнеров
	$(COMPOSE) logs -f backend frontend

logs-dev: ## Логи dev-контейнеров (nodemon/vite)
	$(COMPOSE_ALL) logs -f backend-dev frontend-dev

psql: ## Открыть psql в контейнере БД
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-f1user} -d $${POSTGRES_DB:-f1stats}

mongo: ## Открыть mongosh в контейнере MongoDB
	$(COMPOSE) exec mongo mongosh $${MONGO_URI:-mongodb://localhost:27017/f1stats}

mailhog: ## Открыть web-интерфейс Mailhog
	@xdg-open http://localhost:8025 >/dev/null 2>&1 || open http://localhost:8025 || echo "Открой в браузере: http://localhost:8025"

migrate: ## Применить миграции (в контейнере, без запуска backend)
	$(COMPOSE) run --rm --entrypoint npx backend sequelize-cli db:migrate

seed: ## Засеять данные (в контейнере, без запуска backend)
	$(COMPOSE) run --rm --entrypoint npx backend sequelize-cli db:seed:all

seedmongo: ## Засеять демо-данные в MongoDB (народный прогноз)
	$(COMPOSE) run --rm --entrypoint npm backend run seed:mongo

reset: ## Полный сброс БД (DROP schema + миграции + сиды)
	$(COMPOSE) exec -T postgres psql -U $${POSTGRES_USER:-f1user} -d $${POSTGRES_DB:-f1stats} -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
	$(COMPOSE) run --rm --entrypoint npx backend sequelize-cli db:migrate
	$(COMPOSE) run --rm --entrypoint npx backend sequelize-cli db:seed:all

sync: ## Синхронизировать данные с Jolpica-F1 (по умолчанию текущий сезон)
	$(COMPOSE) run --rm --entrypoint npm backend run sync:f1
