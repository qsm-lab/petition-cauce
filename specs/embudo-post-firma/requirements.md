# Requirements — embudo-post-firma

## Contexto

Pantalla post-firma (`StepThanks`, paso 4 del `SignFlow`) que, tras registrar
el apoyo, ofrece al firmante (a) compartir la campaña y (b) suscribirse a las
novedades de la campaña. El CTA de compartir **ya existe y funciona**; la
suscripción a novedades **no**: el checkbox "Quiero recibir noticias de esta
campaña" está renderizado pero su callback es un no-op
(`SignFlow.tsx:236 → onSubscribe={() => { /* TODO */ }}`) y el valor nunca se
persiste. Esto configura un **consentimiento aparente sin efecto**: se muestra
al titular una casilla de consentimiento que no produce ningún tratamiento —
problema de cumplimiento LOPDP, no solo una feature incompleta.

El objetivo de esta feature es **cablear ese consentimiento de novedades**
como una base de legitimación independiente de la firma, persistiéndolo en el
flag operativo `Consent.notify_updates`, y dar feedback claro al titular.

## Decisión semántica previa (dos flags existentes)

La tabla `consents` tiene dos booleanos:
- **`notify_updates`** — flag **operativo**: `get_signer_emails_for_notify`
  (`campaign_service.py`) filtra por él quién recibe novedades. El portal ARCO
  (`CampaignCard`) ya lo togglea y permite revocarlo (R8 de derechos-arco).
- **`subscribe_newsletter`** — **sin uso operativo de envío**: ningún filtro de
  destinatarios lo consulta; solo se lee/escribe en el perfil ARCO. Vestigial.

⟹ El checkbox DEBE persistir en **`notify_updates`**. Esta spec no elimina
`subscribe_newsletter` (evita migración de columna); lo deja documentado como
sin uso de envío. Limpieza de esa columna = fuera de alcance.

## Terminología de cara al usuario (sesión 37)

El aviso de privacidad cubre la finalidad. La denominación de producto pasa de
"novedades" a **"Anuncios"**, consistente con `centro-comunicaciones` (clase
"Anuncios"). El **nombre interno del campo `notify_updates` no cambia** (evita
tocar código/consultas existentes); es solo copy/UI. Alcance del renombre:
checkbox de `StepThanks`, textos de esta feature y, cuando se implemente, el
copy del portal ARCO "Novedades de esta campaña" → "Anuncios de esta campaña".

## Requisitos

### Captura del consentimiento
- **R1** CUANDO el firmante marque el checkbox de anuncios en la pantalla
  post-firma, el sistema DEBERÁ persistir `notify_updates = true` en el
  `Consent` asociado a la firma recién creada.
- **R2** CUANDO el firmante desmarque el checkbox tras haberlo marcado, el
  sistema DEBERÁ persistir `notify_updates = false` (el control refleja el
  estado real, no es solo "opt-in de un solo sentido").
- **R3** El checkbox DEBERÁ estar **NO premarcado** por defecto
  (`defaultChecked={false}`, ya cumplido) — consentimiento explícito, nunca
  por omisión.
- **R4** El texto del checkbox DEBERÁ dejar claro que es un consentimiento
  **independiente de la firma** y **revocable** (copy actual ya lo indica:
  "Consentimiento independiente de tu firma · puedo retirarme cuando quiera").

### Autorización del canal post-firma
- **R5** La persistencia del consentimiento post-firma DEBERÁ estar autorizada
  por un secreto efímero ligado a esa firma (no basta el `signature_id`): la
  respuesta de creación de firma DEBERÁ devolver un `newsletter_token` de un
  solo propósito, corta vida y un solo uso lógico, distinto del
  `confirmation_token` (doble opt-in) y del `arco_review_token` (portal ARCO).
- **R6** El endpoint de consentimiento post-firma DEBERÁ estar protegido por
  rate limiting por IP (HMAC, patrón heredado) y NUNCA DEBERÁ revelar PII ni
  el estado de otras firmas del titular.
- **R7** El endpoint DEBERÁ ser idempotente respecto al valor final: reenviar
  el mismo valor no produce error ni efectos adicionales.

### Coherencia con el doble opt-in y el envío real
- **R8** Marcar anuncios sobre una firma `pending_confirmation` DEBERÁ
  registrar el consentimiento, pero el titular NO DEBERÁ recibir anuncios
  hasta que la firma pase a `confirmed` — el filtro de envío ya exige
  `status = confirmed` y `archived_at IS NULL`, y esta feature no lo relaja.
- **R9** El consentimiento capturado aquí DEBERÁ ser revocable por los canales
  ya existentes (portal ARCO `notify_updates`) sin trabajo adicional — no se
  crea un segundo flag ni un segundo registro.

### Feedback al usuario
- **R10** Tras marcar/desmarcar, la UI DEBERÁ dar feedback inmediato del estado
  guardado (p. ej. "Te avisaremos de los anuncios" / "Suscripción cancelada")
  y DEBERÁ manejar el fallo de red sin dejar el checkbox en un estado que
  mienta sobre lo persistido (revertir visualmente si la llamada falla).

### Trazabilidad LOPDP (opt-in after-the-fact)
- **R11** El registro del opt-in DEBERÁ ser auditable en el tiempo: dado que
  `notify_updates` se fija después de crear la fila `consent`, el sistema
  DEBERÁ registrar cuándo se activó (ver design.md — decisión sobre
  `notify_updates_at` vs. reutilizar auditoría existente).

## Fuera de alcance

- Enviar novedades / editor de novedades por campaña → feature `novedades-campana`.
- Mecanismo de desuscripción desde el pie de los emails masivos →
  `email-cumplimiento-masivo`.
- Eliminar la columna `subscribe_newsletter` (requeriría migración; sin uso
  operativo, se deja como está).
- Rediseño de la pantalla post-firma: el checkbox y el CTA de compartir ya
  existen en el diseño implementado.
