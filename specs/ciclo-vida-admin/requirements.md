# Requirements — ciclo-vida-admin

## Contexto
Panel admin para gestionar el ciclo de vida de una campaña. Permite avanzar etapas,
registrar notas y ver el historial de cambios. La vista pública (`ciclo-vida-basico`)
ya consume `lifecycle_stage` desde el endpoint público — al cambiar aquí se refleja
inmediatamente allí.

Etapas (índice 0–4): Lanzada → Recolección → Entrega → Diálogo → Decisión.

---

## Requisitos

**R1** — El admin puede establecer cualquier etapa del ciclo de vida (0–4) desde el
panel de edición de campaña. No se restringe avance estrictamente secuencial para
permitir correcciones.

**R2** — Al cambiar de etapa, el admin puede ingresar una nota opcional (máx. 500
caracteres) que queda registrada en `lifecycle_events`.

**R3** — Cada cambio de etapa genera un registro en `lifecycle_events` con: `stage`
(nombre string), `stage_index` (0–4), `notes`, `registered_at`, `registered_by`
(user UUID del admin autenticado).

**R4** — El historial de eventos es visible en el panel: fecha, etapa anterior → nueva,
usuario, nota. Orden descendente (más reciente primero).

**R5** — El cambio de `lifecycle_stage` en la campaña es inmediato y se refleja en la
landing pública sin necesidad de republicar.

**R6** — Solo usuarios autenticados con `org_id` propietario de la campaña pueden
modificar el ciclo de vida (misma guarda que el resto del editor).

**R7** — No se puede modificar el ciclo de vida de una campaña con `archived_at IS NOT
NULL`. El endpoint responde 409 si se intenta.

**R8** — El panel muestra visualmente la etapa actual usando el mismo esquema de colores
del design system (Lime/Ink para activa, gris atenuado para futuras, check para pasadas).

**R9** — Si el admin selecciona la etapa que ya está activa, el botón de confirmar
permanece deshabilitado.

**R10** — `AdminCampaign` incluye `lifecycle_stage: number` y `lifecycle_events:
LifecycleEventOut[]` para que el editor cargue el estado actual e historial sin llamada
extra.

---

## Notificaciones

**R11** — Al hacer clic en "Confirmar cambio" se abre un modal de confirmación que
muestra: etapa actual → nueva etapa, nota ingresada, y un checkbox
"Notificar a [nombre de la organización]" (desmarcado por defecto). Solo al confirmar
en ese modal se ejecuta el cambio de etapa.

**R12** — Al confirmar el cambio, el sistema siempre envía una notificación interna
por email a los admins de plataforma (dirección(es) configuradas en
`PLATFORM_ADMIN_EMAILS`), con: nombre de campaña, etapa anterior, etapa nueva, nota,
y usuario que realizó el cambio.

**R13** — Si en el modal el checkbox "Notificar a organización" está marcado y la
organización tiene `contact_email` registrado, se envía email a ese contacto con:
nombre de campaña, etapa nueva y nota. Si no tiene `contact_email`, el checkbox aparece
deshabilitado con tooltip "La organización no tiene email de contacto registrado".

**R14** — Existe una acción secundaria manual e independiente en el panel:
"Notificar a firmantes". Se activa por botón separado del flujo de cambio de etapa, y
solo puede ejecutarla el admin o gestor de la campaña cuando lo considere necesario.

**R15** — La notificación a firmantes se envía únicamente a quienes tengan
`notify_updates = true` en su registro de consentimiento. El mensaje incluye el nombre
de la campaña, la etapa actual y un campo de mensaje personalizable por el admin.
Si ningún firmante tiene `notify_updates = true`, el botón muestra "Sin firmantes
suscritos" y permanece deshabilitado.

**R16** — El panel muestra feedback tras cada acción de notificación: número de emails
enviados o error si Resend falla.
