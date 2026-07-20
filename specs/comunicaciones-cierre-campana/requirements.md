# Requirements — comunicaciones-cierre-campana

## Contexto

La campaña real `soberania-tlc-ecu-usa` cierra hoy. El cierre (`status="closed"`)
ya deshabilita firma y compartir en el landing (implementado en sesión 31, sin
cambios en esta spec). Falta la comunicación a los firmantes alrededor del
cierre: invitar al evento de entrega física ante la autoridad, avisar el
resultado final, y ajustar el copy del recordatorio a quienes no confirmaron.

**Hallazgo de esta sesión, relevante para el diseño**: el campo
`Consent.notify_updates` (consentimiento de "recibir novedades") nunca se ha
capturado — no existe ningún checkbox en el flujo de firma que lo setee a
`true`. El checkbox visible en `StepThanks.tsx` ("Suscribirme a novedades de
esta causa") llama a un `onSubscribe` que en `SignFlow.tsx` es un no-op
(`/* TODO: newsletter consent */`). En la práctica, **nadie ha dado ese
consentimiento nunca**, en ninguna campaña. Esto invalida usarlo como filtro
de audiencia para los emails de esta spec — ver R2/R6 y "Fuera de alcance".

Se decidió con el usuario que informar sobre el evento de entrega y el
resultado del cierre es parte del propósito mismo de la petición que la
persona firmó (no una novedad de marketing opcional), por lo que no depende
de ese consentimiento roto.

## Terminología

Se introduce el par **"adhesión"** (término general: toda firma enviada a una
petición) / **"confirmada"** vs **"pendiente de confirmar"** (los dos estados
posibles de una adhesión, según haya completado o no el doble opt-in). Esta
spec solo aplica el término en el copy del email R10; no cambia ninguna otra
pantalla ni el conteo público (ver R11).

## Requisitos

### Email #1 — Invitación al evento de entrega
- **R1** El admin DEBERÁ poder componer y enviar una invitación al evento de
  entrega desde el panel de ciclo de vida de la campaña, con estos campos:
  título del evento (opcional, default "Entrega de la petición"), fecha y
  hora (obligatorio), lugar en texto libre (obligatorio), link de mapa
  (opcional), imagen de branding vía URL (opcional), mensaje adicional
  (opcional).
- **R2** El envío DEBERÁ llegar a las firmas `status='confirmed'` de la
  campaña con `country IS NULL` (nacionales). No se filtra por
  `notify_updates` (ver Contexto).
- **R3** El email DEBERÁ mostrar de forma destacada fecha/hora y lugar; SI se
  completó el link de mapa, DEBERÁ mostrar un botón "Ver ubicación"; SI se
  completó la imagen, DEBERÁ mostrarse como banner superior.
- **R4** El envío NO DEBERÁ persistir los datos del evento como configuración
  de la campaña (acción puntual, sin migraciones nuevas) — mismo patrón que
  el "Notificar a firmantes" ya existente.

### Email #2 — Aviso de cierre de campaña
- **R5** El admin DEBERÁ poder disparar el aviso de cierre como acción manual
  independiente del cambio de `status` (NO se envía automáticamente al hacer
  PATCH `/status` a `closed`) — evita envíos accidentales si el admin
  prueba/revierte el status.
- **R6** El envío DEBERÁ llegar a TODAS las firmas `status='confirmed'` de la
  campaña, sin filtrar por país ni por `notify_updates`.
- **R7** El email DEBERÁ incluir: aviso de que la campaña cerró, el conteo
  final de firmas (mismo número que el contador público del landing —
  `campaign.signature_count`), y los enlaces de `campaign.social_links` que
  tengan valor cargado (website, newsletter, instagram, facebook, tiktok,
  whatsapp) — omitiendo los que estén vacíos.
- **R8** Antes de confirmar el envío, el admin DEBERÁ ver un preview del
  conteo final y la cantidad de destinatarios, dado que es una acción masiva
  e irreversible.

### Email #3 — Recordatorio a pendientes (copy)
- **R9** El mecanismo existente (`POST
  /campaigns/{id}/signatures/remind-pending`, botón "Recordar a pendientes")
  NO cambia de audiencia ni de lógica — sigue limitado a
  `visibility='publica'` + `pending_confirmation` (gap ya documentado en
  `remediacion-nombres-incompletos`, fuera de esta spec).
- **R10** El copy del email DEBERÁ actualizarse para aclarar que la adhesión
  del firmante ya cuenta para la petición aunque no haya confirmado, a la vez
  que sigue invitando a confirmar. Usa la terminología "adhesión" /
  "confirmada" / "pendiente de confirmar".
- **R11** El cambio de copy NO DEBERÁ tocar el email de confirmación original
  (el que se manda al momento de firmar) — se crea una función de email
  separada para no alterar ese flujo ya probado en producción.

### Fuera de alcance (explícito)
- **R12** NO se cablea el checkbox de `StepThanks.tsx` ni se empieza a
  capturar `notify_updates` de verdad — es alcance de una spec futura sobre
  `embudo-post-firma`/`novedades-campana` (ambas `pending` en el backlog),
  con su propio análisis de consentimiento independiente.
- **R13** NO se construye el bloque de redirección en el landing público
  (link al sitio del organizador + redes/newsletter renderizados cuando
  `status='closed'`) ni el newsletter de plataforma (captura nueva,
  reusable entre campañas) — quedan para una spec separada, sin apuro de
  hoy.
- **R14** NO cambia qué cuenta el contador público de firmas en el landing
  (sigue siendo solo `confirmed`, como hoy).

### UI — botón único con vista previa y envío de prueba
- **R19** El admin DEBERÁ acceder a la invitación al evento y al aviso de
  cierre desde un único botón "Comunicaciones de cierre" en el panel de
  ciclo de vida, que abre un popup con una pestaña por email. "Notificar a
  firmantes" (genérico) y "Recordar a pendientes" (dashboard de firmas)
  NO se combinan en este popup — siguen donde están hoy.
- **R20** Para cada uno de los 2 emails, el admin DEBERÁ poder generar una
  vista previa del HTML exacto que se enviaría (mismo render del backend,
  no una aproximación en el frontend) antes de cualquier envío real.
- **R21** El admin DEBERÁ poder enviar el email a una o más direcciones de
  prueba (campo abierto, agrega múltiples) usando el mismo contenido que se
  mandaría a la audiencia real, sin afectar la audiencia real ni contarse
  como el envío masivo.
- **R22** El envío real a la audiencia (nacional/todos según el email)
  DEBERÁ quedar separado del envío de prueba y seguir mostrando el conteo
  de destinatarios antes de confirmarse (R8, extendido también al email de
  invitación al evento).

### Seguridad / acceso
- **R15** Los 4 endpoints nuevos (2 de envío + 2 de vista previa) DEBERÁN
  exigir JWT + rol `admin`/`gestor` + scope de campaña (mismo patrón que
  `notify-signers`/`remind-pending`).
- **R16** Los 2 endpoints de envío DEBERÁN tener rate limiting (slowapi),
  mismo patrón que `remind-pending` (3-5/minuto), dado que son envíos
  masivos disparados por un solo click; los 2 de vista previa (no envían
  nada) pueden tener un límite más laxo o ninguno.

### Tests
- **R17** Tests de servicio para las dos nuevas funciones de audiencia
  (`get_signer_emails_..._nacional_confirmed`, `..._todos_confirmed`):
  verifican el filtro de país y de status, y que excluyen `anulada`.
- **R18** Test de que `remind_pending_signatures` sigue funcionando igual
  (mismo query, mismo endpoint) y que ahora llama a la función de email con
  el nuevo copy.
- **R23** Test de que `test_emails` (cuando viene con datos) redirige el
  envío completo a esas direcciones y NO consulta ni impacta la audiencia
  real (R21); test de que el endpoint de preview devuelve el mismo HTML que
  build_...() usa internamente para el envío real (R20, paridad exacta).
