# Diseño técnico — modelo-base
> Fecha: 2026-06-29 (revisado con decisiones del usuario)

---

## Archivos afectados

### Nuevos
| Archivo | Descripción |
|---------|-------------|
| `apps/api/migrations/versions/006_modelo_base.py` | Migración Alembic única (atómica) |
| `apps/api/app/models/processing_contract.py` | Modelo `ProcessingContract` |
| `apps/api/app/models/signature.py` | Modelo `Signature` |
| `apps/api/app/models/consent.py` | Modelo `Consent` |
| `apps/api/app/models/privacy_config.py` | Modelo `PrivacyConfig` |
| `apps/api/app/models/lifecycle_event.py` | Modelo `LifecycleEvent` |
| `apps/api/app/models/domain.py` | Modelo `Domain` |

### Modificados
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/models/campaign.py` | Campos de petición + `signer_type` + relaciones nuevas |
| `apps/api/app/models/user.py` | `status`, `archived_at`, `archived_by` |
| `apps/api/app/models/organization.py` | `domain`, `rep_name`, `status`, `archived_at`, `archived_by` |
| `apps/api/app/models/__init__.py` | Exportar modelos nuevos |
| `apps/api/app/scripts/seed_dev.py` | Semillas para contratos, privacy_config, lifecycle_events |

---

## Decisiones de diseño

### 1. `processing_contracts` — tabla estructurada con ciclo de vida

El contrato de encargo LOPDP no es un simple texto de referencia: tiene un ciclo de vida completo.

**Ciclo:** `borrador → enviado_firma → firmado → (revocado)`

```
processing_contracts
├── id UUID PK
├── org_id UUID FK organizations
├── contract_type VARCHAR(50)          -- 'encargo_tratamiento' | 'dpa' etc.
├── title VARCHAR(500)
├── content_text TEXT                  -- cuerpo del contrato (renderizable a PDF)
├── status VARCHAR(20)                 -- borrador | enviado_firma | firmado | revocado
├── draft_url TEXT NULL                -- URL del PDF sin firma (descargable antes de aceptar)
├── signed_url TEXT NULL               -- URL del PDF firmado con QR incrustado
├── validation_token UUID UNIQUE       -- token que el QR apunta a /contratos/validar/:token
├── signed_at TIMESTAMPTZ NULL         -- una vez no-nulo → registro INMUTABLE (trigger)
├── signed_by_name VARCHAR(255) NULL   -- nombre del firmante legal
├── signed_by_email VARCHAR(255) NULL  -- email del firmante legal
├── email_delivered_at TIMESTAMPTZ NULL
├── created_at TIMESTAMPTZ NOT NULL
└── updated_at TIMESTAMPTZ NOT NULL
```

**Inmutabilidad:** trigger PG bloquea cualquier `UPDATE` cuando `signed_at IS NOT NULL`. Solo `revocado` puede aplicarse sobre un contrato firmado, y solo via función interna auditada.

**`campaigns.processing_contract_id`** pasa de `TEXT` a `UUID NOT NULL FK → processing_contracts`. Sin contrato en estado `firmado`, la campaña no puede publicarse (validación en el servicio, no en la BD).

> **Fuera de scope de modelo-base:** generación del PDF, incrustación del QR, envío por email, endpoint de validación del QR. Eso va en la feature `contratos-lopdp`.

---

### 2. Cédula — verificación antes del hash

La cédula ecuatoriana (10 dígitos, módulo-10) se valida en Python **antes** de calcular cualquier hash. Flujo en el router:

```
input "0102030405"
  → strip() → solo dígitos → 10 chars
  → verificar_cedula_ecuatoriana()   ← HTTPException 422 si inválida
  → HMAC-SHA256(cedula_normalizada, HMAC_SECRET_KEY) → cedula_hash
  → base64(cedula) → cedula_encrypted   ← placeholder dev; AES-256-GCM en Fase 3
```

El mismo patrón aplica a email: `lower(strip(email))` antes del HMAC.

Cédulas que no superan la verificación son rechazadas en el router; nunca llegan a la BD.

---

### 3. Tipos de firmante por campaña

Una campaña puede aceptar:
- **`'natural'`** — solo personas naturales (cédula obligatoria)
- **`'org'`** — solo organizaciones (email institucional como identificador)
- **`'both'`** — ambos tipos

```sql
-- En campaigns:
signer_type VARCHAR(10) NOT NULL DEFAULT 'natural'
  CHECK (signer_type IN ('natural', 'org', 'both'))

-- En signatures:
signer_type    VARCHAR(10) NOT NULL DEFAULT 'natural'
  CHECK (signer_type IN ('natural', 'org'))
org_name       VARCHAR(500) NULL   -- requerido si signer_type = 'org'
org_name_hash  VARCHAR(128) NULL   -- HMAC(lower(strip(org_name)))
```

**Deduplicación mediante índices parciales:**

```sql
-- Personas: un email y una cédula por campaña
CREATE UNIQUE INDEX uq_sig_email_natural
  ON signatures (campaign_id, email_hash)
  WHERE signer_type = 'natural';

CREATE UNIQUE INDEX uq_sig_cedula_natural
  ON signatures (campaign_id, cedula_hash)
  WHERE signer_type = 'natural';

-- Organizaciones: un email institucional o un nombre por campaña
CREATE UNIQUE INDEX uq_sig_email_org
  ON signatures (campaign_id, email_hash)
  WHERE signer_type = 'org';

CREATE UNIQUE INDEX uq_sig_orgname
  ON signatures (campaign_id, org_name_hash)
  WHERE signer_type = 'org' AND org_name_hash IS NOT NULL;
```

Para organizaciones, `cedula_encrypted` y `cedula_hash` pueden quedar nulos (la campaña no los requiere).

---

### 4. Denormalización de `lifecycle_stage`

`campaigns.lifecycle_stage SMALLINT DEFAULT 0` es una copia del último `stage_index` de `lifecycle_events`. Evita un JOIN en cada request de la landing pública.

**Por qué importa en producción:** una campaña viral con 8.000 visitas/día ejecutaría 8.000 queries a `lifecycle_events` solo para mostrar el badge de etapa actual. Con el campo denormalizado, esa información está en la misma fila que `title`, `goal_count` y `slug` — una sola query sin JOIN.

**Consistencia garantizada por transacción:** cuando el admin avanza la etapa, el servicio ejecuta ambas operaciones en una sola transacción:
```python
# Ambas operaciones en el mismo db.commit()
db.add(LifecycleEvent(campaign_id=id, stage='entrega', stage_index=2, ...))
campaign.lifecycle_stage = 2
```
Si la transacción falla, ambas se revierten. La fuente de verdad es siempre `lifecycle_events`; `lifecycle_stage` es solo un caché de lectura.

---

### 5. Una migración atómica `006`

**Decisión:** una sola migración `006_modelo_base.py`. Justificación para la etapa actual:

- No hay datos en producción — la atomicidad vale más que la granularidad
- Si algo falla, `alembic downgrade 005` deja la BD como estaba
- El riesgo de estado parcial (que aparece con sub-migraciones) no existe

Cuando haya firmas reales en producción y se necesite un `ALTER TABLE` en una tabla con miles de registros, se usarán migraciones separadas para poder pausar entre pasos.

---

### 6. PII — estrategia de doble columna

Para cada campo PII sensible se mantienen dos columnas:

| Campo | `*_encrypted` | `*_hash` |
|-------|--------------|----------|
| Email | `base64(email)` en dev / AES-256-GCM en Fase 3 | `HMAC-SHA256(lower(strip(email)), SECRET)` |
| Cédula | `base64(cedula)` en dev / AES-256-GCM en Fase 3 | `HMAC-SHA256(strip(cedula), SECRET)` |
| Nombre org | — (texto plano, no es PII crítica) | `HMAC-SHA256(lower(strip(org_name)), SECRET)` |

El `HMAC_SECRET_KEY` es obligatorio al arrancar y **distinto** al de forms-qsm.

---

### 7. IP como HMAC — nunca texto plano

`ip_hmac = HMAC-SHA256(ip_address, HMAC_SECRET_KEY)`. No se almacena la IP real. Consistente con el patrón heredado de forms-qsm.

---

### 8. Soft-delete unificado

`archived_at TIMESTAMPTZ NULL` en `campaigns`, `organizations`, `users`. Ningún borrado físico en rutas de negocio. `archived_at IS NULL` es la condición por defecto en todas las queries.

---

## Seguridad

| Aspecto | Decisión |
|---------|----------|
| PII email | `email_encrypted` (placeholder dev) + `email_hash` HMAC |
| PII cédula | validación módulo-10 → `cedula_encrypted` + `cedula_hash` HMAC |
| PII nombre org | `org_name` en texto plano + `org_name_hash` HMAC para dedup |
| IP | `ip_hmac` HMAC-SHA256 — nunca texto plano |
| RLS | `signatures` y `consents` con aislamiento por `org_id` desde migración |
| Contratos | Trigger de inmutabilidad al firmar (`signed_at IS NOT NULL`) |
| Consentimiento | `text_snapshot` preserva el texto exacto presentado al firmante |

---

## LOPDP — análisis de datos personales

### Base de legitimación
`consents.legal_basis = 'consentimiento_expreso'` (Art. 7 LOPDP).

### Datos tratados
| Campo | Clasificación | Propósito |
|-------|--------------|-----------|
| `name` | Dato personal | Identificación en expediente para autoridad |
| `email_encrypted` | Dato personal | Verificación double opt-in |
| `cedula_encrypted` | Dato personal — identificador único | Autenticidad del firmante natural |
| `org_name` | Dato de persona jurídica | Identificación de organización firmante |
| `provincia` | Dato personal | Análisis territorial para expediente |
| `ip_hmac` | Pseudónimo | Anti-fraude, solo hash |

### `processing_contract_id`
Obligatorio (FK a `processing_contracts`). Referencia el contrato de encargo entre Cauce Petition (Encargado) y la organización Responsable, conforme Art. 26 LOPDP.

### Retención
`privacy_config.retention_days` define el plazo por campaña. Job de purga en `retencion-datos` (Fase 3).
