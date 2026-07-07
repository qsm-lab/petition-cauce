# Design — ciclo-vida-admin

## Archivos afectados

### Backend

| Archivo | Cambio |
|---------|--------|
| `apps/api/app/schemas/campaign.py` | Agregar `LifecycleStageUpdate`, `LifecycleEventOut`, `NotifySignersRequest`; extender respuesta admin con `lifecycle_stage` y `lifecycle_events` |
| `apps/api/app/services/campaign_service.py` | Nuevo método `update_lifecycle_stage` |
| `apps/api/app/services/email_service.py` | Nuevas funciones: `send_lifecycle_admin_notification`, `send_lifecycle_org_notification`, `send_lifecycle_signer_notification` |
| `apps/api/app/routers/campaigns.py` | Nuevos endpoints: `PATCH /{id}/lifecycle` y `POST /{id}/lifecycle/notify-signers` |
| `apps/api/app/config.py` | Nueva variable `platform_admin_emails: str = ""` (comma-separated) |

### Frontend

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/lib/admin-campaigns-api.ts` | Agregar `lifecycle_stage`, `lifecycle_events` a `AdminCampaign`; nuevos tipos `LifecycleEventOut`, `NotifySignersResult`; funciones `advanceLifecycleStage`, `notifySigners` |
| `apps/web/src/app/admin/campanas/[id]/LifecyclePanelAdmin.tsx` | Nuevo componente principal del panel |
| `apps/web/src/app/admin/campanas/[id]/LifecycleConfirmModal.tsx` | Modal de confirmación con checkbox de notificación a org |
| `apps/web/src/app/admin/campanas/[id]/CampanaEditorClient.tsx` | Integrar `<LifecyclePanelAdmin>` en la sección lateral o como panel dedicado |

---

## Endpoints

```
PATCH /v1/campaigns/{campaign_id}/lifecycle
Authorization: Bearer <JWT>

Body:  { "stage": 2, "notes": "Expediente entregado.", "notify_org": true }
200:   { "lifecycle_stage": 2, "event": { ...LifecycleEventOut }, "notifications_sent": ["admins", "org"] }
409:   campaña archivada
400:   stage fuera de rango 0–4
```

```
POST /v1/campaigns/{campaign_id}/lifecycle/notify-signers
Authorization: Bearer <JWT>

Body:  { "message": "La campaña ha avanzado a la etapa de Entrega..." }
200:   { "sent_count": 42 }
400:   mensaje vacío
409:   campaña archivada
```

---

## Decisiones

### Sin migración
El modelo `LifecycleEvent` y la columna `lifecycle_stage` en `campaigns` ya existen
desde `modelo-base`. Solo falta el endpoint y el servicio.

### Avance libre (no estrictamente secuencial)
R1 permite ir a cualquier etapa (incluido retroceder). El historial registra todos
los cambios para auditoría. Esta flexibilidad evita bloquear al admin ante errores
de etapa.

### `lifecycle_stage` en `CampaignOut` admin
`AdminCampaign` actualmente no incluye `lifecycle_stage`. Se agrega junto con
`lifecycle_events[]` (máx. últimos 20) para que el editor no necesite una llamada
adicional (R10).

### Flujo de confirmación modal (R11)
El botón "Confirmar cambio" en `LifecyclePanelAdmin` no ejecuta el cambio directamente:
abre `LifecycleConfirmModal` que muestra el resumen (etapa actual → nueva, nota) y el
checkbox "Notificar a [org name]". Solo el botón "Confirmar" dentro del modal dispara
el `PATCH`. Esto evita cambios accidentales y es el único punto de disparo de
notificaciones automáticas.

### Notificaciones automáticas en PATCH (R12, R13)
El parámetro `notify_org: bool` llega en el body. El backend siempre notifica a los
admins de plataforma (`PLATFORM_ADMIN_EMAILS`, comma-separated en config); notifica a
`org.contact_email` solo si `notify_org=true` y el campo no es nulo. Ambas
notificaciones son fire-and-forget (error logeado, no falla el 200).

### PLATFORM_ADMIN_EMAILS
Nueva variable de entorno en `config.py`. En dev puede estar vacía (log en lugar de
envío, igual que `resend_api_key` vacío). En producción se configura con el email del
equipo de Cauce.

### Notificación a firmantes: dependencia con `novedades-campana`
R14 y R15 requieren un campo `notify_updates` en consentimientos. La tabla `consents`
ya existe pero no tiene ese campo. Para este spec se agrega la columna
`notify_updates: bool DEFAULT false` en una migración nueva (014). La captura del
opt-in en el formulario de firma es parte de `novedades-campana` / `embudo-post-firma`;
hasta que esa feature esté implementada, el botón "Notificar firmantes" estará activo
pero mostrará "0 firmantes suscritos" en la mayoría de campañas (R15). No se bloquea
la feature de notificación en espera de las otras.

### Componente `LifecyclePanelAdmin`
Panel independiente de `LifecycleSteps.tsx` (que es público/inline-style). El panel
admin usa Tailwind y muestra:
1. Indicador visual de 5 etapas (dots + labels, esquema Lime/Ink del design system)
2. Selector de etapa destino (5 botones)
3. Textarea para nota opcional
4. Botón "Confirmar cambio" → abre `LifecycleConfirmModal` (deshabilitado si etapa === actual)
5. Historial de eventos (fecha, etapa anterior → nueva, nota, usuario)
6. Botón secundario "Notificar a firmantes" → abre modal de mensaje

Se ubica como panel adicional en el sidebar del editor, visible solo en modo edición
(no en modo `isNew`).

### Impacto en landing pública
El endpoint público ya devuelve `lifecycle_stage` desde la fila de campaña. Al hacer
PATCH, el campo se actualiza en la BD; la landing lo refleja en el próximo request
(no hay caché de `lifecycle_stage`).

---

## Seguridad

- `registered_by` se asigna desde `current_user.id` en el backend, nunca desde el body.
- Validación `0 ≤ stage ≤ 4` en schema Pydantic.
- Notificación a firmantes: solo a `consents.notify_updates = true`; sin exponer emails
  entre sí (BCC o envío individual).
- Protegido por JWT + `_get_owned_campaign` (misma guarda del editor).
- Emails de plataforma admin vía variable de entorno, nunca hardcodeados.
