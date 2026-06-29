# Requisitos — modelo-base
> EARS notation. Fecha: 2026-06-29

---

## Extensiones a tablas existentes

**R1** — La columna `users.role` SHALL aceptar los valores `'admin'`, `'gestor'` y `'editor'`. El valor por defecto SHALL cambiar de `'editor'` a `'gestor'`.

**R2** — La tabla `users` SHALL incluir las columnas `status VARCHAR(20) DEFAULT 'activo'`, `archived_at TIMESTAMPTZ NULL` y `archived_by UUID NULL REFERENCES users(id)`. Las políticas de archivado son soft-delete (ver R23).

**R3** — La tabla `organizations` SHALL incluir las columnas `domain VARCHAR(255) NULL`, `rep_name VARCHAR(255) NULL`, `status VARCHAR(20) DEFAULT 'pendiente'`, `archived_at TIMESTAMPTZ NULL` y `archived_by UUID NULL REFERENCES users(id)`.

**R4** — La tabla `campaigns` SHALL incluir el campo `processing_contract_id TEXT NOT NULL` que referencia el identificador externo del contrato de encargo de tratamiento LOPDP firmado entre el Encargado (Cauce Petition) y la organización Responsable. **Ninguna campaña podrá crearse sin este campo.**

**R5** — La tabla `campaigns` SHALL incluir campos propios de petición: `category VARCHAR(50)`, `goal_count INTEGER`, `authority TEXT`, `asks JSONB DEFAULT '[]'`, `petition_body JSONB DEFAULT '{}'`, `hero_image_url TEXT`, `lifecycle_stage SMALLINT NOT NULL DEFAULT 0`.

**R6** — La tabla `campaigns` SHALL incluir `archived_at TIMESTAMPTZ NULL` y `archived_by UUID NULL REFERENCES users(id)` para soft-delete.

---

## Tabla `signatures`

**R7** — El sistema SHALL crear la tabla `signatures` con RLS habilitado desde la migración inicial.

**R8** — La tabla `signatures` SHALL incluir las columnas: `id UUID PK`, `campaign_id UUID NOT NULL FK campaigns`, `org_id UUID NOT NULL FK organizations` (para RLS), `name VARCHAR(255)` (nombre completo — nulo si firma secreta), `email_encrypted TEXT NOT NULL` (texto cifrado — en dev contiene el email base64 como placeholder), `email_hash VARCHAR(128) NOT NULL` (HMAC-SHA256 del email normalizado, para deduplicación sin exponer PII), `cedula_encrypted TEXT NOT NULL`, `cedula_hash VARCHAR(128) NOT NULL` (HMAC-SHA256 de la cédula, para deduplicación), `provincia VARCHAR(100)`, `visibility VARCHAR(10) NOT NULL DEFAULT 'anonima'` (valores: `publica`, `anonima`, `secreta`), `status VARCHAR(25) NOT NULL DEFAULT 'pending_confirmation'` (valores: `pending_confirmation`, `confirmed`, `anulada`), `source VARCHAR(50)` (origen del tráfico para tracking), `confirmation_token VARCHAR(128) UNIQUE NULL`, `confirmation_token_expires_at TIMESTAMPTZ NULL`, `confirmed_at TIMESTAMPTZ NULL`, `ip_hmac VARCHAR(128)` (HMAC-SHA256 de la IP, nunca IP en texto plano), `anulada_at TIMESTAMPTZ NULL`, `anulada_by UUID NULL REFERENCES users(id)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**R9** — La tabla `signatures` SHALL tener una restricción UNIQUE sobre `(campaign_id, email_hash)` para prevenir duplicados por email en la misma campaña.

**R10** — La tabla `signatures` SHALL tener una restricción UNIQUE sobre `(campaign_id, cedula_hash)` para prevenir duplicados por cédula en la misma campaña.

**R11** — La columna `signatures.visibility` SHALL aceptar solo `'publica'`, `'anonima'`, `'secreta'` con CHECK constraint.

**R12** — La columna `signatures.status` SHALL aceptar solo `'pending_confirmation'`, `'confirmed'`, `'anulada'` con CHECK constraint.

**R13** — El sistema SHALL habilitar RLS en `signatures` con política de aislamiento por `org_id`:
- Política admin: `org_id = current_setting('app.current_org_id')::uuid`
- Política pública (sin contexto org): `status = 'confirmed' AND visibility IN ('publica', 'anonima')`

---

## Tabla `consents`

**R14** — El sistema SHALL crear la tabla `consents` con RLS habilitado desde la migración inicial.

**R15** — La tabla `consents` SHALL incluir: `id UUID PK`, `signature_id UUID NOT NULL FK signatures`, `campaign_id UUID NOT NULL FK campaigns`, `org_id UUID NOT NULL FK organizations` (para RLS), `text_snapshot TEXT NOT NULL` (texto completo del aviso de privacidad tal como fue presentado al firmante), `version VARCHAR(20) NOT NULL`, `legal_basis VARCHAR(100) NOT NULL` (base de legitimación: `consentimiento_expreso`, `interes_legitimo`, etc.), `consented_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `ip_hmac VARCHAR(128)` (misma IP que en signatures, como HMAC), `subscribe_newsletter BOOLEAN NOT NULL DEFAULT false` (consentimiento separado e independiente), `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**R16** — La tabla `consents` SHALL tener política RLS por `org_id` con la misma lógica que `signatures`.

---

## Tabla `privacy_config`

**R17** — El sistema SHALL crear la tabla `privacy_config` con una relación uno-a-uno con `campaigns` (una configuración activa por campaña, editable).

**R18** — La tabla `privacy_config` SHALL incluir: `id UUID PK`, `campaign_id UUID NOT NULL UNIQUE FK campaigns`, `aviso_privacidad TEXT NOT NULL` (texto del aviso presentado al firmante), `base_legal VARCHAR(100) NOT NULL`, `retention_days INTEGER NOT NULL DEFAULT 365`, `data_contact_name VARCHAR(255)`, `data_contact_email VARCHAR(255)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

---

## Tabla `lifecycle_events`

**R19** — El sistema SHALL crear la tabla `lifecycle_events` para registrar las transiciones de ciclo de vida de cada campaña.

**R20** — La tabla `lifecycle_events` SHALL incluir: `id UUID PK`, `campaign_id UUID NOT NULL FK campaigns`, `stage VARCHAR(20) NOT NULL` (valores: `lanzada`, `recoleccion`, `entrega`, `dialogo`, `decision`), `stage_index SMALLINT NOT NULL` (0–4), `notes TEXT`, `registered_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `registered_by UUID NULL REFERENCES users(id)`.

**R21** — La columna `lifecycle_events.stage` SHALL aceptar solo los 5 valores válidos con CHECK constraint.

**R22** — Cuando una campaña cambia de etapa, `campaigns.lifecycle_stage` SHALL actualizarse al `stage_index` del nuevo `lifecycle_events` insertado (trigger o responsabilidad del servicio — se define en la spec de `ciclo-vida-admin`).

---

## Tabla `domains`

**R23** — El sistema SHALL crear la tabla `domains` para el ruteo multi-dominio por Host header.

**R24** — La tabla `domains` SHALL incluir: `id UUID PK`, `campaign_id UUID NOT NULL FK campaigns`, `host VARCHAR(255) NOT NULL UNIQUE`, `tls_status VARCHAR(20) NOT NULL DEFAULT 'pending'` (valores: `pending`, `active`, `error`), `verified_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

---

## Soft-delete unificado (todas las entidades)

**R25** — El sistema SHALL implementar soft-delete mediante `archived_at TIMESTAMPTZ NULL` en `campaigns`, `organizations` y `users`. `archived_at IS NULL` significa "no archivado".

**R26** — El sistema SHALL registrar quién ejecutó el archivado en `archived_by UUID NULL REFERENCES users(id)`.

**R27** — El sistema SHALL garantizar que ningún registro en ninguna tabla de esta migración sea eliminado físicamente (no hay DROP/DELETE en las rutas de negocio).

---

## Integridad e índices

**R28** — El sistema SHALL crear índices sobre: `signatures(campaign_id, status)`, `signatures(campaign_id, visibility)`, `signatures(email_hash)`, `signatures(cedula_hash)`, `consents(signature_id)`, `consents(campaign_id)`, `lifecycle_events(campaign_id, registered_at)`, `domains(host)`.

**R29** — El sistema SHALL extender el trigger `update_updated_at` a las tablas `signatures` y `privacy_config` (que tienen columna `updated_at`).
