# Historial de sesiones — proy_petition-cauce

---

## 2026-07-05 — Sesión 19: rediseño completo design system v2 — landing + SignFlow + admin

**Design system v2:** fuentes Anton (display) + Work Sans (body) cargadas vía `next/font/google`. Tokens CSS actualizados: Lime `#D7F24C` como CTA/primary, Ink `#16261F`, Sage `#EDF4F1` como fondo, Green Light `#DCE9E6`. `category-color.ts` nueva utilidad. Tailwind: `font-display` → Anton, `font-body` → Work Sans.

**Landing pública (9 componentes reescritos):** `CampaignPage` con grid sidebar-primero DOM + order invertido desktop. `ActionBlock` chip full-width Ink, CTA Lime, dot pulsante cauce-live-dot. `PetitionBody` sección "Por qué importa" fondo Ink oscuro con heading Lime. `LifecycleSteps` horizontal con dot activo coloreado. `ShareSection` WA Ink Blue. Fondo sage `#EDF4F1`.

**SignFlow (6 archivos reescritos):** bottom-sheet mobile / modal desktop con blur. Pills activos Ink bg + sage text. `StepThanks` nuevo con contador crema + opt-in newsletter independiente.

**Admin (15 archivos):** sidebar item activo Lime+Ink. `ui/Button` primary Lime+Ink. `ui/Badge` active/collecting Lime+Ink. 40+ instancias `#18794A` reemplazadas por Green Light chips + Ink text. `text-white` sobre Lime corregido en 13 páginas. TypeScript: 0 errores. 4 commits borradores preparados.

---

## 2026-07-04 — Sesión 18: org detail, categorías inline, políticas inline + 9 rectificaciones front/back

**Batch 1 (ítems 8-10):** `/admin/organizaciones/[id]` (edit org + campañas vinculadas), `CategoriasList` inline edit + campañas lazy, `PoliticasList` inline edit + campañas lazy + modal contrato LOPDP.

**Batch 2 (9 rectificaciones):** CSP `img-src https:`, PetitionBody iconos MDI SVG + jerarquía asks numerados, StepThanks icono MDI + iconos en botones sociales, ShareSection prop `shareText`, CampanaEditorClient campo `share_text` + secciones movidas al panel derecho + validación preemptiva + banner error prominente, PoliticasList botón × SVG en modal, firmas/page.tsx reescrito como tabla de campañas con conteos, OrgDetailClient campo logo_url + miniatura, backend `share_text` en `CampaignUpdate`+`_META_FIELDS`+`_serialize`. TypeScript: 0 errores. Docker rebuild exitoso. 5 commits en branch `dev` (766309c…6f29113).

---

## 2026-07-03 — Sesión 17: cierre administrativo — borradores de commits + resumen ítems 8-10

**Completado:**
- Preparados 11 borradores de commits para sesiones 13-16 (sin código nuevo)
- Corregido error zsh glob en rutas con `[id]`: usar comillas simples
- Breve resumen de ítems 8-10 pendientes (perfiles-org): org detail page, edición inline categorías, edición inline políticas + template LOPDP

**Pendiente:**
- El usuario ejecuta los commits manualmente en terminal
- Review manual de los 5 puntos de sesión 16 (PetitionBody, ShareSection, StepThanks, editor layout, validación activación)
- Implementar ítems 8, 9, 10 de perfiles-org

---

## 2026-07-03 — Sesión 16: editor rework + ShareSection + StepThanks + PetitionBody

**Completado:**
- `PetitionBody.tsx`: headers "Lo que pedimos" / "Por qué importa" con icono + badge color; asks en bold/15px
- `ShareSection.tsx`: reescritura completa — iconos SVG, sin Telegram, +Email, QR bajo URL, archivos descargables, disabled cuando `closed`
- `StepThanks.tsx`: sin Telegram, agrega X + Facebook + Email, layout mejorado
- `CampanaEditorClient.tsx`: layout 2 columnas rework — portada (desktop+mobile URL), asks editor (max 5), archivos descargables, QR generator client-side, categoría/fecha/política movidas al panel derecho, selector de org
- Validación antes de activar: warning amarillo en panel + indicadores rojos por campo faltante; `api.ts` corregido para serializar `detail` objeto a JSON
- Correcciones: `AdminCampaign.asks`, `CategoriasList/OrganizacionesClient/PoliticasList` usan `api.post/patch`, `qr_code_data` en `CampaignUpdate`
- TypeScript: 0 errores; contenedor web compilando sin errores

**Pendiente:**
- Review manual de 5 puntos (PetitionBody visual, ShareSection, StepThanks, editor layout, validación activación)
- Ítems 8, 9, 10: org detail page, edición inline categorías, edición inline políticas + template contrato LOPDP

---

## 2026-07-02 — Sesión 12: dashboard-firmas implementado + ui-design-system verificado

**Completado:**
- `dashboard-firmas` — API + frontend completo (T1-T28):
  - `GET /v1/admin/campaigns/{id}/signatures` — lista paginada con filtros provincia/visibility/status
  - `GET /v1/admin/campaigns/{id}/signatures/export.csv` — export con filtros activos
  - Stats (confirmed/pending/anulada) siempre sobre totales de campaña, independientes de filtros
  - Frontend: FiltrosBar (form GET auto-submit), ExportCsvButton (window.open), tabla semántica, paginación URL-based
  - Verificado con Playwright: T19-T28 (tabla, badges, opacidad anuladas, filtros, export, breadcrumb, paginación)
- `ui-design-system` verificaciones V1/V3/V4:
  - V1: fidelidad visual — sidebar `#15241B`, tokens activos, layout fiel al handoff AdminPanel.dc.html
  - V3: 0 requests CDN; 86 @font-face via next/font (Poppins, Inter, Montserrat, Nunito, Fredoka)
  - V4: inyección tokens campaña — preset Océano propagado a toda la UI sin rebuild
- UUID de campaña dev corregido: `90160ea0-8f05-4605-9fb5-e1af8cc5bf52`
- Migración 010 (`country` en signatures) aplicada en Mac local

**Diagnóstico:** Los cambios del otro Mac no se reflejaban porque la migración 010 estaba en código pero no aplicada en la DB de este Mac. Solución: `docker exec petition-api-dev alembic upgrade head`.

**Pendiente:** `dashboard-firmas` pendiente validación final del usuario + `infra-fork` VPS + `resumen-admin` KPIs reales

---

## 2026-07-01 — Sesión 11: iteraciones formulario-firma + integración Resend

**Completado:**
- `form_config` en `campaigns.meta`: controla `signer_types`, `location_modes`, `required_fields`, `visibility_options` por campaña
- Migración 010: columna `country` en `signatures`
- Toggle persona natural/organización + campo `org_name`
- Toggle "¿Firmas desde?" Ecuador/Internacional: cédula con módulo-10 solo para nacional; internacional acepta cualquier identificación (opcional)
- Cédula movida al final del formulario (después de provincia/país)
- Visibilidad "Secreta" oculta por defecto; habilitada explícitamente en `form_config` de la campaña dev
- `email_service.py`: Resend (si `RESEND_API_KEY` configurado) o log en consola (dev)
- `POST /{campaign_id}/signatures/resend-confirmation` rate-limit 3/min, 204 siempre
- `StepSuccess` con estados idle/sending/sent en botón reenvío
- Step 4 obtiene contador real via `getCampaignCount()` antes de mostrar
- Specs `dashboard-firmas` generados: requirements.md + design.md + tasks.md (T1-T28)
- Flujo completo verificado: submit ✓ | email log ✓ | resend 204 ✓ | confirm ✓ | Step 4 con contador real ✓

**Pendiente:** `dashboard-firmas` implementación + `infra-fork` VPS + activar `RESEND_API_KEY` en producción

---

## 2026-07-01 — Sesión 10: contingencia git + verificación MVP en Mac casa

**Completado:**
- Diagnóstico y resolución de historias git divergidas entre Mac casa y Mac oficina
- Alias SSH corregido en remote URL (`githubqsmlab` → `github-qsmlab`)
- `git reset --hard origin/dev` — Mac casa sincronizada con Fase 1 completa del remoto
- Contenedor API reconstruido (`jinja2` faltaba en imagen anterior)
- Migraciones 006–009 aplicadas en DB local de Mac casa
- Seed ejecutado: org, admin, contrato, campaña, privacy_config, lifecycle_events
- MVP Fase 1 verificado en browser: landing ✓ | Sign Flow ✓ | admin ✓

**Aprendizaje registrado:** Siempre `git pull --rebase origin dev` al iniciar sesión. Nunca usar disco externo para transferir código — usar `git bundle` sin internet. En Mac nueva: `make migrate` + `make seed` + reconstruir contenedor si cambiaron dependencias.

**Pendiente:** `dashboard-firmas` (siguiente feature) + `infra-fork` VPS

---

## 2026-06-30 — Sesión 9: Fase 1 MVP funcionando end-to-end

**Completado:**
- Specs generados y aprobados: `multidominio`, `anti-fraude-basico`, `landing-campana`, `formulario-firma`
- API Fase 1: `domains.py` (resolve-domain), `public_campaign.py` (by-slug, GET/POST signatures, confirm), schemas, domain_service, signature_service
- Next.js Fase 1: `page.tsx` Server Component con resolución slug/dominio, `aviso-de-privacidad/page.tsx`, middleware actualizado, CampaignPage (layout 1col/2col), 8 subcomponentes, SignFlow (5 estados, bottom sheet/modal)
- 5 bugs corregidos: campaign status draft→active en seed; alias red `petition-api` en docker-compose; turnstile bypass usa prefijo; migración 008 RLS `sig_org_admin` con NULLIF; migración 009 UPDATE policy para confirm flow; `confirmada`→`confirmed` en signature_service
- Flujo completo verificado: GET landing ✓ | POST signature 201 ✓ | GET confirm 200 `{count:1,goal:10000}` ✓ | dedup 409 ✓ | cédula inválida 422 ✓

**Pendiente:** commit de Fase 1 (~30 archivos) + commits modelo-base + lopdp-base; dashboard-firmas; infra-fork VPS

---

## 2026-06-30 — Sesión 8: lopdp-base implementado completo

**Completado:**
- Feature `lopdp-base` completa (T1–T18): migración 007 aplicada, templates Jinja2, render functions, runbook brechas
- `privacy_config.version` (SmallInteger) añadido vía migración 007
- 3 templates Jinja2: aviso de privacidad (9 secciones), contrato encargo (12 cláusulas), RAT (10 secciones + versiones activas)
- Render functions: `render_aviso_privacidad()` + `build_aviso_context()`, `render_contrato_encargo()` + `build_contrato_context()` + `get_contrato_dev()`, `render_rat()` + `build_rat_context()`
- Runbook brechas `docs/legal/runbook_brechas.md`: cronograma T+0→T+72h, árbol decisión, contenido SPDP, registro interno
- `seed_dev.py` usa `get_contrato_dev()` y `render_aviso_privacidad(build_aviso_context(...))` — texto real completo en BD
- `.env.example` + `config.py`: vars `ENCARGADO_*` y `RESEND_API_KEY`
- Todos los templates son condicionales natural/juridica para Responsable y Encargado (Cauce Petition opera como persona natural hasta SAS)
- `make migrate` → 007 aplicada ✓ | `make seed` → exitoso ✓

**Pendiente:** commit de ~15 archivos (modelo-base) + ~14 archivos (lopdp-base) + progress

---

## 2026-06-30 — Sesión 7: modelo-base implementado + configuración Mac 2

**Completado:**
- Configuración Mac 2: SSH alias `githubqsmlab`, clave `github_mac_ae` (ed25519, sin passphrase), Docker + Node instalados
- Push de archivos pendientes desde Mac 2, clone limpio en `~/Dev/proy_petition-cauce/`
- Feature `modelo-base` completa (T1–T18): migración 006 aplicada y verificada en dev

**Detalle migración 006:**
- 6 tablas nuevas: `processing_contracts`, `signatures`, `consents`, `privacy_config`, `lifecycle_events`, `domains`
- 3 tablas extendidas: `users` (status, archived_*), `organizations` (domain, rep_name, status, archived_*), `campaigns` (processing_contract_id, signer_type, campos petición, lifecycle_stage, archived_*)
- Trigger inmutabilidad contratos firmados (`signed_at IS NOT NULL`)
- RLS en `signatures` y `consents` (política admin por org_id + política pública)
- 4 índices únicos parciales en `signatures` para deduplicación por tipo de firmante
- `crypto.py`: `hmac_sha256(value, key)` + `verify_cedula()` módulo-10 Ecuador
- `seed_dev.py`: CONTRATO-DEV-001 (firmado) + campana-dev-001 (signer_type=both, lifecycle_stage=1) + privacy_config + 2 lifecycle_events

**Bugs resueltos:**
- Índice `idx_consents_campaign` duplicado con migración 001 → renombrado
- `AmbiguousForeignKeysError` en `Organization.users` por múltiples FK → `foreign_keys="User.org_id"`
- Seed bloqueado por RLS en campaigns → `SET LOCAL app.current_org_id` antes del INSERT

**Pendiente:** commit de 13 archivos + progress (el usuario lo ejecuta manualmente)

---

## 2026-06-29 — Sesión 6: Admin shell + spec modelo-base aprobado

**Completado:**
- Incorporado handoff `design_handoff_cauce_back-admin/README.md` al proyecto
- Nuevo `AdminSidebarClient.tsx`: sidebar 220px, bg `--bink`, 6 nav items, RBAC por rol, iconos SVG, logout
- Nuevo `layout.tsx` del admin: server component, fetch user, filtra nav según `role: admin|gestor`
- 6 nuevas rutas: `/admin/resumen`, `/admin/campanas`, `/admin/firmas`, `/admin/organizaciones`, `/admin/usuarios`, `/admin/configuracion`
- Redirigidos `/admin/dashboard` y login post-auth a `/admin/resumen`
- RBAC: gestores ven solo Campañas y Firmas; admin ve todo; páginas admin-only redirigen a /campanas si gestor accede
- Todos los stubs con design shells completos (badges, tablas, filtros, toggles) según spec del README
- `User.role` extendido con `"gestor"`
- TypeScript: 0 errores

**También completado:**
- Spec `modelo-base` generado, revisado con 5 decisiones clave y aprobado (spec_ready)
- 4 commits realizados: harness, infra, ui-design-system, admin shell

**Pendiente próxima sesión:**
- Implementar `006_modelo_base.py` + modelos SQLAlchemy (T1–T18 en specs/modelo-base/tasks.md)

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

---

## 2026-06-29 — Sesión 5: ui-design-system (implementación) + acceso admin operativo

**Completado:**

**Sistema de diseño base (ui-design-system):**
- Tokens CSS (custom properties `--bp`, `--bop`, `--bsec`, `--bink`, `--bmut`, `--bsurf`, `--bbg`, `--bbord`, `--br`) con tema Bosque por defecto
- `@layer utilities` en `globals.css` — 15 clases semánticas que responden a sobreescrituras de tokens por campaña
- Fuentes: Poppins (display) + Inter (body) via `next/font/google` (build-time, sin CDN en runtime)
- Componentes: `Button`, `Card`, `Badge`, `FormField`, `Alert`, `cn()`, `design-tokens.ts` (3 presets + `campaignStyleTag()`)
- Login page completamente rediseñada con identidad "Cauce Petition" y toggle show/hide password

**Bugs críticos resueltos (acceso admin):**

| Bug | Causa raíz | Fix aplicado |
|-----|-----------|-------------|
| Migraciones no aplicadas | Alembic nunca ejecutado en este entorno | `alembic upgrade head` (5 migraciones) |
| Email de seed rechazado | `.local` TLD reservado, pydantic 422 | `admin@cauce.local` → `admin@cauce.ec` |
| JavaScript bloqueado | CSP sin `'unsafe-eval'`; Next.js dev lo requiere | Agregado a `script-src` en `next.config.mjs` |
| Cookie rechazado por browser | `secure=True` con HTTP en dev | `secure=settings.environment == "production"` en `auth.py` |

**Admin accesible y verificado al cierre de sesión.**

**Lección técnica registrada:**
- Tailwind v3 no genera utilidades para colores definidos como `var(--css-var)` — usar `@layer utilities` en CSS
- `next.config.mjs` se copia en la imagen Docker en build; requiere `--build` para actualizar (no es volumen)

**Pendiente (no bloquea):**
- V1/V3/V4 verificación visual del design system
- Commit de todos los archivos pendientes (revisar lista en `progress/current.md`)
- Infra VPS: D3/F8/Cloudflare/GitHub Secrets — antes del primer deploy

**Próxima sesión:** Verificaciones V1/V3/V4 + commit, luego `modelo-base` o `landing-campana`.
