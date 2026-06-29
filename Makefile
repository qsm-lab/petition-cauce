# proy_petition-cauce — Makefile de desarrollo
# Usar: make <comando>

.PHONY: dev dev-build dev-down dev-logs api-logs web-logs \
        migrate migration seed test lint db status \
        check-isolation

dev:
	docker compose -f docker-compose.dev.yml up

dev-build:
	docker compose -f docker-compose.dev.yml up --build

dev-down:
	docker compose -f docker-compose.dev.yml down

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

api-logs:
	docker compose -f docker-compose.dev.yml logs -f petition-api-dev

web-logs:
	docker compose -f docker-compose.dev.yml logs -f petition-web-dev

migrate:
	docker exec petition-api-dev alembic upgrade head

migration:
	docker exec petition-api-dev alembic revision --autogenerate -m "$(name)"

seed:
	docker exec petition-api-dev python -m app.scripts.seed_dev

test:
	docker exec petition-api-dev pytest tests/ -v

lint:
	docker exec petition-api-dev ruff check app/

db:
	docker exec -it petition-db-dev psql -U petition_admin -d petition_cause

db-app:
	# Abre psql como petition_app (no-superusuario) — para verificar RLS
	docker exec -it petition-db-dev psql -U petition_app -d petition_cause

status:
	docker compose -f docker-compose.dev.yml ps

check-isolation:
	@echo "=== Contenedores petition-cauce ==="
	@docker ps --format "table {{.Names}}\t{{.Ports}}" | grep petition || echo "(ninguno corriendo)"
	@echo ""
	@echo "=== Contenedores forms-qsm ==="
	@docker ps --format "table {{.Names}}\t{{.Ports}}" | grep forms || echo "(ninguno corriendo)"
	@echo ""
	@echo "=== Puertos en uso (3001/3002/8010/8011) ==="
	@ss -tlnp 2>/dev/null | grep -E '3001|3002|8010|8011' || echo "(ninguno)"
	@echo ""
	@echo "=== Redes Docker ==="
	@docker network ls | grep -E 'forms|petition'
