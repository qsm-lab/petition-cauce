# Diseño técnico — modelo-base
> Fecha: 2026-06-29

---

## Archivos afectados

### Nuevos
| Archivo | Descripción |
|---------|-------------|
| `apps/api/migrations/versions/006_modelo_base.py` | Migración Alembic única |
| `apps/api/app/models/signature.py` | Modelo SQLAlchemy `Signature` |
| `apps/api/app/models/consent.py` | Modelo SQLAlchemy `Consent` |
| `apps/api/app/models/privacy_config.py` | Modelo SQLAlchemy `PrivacyConfig` |
| `apps/api/app/models/lifecycle_event.py` | Modelo SQLAlchemy `LifecycleEvent` |
| `apps/api/app/models/domain.py` | Modelo SQLAlchemy `Domain` |

### Modificados
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/models/campaign.py` | Añadir campos de petición + relaciones nuevas |
| `apps/api/app/models/user.py` | Añadir `status`, `archived_at`, `archived_by` |
| `apps/api/app/models/organization.py` | Añadir `domain`, `rep_name`, `status`, `archived_at`, `archived_by` |
| `apps/api/app/models/__init__.py` | Exportar modelos nuevos |
| `apps/api/app/scripts/seed_dev.py` | Añadir `processing_contract_id` y semillas de prueba |

---

## Decisiones de diseño

### 1. `processing_contract_id` como TEXT externo
El contrato de encargo LOPDP entre Cauce Petition (Encargado) y la organización Responsable se gestiona fuera del sistema (PDF firmado, número de registro). La columna almacena solo el identificador de referencia, no el documento. Es NOT NULL — **sin contrato, sin campaña**.

### 2. PII — estrategia de doble columna
Para cada campo PII sensible (email, cédula) se mantienen dos columnas:
- `*_encrypted` — valor cifrado (en dev: base64 del valor plano como placeholder; cifrado real en Fase 3 con `cifrado-reposo`)
- `*_hash` — HMAC-SHA256(valor_normalizado, HMAC_SECRET_KEY) para deduplicación sin acceder a PII

La normalización antes de calcular el hash:
- Email: `lower(strip(email))`
- Cédula: `strip(cedula)` (solo dígitos)

El `email_encrypted` en dev usará `base64(email)` para que las pruebas sean posibles sin cifrado real. El `HMAC_SECRET_KEY` es obligatorio al arrancar (ya verificado en `config.py`).

### 3. IP como HMAC — nunca texto plano
`ip_hmac = HMAC-SHA256(ip_address, HMAC_SECRET_KEY)`. No se almacena la IP real en ninguna columna. Consistente con el patrón heredado de forms-qsm (`ip_hash`).

### 4. Visibility y su efecto en la presentación pública
| Valor | Feed público | Conteo oficial |
|-------|-------------|----------------|
| `publica` | Nombre + provincia visible | ✅ |
| `anonima` | "Anónimo" | ✅ |
| `secreta` | No aparece | ✅ |

La política RLS pública filtra: `status = 'confirmed' AND visibility IN ('publica', 'anonima')`. Las firmas secretas solo las ve el admin/gestor autenticado.

### 5. Double opt-in via `confirmation_token`
- Al firmar: `status = 'pending_confirmation'`, `confirmation_token = secrets.token_urlsafe(32)`, `expires_at = now() + 24h`
- Al confirmar email: `status = 'confirmed'`, token se nulifica
- El conteo público (`count_signatures`) solo suma `status = 'confirmed'`

### 6. RLS desde la migración inicial
El patrón heredado de 004_rls.py aplica: `current_setting('app.current_org_id', true)`. Los nuevos modelos siguen el mismo patrón. La migración habilita RLS y crea las políticas en el mismo `upgrade()`.

### 7. `lifecycle_stage` denormalizado en `campaigns`
`campaigns.lifecycle_stage SMALLINT DEFAULT 0` se actualiza cuando se inserta un `lifecycle_event`. Es redundante pero evita un JOIN en la landing pública. La fuente de verdad es `lifecycle_events`; el campo en `campaigns` es una copia de conveniencia.

### 8. Una sola migración (006)
Todas las extensiones van en un solo archivo `006_modelo_base.py` para garantizar atomicidad. Si falla, nada queda a medias. Operación idempotente vía `IF NOT EXISTS` donde aplica.

### 9. `domains` — solo estructura
La lógica de ruteo por Host header se implementa en `multidominio` (Fase 1). Esta migración solo crea la tabla vacía.

### 10. Campos sin implementar en esta fase
Los campos `*_encrypted` no estarán cifrados hasta `cifrado-reposo` (Fase 3). Esta decisión está documentada y es intencional — las columnas están diseñadas para el cifrado desde el inicio.

---

## Seguridad

| Aspecto | Decisión |
|---------|----------|
| PII email | `email_encrypted` (placeholder dev) + `email_hash` HMAC |
| PII cédula | `cedula_encrypted` (placeholder dev) + `cedula_hash` HMAC |
| IP | `ip_hmac` HMAC-SHA256 — nunca texto plano |
| RLS | `signatures` y `consents` con aislamiento por `org_id` desde migración |
| Soft-delete | `archived_at` en campaigns, organizations, users — no hay DELETE en negocio |
| Consentimiento | `text_snapshot` en `consents` preserva el texto exacto presentado al firmante |

---

## LOPDP — análisis de datos personales

### Base de legitimación
`consents.legal_basis = 'consentimiento_expreso'` (Art. 7 LOPDP) para todas las firmas. El titular otorga consentimiento explícito y específico al firmar.

### Datos tratados
| Campo | Clasificación | Propósito |
|-------|--------------|-----------|
| `name` | Dato personal | Identificación en expediente para autoridad |
| `email_encrypted` | Dato personal | Verificación double opt-in + comunicación |
| `cedula_encrypted` | Dato personal sensible (identificador único) | Autenticidad del firmante |
| `provincia` | Dato personal | Análisis territorial para expediente |
| `ip_hmac` | Pseudónimo | Anti-fraude, solo hash |

### Flujo de derechos ARCO
- Implementados en Fase 3 (`derechos-arco`)
- Esta migración diseña las columnas previendo la supresión: `status = 'anulada'` + `anulada_at` + datos enmascarados

### Retención
`privacy_config.retention_days` define el plazo por campaña. El job de purga/anonimización se implementa en `retencion-datos` (Fase 3). La columna está disponible desde esta migración.

### `processing_contract_id`
Obligatorio. Referencia el contrato de encargo entre Cauce Petition y la organización Responsable, conforme Art. 26 LOPDP.
