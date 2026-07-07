# Requirements — retencion-datos

## Contexto

`privacy_config.retention_days` (default 365) ya existe por campaña pero nada lo
ejecuta. LOPDP exige limitar la conservación al plazo declarado en el aviso de
privacidad. Este job purga/anonimiza PII de firmantes cuando expira el plazo.

## Requisitos

- **R1** El sistema DEBERÁ ejecutar un job de retención programado (diario) que evalúe todas las campañas con firmas no anonimizadas.
- **R2** El plazo de retención de una firma DEBERÁ contarse desde la fecha del evento de ciclo de vida `entrega` de su campaña; SI la campaña no ha llegado a `entrega`, ENTONCES el plazo se cuenta desde `created_at` de la firma.
- **R3** CUANDO una firma supere `retention_days` de su campaña, el sistema DEBERÁ anonimizarla: `name`, `org_name`, `email_encrypted`, `cedula_encrypted`, `email_hash`, `cedula_hash`, `org_name_hash`, `ip_hmac`, `confirmation_token` puestos a NULL o tombstone, y `anonymized_at` con timestamp.
- **R4** La anonimización DEBERÁ preservar los campos agregables no identificantes: `status`, `visibility`, `provincia`, `country`, `signer_type`, `created_at`, `confirmed_at` — el conteo histórico de la campaña no cambia.
- **R5** El sistema DEBERÁ conservar el registro de `consents` (prueba del consentimiento otorgado) pero anonimizar su `ip_hmac`.
- **R6** El job DEBERÁ registrar cada corrida en una tabla de auditoría: timestamp, campañas evaluadas, firmas anonimizadas por campaña; NUNCA registrar PII.
- **R7** El job DEBERÁ ser idempotente: firmas ya anonimizadas (`anonymized_at IS NOT NULL`) se excluyen.
- **R8** SI dos instancias del job coinciden, ENTONCES un lock (Redis) DEBERÁ garantizar ejecución única.
- **R9** El sistema DEBERÁ exponer al admin (rol `admin`) un endpoint de ejecución manual del job (`POST /v1/admin/retention/run`) para pruebas y corridas bajo demanda.
- **R10** Las firmas anonimizadas DEBERÁN quedar excluidas de: feed público de recientes (ya filtra por `visibility` + `name`), export CSV con PII, y notificaciones a firmantes.
- **R11** Los tests DEBERÁN cubrir: cálculo de fecha ancla (con y sin evento `entrega`), anonimización completa de campos, idempotencia, preservación de conteos y registro de auditoría.

## Fuera de alcance

- Borrado físico de filas (se preserva la fila anonimizada para estadística histórica).
- Retención de backups del VPS (operativo, documentar en runbook).
- Supresión a pedido del titular (eso es derechos-arco).
