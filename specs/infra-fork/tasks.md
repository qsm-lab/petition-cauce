# Tareas — infra-fork

Feature ID: `infra-fork`
Fecha: 2026-06-27

---

## Prerequisitos (usuario, ANTES de que Claude implemente)

- [x] **CF-1** Pasos Cloudflare completados (WORKFLOW_LOCAL.md §5): DNS A record, SSL Full strict, WAF rule, Turnstile widget creado
- [x] **CF-2** Claves Turnstile (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) anotadas para agregar a `.env`
- [x] **COPY** Copiar directorios base de forms-qsm al nuevo repo:
  ```bash
  cd ~/Devs/proy_petition-cauce
  cp -r ~/Devs/proy_forms-qsm/apps .
  cp -r ~/Devs/proy_forms-qsm/infra .
  cp -r ~/Devs/proy_forms-qsm/database .
  ```

---

## Bloque A — Git (usuario ejecuta)

- [x] **A1** `git init` en `~/Devs/proy_petition-cauce/` (R1)
- [x] **A2** `git checkout -b dev` — crear branch dev como default (R2)
- [x] **A3** `git remote add origin git@github.com:qsm-lab/petition-cauce.git` (R1)
- [x] **A4** Verificar: `git remote -v` muestra `origin → git@github.com:qsm-lab/petition-cauce.git`

---

## Bloque B — Archivos de configuración (Claude genera)

- [x] **B1** `docker-compose.yml` — puertos 8011/3002, red `petition_cause_network`, 4 servicios propios (R6, R7, R8)
- [x] **B2** `docker-compose.dev.yml` — bind mounts, puertos dev 8011/3002/5435/6381 (R9)
- [x] **B3** `.env.example` — todas las variables con comentarios, sin valores (R5)
- [x] **B4** `Makefile` — targets dev, dev-build, dev-down, migrate, migration, seed, test, lint, db, db-app, status, check-isolation (R16)
- [x] **B5** `database/init.sql` — crea `petition_app` como NO superusuario; permisos sobre public schema (R7)

---

## Bloque C — Adaptaciones de código (Claude genera)

- [x] **C1** `apps/api/app/config.py` — `api_internal_url` → petition-api, `cors_origins` → 3002, `default_org_slug` → cauce, `DATABASE_URL_SYNC` separado para Alembic (R4, R5)
- [x] **C2** `apps/api/alembic.ini` — comentario documenta que URL real viene de DATABASE_URL_SYNC en settings
- [x] **C3** `apps/web/next.config.mjs` — CSP connect-src 8011 dev, allowedOrigins incluye cauce.ecuadornotlc.org
- [x] **C4** Adaptar `apps/web/src/lib/api.ts`, `api-server.ts`, `ExportButtons.tsx` — fallbacks de puerto 8010→8011 y container `forms-api-dev`→`petition-api-dev`
- [x] **C5** Renombrar referencias `forms_app`/`forms-api`/qsm en scripts seed Python y migración 004_rls — `petition_app`/`petition-api`/cauce

---

## Bloque D — nginx (Claude genera)

- [x] **D1** `infra/nginx/cauce.ecuadornotlc.org.conf` — proxy 8011/3002, `Host $host` en ambos location blocks, CF real IP, TLS Let's Encrypt (R10, R11, R12)
- [x] **D2** Documentado en `WORKFLOW_LOCAL.md` §4: habilitar vhost, certbot, comando nginx reload
- [ ] **D3** Verificar extracción de IP real de Cloudflare en `nginx.conf` del VPS (bloque `http`): `real_ip_header CF-Connecting-IP` + rangos CF (R11) — el usuario lo verifica en el VPS

---

## Bloque E — GitHub Actions (Claude genera)

- [x] **E1** `.github/workflows/deploy.yml` — push→main trigger, `VPS_SSH_KEY`, `DEPLOY_PATH`, `command_timeout: 20m`, sin `--no-cache` (R13, R14, R15)
- [x] **E2** Documentado en `WORKFLOW_LOCAL.md` §4: tabla de 4 secrets (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DEPLOY_PATH`) con instrucciones

---

## Bloque F — Verificación (usuario + Claude)

- [x] **F1** `make dev` levanta los 4 contenedores sin errores (R6, R9)
- [x] **F2** `docker ps` muestra nombres `petition-api-dev`, `petition-web-dev`, `petition-db-dev`, `petition-redis-dev`
- [x] **F3** Verificar sin colisión de puertos: `ss -tlnp | grep -E '3001|3002|8010|8011'` — solo 3002 y 8011 deben pertenecer a petition-cauce
- [x] **F4** `curl http://localhost:8011/health` responde 200 (FastAPI up)
- [x] **F5** `curl http://localhost:3002` responde con la app Next.js (aunque sea la de forms-qsm todavía)
- [x] **F6** Verificar que `petition_app` no es superusuario:
  ```sql
  SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'petition_app';
  -- rolsuper debe ser false
  ```
- [x] **F7** Verificar que el schema `petition_cause` existe:
  ```sql
  SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'petition_cause';
  ```
- [x] **F8** (En VPS) Primer push a `main` → verificar que Actions dispara y completa sin timeout

---

## Notas

- **No incluir `.env` ni `.env.dev` en el primer commit.** Solo `.env.example`.
- El usuario agrega los valores reales a `.env` y `.env.dev` manualmente antes de `make dev`.
- `HMAC_SECRET_KEY` debe ser un valor **nuevo**, generado con `openssl rand -hex 32` — no reutilizar el de forms-qsm.
- Las migraciones Alembic no corren en infra-fork; se crean en `modelo-base` (siguiente feature).
