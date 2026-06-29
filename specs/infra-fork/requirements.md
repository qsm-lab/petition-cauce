# Requisitos — infra-fork
# Infraestructura base: fork, branches, Docker, nginx, CI/CD

Feature ID: `infra-fork`
Fase: 0
Fecha: 2026-06-27
Estado: draft — pendiente aprobación

---

## Contexto

`proy_petition-cauce/` existe con archivos de control (CLAUDE.md, feature_list.json, progress/, specs/) pero sin código de aplicación. Esta feature inicializa el repo Git, copia y adapta el código base de `proy_forms-qsm`, configura el entorno Docker aislado en el VPS compartido, el server block de nginx para `cauce.ecuadornotlc.org`, y el pipeline CI/CD.

Prerequisito externo (a ejecutar manualmente por el usuario antes del primer deploy): pasos de Cloudflare documentados en `WORKFLOW_LOCAL.md §5`.

---

## Bloque A — Repositorio Git

### R1
The system shall have a Git repository initialized at `~/Devs/proy_petition-cauce/` with a single remote named `origin` pointing to `git@github.com:qsm-lab/petition-cauce.git`.

### R2
The repository shall have two long-lived branches:
- `dev` — branch por defecto; todo el desarrollo ocurre aquí.
- `main` — producción; recibe merges manuales desde `dev`; el merge dispara el deploy automático.

### R3
The `.gitignore` shall exclude at minimum: `.env`, `.env.dev`, `AGENTS.md`, `plan/`, `WORKFLOW_LOCAL.md`, `PROJECT_REFERENCE.md`, `SECURITY_OVERVIEW.md`, `__pycache__/`, `*.pyc`, `node_modules/`, `.next/`, `.DS_Store`, `*.log`.

---

## Bloque B — Estructura de directorios y código base

### R4
The repository shall have the following top-level structure, copied and adapted from `proy_forms-qsm`:
```
apps/
  api/        ← FastAPI application
  web/        ← Next.js 14 application
infra/
  nginx/      ← nginx configs
database/     ← SQL schema base
specs/        ← SDD specs (ya existe)
progress/     ← sesión state (ya existe)
plan/         ← docs de planificación (ya existe)
Makefile
.env.example
docker-compose.yml
docker-compose.dev.yml
.github/
  workflows/
    deploy.yml
```

### R5
A `.env.example` file shall document all required environment variables without values. Shall include at minimum:
```
# Database
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=petition_cause
POSTGRES_SCHEMA=petition_cause

# API
SECRET_KEY=
HMAC_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=120
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15

# Redis
REDIS_URL=

# Cloudflare Turnstile
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# App
API_PORT=8011
WEB_PORT=3002
ENVIRONMENT=development
```

---

## Bloque C — Docker Compose

### R6
`docker-compose.yml` (producción) shall define these services with these constraints:

| Servicio | Puerto host | Puerto interno | Red | Independencia |
|----------|-------------|----------------|-----|---------------|
| `petition-api` | 8011 | 8000 | petition_cause_network | Separado de forms-qsm |
| `petition-web` | 3002 | 3000 | petition_cause_network | Separado de forms-qsm |
| `petition-db` | no expuesto al host | 5432 | petition_cause_network | Contenedor **propio** — no comparte instancia PostgreSQL con forms-qsm |
| `petition-redis` | no expuesto al host | 6379 | petition_cause_network | Contenedor **propio** — no comparte instancia Redis con forms-qsm |

Todos los servicios pertenecen exclusivamente a `petition_cause_network`. Ningún servicio usa los puertos 8010, 3001 (reservados a forms-qsm). Un `docker compose down` en este proyecto no afecta a forms-qsm.

**Comandos de verificación de aislamiento:**
```bash
# Ambos proyectos corriendo — verificar puertos sin colisión
docker ps --format "table {{.Names}}\t{{.Ports}}"
ss -tlnp | grep -E '3001|3002|8010|8011'

# Verificar redes Docker aisladas
docker network ls | grep -E 'forms|petition'

# Verificar que un down en petition-cauce no afecta forms-qsm
cd ~/Devs/proy_petition-cauce && docker compose down
cd ~/Devs/proy_forms-qsm && docker ps  # forms-qsm sigue corriendo
```

### R7
When the PostgreSQL container initializes, the system shall create the schema `petition_cause` and the database user `petition_app` (equivalent to `forms_app` in forms-qsm) as non-superuser, to ensure RLS is effective.

### R8
The Docker Compose file shall not use features unavailable in Docker Engine `29.3.1`. (La versión en el VPS está congelada.)

### R9
`docker-compose.dev.yml` shall override the production compose for local development: rebuild desde código fuente (bind mounts), variables de entorno desde `.env.dev`, hot-reload en API y Web.

---

## Bloque D — nginx

### R10
The nginx configuration for `cauce.ecuadornotlc.org` shall:
- Escuchar en el puerto 80 (Cloudflare maneja HTTPS externamente; la conexión CF→VPS puede ser HTTP o HTTPS).
- Hacer proxy de `/api/` hacia `http://127.0.0.1:8011` (FastAPI).
- Hacer proxy de todo lo demás hacia `http://127.0.0.1:3002` (Next.js).

### R11
When nginx receives a request forwarded by Cloudflare, it shall extract the real client IP from the `CF-Connecting-IP` header and set it as `X-Real-IP`, forwarding it to the upstream applications. (Mismo patrón que forms-qsm.)

### R12
The nginx config shall set `proxy_set_header Host $host` so that Next.js and FastAPI reciben el hostname original del request — prerequisito para el ruteo por Host header que implementará `multidominio` en Fase 1.

---

## Bloque E — GitHub Actions CI/CD

### R13
The file `.github/workflows/deploy.yml` shall trigger on `push` to branch `main` and execute the following steps:
1. SSH al VPS usando los secrets `VPS_HOST`, `VPS_USER`, `SSH_PRIVATE_KEY`.
2. En el VPS: `cd /path/to/petition-cauce && git pull origin main && docker compose up -d --build`.
3. SSH `command_timeout: 20m` (assets PNG y builds JS pueden superar el timeout por defecto de 10m).

### R14
The workflow shall NOT use `--no-cache` flag in `docker compose build` — builds sin caché toman 7–9 minutos adicionales por la descarga de capas, innecesariamente.

### R15
GitHub Actions secrets requeridos (configurados por el usuario en el repo, no por Claude):
- `VPS_HOST` — IP o hostname del VPS
- `VPS_USER` — usuario SSH
- `SSH_PRIVATE_KEY` — clave privada SSH sin passphrase
- `DEPLOY_PATH` — ruta absoluta del proyecto en el VPS

---

## Bloque F — Makefile

### R16
The `Makefile` shall provide the following targets (adapted from forms-qsm):

| Target | Comando | Descripción |
|--------|---------|-------------|
| `dev` | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` | Levanta entorno local |
| `dev-build` | ídem + `--build` | Rebuild + levantar |
| `migrate` | `docker exec petition-api-dev alembic upgrade head` | Aplica migraciones |
| `test` | `docker exec petition-api-dev pytest apps/api/tests/ -v` | Corre tests |
| `db` | `docker exec -it petition-db psql -U petition_app -d petition_cause` | Abre psql |
