# Estado actual — tras sesión 24 (2026-07-07)

## Resumen de sesión 24

Sesión larga en dos frentes: (a) trabajo local planificado — desincronizaciones, specs LOPDP fase 3, tests, repo-docs, validación local — y (b) fixes de producción sobre la marcha mientras el usuario ejecutaba los tests manuales en el VPS y montaba la primera campaña real (`soberania-tlc-ecu-usa`).

Todos los cambios commiteados y desplegados (último: `8f93023`).

---

## Lo que se hizo

### Docs, specs y sincronización
- `feature_list.json` sincronizado (editor-branding → in_progress) + specs retroactivas de `perfiles-org` y `validacion-cedula` (esta ya estaba implementada en `crypto.py`)
- `tasks.md` de todas las features actualizados al estado real (features done → 100%; in_progress → lo verificado)
- **Specs nuevas en `spec_ready` (esperan aprobación):** `cifrado-reposo`, `retencion-datos`, `derechos-arco`, `enlace-corto-qr` (enlace corto en `/s/{code}`), `supresion-admin` (ventana 15 días — decisión del usuario)
- README.md + LICENSE AGPL-3.0 (decisión del usuario)
- `history.md`: detectado que sesiones 6–23 nunca se registraron (reconstrucción opcional pendiente)

### Tests API: de 2 a 46 (todos pasan)
- `make test` estaba roto (pytest no instalado en el contenedor): `requirements-dev.txt` + `pytest.ini` (asyncio loop de sesión, pythonpath) + `Dockerfile.api.dev`
- Suites nuevas: `test_cedula` (24 casos), `test_crypto` (HMAC), `test_anonymizer`, `test_form_config`

### Producción — landing y patrón /c/
- **Fix crítico multidominio:** `domain_service` filtraba `tls_status='activo'` pero el constraint solo permite `'active'` → ningún dominio resolvía jamás. Corregido; INSERT en `domains` del VPS es ahora opcional.
- **Patrón forms-qsm `/c/<slug>`:** la landing de petición se sirve por path en cualquier dominio (sin filas en `domains`). Reescrito `app/c/[slug]/page.tsx` (antes: flujo forms sin uso); eliminados vestigios QSM (`layout` oscuro, `CBodyFix`, `loading.tsx` que rompía el 404, página `gracias`); OG unificado en `lib/campaign-og.ts`; editor y QR apuntan a `/c/`; middleware cubre `/c/:path*`.
- **Turnstile en prod:** err 110200 = hostname faltante en el widget de Cloudflare — rectificado por el usuario en el dashboard (sitekey `0x4AAAAAADsMg474eUfwuPsk`).

### Verificación de firma por email
- `confirm_signature` idempotente (token no se borra: segundo clic / prefetch del correo no falla) y retorna slug
- `GET /confirm/{token}`: redirect 302 a `/c/<slug>?confirmada=1|expirada` (antes JSON crudo)
- `ConfirmationBanner.tsx` en la landing (confirmada/expirada, descartable)
- Copy corregido: "vence en 24 horas" (TTL real)
- `.env.example`: `RESEND_FROM_EMAIL` (dominio verificado en Resend) y `API_PUBLIC_URL` (sin ella los emails llevan enlaces a localhost)
- **Nota conocida:** confirmación por GET puede dispararla un escáner de email corporativo; mitigación futura = página intermedia con botón (requiere diseño)

### Coherencia editor de campaña ↔ landing (4 bugs)
1. `CampaignResponse` no declaraba `asks`, `privacy_policy_id` ni `org_id` → el editor se hidrataba vacío al recargar (y guardar habría borrado los asks). Campos agregados.
2. Selector de organización: existía pero oculto — las páginas pedían `/v1/organizaciones` en vez de `/v1/admin/organizaciones`. Ruta corregida (editar y nueva); panel visible encima de Categoría/QR.
3. Branding sin efecto en CTA: `#D7F24C` hardcodeado → tokenizado a `var(--bp)`/`var(--bop)` en ActionBlock (CTA + flotante), StepForm, StepSuccess, StepError.
4. "Logo de la campaña" eliminado del editor (`welcome_logo_url` no se usa en la landing; el único logo es el de la organización).

### Aviso de privacidad (contenido)
- Borradores entregados al usuario: aviso al firmante (extenso + versión breve + label del checkbox) y aviso a la organización, para la política de la Plataforma por la Soberanía Alimentaria

---

## Datos dev

| Campo | Valor |
|-------|-------|
| Email | `admin@cauce.ec` |
| Password | `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| Landing por path | `http://localhost:3002/c/campana-dev-001` |
| Migración activa | `014` |

## Datos producción

| Campo | Valor |
|-------|-------|
| Primera campaña real | `Camp-01_AMICUS_TLC_USA` → `https://cauce.ecuadornotlc.org/c/soberania-tlc-ecu-usa` |
| Campaign ID | `63867787-5498-401e-90f7-990f46b1e09e` |
| Organización | Plataforma por la Soberanía Alimentaria |
| Turnstile sitekey | `0x4AAAAAADsMg474eUfwuPsk` (hostname rectificado) |

---

## Estado infra-fork (VPS producción)

| Paso | Estado | Notas |
|------|--------|-------|
| Cloudflare, CI/CD, VPS, nginx, admin | **✓** | |
| TEST-5: flujo firma en prod | **casi ✓** | Firma + modal + email en curso; falta confirmar clic del email en prod con `RESEND_FROM_EMAIL`/`API_PUBLIC_URL` en el `.env` del VPS |
| TEST-6: HTTPS forzado | **✓** | |
| TEST-7: firma visible en admin | **✓** | Verificado en dashboard (screenshot sesión 24) |
| Paso 6: primera campaña real | **en curso** | `soberania-tlc-ecu-usa` montándose — **implementar cifrado-reposo antes de recolectar firmas reales** |

## Acciones pendientes del usuario en el VPS (`.env`)

1. `RESEND_FROM_EMAIL=` dirección del dominio verificado en Resend
2. `API_PUBLIC_URL=https://cauce.ecuadornotlc.org/api`
3. (Reiniciar contenedor API tras editar)

---

## Estado de features (cambios de sesión 24)

| Feature | Estado | Cambio |
|---------|--------|--------|
| `cifrado-reposo` | **spec_ready** | nueva spec — **primera a implementar** |
| `retencion-datos` | **spec_ready** | nueva spec |
| `supresion-admin` | **spec_ready** | nueva spec (feature nueva, ventana 15 días) |
| `derechos-arco` | **spec_ready** | nueva spec |
| `enlace-corto-qr` | **spec_ready** | nueva spec (`/s/{code}`, QR ya existente documentado) |
| `validacion-cedula` | **spec_ready** | retroactiva; implementación existía; tests hechos ✓ |
| `editor-branding` | **in_progress** | validado + fix tokens CTA; logo de campaña eliminado (decisión) |
| `editor-campana` | **in_progress** | 15/15 tasks + fixes de hidratación y org selector |
| `repo-docs` | **in_progress** | README + LICENSE AGPL-3.0 — usuario valida |
| `multidominio` | **done*** | fix tls_status + patrón /c/ agregado post-done |
| resto | sin cambio | validaciones locales en tasks.md |

Orden de implementación fase 3 acordado: **cifrado-reposo → retencion-datos → supresion-admin → derechos-arco**.

---

## Pendientes para próxima sesión

1. Usuario: aprobar specs de fase 3 (+ `enlace-corto-qr`) para arrancar implementación
2. Usuario: `RESEND_FROM_EMAIL` + `API_PUBLIC_URL` en el VPS y probar el clic del email en prod
3. Implementar `cifrado-reposo` (bloqueante: cifrar PII antes de recolectar firmas reales de la campaña TLC)
4. Checks de browser menores: dashboard-firmas T25-T28, editor-branding T14 (social links en StepThanks), resumen-admin T6-T7
5. Opcional: reconstruir `history.md` sesiones 6–23 desde git log

## Al inicio de la próxima sesión

```bash
docker compose -f docker-compose.dev.yml up -d
```
