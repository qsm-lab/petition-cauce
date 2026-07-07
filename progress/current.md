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

### 6. Fix producción: landing 404 + patrón /c/[slug] (post-pausa)
- **Bug 1 (código):** `domain_service.py` buscaba `tls_status == "activo"` pero el constraint de la migración 006 solo permite `'pending'|'active'|'error'` → ningún dominio podía resolver. Fix: `"active"`. SQL para el VPS ya entregado al usuario (INSERT en `domains` con `'active'`).
- **Bug 2 (diseño):** en producción `?slug=` se ignoraba (solo resolución por dominio). Solución adoptada: **patrón forms-qsm `/c/<slug>`**:
  - `app/c/[slug]/page.tsx` reescrito: renderiza la landing de petición por slug (antes: FormRenderer del flujo forms qsm, sin uso — `form_id` NULL en todas las campañas)
  - Vestigios forms eliminados de `/c/`: `layout.tsx` (fondo QSM `#01004d`), `CBodyFix.tsx`, `loading.tsx` (rompía el status 404 por streaming), `[slug]/gracias/`
  - `lib/campaign-og.ts` nuevo: metadata OG compartida entre `/` y `/c/[slug]`
  - Editor admin: QR, botón "Landing ↗" y label del slug ahora usan `/c/<slug>`
  - Middleware: `x-original-host` también en `/c/:path*`
  - Multidominio intacto: `/` sigue resolviendo por Host para campañas con dominio propio
- **Spec `enlace-corto-qr` ajustada por consistencia:** el enlace corto pasa de `/c/{code}` a **`/s/{code}`** (evita colisión con landings); redirect destino ahora `/c/<slug>?source=short`
- Verificado: `/c/<slug>` 200 + OG canónico, slug inexistente 404, raíz sin regresión, tsc 0 errores, 46 tests pasan

### 7. Verificación de firma por email (post-/c/)
- Turnstile prod: rectificado por el usuario en el dashboard de Cloudflare (err 110200 = hostname faltante en el widget; sitekey en prod: `0x4AAAAAADsMg474eUfwuPsk`)
- `confirm_signature` ahora es **idempotente** (el token no se borra al confirmar: segundo clic o prefetch del cliente de correo no falla) y retorna `status` + `slug`
- `GET /confirm/{token}` ya no devuelve JSON crudo: **redirect 302** a `/c/<slug>?confirmada=1|expirada` (token inexistente → raíz)
- `ConfirmationBanner.tsx` nuevo en la landing: banner confirmada/expirada, descartable, limpia el query param
- Copy StepSuccess corregido: "vence en 30 minutos" → "24 horas" (TTL real del backend)
- `.env.example`: agregadas `RESEND_FROM_EMAIL` (debe ser del dominio verificado en Resend) y `API_PUBLIC_URL` (sin ella los emails llevan enlaces a localhost)
- **Acción usuario en VPS `.env`**: definir `RESEND_FROM_EMAIL` y `API_PUBLIC_URL=https://cauce.ecuadornotlc.org/api` (solo API, no requiere rebuild del web)
- E2E verificado en dev: firma → confirm 302 → banner visible; idempotencia; caso expirado; tsc 0 errores; 46 tests
- **Nota conocida**: la confirmación por GET puede ser disparada por escáneres de email corporativos (prefetch). Mitigación futura: página intermedia con botón (requiere diseño). Aceptado para MVP.

### 8. Feature nueva: supresion-admin (spec_ready)
- Caso: firmante pide borrar sus datos por canal no digital → admin ejecuta desde el dashboard de firmas
- Análisis presentado al usuario: supresión inmediata vs ventana 15d vs 30d — **usuario eligió ventana de 15 días** (reversible y dentro del plazo LOPDP)
- Spec en `specs/supresion-admin/`: Archivar → email al firmante → job purga PII al día 15 (reutiliza `anonymize_signature` de retencion-datos) → fila anonimizada sigue contando para siempre
- Depende de retencion-datos. Orden fase 3: cifrado-reposo → retencion-datos → supresion-admin → derechos-arco

### 9. Fixes editor de campaña ↔ landing (coherencia admin/front)
- **`CampaignResponse` no declaraba `asks`, `privacy_policy_id` ni `org_id`** → el editor se hidrataba vacío al recargar ("Lo que pedimos" en blanco, política "Sin asignar") aunque los datos estaban en DB y la landing los mostraba. Peligro real: guardar en ese estado habría borrado los asks. Fix: 3 campos agregados al schema.
- **Selector de organización**: ya existía en el sidebar del editor pero nunca se veía — `page.tsx` (editar y nueva) consultaba `/v1/organizaciones` en vez de `/v1/admin/organizaciones` → lista siempre vacía. Fix: ruta corregida; el panel aparece encima de Categoría/QR.
- **Color de branding sin efecto en el CTA**: los botones tenían `#D7F24C` hardcodeado. Tokenizados a `var(--bp)`/`var(--bop)` en: ActionBlock (CTA + flotante), StepForm (submit), StepSuccess, StepError.
- **"Logo de la campaña" eliminado del editor**: `welcome_logo_url` no se usa en ninguna parte de la landing (el único logo visible es el de la organización). Campo backend se conserva por compat.
- Verificado: roundtrip asks admin↔público, botón consume `var(--bp)` con Fuego, tsc 0, 46 tests.

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
