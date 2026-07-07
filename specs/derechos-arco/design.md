# Design — derechos-arco

## Flujo

```
1. /mis-datos (pública, por dominio de campaña)
   → email + cédula + Turnstile
   → respuesta genérica siempre (R2)
2. Si email_hash + cedula_hash coinciden con una firma no anonimizada:
   → email con enlace /mis-datos/portal?token=<t1> (1h, un solo uso)
3. Portal (sesión 30 min, token de sesión distinto del de verificación):
   → Acceso: datos + consentimiento (R5)
   → Rectificar: name, provincia/country, visibility (R6)
   → Oposición: toggles notify_updates / subscribe_newsletter (R8)
   → Portabilidad: descarga JSON/CSV (R9)
   → Supresión: confirmación en dos pasos → anonimización inmediata (R7)
```

## Decisiones

- **Búsqueda por hash:** la identificación usa `email_hash` y `cedula_hash` (HMAC) — compatible con cifrado-reposo, sin descifrar para buscar.
- **Dos tokens:** verificación (email, 1h, un uso, hasheado en DB) → sesión de portal (30 min, en memoria de respuesta, no persistido). Patrón similar a `confirmation_token` existente.
- **Supresión = anonimización** de retencion-datos (`retention_service.anonymize_signature`) — un solo mecanismo, dos disparadores. El contador público no cambia (la firma fue válida; se elimina la PII, no el hecho del apoyo — documentado en el aviso de privacidad).
- **Cédula enmascarada en acceso (R5):** mostrar `17*****89` — el portal nunca re-expone la cédula completa.
- **Multi-firma:** si el mismo email+cédula firmó varias campañas del mismo dominio, el portal lista todas y opera por firma.

### Tabla `arco_requests` (R10)
```
id UUID PK, campaign_id, right_type ('acceso'|'rectificacion'|'supresion'|
'oposicion'|'portabilidad'), email_hash, requested_at, completed_at,
result ('completed'|'expired'|'not_found'), detail JSONB (sin PII)
```

## Archivos afectados

### Backend
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/models/arco_request.py` | nuevo modelo |
| `apps/api/migrations/versions/017_arco.py` | tabla `arco_requests` + `signatures.arco_verification_token/expires` |
| `apps/api/app/services/arco_service.py` | nuevo: verificación, portal, cada derecho |
| `apps/api/app/routers/arco.py` | nuevo router público: request-access, verify, get-data, rectify, oppose, export, delete |
| `apps/api/app/services/email_service.py` | `send_arco_verification_email`, `send_arco_org_notification` |
| `apps/api/tests/test_arco.py` | tests R13 |

### Frontend (requiere Claude Design ANTES de implementar)
| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/(campaign)/mis-datos/page.tsx` | formulario de solicitud |
| `apps/web/src/app/(campaign)/mis-datos/portal/page.tsx` | portal de derechos |
| `specs/derechos-arco/design-export.html` | export de Claude Design (pendiente) |

## Seguridad

- Rate limit estricto en request-access (ej. 3/hora por IP) + Turnstile (R4).
- Anti-enumeración en TODAS las respuestas públicas, incluida firma anonimizada (R2, R12).
- Token de verificación almacenado hasheado (HMAC) en DB; comparación por hash.
- Sesión de portal: token firmado corto, scope limitado a la(s) firma(s) verificada(s); no es JWT de admin.
- Auditoría sin PII: solo `email_hash` (R10).

## LOPDP

- Implementa derechos de los titulares (acceso, rectificación, eliminación, oposición, portabilidad) con plazos autoejecutados (< 15 días trivially).
- Rol Encargado: la plataforma ejecuta y notifica al Responsable (R11); el contrato de encargo debe reflejar este flujo delegado.
- `arco_requests` = evidencia de cumplimiento ante SPDP.
- Texto del aviso de privacidad (lopdp-base) debe enlazar `/mis-datos` como canal de ejercicio.

## Dependencias

- **Requiere retencion-datos** (reutiliza `anonymize_signature`) — implementar después.
- Compatible con cifrado-reposo (acceso/portabilidad descifran vía `decrypt_pii`).
- Frontend bloqueado hasta diseño Claude Design aprobado (regla CLAUDE.md).
