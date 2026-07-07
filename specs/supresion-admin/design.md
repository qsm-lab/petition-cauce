# Design — supresion-admin

## Decisión de producto (sesión 24)

Ventana de gracia de **15 días** (opción elegida por el usuario entre inmediata /
15 días / 30 días): reversible ante errores del admin y dentro del plazo LOPDP
de 15 días para atender una solicitud de supresión. El email de notificación
(R3) constituye la respuesta formal al titular dentro del plazo.

## Modelo

Columnas nuevas en `signatures` (migración):
```
archived_at   TIMESTAMPTZ NULL
archived_by   UUID NULL REFERENCES users(id)
purge_after   TIMESTAMPTZ NULL
```
- `status` NO cambia al archivar: el conteo (`status='confirmed'`) sigue
  incluyendo la firma durante la ventana y después de la purga (R2, R9).
- La purga usa `anonymized_at` (columna de retencion-datos) como marca final.
- Estados derivados en el dashboard:
  - `archived_at NULL` → normal
  - `archived_at NOT NULL && anonymized_at NULL` → "Archivada — purga el X" (R5)
  - `anonymized_at NOT NULL` → "Suprimida" (R9)

## Flujo

```
[Admin] botón Archivar → modal 2 pasos (explica R1)
   → POST /v1/admin/campaigns/{cid}/signatures/{sid}/archive
   → set archived_at/by, purge_after = now()+15d
   → send_archive_notification(email descifrado, campaña, fecha_purga)
   → INSERT arco_requests (supresion, trigger=admin)
[Job diario — scheduler compartido con retencion-datos]
   → WHERE purge_after <= now() AND anonymized_at IS NULL
   → anonymize_signature(sig)  (reutilizado de retention_service)
   → auditoría de corrida
[Admin] botón Restaurar (solo en ventana)
   → POST .../unarchive → limpia archived_at/purge_after → auditoría
```

## Archivos afectados

### Backend
| Archivo | Cambio |
|---------|--------|
| `apps/api/migrations/versions/0XX_signature_archive.py` | 3 columnas nuevas |
| `apps/api/app/models/signature.py` | columnas `archived_at`, `archived_by`, `purge_after` |
| `apps/api/app/services/admin_signature_service.py` | `archive_signature`, `unarchive_signature`; exponer estado derivado en `list_signatures`; exclusiones R7 en export |
| `apps/api/app/services/retention_service.py` | el job incluye la cola de purga por archivado (query R8) |
| `apps/api/app/services/email_service.py` | `send_archive_notification` |
| `apps/api/app/routers/admin_signatures.py` | `POST .../archive`, `POST .../unarchive` (rol admin) |
| `apps/api/app/services/campaign_service.py` | `get_signer_emails_for_notify`: excluir archivadas (R7) |
| `apps/api/tests/test_supresion_admin.py` | R11 |

### Frontend (adiciones a pantalla existente — sin ronda Claude Design)
| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/admin/campanas/[id]/firmas/page.tsx` | columna de acciones, badges Archivada/Suprimida |
| `apps/web/src/app/admin/campanas/[id]/firmas/ArchiveModal.tsx` | nuevo: modal de confirmación 2 pasos + restaurar |
| `apps/web/src/lib/admin-signatures-api.ts` | `archiveSignature`, `unarchiveSignature` |

## Seguridad

- Endpoints con JWT + rol admin + validación campaña→org (patrón existente del router).
- El email del firmante se descifra en memoria solo para enviar la notificación (vía `decrypt_pii` cuando cifrado-reposo esté activo).
- Auditoría sin PII: `email_hash` + ids (R4).

## LOPDP

- Ejecuta el derecho de supresión solicitado por canal no digital; el email R3 es la respuesta al titular dentro del plazo de 15 días.
- La anonimización final es irreversible y conserva únicamente datos no identificantes (campaign_id, status, provincia, fechas) — el conteo histórico es interés legítimo de la campaña y no contiene datos personales.
- `arco_requests` acumula la evidencia de cumplimiento (solicitud→archivo→purga) ante la SPDP.
- Durante la ventana la PII sigue en el sistema pero fuera de todo flujo operativo (R7) — solo espera purga o reversión.

## Dependencias

1. **retencion-datos** (anonymize_signature + scheduler + `anonymized_at`) — implementar primero.
2. Compatible con **cifrado-reposo** (descifra para notificar) y **derechos-arco** (comparte `arco_requests`).

Orden sugerido de implementación fase 3: cifrado-reposo → retencion-datos → supresion-admin → derechos-arco.
