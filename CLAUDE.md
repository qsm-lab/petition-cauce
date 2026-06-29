# CLAUDE.md — proy_petition-cauce

Instrucciones para Claude Code. Leer al inicio de cada sesión.

## Inicio de sesión obligatorio

Antes de hacer cualquier cosa, leer en este orden:

1. `progress/current.md` — estado de la sesión anterior
2. `feature_list.json` — backlog y estados
3. `AGENTS.md` — roles y orientación (local, no commiteado)

Reportar al usuario: features en `pending`, `spec_ready`, `in_progress`.

## Contexto del proyecto

Plataforma multi-tenant de campañas de recolección de firmas/apoyos para activismo ambiental en Ecuador. Fork independiente de `proy_forms-qsm`.

**Rol LOPDP: Encargado.** La plataforma opera campañas para terceras organizaciones activistas. Toda campaña requiere `processing_contract_id` referenciando un contrato de encargo de tratamiento LOPDP firmado.

**Referencia técnica base:** `~/Devs/proy_forms-qsm/PROJECT_REFERENCE.md` — stack, patrones de seguridad y decisiones técnicas heredadas.

Monorepo:
- `apps/api/` — FastAPI + PostgreSQL (`petition_cause`) + Redis
- `apps/web/` — Next.js 14 (App Router)
- `infra/nginx/` — configuración nginx
- `database/` — schema SQL e init scripts
- `specs/` — especificaciones SDD por feature
- `progress/` — estado entre sesiones

## Aislamiento de infraestructura (independiente de proy_forms-qsm)

| Recurso | proy_forms-qsm | proy_petition-cauce |
|---------|---------------|---------------------|
| API puerto | 8010 | **8011** |
| Web puerto | 3001 | **3002** |
| PostgreSQL | contenedor `forms-db` | contenedor **`petition-db`** (separado) |
| Redis | contenedor `forms-redis` | contenedor **`petition-redis`** (separado) |
| Red Docker | `forms_network` | **`petition_cause_network`** |
| DB schema | `qsm_forms` | **`petition_cause`** |
| Usuario DB | `forms_app` | **`petition_app`** (no superusuario) |

Ambos proyectos son completamente independientes y operables por separado en el mismo VPS. Un `docker compose down` en uno no afecta al otro.

**Verificar aislamiento:**
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
ss -tlnp | grep -E '3001|3002|8010|8011'
docker network ls | grep -E 'forms|petition'
```

## Restricciones de entorno

- Docker `29.3.1` en VPS — **CONGELADO, no sugerir actualizar**
- PostgreSQL contenedor propio — **no tocar `forms-db` ni `qsm_forms`**
- Puertos: API `8011`, Web `3002` — nunca 8010 ni 3001
- Red Docker: `petition_cause_network` — aislada; nunca `default` ni redes de otros proyectos
- Deploy incremental: `docker compose up -d --build` reutiliza capas cacheadas de Docker; solo reconstruye lo que cambió
- VPS compartido: no instalar servicios globales sin confirmación explícita

## Flujo de frontend — Claude Design + Next.js

El frontend de este proyecto se diseña con **Claude Design (Adobe Express)** antes de implementarse en Next.js.

**Flujo por feature frontend:**
```
1. Diseño en Claude Design → exportar HTML estructurado
2. Claude Code integra el HTML exportado en componentes Next.js (Tailwind)
3. Verificar fidelidad visual y responsividad
4. Ajustar hasta que coincida con el diseño
```

**Reglas:**
- Ninguna pantalla nueva se implementa en Next.js sin diseño aprobado en Claude Design primero.
- El diseño exportado (HTML) se guarda en `specs/<feature>/design-export.html` como referencia.
- CSS: Tailwind únicamente. El HTML exportado de Claude Design se traduce a clases Tailwind, no se embebe CSS inline.
- Fuentes: auto-hosteadas en build time (igual que forms-qsm) — no cargar desde CDN en runtime.

## Reglas de trabajo

- **Nunca commitear.** El usuario revisa y commitea manualmente.
- **Nunca tocar `.env.dev` ni `.env`** en ninguna forma.
- **Nunca modificar `.github/workflows/`** sin pedido explícito.
- **No implementar sin spec aprobada** cuando `sdd: true` en feature_list.json.
- **No marcar features como `done`** — lo decide el usuario.
- **No pushear ni hacer merge** — el usuario controla el flujo git.
- **Ninguna feature frontend se implementa sin diseño Claude Design aprobado.**
- **Ninguna feature con PII se implementa sin `privacy_config` aprobada** en `design.md`.

## Flujo SDD para features nuevas

```
pending → [Claude genera specs/<feature>/] → spec_ready
         ⏸ USUARIO REVISA Y APRUEBA
spec_ready → in_progress → [Claude implementa + tests] → done (usuario valida)
```

Para features frontend, el flujo incluye un paso de diseño antes de `in_progress`:
```
spec_ready → [Diseño Claude Design → HTML exportado → aprobado] → in_progress
```

Archivos de spec por feature:
- `requirements.md` — requisitos EARS (R1..Rn)
- `design.md` — archivos afectados, decisiones, seguridad, LOPDP si aplica
- `tasks.md` — checklist con referencias Rn
- `design-export.html` — (solo features frontend) HTML exportado de Claude Design

## Seguridad — principios heredados de proy_forms-qsm

- RLS en PostgreSQL desde la migración inicial (no agregarlo después)
- Consentimiento versionado: `text_snapshot`, `version`, `legal_basis`, `timestamp`, `ip_hmac`
- HMAC-SHA256 para IP y email en logs/audit (nunca texto plano)
- Rate limiting con slowapi + Redis
- Turnstile Cloudflare Non-interactive (no Managed — falla en cadena)
- CSP headers, security headers Next.js, CORS restrictivo
- `HMAC_SECRET_KEY` obligatoria al arrancar; valor **distinto** al de forms-qsm

## Cierre de sesión

Actualizar `progress/current.md` y agregar entrada en `progress/history.md`.

## Stack y convenciones

- Python: async/await, SQLAlchemy 2.x, Alembic para migraciones
- TypeScript: strict, sin `any` cuando sea posible
- CSS: Tailwind únicamente, sin CSS-in-JS
- Tests API: pytest + httpx
- Entorno local: `make dev` levanta Docker Compose
