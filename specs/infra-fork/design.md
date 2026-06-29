# Diseño — infra-fork

Feature ID: `infra-fork`
Fecha: 2026-06-27

---

## 1. Estrategia de fork

Este no es un fork de GitHub (que mantendría relación con el upstream). Es una **copia independiente** del código de `proy_forms-qsm` con un repositorio Git nuevo.

**Procedimiento recomendado (lo hace el usuario):**

```bash
# Desde ~/Devs/proy_petition-cauce/ (ya existe con archivos de control)
# Copiar código base de forms-qsm
cp -r ~/Devs/proy_forms-qsm/apps .
cp -r ~/Devs/proy_forms-qsm/infra .
cp -r ~/Devs/proy_forms-qsm/database .
cp    ~/Devs/proy_forms-qsm/Makefile .
cp    ~/Devs/proy_forms-qsm/docker-compose-forms.yml docker-compose.yml  # renombrar
cp    ~/Devs/proy_forms-qsm/docker-compose.dev.yml .

# Inicializar repo Git
git init
git checkout -b dev          # branch principal de desarrollo
git remote add origin git@github.com:qsm-lab/petition-cauce.git
```

> Claude genera los archivos adaptados (docker-compose, nginx, workflow, .env.example, Makefile). El usuario copia los directorios `apps/`, `infra/`, `database/` manualmente desde forms-qsm y luego aplica los diffs.

---

## 2. Archivos afectados

### Nuevos (Claude genera)

| Archivo | Descripción |
|---------|-------------|
| `docker-compose.yml` | Compose de producción adaptado |
| `docker-compose.dev.yml` | Compose de desarrollo con bind mounts |
| `infra/nginx/cauce.ecuadornotlc.org.conf` | Server block nginx para el dominio MVP |
| `.github/workflows/deploy.yml` | Pipeline CI/CD GitHub Actions |
| `Makefile` | Targets de desarrollo local |
| `.env.example` | Plantilla de variables de entorno |

### Adaptados desde forms-qsm (Claude genera el diff)

| Archivo | Cambio |
|---------|--------|
| `apps/api/app/config.py` | `POSTGRES_SCHEMA = "petition_cause"`, nuevo prefijo Redis `petition:`, variables nuevas |
| `apps/api/alembic.ini` | URL de BD apunta a schema `petition_cause` |
| `apps/web/next.config.mjs` | Actualizar dominios permitidos en CSP (`cauce.ecuadornotlc.org`) |
| `apps/web/src/lib/config.ts` | URL base de API → `http://petition-api:8000` |

### Copiados sin modificar desde forms-qsm

- `apps/api/app/crypto.py` — módulo HMAC neutral (no cambia)
- `apps/api/app/limiter.py` — slowapi + Redis (solo cambia el prefijo vía config)
- `apps/api/app/dependencies.py` — `get_db_with_org`, `get_current_user`
- `apps/api/app/models/` — todos los modelos base heredados (organizations, campaigns, forms, responses, users, login_audit)
- `apps/web/src/components/` — componentes UI base

---

## 3. Docker Compose — decisiones técnicas

### Puertos
```
petition-api  : host 8011 → container 8000
petition-web  : host 3002 → container 3000
petition-db   : interno solamente (no expuesto al host)
petition-redis: interno solamente (no expuesto al host)
```

### Red Docker
```yaml
networks:
  petition_cause_network:
    driver: bridge
```
Todos los servicios se unen SOLO a `petition_cause_network`. No se usa la red `default` de Docker — evita que los contenedores sean accesibles desde otras redes del VPS.

### Base de datos
- Imagen: `postgres:15-alpine` (mismo que forms-qsm — no cambiar versión en VPS compartido)
- Schema: `petition_cause` (creado en `init.sql` en `/docker-entrypoint-initdb.d/`)
- Usuario de servicio: `petition_app` — **no superusuario** — para que RLS sea efectivo
- Usuario propietario de tablas: `javofox` (mismo que en forms-qsm, es el usuario del VPS)

### Redis
- Imagen: `redis:7-alpine` (mismo que forms-qsm)
- Contenedor `petition-redis` **propio** — completamente separado del `forms-redis` de proy_forms-qsm
- Prefijo de claves en `config.py`: `REDIS_PREFIX = "petition:"` (por convención interna, no por aislamiento real — el aislamiento lo da el contenedor separado)

### Por qué contenedores Redis/DB separados (no compartidos)
El VPS tiene 48 GB RAM y 720 GB disco — recursos suficientes para dos stacks completos. Compartir contenedores de BD/Redis crearía acoplamiento de ciclo de vida: un `docker compose down` en uno afectaría al otro. Con contenedores propios, cada proyecto es operable de forma completamente independiente.

---

## 4. nginx — decisiones técnicas

### Arquitectura de tráfico
```
Internet → Cloudflare (HTTPS :443) → VPS nginx (:80) → Next.js/FastAPI
```

Cloudflare termina TLS con el usuario final. La conexión entre Cloudflare y el VPS puede ser HTTP (modo Flexible) o HTTPS con certificado en nginx (modo Full/Full strict). Se recomienda Full strict con certificado en nginx (Let's Encrypt o autofirmado para la conexión interna).

### Header Host
`proxy_set_header Host $host` es obligatorio — asegura que Next.js y FastAPI vean el hostname original (`cauce.ecuadornotlc.org`). Sin esto, el middleware Next.js de `multidominio` (Fase 1) no puede resolver la campaña desde el Host.

### IP real de Cloudflare
```nginx
# En nginx.conf (bloque http, antes de los includes)
real_ip_header CF-Connecting-IP;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
# ... rangos IP de Cloudflare
```
Esto permite que el rate limiter de FastAPI (slowapi) y el login audit log vean la IP real del cliente, no la IP de Cloudflare. Mismo patrón que forms-qsm.

---

## 5. GitHub Actions — decisiones técnicas

### Sin `--no-cache`
Builds sin caché tardan 7–9 minutos adicionales descargando capas de Docker. Con caché, solo se reconstruyen las capas modificadas: ~1–2 minutos para cambios en código, ~4–5 para cambios en dependencias.

### `command_timeout: 20m`
El build de assets Next.js (imágenes PNG de campaña, chunks JS) puede superar el timeout SSH por defecto de 10 minutos. Lección directa de forms-qsm Fase 2.

### Secretos requeridos en GitHub
El usuario los configura en `Settings → Secrets and variables → Actions` del repo `qsm-lab/petition-cauce`:
- `VPS_HOST`
- `VPS_USER`
- `SSH_PRIVATE_KEY`
- `DEPLOY_PATH` (ej: `/home/javofox/apps/petition-cauce`)

---

## 6. Seguridad

| Control | Implementación |
|---------|----------------|
| No exponer BD/Redis al exterior | Puertos internos, sin binding al host |
| Red Docker aislada | `petition_cause_network` separada de forms-qsm |
| Usuario DB no superusuario | `petition_app` — permite que RLS sea efectivo |
| IP real en logs | nginx extrae `CF-Connecting-IP` → FastAPI ve la IP real |
| `Host` header preservado | nginx hace pass-through del Host — necesario para multidominio |
| Secretos en Actions, nunca en código | `.env.example` sin valores; `.env` y `.env.dev` en `.gitignore` |

---

## 5. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Colisión de puertos con forms-qsm en el VPS | Puertos 8011/3002 definidos; verificar con `ss -tlnp` antes del deploy |
| `docker compose down` en un proyecto afecta al otro | Nombres de contenedores únicos por proyecto (`petition-*` vs `forms-*`) |
| SSH timeout en deploy | `command_timeout: 20m` en el workflow |
| Cloudflare no propagado antes del primer deploy | Los pasos CF son prerequisito manual (WORKFLOW_LOCAL.md §5) |
