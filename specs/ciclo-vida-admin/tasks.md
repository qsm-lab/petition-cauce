# Tasks — ciclo-vida-admin

## Backend — Modelos y schemas

- [ ] **T1** Agregar `LifecycleEventOut` schema en `campaign.py`:
  `id`, `stage`, `stage_index`, `notes`, `registered_at`, `registered_by` (R3, R4)

- [ ] **T2** Agregar `LifecycleStageUpdate` schema: `stage: int` (ge=0, le=4),
  `notes: str | None` (max_length=500), `notify_org: bool = False` (R1, R2, R13)

- [ ] **T3** Agregar `NotifySignersRequest` schema: `message: str` (min=1,
  max_length=1000) (R14, R15)

- [ ] **T4** Extender serialización admin de campaña con `lifecycle_stage: int`
  y `lifecycle_events: list[LifecycleEventOut]` — máx. 20 más recientes (R10)

---

## Backend — Config y email

- [ ] **T5** Agregar `platform_admin_emails: str = ""` en `config.py`; parsear
  como lista al usar (`[e.strip() for e in v.split(",") if e.strip()]`) (R12)

- [ ] **T6** `send_lifecycle_admin_notification(campaign_title, org_name, old_stage,
  new_stage, notes, changed_by_email)` en `email_service.py`: fire-and-forget a
  `PLATFORM_ADMIN_EMAILS`; no-op si lista vacía o `resend_api_key` vacío (R12)

- [ ] **T7** `send_lifecycle_org_notification(to_email, campaign_title, new_stage,
  notes)` en `email_service.py`: fire-and-forget a `org.contact_email`;
  no-op si email nulo (R13)

- [ ] **T8** `send_lifecycle_signer_notification(db, campaign_id, campaign_title,
  message)` en `email_service.py`: consulta `consents` donde `notify_updates=true`
  y `campaign_id`, envía individualmente (no BCC masivo); retorna `sent_count` (R15)

---

## Backend — Migración

- [ ] **T9** Migración `014_consents_notify_updates.py`: agregar columna
  `notify_updates BOOLEAN NOT NULL DEFAULT false` a tabla `consents` (R15)

---

## Backend — Servicio y endpoints

- [ ] **T10** `campaign_service.update_lifecycle_stage(db, campaign, new_stage, notes,
  user_id, notify_org, org)`: actualiza `campaign.lifecycle_stage`, crea
  `LifecycleEvent`, commit; llama `send_lifecycle_admin_notification` y
  condicionalmente `send_lifecycle_org_notification`; retorna evento + lista de
  notificaciones enviadas (R3, R5, R7, R12, R13)

- [ ] **T11** `PATCH /v1/campaigns/{id}/lifecycle`: valida campaña no archivada (409),
  llama al service, responde `{ lifecycle_stage, event, notifications_sent }` (R6, R7)

- [ ] **T12** `POST /v1/campaigns/{id}/lifecycle/notify-signers`: valida campaña no
  archivada (409), llama `send_lifecycle_signer_notification`, responde
  `{ sent_count }` (R14, R15)

---

## Frontend — Tipos y API

- [ ] **T13** Agregar a `AdminCampaign` en `admin-campaigns-api.ts`:
  `lifecycle_stage: number` y `lifecycle_events: LifecycleEventOut[]`;
  definir tipo `LifecycleEventOut` (R10)

- [ ] **T14** Función `advanceLifecycleStage(campaignId, stage, notes, notifyOrg)` →
  `PATCH /v1/campaigns/{id}/lifecycle` (R1, R2, R13)

- [ ] **T15** Función `notifySigners(campaignId, message)` →
  `POST /v1/campaigns/{id}/lifecycle/notify-signers`; retorna `{ sent_count }` (R14)

---

## Frontend — Componentes

- [ ] **T16** `LifecycleConfirmModal.tsx`: muestra etapa actual → nueva, nota, checkbox
  "Notificar a [org name]" (desmarcado por defecto; deshabilitado si org sin email con
  tooltip), botones Cancelar / Confirmar (R11, R13)

- [ ] **T17** `LifecyclePanelAdmin.tsx`: indicador visual 5 etapas Tailwind
  (Lime/Ink para actual, gris atenuado para futuras, check para pasadas) (R8)

- [ ] **T18** En `LifecyclePanelAdmin`: 5 botones de selección de etapa destino;
  textarea nota; botón "Confirmar cambio" → abre `LifecycleConfirmModal`;
  deshabilitado si etapa === actual (R1, R9, R11)

- [ ] **T19** En `LifecyclePanelAdmin`: historial de eventos (fecha, etapa anterior →
  nueva, nota, usuario); orden descendente (R4)

- [ ] **T20** En `LifecyclePanelAdmin`: botón secundario "Notificar a firmantes" → abre
  modal con textarea de mensaje personalizable; muestra `sent_count` o
  "Sin firmantes suscritos" si 0 (R14, R15, R16)

- [ ] **T21** Integrar `<LifecyclePanelAdmin>` en `CampanaEditorClient.tsx`: visible
  solo en modo edición (`!isNew`), en sidebar bajo el panel de estado (R8)
