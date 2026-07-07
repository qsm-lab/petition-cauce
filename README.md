# Cauce — Plataforma de campañas de firmas para activismo ambiental

Plataforma multi-tenant de recolección de firmas y apoyos ciudadanos para
campañas de defensa ambiental en Ecuador. Operada como **Encargado del
tratamiento** bajo la LOPDP: cada campaña pertenece a una organización
activista (Responsable) con contrato de encargo de tratamiento firmado.

**Producción:** [cauce.ecuadornotlc.org](https://cauce.ecuadornotlc.org)

## Propósito

Herramienta de organización ciudadana: campañas de firmas con ciclo de vida
público (lanzada → recolección → entrega → diálogo → decisión), consentimiento
LOPDP versionado, privacidad del firmante como principio de diseño (visibilidad
elegida por cada persona, PII protegida con HMAC y cifrado) y kit de difusión
para territorio y redes.

## Stack

| Capa | Tecnología |
|------|-----------|
| API | FastAPI (Python 3.11, async), SQLAlchemy 2.x, Alembic |
| Base de datos | PostgreSQL con Row-Level Security desde la migración inicial |
| Caché / rate limiting | Redis + slowapi |
| Frontend | Next.js 14 (App Router), TypeScript strict, Tailwind CSS |
| Anti-bot | Cloudflare Turnstile (Non-interactive) |
| Infra | Docker Compose, nginx, Cloudflare (DNS/SSL/WAF), GitHub Actions |

## Estructura del monorepo

```
apps/api/      FastAPI + migraciones Alembic
apps/web/      Next.js 14
infra/nginx/   Configuración nginx del VPS
database/      Schema SQL e init scripts
specs/         Especificaciones SDD por feature
progress/      Estado entre sesiones de desarrollo
```

## Desarrollo local

Requisitos: Docker y Docker Compose.

```bash
# 1. Variables de entorno
cp .env.example .env.dev
# Completar valores (ver comentarios del archivo).
# En local usar las claves de TEST de Turnstile documentadas ahí.

# 2. Levantar el stack (API 8011, Web 3002, Postgres 5435, Redis 6381)
make dev

# 3. Migraciones y datos semilla
make migrate
make seed

# 4. Tests
make test
```

- Web: http://localhost:3002
- API: http://localhost:8011/health

Los puertos están deliberadamente desplazados (8011/3002) para convivir con
otros proyectos en el mismo host. Ver `Makefile` para el resto de targets
(`dev-down`, `migration`, `lint`, `db`, `check-isolation`).

## Variables de entorno

Todas documentadas en [`.env.example`](.env.example). Reglas:

- `.env` y `.env.dev` **nunca** se commitean.
- `JWT_SECRET_KEY` y `HMAC_SECRET_KEY` se generan con `openssl rand -hex 32`,
  distintas entre dev y producción.
- La PII (email, cédula, IP) nunca se persiste ni loguea en claro: HMAC-SHA256
  para búsquedas/dedup y columnas cifrables para el dato.

## Seguridad y privacidad

- RLS en PostgreSQL por organización desde el inicio.
- Consentimiento versionado por firma: snapshot del texto, versión, base
  legal, timestamp e IP con HMAC.
- Doble opt-in por email antes de confirmar cada firma.
- Visibilidad de firma elegida por el firmante (pública / anónima / secreta).
- Rate limiting, CSP, security headers y CORS restrictivo.

## Flujo de desarrollo

El proyecto se desarrolla con especificaciones SDD por feature (`specs/`) y
sesiones documentadas en `progress/`. Las instrucciones operativas para
sesiones asistidas por IA están en [`CLAUDE.md`](CLAUDE.md).

## Licencia

[AGPL-3.0](LICENSE) — si operas una versión modificada de esta plataforma como
servicio, debes publicar el código fuente de tus modificaciones.
