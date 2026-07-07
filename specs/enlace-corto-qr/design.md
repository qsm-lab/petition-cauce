# Design — enlace-corto-qr

## Decisiones

- **Código corto:** `secrets.choice` sobre alfabeto `abcdefghjkmnpqrstuvwxyz23456789` (sin `0/O/1/l/i`), 7 chars (~34 bits). Columna `campaigns.short_code VARCHAR(12) UNIQUE`, generado al crear campaña (y backfill por migración para las existentes). Reintento en colisión (probabilidad despreciable).
- **Ruta `/s/` (no `/c/`):** desde sesión 24, `/c/<slug>` es la landing pública de campaña por path (patrón forms-qsm); el enlace corto vive en `/s/{code}` para no colisionar.
- **Redirect en Next.js, no en API:** route handler `apps/web/src/app/s/[code]/route.ts` — resuelve vía API pública y hace `redirect()` 302 a `/c/<slug>?source=short` (o al dominio propio de la campaña si existe). Mantiene el flujo multidominio server-side existente.
- **Endpoint API público:** `GET /v1/public/short/{code}` → `{slug, domain}` o 404. Sin datos sensibles, cacheable.
- **QR client-side se mantiene** (patrón actual con librería `qrcode` en el editor): solo cambia el contenido codificado → `https://<dominio>/s/<short_code>?source=qr`, y se agrega botón de descarga PNG 1024px (`QRCode.toDataURL(url, {width: 1024})` → `<a download>`).
- **`source` en la firma:** el formulario ya persiste `signatures.source`; verificar que la landing propague `?source=` de la URL al payload de firma (si no, agregarlo — cambio menor en el form).

## Archivos afectados

### Backend
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/models/campaign.py` | columna `short_code` |
| `apps/api/migrations/versions/0XX_short_code.py` | columna UNIQUE + backfill campañas existentes |
| `apps/api/app/services/campaign_service.py` | generación en create + helper resolve |
| `apps/api/app/routers/public_campaign.py` | `GET /v1/public/short/{code}` |
| `apps/api/tests/test_short_link.py` | tests R9 |

### Frontend
| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/s/[code]/route.ts` | route handler redirect 302 |
| `apps/web/src/app/admin/campanas/[id]/CampanaEditorClient.tsx` | panel QR: mostrar enlace corto + copiar; QR codifica enlace corto; botón descarga PNG 1024 |
| formulario de firma | propagar `?source=` al payload si falta |

> Nota frontend: cambios sobre el panel QR existente del editor (ajuste menor de UI
> ya diseñada) — no requiere ronda nueva de Claude Design salvo que el usuario
> quiera rediseñar el panel.

## Seguridad

- Endpoint público de resolución: rate limit estándar, sin PII, solo campañas activas no archivadas (R3).
- El código corto no es secreto (aparece impreso); no da acceso a nada no público.

## LOPDP

- Sin PII nueva. `source` es metadato de origen, no identifica al titular.
