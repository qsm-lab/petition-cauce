# Design — export-entrega

## Decisión de producto (sesión 27)

Entre las alternativas analizadas (password adicional estático / OTP por email /
combinación), se aprobó la **combinación**: re-validación de contraseña + OTP al
email del admin. Un password estático extra sería un segundo secreto compartido,
sin expiración y difícil de rotar; el OTP prueba control del buzón y expira solo.
La descarga queda ligada a su finalidad (etapa Entrega) y deja rastro auditable
+ notificación al Responsable.

## Flujo

```
[Admin] botón "Descarga de entrega" (visible si lifecycle_stage >= 2)
   → modal paso 1: re-ingresar contraseña
   → POST /v1/admin/campaigns/{cid}/export-entrega/request  {password}
       · verifica password (hash bcrypt del usuario actual)
       · OTP 6 dígitos → SHA-256 en Redis (TTL 600s) · máx 3 req/hora
       · send_export_otp_email(admin.email, code, campaign_title)
   → modal paso 2: ingresar código
   → POST /v1/admin/campaigns/{cid}/export-entrega/verify  {code}
       · compara hash · máx 3 intentos (contador en Redis) · invalida al agotar
       · emite download_token aleatorio (Redis, TTL 300s, single-use)
   → GET /v1/admin/campaigns/{cid}/export-entrega/download?token=...
       · consume el token (GETDEL) · genera CSV descifrado en streaming
       · INSERT pii_export_audit · send_export_notification(org, admins)
```

## Modelo

Tabla nueva (migración `0XX_pii_export_audit`):
```
pii_export_audit
  id           UUID PK (= export_id del CSV)
  campaign_id  UUID NOT NULL REFERENCES campaigns(id)
  org_id       UUID NOT NULL
  user_id      UUID NOT NULL REFERENCES users(id)
  ip_hmac      VARCHAR(64) NOT NULL
  row_count    INTEGER NOT NULL
  secret_count INTEGER NOT NULL    -- secretas excluidas (R6)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS: mismas políticas org + platform_admin del resto de tablas admin.

Redis (prefijos nuevos, TTL automático):
```
petition:otp:export:<user_id>:<campaign_id>        → sha256(code) · TTL 600
petition:otp:export:attempts:<user_id>:<cid>       → contador · TTL 600
petition:otp:export:rate:<user_id>                 → contador · TTL 3600
petition:dl:export:<token>                          → user_id:campaign_id · TTL 300
```

## Archivos afectados

### Backend
| Archivo | Cambio |
|---------|--------|
| `apps/api/migrations/versions/0XX_pii_export_audit.py` | tabla nueva + RLS |
| `apps/api/app/models/pii_export_audit.py` | nuevo modelo |
| `apps/api/app/services/pii_export_service.py` | nuevo: OTP, token, CSV descifrado, auditoría |
| `apps/api/app/services/email_service.py` | `send_export_otp_email`, `send_export_notification` |
| `apps/api/app/routers/admin_signatures.py` | 3 endpoints `export-entrega/*` (rate limit slowapi) |
| `apps/api/tests/test_export_entrega.py` | R11 |

### Frontend (adiciones a pantalla existente — sin ronda Claude Design)
| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/admin/campanas/[id]/firmas/*` | botón condicionado por etapa + modal 2 pasos (password → código → descarga) |
| `apps/web/src/lib/admin-signatures-api.ts` | `requestExportEntrega`, `verifyExportEntrega`, URL de descarga |

## Seguridad

- Contraseña verificada contra el hash bcrypt del usuario autenticado (nunca se
  loguea); mensajes de error genéricos (R10).
- OTP nunca en claro: solo su SHA-256 en Redis; comparación en tiempo constante
  (`hmac.compare_digest`).
- Token de descarga consumido con `GETDEL` (atómico) — un solo uso real aun con
  requests concurrentes.
- Rate limiting doble: slowapi por IP + contadores Redis por usuario (R3).
- La PII se descifra en streaming solo durante la generación del CSV; no se
  persiste ningún archivo en el servidor.

## LOPDP

- **Finalidad**: la descarga completa existe solo para la entrega oficial del
  lote (base: la misma del consentimiento de firma); el gating por etapa
  Entrega materializa la limitación de finalidad.
- **Minimización**: solo firmas confirmadas; secretas excluidas (compromiso con
  el titular); archivadas/anonimizadas excluidas.
- **Responsabilidad proactiva**: `pii_export_audit` + notificación al
  Responsable y a la plataforma dejan evidencia de cada acceso masivo a PII
  (accountability del Encargado ante la SPDP).
- **Traspaso Encargado→Responsable**: el email de notificación (R9) recuerda al
  Responsable su deber de custodia y el plazo de retención pactado en el
  contrato de encargo; desde la descarga, la copia es responsabilidad del
  Responsable.
- Sin nuevas categorías de datos ni nuevos destinatarios: no altera el RAT más
  allá de registrar el flujo de entrega ya declarado.

## Dependencias

- `cifrado-reposo` (desplegado): `decrypt_pii` es la vía de lectura.
- Redis existente (`petition-redis`).
- Independiente de `retencion-datos` / `supresion-admin` / `derechos-arco`;
  respeta sus marcas (`archived_at`, `anonymized_at`) cuando existan.
- Insumo futuro de `documento-entrega` (fase 4).
