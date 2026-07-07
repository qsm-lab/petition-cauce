# Requirements — supresion-admin

## Contexto

Un firmante puede solicitar la eliminación de sus datos por canales no
digitales (email a la organización, verbalmente en territorio). El admin
necesita ejecutar esa supresión desde el dashboard de firmas. Decisión de
producto (sesión 24): **ventana de gracia de 15 días** — la firma se archiva,
se notifica al titular, y un job purga la PII al día 15; reversible dentro de
la ventana. La firma sigue cuantificándose en la campaña para siempre (fila
anonimizada conserva `campaign_id` y `status`).

Complementa a `derechos-arco` (canal self-service) y reutiliza el mecanismo de
anonimización de `retencion-datos` — un solo mecanismo, tres disparadores.

## Requisitos

### Archivar
- **R1** El dashboard de firmas DEBERÁ ofrecer una acción "Archivar" por fila, disponible para firmas no archivadas ni anonimizadas, protegida por confirmación en dos pasos que explique: notificación al firmante, purga a los 15 días, la firma seguirá contando de forma anónima.
- **R2** CUANDO el admin confirme, el sistema DEBERÁ marcar la firma con `archived_at`, `archived_by` (admin) y `purge_after = now() + 15 días`, SIN cambiar su `status` (una firma confirmada sigue contando durante la ventana y después de la purga).
- **R3** Al archivar, el sistema DEBERÁ enviar un email al firmante informando: sus datos quedaron archivados a su solicitud, serán eliminados definitivamente el [fecha], su apoyo seguirá contando de forma anónima, y cómo contactar si desea revertir.
- **R4** El archivado DEBERÁ registrarse en la auditoría ARCO (`arco_requests`, right_type `supresion`, detail `{trigger: "admin", admin_id}`) — solo `email_hash`, nunca PII.

### Ventana y reversión
- **R5** MIENTRAS la firma esté en ventana (archivada, no purgada), el dashboard DEBERÁ mostrar badge "Archivada — purga el [fecha]" y ofrecer la acción "Restaurar".
- **R6** CUANDO el admin restaure dentro de la ventana, el sistema DEBERÁ limpiar `archived_at`/`purge_after`, registrar la reversión en auditoría y (opcional en la misma operación) notificar al firmante.
- **R7** Las firmas archivadas DEBERÁN excluirse de: export CSV con datos, notificaciones a firmantes y feed público de recientes, desde el momento del archivado (no esperar la purga).

### Purga
- **R8** Un job diario DEBERÁ anonimizar las firmas con `purge_after <= now()` y `anonymized_at IS NULL`, usando `retention_service.anonymize_signature` (PII → NULL/tombstone, fila y conteo intactos), y registrar la corrida en auditoría.
- **R9** Tras la purga, el dashboard DEBERÁ mostrar la fila con badge "Suprimida" (nombre "—"), y el conteo de la campaña NO DEBERÁ cambiar, incluso con la campaña terminada o archivada.
- **R10** La purga DEBERÁ ser idempotente y NO DEBERÁ intentar notificar al firmante (su email ya no existe en el sistema; la notificación fue R3).

### Tests
- **R11** Los tests DEBERÁN cubrir: archivar (columnas + email + auditoría), exclusiones R7, restaurar dentro de ventana, purga al vencer (PII eliminada, conteo intacto), idempotencia, y permisos (solo rol admin, 401/403).

## Fuera de alcance

- Solicitud self-service del titular (es `derechos-arco`).
- Anulación de firma (invalidar el conteo por fraude) — acción distinta, pendiente de diseño propio.
- Purga por política de retención de campaña (es `retencion-datos`).
