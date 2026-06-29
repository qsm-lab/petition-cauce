# Historial de sesiones — proy_petition-cauce

---

## 2026-06-27 — Sesión de apertura: planificación y andamiaje Harness SDD

**Completado:**
- Plan de desarrollo leído y validado (PLAN_VALIDACION_campanas_firmas.md y PROJECT_REFERENCE.md)
- Plan aprobado: fork independiente de forms-qsm, rol LOPDP Encargado, MVP urgente (campaña real)
- Andamiaje Harness SDD completo: CLAUDE.md, AGENTS.md, WORKFLOW_LOCAL.md, PROJECT_REFERENCE.md, SECURITY_OVERVIEW.md, .gitignore, feature_list.json (24 features, Fases 0–5), progress/

**Rectificaciones aplicadas:**
- Nombre correcto del directorio local: `proy_petition-cauce/` (con c)
- `multidominio` movido de Fase 2 a Fase 1 — arquitectura correcta desde el primer deploy
- Pasos de pre-configuración Cloudflare documentados en WORKFLOW_LOCAL.md §5
- `harness-setup` marcado como `done` en feature_list.json

**Decisiones de infra confirmadas:**
- Repo: `https://github.com/qsm-lab/petition-cauce.git`
- Dominio MVP: `cauce.ecuadornotlc.org` (Cloudflare Free, 1 regla WAF)
- Multi-dominio: en Fase 1, no en Fase 2

**Próxima sesión:** Fase 0 — `infra-fork`, `modelo-base`, `lopdp-base`.

---

## 2026-06-28 — Sesión 2: confirmaciones de arquitectura + spec infra-fork

**Confirmaciones validadas:**
- DB y Redis: contenedores propios por proyecto (no compartidos con forms-qsm)
- Deploy incremental: Docker layer cache; solo reconstruye lo modificado
- Frontend: flujo Claude Design (Adobe Express) → HTML exportado → Next.js/Tailwind
- `ui-design-system` agregado como feature Fase 0
- Ambos proyectos completamente independientes y operables por separado

**Spec generada:** `specs/infra-fork/` (requirements.md R1–R16, design.md, tasks.md) — pendiente aprobación.

**Pendiente:** aprobación de spec `infra-fork` → implementación.

---

## 2026-06-28 — Sesión 3: implementación infra-fork (bloques B–E) + reglas de secretos

**Completado — archivos generados (infra-fork bloques B–E):**

| Archivo | Contenido |
|---------|-----------|
| `docker-compose.yml` | 4 servicios propios: petition-api/web/db/redis, puertos 8011/3002 |
| `docker-compose.dev.yml` | dev con bind mounts, puertos 5435/6381 (sin colisión con forms-qsm) |
| `database/init.sql` | `petition_app` como NO superusuario → RLS activo en dev desde día 1 |
| `.env.example` | Separación explícita admin vs app; reglas de seguridad de secretos |
| `Makefile` | 14 targets: dev, migrate, test, db, db-app, check-isolation, etc. |
| `infra/nginx/cauce.ecuadornotlc.org.conf` | TLS, CF real IP, proxy 8011/3002, `Host $host` en ambos locations |
| `.github/workflows/deploy.yml` | 20m timeout, sin --no-cache, VPS_SSH_KEY + DEPLOY_PATH |
| `apps/api/app/config.py` | Adaptado: petition-api, 3002, default_org_slug=cauce, URLs separadas admin/app |
| `apps/api/alembic.ini` | Documenta uso de DATABASE_URL_SYNC para migraciones |
| `apps/web/next.config.mjs` | CSP 8011 en dev, allowedOrigins cauce.ecuadornotlc.org |
| `WORKFLOW_LOCAL.md §4` | Secrets GitHub (4 vars), certbot, comando nginx vhost |

**Diferencia de seguridad clave vs forms-qsm:**
- `petition_app` es NO superusuario → RLS testeable en dev (forms-qsm no lo tenía)
- `DATABASE_URL` (app) separado de `DATABASE_URL_SYNC` (admin para Alembic)

**Reglas de secretos añadidas a memoria:**
- Secretos del `.env` siempre se agregan manualmente; Claude nunca escribe valores reales
- Secretos de producción deben ser diferentes a los de desarrollo y generarse manualmente
- En local/dev: Turnstile usa claves de test oficiales de Cloudflare (`1x00000000000000000000AA`)

**Pendiente (requiere acción manual del usuario):**
- A1–A4: `git init`, branches dev/main, remote origin
- COPY: `cp -r ~/Devs/proy_forms-qsm/apps .`
- Crear `.env.dev` desde `.env.example` con valores reales de dev (Turnstile test keys)
- C4/C5: adaptar `config.ts` y seeds después del COPY
- F1–F8: verificación completa con `make dev`

**Próxima sesión:** Verificación F1–F8 post-git/COPY + inicio `ui-design-system` (Fase 0).

---

## 2026-06-28 — Sesión 4: verificación F1–F7 + bloques C4/C5 infra-fork

**Completado:**

- Git inicializado (`git init`, rama `dev`, remote `git@github-qsmlab:qsm-lab/petition-cauce.git` — alias SSH correcto para cuenta org)
- COPY apps/ completado desde forms-qsm (sin sobreescribir los 3 archivos ya adaptados)
- `.env.dev` creado con secretos de dev y Turnstile test keys
- `make dev` levanta los 4 contenedores correctamente
- Verificación F1–F7 completada: todos los checks pasan
  - F4: `{"status":"ok","db":"ok","redis":"ok","version":"1.0.0"}`
  - F6: `petition_app` no superusuario, `rolbypassrls=f`
  - F7: corregida redacción de la spec (schema=public, no schema petition_cause — la BD se llama petition_cause)
- C4: `api.ts`, `api-server.ts`, `ExportButtons.tsx` — fallbacks 8010→8011, container forms-api-dev→petition-api-dev
- C5: todos los scripts seed Python y migración 004_rls — sin referencias a forms-qsm

**Pendiente de infra-fork (no bloquea desarrollo):**
- D3 + F8 + Cloudflare + GitHub Secrets — se hacen antes del primer deploy a VPS

**Próxima sesión:** Feature `ui-design-system` (spec SDD → diseño Claude Design → Next.js/Tailwind).
