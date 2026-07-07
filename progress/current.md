# Estado actual — sesión 24 en curso (2026-07-07)

## Resumen de sesión 24 (hasta la pausa de commits)

Sesión de trabajo local mientras el usuario ejecuta TEST-5/6/7 manualmente en el VPS.
Orden ejecutado: desincronizaciones → specs LOPDP fase 3 → specs fase 2/4 → tests → repo-docs → validación local.

---

## Lo que se hizo

### 1. Desincronizaciones corregidas
- `feature_list.json`: `editor-branding` `pending` → `in_progress` (estaba implementado y en producción)
- Spec retroactiva de `perfiles-org` creada (`specs/perfiles-org/`) — se implementó en sesiones 18-19 sin spec; R10 (regiones) y R11 (catálogo público) quedan como alcance restante
- `tasks.md` de features done/implementadas: casillas marcadas según estado real
- El commit `ci: checkout@v5` ya estaba hecho (`ed89932`) — pendiente resuelto

### 2. Specs nuevas → `spec_ready` (esperan aprobación del usuario)
| Spec | Contenido clave |
|------|----------------|
| `cifrado-reposo` | AES-256-GCM, `PII_ENCRYPTION_KEY` nueva, formato `enc:v1:`, migración idempotente. **Urgente antes de la primera campaña real** |
| `retencion-datos` | APScheduler diario + lock Redis, ancla en evento `entrega`, anonimización preservando conteos, tabla `retention_runs` |
| `derechos-arco` | Portal self-service `/mis-datos`, doble verificación email+cédula, anti-enumeración, tabla `arco_requests`. Frontend requiere Claude Design |
| `enlace-corto-qr` | `/c/{code}` redirect, QR codifica enlace corto con `?source=qr`, descarga PNG 1024 |
| `validacion-cedula` | **Retroactiva** — `verify_cedula` ya implementado; faltaban tests (hechos en esta sesión) |

Orden de implementación recomendado: cifrado-reposo → retencion-datos → derechos-arco (dependencias documentadas).

### 3. Tests API (de 2 a 46 tests, todos pasan)
- `requirements-dev.txt` nuevo (pytest, pytest-asyncio) + `Dockerfile.api.dev` los instala — **antes `make test` no podía correr (pytest no estaba instalado)**
- `pytest.ini`: `asyncio_mode=auto`, loop scope `session` (arregla fallo de event loop en `test_campaign_not_found`), `pythonpath=.`
- Nuevos: `test_cedula.py` (24 casos), `test_crypto.py` (HMAC), `test_anonymizer.py`, `test_form_config.py`
- `make test` → **46 passed**

### 4. repo-docs
- `README.md` creado (propósito, stack, setup local, seguridad/LOPDP)
- LICENSE AGPL-3.0 agregada (decisión del usuario en sesión 24)

### 5. Validación local de features in_progress (API + SSR)
| Verificado ✓ | Detalle |
|--------------|---------|
| resumen-admin | `/v1/dashboard/summary` correcto; `/admin/resumen` renderiza KPIs reales |
| dashboard-firmas | Lista con stats/filtros/paginación; CSV sin PII; 401 sin JWT. Falta: 404 multi-org y checks de browser (T23, T25-T28) |
| editor-campana | CRUD completo, 409 slug duplicado, org_id correcto — 15/15 |
| editor-branding | Color Fuego → aparece en landing SSR y revierte; tsc 0 errores. Falta: miniatura logo y social links en browser (T13, T14) |
| ciclo-vida-admin | PATCH lifecycle crea evento + notifica admins ✓ |
| ciclo-vida-basico | 5 etapas presentes en landing SSR, etapa actual desde DB |
| firmas-recientes / firma-visibilidad | Feed solo muestra la firma pública de 5 existentes |
| landing/OG | OG completo (title, desc, image+dims, twitter card) |

Nota: la landing SSR cachea ~2 s los datos de campaña — esperar antes de verificar cambios.

---

## Pausa de commits (punto actual)

Cambios listos para commit (el usuario commitea manualmente):
1. Specs nuevas + retroactivas + feature_list.json + tasks.md actualizados
2. Tests + infra de tests (requirements-dev, pytest.ini, Dockerfile.api.dev)
3. README.md
4. progress/

Licencia decidida: AGPL-3.0 (LICENSE agregada).

---

## Datos dev

| Campo | Valor |
|-------|-------|
| Email | `admin@cauce.ec` |
| Password | `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| URL landing campaña dev | `http://localhost:3002/?slug=campana-dev-001` |
| Campaña prueba_001 ID | `6def46c9-c089-4749-aa91-9d80e9a5a59b` |
| Migración activa | `014` |

---

## Estado infra-fork (VPS producción)

| Paso | Estado | Notas |
|------|--------|-------|
| Cloudflare, CI/CD, VPS, nginx, admin | **✓** | |
| TEST-5: flujo firma en prod | **en curso** | Usuario lo ejecuta manualmente |
| TEST-6: HTTPS forzado | **✓** | |
| TEST-7: firma visible en admin | **en curso** | Usuario lo ejecuta manualmente |
| Paso 6: primera campaña real | **pendiente** | Tras TEST-5/7 — **implementar cifrado-reposo antes** |

---

## Estado de features (cambios de esta sesión)

| Feature | Estado | Cambio |
|---------|--------|--------|
| `cifrado-reposo` | **spec_ready** | nueva spec |
| `retencion-datos` | **spec_ready** | nueva spec |
| `derechos-arco` | **spec_ready** | nueva spec |
| `enlace-corto-qr` | **spec_ready** | nueva spec |
| `validacion-cedula` | **spec_ready** | spec retroactiva; implementación ya existía + tests hechos |
| `editor-branding` | **in_progress** | corregido desde pending; validado en local |
| `repo-docs` | **in_progress** | README + LICENSE AGPL-3.0 hechos; usuario valida |
| resto | sin cambio | validaciones locales registradas en tasks.md |

---

## Pendientes tras la pausa

1. Usuario: revisar/aprobar specs y commitear
2. Usuario: resultado de TEST-5/7 en producción
3. Si specs aprobadas: implementar `cifrado-reposo` (bloqueante de primera campaña real)
4. Checks de browser pendientes: dashboard-firmas T25-T28, editor-branding T13-T14, resumen-admin T6-T7
