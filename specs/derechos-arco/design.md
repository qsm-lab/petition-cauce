# Design — derechos-arco

## Flujo (actualizado sesión 30 — multi-campaña)

```
Entrada al flujo:
  A) Landing de campaña → botón secundario "¿Ya firmaste? Accedé a tus
     datos" → /mis-datos?campaign={id} (R16)
  B) Email de agradecimiento post-confirmación → enlace directo con token
     de 24h → /mis-datos/portal?token=<t>&campaign={id} (R15, salta el
     formulario)
  C) Enlace directo a /mis-datos (sin contexto de campaña)

1. /mis-datos (si no vino con token directo, caso A o C)
   → email + cédula + Turnstile [+ campaign de contexto, opcional]
   → respuesta genérica siempre (R2)
2. Si email_hash + cedula_hash coinciden con AL MENOS UNA firma no
   anonimizada en CUALQUIER campaña de la plataforma:
   → email con enlace /mis-datos/portal?token=<t1> (1h, un solo uso)
3. Portal (sesión 30 min, token de sesión JWT distinto del de verificación):
   → Reúne TODAS las firmas no anonimizadas del titular (R1b)
   → Auto-confirma firmas pending_confirmation en campañas aún firmables (R1c)
   → Nivel 1 (compartido): Acceso a datos personales + Rectificar nombre/
     provincia/país (aplica a todas las campañas, R6a) + Portabilidad
     unificada (R9)
   → Nivel 2/3 (por campaña, selector con la campaña de origen preseleccionada,
     R17): Confirmación manual (R14) + Visibilidad (R6b) + Oposición (R8) +
     Supresión (R7) — todo scoped a un signature_id puntual
   → Cualquier cambio dispara email al titular (R18) y, si aplica
     (rectificación de datos personales o supresión), al Responsable (R11)
```

## Decisiones

- **Búsqueda por hash, platform-wide:** la identificación usa `email_hash` y
  `cedula_hash` (HMAC) sin restringir por `campaign_id` — compatible con
  cifrado-reposo, sin descifrar para buscar. Requiere bypass de RLS
  (`app.is_platform_admin`, transaction-local) para la búsqueda inicial, ya
  que no hay un `org_id` conocido de antemano — mismo patrón ya usado por
  `retention_service.run_retention` para operaciones cross-org legítimas.
- **Token de verificación — "ancla" única:** `signatures.arco_verification_token`
  tiene constraint `UNIQUE` (migración 020) — el token no se replica en todas
  las firmas encontradas (violaría la unicidad); se escribe en **una sola
  fila ancla** (la de la campaña de origen si se indicó, si no la primera
  coincidencia). Al verificar, se lee el `email_hash`/`cedula_hash` de esa
  fila ancla y se **re-consulta** todas las firmas no anonimizadas que
  coincidan — así la sesión de portal siempre refleja el estado más
  reciente, no una foto fija del momento del `request_access`.
- **Un solo mecanismo de token para dos disparadores:** el mismo campo
  `arco_verification_token`/`expires_at` sirve tanto para el flujo bajo
  demanda (`request_access`, TTL 1h) como para el acceso directo emitido al
  confirmar una firma (TTL 24h, R15) — sin tablas ni columnas nuevas.
- **Sesión de portal multi-firma:** JWT propio (`typ=arco_portal`,
  `signature_ids: [...]`, `origin_campaign_id`, `exp` 30 min) — no
  persistido. Firmado con el mismo secreto de admin (`jwt_secret_key`) pero
  con `typ` distinto, dependencia separada de `get_current_admin`.
- **Auto-confirmación al verificar (R1c):** al abrir la sesión de portal, toda
  firma `pending_confirmation` cuya campaña siga en `_SIGNABLE_STATUSES`
  (`draft`/`active`/`online`) se confirma automáticamente — el enlace ARCO ya
  prueba la titularidad del email igual que el enlace de confirmación
  original, así que no hace falta un segundo paso. Si la campaña ya cerró, se
  omite (R14 permite confirmar manualmente después si la campaña reabre).
- **Datos personales compartidos vs. por campaña:** `name`, `provincia`,
  `country` son atributos de la *persona*, no de la firma — se rectifican una
  vez y se propagan a todas sus firmas no anonimizadas en la misma
  operación, agrupando por `org_id` (cada campaña puede pertenecer a una
  organización distinta, así que el contexto RLS se escala por lotes según
  el `org_id` de cada grupo de firmas). `visibility` sí es por campaña
  (misma persona puede querer ser pública en una y secreta en otra).
- **Trazabilidad sin PII (R6a):** la auditoría de rectificación de datos
  personales registra `detail: {"fields_changed": ["name", "provincia"]}` —
  qué cambió y cuándo, nunca el valor anterior ni el nuevo.
- **Email/cédula rectificables, con choque por campaña (R6a, sesión 30):**
  a diferencia de nombre/provincia, `email`/`cedula` tienen índices únicos
  parciales por campaña (`uq_sig_email_natural/org`, `uq_sig_cedula_natural`,
  migración 006, partidos por `signer_type`). `rectify_personal_data` verifica
  colisión campaña por campaña (`_has_collision`) antes de aplicar — si choca,
  esa campaña queda con el valor anterior y se reporta en `conflicts`; el
  resto se aplica igual. Si el email cambia en una firma `pending_confirmation`,
  se regenera `confirmation_token` (24h) y se reenvía la confirmación al
  correo nuevo. El aviso de seguridad (R18) siempre va al correo **anterior**.
- **Celular, opcional (nuevo):** `signatures.celular_encrypted` (migración
  022) — cifrado igual que email/cédula, sin hash ni índice (no participa en
  búsqueda ni verificación de identidad). Aportado voluntariamente por el
  titular vía el portal — no requiere actualizar el aviso de privacidad de la
  campaña (no es un dato que la plataforma solicite al firmar).
- **Portabilidad unificada (R9):** un solo export (JSON/CSV) con un registro
  por campaña encontrada, generado on-demand sin persistir archivo.
- **Cédula enmascarada en acceso (R5):** mostrar `17*****89` — el portal
  nunca re-expone la cédula completa.
- **Supresión = anonimización** de retencion-datos
  (`retention_service.anonymize_signature`) — un solo mecanismo, ahora tres
  disparadores (retención automática, archivado admin, self-service ARCO).
  El contador público no cambia. Alcance: **una sola campaña por operación**
  — eliminar en una no afecta a las demás del titular.

### Tabla `arco_requests` (R10)
Sin cambios de esquema — reutilizada tal cual (ya existía desde `019`,
`supresion-admin`):
```
id UUID PK, campaign_id, right_type ('acceso'|'rectificacion'|'supresion'|
'oposicion'|'portabilidad'), email_hash, requested_at, completed_at,
result ('completed'|'expired'|'not_found'), detail JSONB (sin PII)
```
Una solicitud sin ninguna coincidencia (R2/anti-enumeración) no genera fila
— no hay `campaign_id` (NOT NULL) que asociarle. Acciones que tocan varias
campañas a la vez (rectificación de datos personales) generan **una fila por
campaña afectada**.

## Archivos afectados

### Backend
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/models/arco_request.py` | sin cambios (ya existía) |
| `apps/api/migrations/versions/020_arco_verification.py` | sin cambios (ya aplicada) — el campo `arco_verification_token`/`expires_at` se reutiliza para ambos TTL (1h/24h), sin nueva migración |
| `apps/api/migrations/versions/021_fix_consents_rls.py` | sin cambios (ya aplicada) |
| `apps/api/migrations/versions/022_signatures_celular.py` | `signatures.celular_encrypted`, opcional, sin hash |
| `apps/api/app/services/arco_service.py` | reescrito: búsqueda platform-wide, sesión multi-firma, auto-confirmación, confirmación manual, rectificación de datos personales por lotes de org, export unificado, notificación de cambio al titular |
| `apps/api/app/routers/arco.py` | reescrito bajo `/v1/arco/*` (ya no depende de `campaign_id` en la ruta) |
| `apps/api/app/services/signature_service.py` | `confirm_signature` genera el token de acceso directo (24h) al confirmar y lo pasa al email de agradecimiento |
| `apps/api/app/services/email_service.py` | `send_arco_verification_email` (genérico, no atado a una campaña), `send_arco_org_notification`, `send_arco_deletion_notification`, nueva `send_arco_change_notification`; `send_thanks_share_email` gana el CTA "Gestionar mis datos" |
| `apps/api/tests/test_arco.py` | reescrito para el modelo multi-campaña |

### Frontend (requiere Claude Design — hecho en sesión 30, ver abajo)
| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/(campaign)/components/ActionBlock.tsx` | addition menor: botón secundario "¿Ya firmaste? Accedé a tus datos" (componente ya implementado, no pantalla nueva — mismo criterio que `supresion-admin`) |
| `apps/web/src/app/mis-datos/page.tsx` | nuevo: formulario de solicitud |
| `apps/web/src/app/mis-datos/portal/page.tsx` | nuevo: portal multi-campaña (3 niveles) |
| `specs/derechos-arco/design-export.html` | diseño aprobado sesión 30 (7 frames: landing addition, formulario, confirmación genérica, verificando, enlace inválido, portal multi-nivel, modal de supresión) |

## Seguridad

- Rate limit estricto en request-access (3/hora por IP) + Turnstile (R4).
- Anti-enumeración en TODAS las respuestas públicas, incluida firma
  anonimizada y "sin ninguna coincidencia" (R2, R12).
- Token de verificación almacenado hasheado (HMAC) en DB, anclado a una sola
  fila por la restricción `UNIQUE`; comparación por hash.
- Sesión de portal: JWT firmado, scope limitado a los `signature_ids`
  verificados en ese momento; no es JWT de admin (`typ` distinto).
- Auditoría sin PII: solo `email_hash` (R10).
- Notificación de cambio al titular (R18) como capa adicional de detección
  de uso no autorizado de un enlace/sesión comprometidos.

## LOPDP

- Implementa derechos de los titulares (acceso, rectificación, eliminación,
  oposición, portabilidad) con plazos autoejecutados (< 15 días trivially).
- El alcance platform-wide es coherente con el rol Encargado: la plataforma
  procesa PII para múltiples Responsables, y el derecho de acceso/portabilidad
  del titular abarca razonablemente todo lo que el Encargado procesa sobre
  él, no solo una campaña aislada.
- Rol Encargado: la plataforma ejecuta y notifica al Responsable (R11) por
  cada campaña afectada; el contrato de encargo debe reflejar este flujo
  delegado.
- `arco_requests` = evidencia de cumplimiento ante SPDP.
- Texto del aviso de privacidad (lopdp-base) debe enlazar `/mis-datos` como
  canal de ejercicio.

## Dependencias

- **Requiere retencion-datos** (reutiliza `anonymize_signature`) — implementada.
- Compatible con cifrado-reposo (acceso/portabilidad descifran vía `decrypt_pii`).
- Frontend: diseño aprobado en sesión 30 (`design-export.html`), pendiente de
  implementación (T13-T14).
