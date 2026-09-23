COMPOSE = docker compose -f docker/docker-compose.yml
DGREEN := \033[32m
RESET := \033[0m

.PHONY: help up down psql mailhog migrate seed reset sync server client dev

help: ## Показать все команды
	@echo "$(DGREEN)Доступные команды:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Поднять инфраструктуру (БД + Mailhog) + миграции + сиды
	$(COMPOSE) up -d
	cd server && npm run db:migrate && npm run db:seed

down: ## Остановить инфраструктуру
	$(COMPOSE) down

psql: ## Открыть psql в контейнере БД
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-f1user} -d $${POSTGRES_DB:-f1stats}

mailhog: ## Открыть web-интерфейс Mailhog
	@xdg-open http://localhost:8025 >/dev/null 2>&1 || open http://localhost:8025 || echo "Открой в браузере: http://localhost:8025"

migrate: ## Применить миграции
	cd server && npm run db:migrate

seed: ## Засеять данные
	cd server && npm run db:seed

reset: ## Полный сброс БД (DROP schema + миграции + сиды)
	$(COMPOSE) exec -T postgres psql -U $${POSTGRES_USER:-f1user} -d $${POSTGRES_DB:-f1stats} -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
	cd server && npm run db:migrate
	cd server && npm run db:seed

sync: ## Синхронизировать данные с Jolpica-F1 (по умолчанию текущий сезон)
	cd server && npm run sync:f1

server: ## Запустить бэкенд
	cd server && npm run dev

client: ## Запустить фронтенд
	cd client && npm run dev

dev: ## Запустить сервер и клиент (клиент в фореграунде)
	@(cd server && npm run dev > /tmp/f1-server.log 2>&1 &); \
	echo "Server log: /tmp/f1-server.log"; \
	echo "Client: http://localhost:5173  Mailhog: http://localhost:8025"; \
	cd client && npm run dev