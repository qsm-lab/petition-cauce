# Tasks — derechos-arco

> Dependencias: retencion-datos (anonymize_signature) y cifrado-reposo (decrypt_pii)
> ya implementadas. Frontend requiere Claude Design aprobado (hecho sesión 30).
>
> **Sesión 30 — reescritura multi-campaña**: el alcance original (T1-T18, acotado a
> una campaña) se implementó, verificó y luego se amplió a un modelo platform-wide
> a pedido del usuario (ver requirements.md/design.md). Las tareas de esta sección
> reflejan el estado final; el historial completo de la primera pasada queda en
> `progress/history.md`.

## Backend — modelos y migración

- [x] **T1** Modelo `ArcoRequest` (ya existía, migración `019`) + migración
      `020_arco_verification.py` (`arco_verification_token`/`expires_at` en
      `signatures`, reutilizado para ambos TTL: 1h bajo demanda y 24h acceso
      directo) (R10, R1b, R15)
- [x] **T1b** Migración `021_fix_consents_rls.py`: bug preexistente de RLS en
      `consents_org_admin` (le faltaba el guard `NULLIF` que `sig_org_admin` ya
      tenía desde la `008`) — expuesto por el flujo de portal ARCO

## Backend — servicio (`arco_service.py`)

- [x] **T2** `request_access(db, email, cedula, origin_campaign_id=None)`: búsqueda
      platform-wide, token anclado a una sola fila (constraint `UNIQUE`), preferencia
      por la campaña de origen; auditoría por cada campaña encontrada; sin auditoría
      si no hay ninguna coincidencia (R1, R1b, R2, R3, R10)
- [x] **T3** `verify_token(db, token, origin_campaign_id_hint=None)`: un solo uso,
      re-consulta el conjunto vigente de firmas por email_hash+cedula_hash, emite
      JWT de sesión de portal (30 min) con la lista completa de `signature_ids` (R3, R1b)
- [x] **T3b** Auto-confirmación de firmas `pending_confirmation` en campañas aún
      firmables, como parte de `verify_token` (R1c)
- [x] **T4** `get_subject_data(...)`: datos personales + lista de campañas con
      cédula enmascarada, consentimiento, `is_origin`, `signable`,
      `just_auto_confirmed` (R5, R17)
- [x] **T5a** `rectify_personal_data(...)`: nombre/email/cédula/celular aplicados a
      TODAS las firmas no anonimizadas de la persona en una sola operación;
      trazabilidad sin PII (`fields_changed`, no valores) (R6a)
- [x] **T5a-2** Email/cédula: detección de choque por campaña (`_has_collision`,
      replica los índices únicos `uq_sig_email_*`/`uq_sig_cedula_natural`) —
      aplica donde se puede, reporta conflictos; reenvío de confirmación al
      correo nuevo si la firma está pendiente; aviso de seguridad al correo
      anterior (sesión 30, a pedido del usuario)
- [x] **T5a-3** Celular opcional (`celular_encrypted`, migración `022`) — cifrado,
      sin hash, enmascarado en Acceso/export igual que cédula; siempre editable,
      incluso en campañas cerradas
- [x] **T5a-4** Congelamiento por cierre: nombre/email/cédula se saltan (con
      conflicto `reason="campana_cerrada"`) si la campaña de esa firma ya no es
      firmable — decisión final de sesión 30 (R6a)
- [x] **T5b** `set_visibility(...)`: por campaña, con invariante de nombre solo en
      visibilidad pública — siempre editable (R6b)
- [x] **T5c** `update_campaign_profile(...)` (nuevo): tipo de firmante/ubicación
      por campaña, editables solo si `pending_confirmation` + campaña firmable;
      provincia/país por campaña, siempre editables (R6b)
- [x] **T6** `oppose(...)`: toggles `notify_updates`/`subscribe_newsletter` en
      `Consent`, por campaña (R8)
- [x] **T6b** `confirm_pending(...)`: confirmación manual por campaña, solo si
      `pending_confirmation` y campaña firmable (R14)
- [x] **T7** `export_data(...)`: JSON/CSV unificado con todas las campañas de la
      sesión, on-demand, sin persistir archivo (R9)
- [x] **T8** `delete_subject(...)`: anonimización inmediata por campaña vía
      `retention_service.anonymize_signature`; no afecta otras campañas (R7)
- [x] **T9** Registro en `arco_requests` en cada operación con campaña conocida,
      solo `email_hash` (R10)
- [x] **T10** `email_service`: `send_arco_verification_email` (genérico,
      platform-wide), `send_arco_org_notification`, `send_arco_deletion_notification`,
      `send_arco_change_notification` (nuevo, R18); `send_thanks_share_email` gana
      el CTA de acceso directo (R15)
- [x] **T10b** `signature_service.confirm_signature` emite el token de acceso
      directo (24h) al confirmar y lo pasa al email de agradecimiento (R15)
- [x] **T10c** `signature_service.create_signature` emite un segundo token de
      revisión (24h) al firmar; `send_confirmation_email` gana el resumen de
      datos ingresados + enlace secundario "Corregir mis datos" (R19)
- [x] **T10d** `form_config.request_celular` (toggle por campaña, default
      `false`) — celular pasa a poder capturarse también en el alta original,
      no solo vía ARCO; `SignatureCreate`/`create_signature` lo aceptan (R20)

## Backend — router

- [x] **T11** `routers/arco.py` bajo `/v1/arco/*` (ya no depende de `campaign_id`
      en la ruta): request-access, verify, data, personal-data, visibility,
      campaign-profile, oppose, confirm, export, subject — Turnstile + rate limit
      3/h en `request-access`; respuesta genérica uniforme (R2, R4, R12)

## Frontend

- [x] **T12** Diseño en `specs/derechos-arco/design-export.html` — aprobado sesión
      30 tras varias rondas de ajuste: botón de acceso en landing (Frame 0) +
      email de confirmación con revisión (Frame 0b), formulario + confirmación
      genérica (Frames 1-2), verificando/enlace inválido (Frames 3-4), portal en
      3 niveles con selector de campaña y perfil por campaña (Frame 5), modal de
      supresión por campaña (Frame 6)
- [x] **T13b** Link en `RecentSignatures.tsx` (landing ya implementada, movido
      desde `ActionBlock.tsx` a pedido del usuario): "¿Ya firmaste? Accedé a tus
      datos" → `/mis-datos?campaign={id}` (R16)
- [x] **T13c** Toggle "Solicitar celular" en `CampanaEditorClient.tsx`, panel
      "Configuración formulario" (R20)
- [ ] **T13** Página `/mis-datos`: formulario email+cédula+Turnstile (Frames 1-2)
- [ ] **T14** Portal `/mis-datos/portal`: verificación (Frames 3-4) + 3 niveles
      (datos personales/descarga compartidos, selector de campaña, tarjeta
      unificada con confirmación manual/tipo de firmante/ubicación/visibilidad/
      oposición/supresión) (Frame 5) + modal de supresión (Frame 6)

## Tests (R13)

- [x] **T15** Anti-enumeración: sin coincidencia no audita; firma anonimizada deja
      de coincidir (email_hash/cedula_hash cambiados)
- [x] **T16** Token: ancla única (constraint `UNIQUE`), expiración 1h, un solo uso,
      re-consulta del conjunto vigente, sesión de portal 30 min
- [x] **T16b** Auto-confirmación condicionada al estado de campaña (firmable vs
      cerrada) + confirmación manual (acepta/rechaza según estado)
- [x] **T17** Cada derecho multi-campaña: datos personales aplicados a todas las
      firmas con trazabilidad sin PII; visibilidad/oposición/supresión aisladas por
      campaña (una acción no afecta a las demás); portabilidad unificada
- [x] **T18** Auditoría sin PII + rate limiting activo (verificado vía HTTP real)

42 tests en `test_arco.py`, 109 tests API en total — todos en verde. Verificación
manual end-to-end vía HTTP con 3 campañas de prueba (activa+confirmada,
activa+pendiente, cerrada+pendiente) para el mismo email+cédula — datos limpiados.
`tsc --noEmit` sin errores en el frontend tras el wiring de celular y el link
movido en `RecentSignatures.tsx`.
