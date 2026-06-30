# Requisitos — modelo-base
> EARS notation. Fecha: 2026-06-29 (revisado con decisiones del usuario)

---

## Tabla `processing_contracts`

**R1** — El sistema SHALL crear la tabla `processing_contracts` con los campos: `id UUID PK`, `org_id UUID NOT NULL FK organizations`, `contract_type VARCHAR(50) NOT NULL` (valores: `encargo_tratamiento`, `dpa`), `title VARCHAR(500) NOT NULL`, `content_text TEXT NOT NULL`, `status VARCHAR(20) NOT NULL DEFAULT 'borrador'` (valores: `borrador`, `enviado_firma`, `firmado`, `revocado`), `draft_url TEXT NULL`, `signed_url TEXT NULL`, `validation_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()`, `signed_at TIMESTAMPTZ NULL`, `signed_by_name VARCHAR(255) NULL`, `signed_by_email VARCHAR(255) NULL`, `email_delivered_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**R2** — El sistema SHALL crear un trigger PG que lance una excepción si se intenta hacer `UPDATE` en cualquier columna de `processing_contracts` cuando `signed_at IS NOT NULL`, excepto la columna `status` cuando el nuevo valor sea `'revocado'`.

**R3** — La columna `processing_contracts.status` SHALL aceptar solo `'borrador'`, `'enviado_firma'`, `'firmado'`, `'revocado'` con CHECK constraint.

---

## Extensiones a tablas existentes

**R4** — La columna `users.role` SHALL aceptar los valores `'admin'`, `'gestor'` y `'editor'`. El valor por defecto SHALL cambiar a `'gestor'`.

**R5** — La tabla `users` SHALL incluir: `status VARCHAR(20) NOT NULL DEFAULT 'activo'`, `archived_at TIMESTAMPTZ NULL`, `archived_by UUID NULL REFERENCES users(id)`.

**R6** — La tabla `organizations` SHALL incluir: `domain VARCHAR(255) NULL`, `rep_name VARCHAR(255) NULL`, `status VARCHAR(20) NOT NULL DEFAULT 'pendiente'` (valores: `verificada`, `pendiente`, `archivada`), `archived_at TIMESTAMPTZ NULL`, `archived_by UUID NULL REFERENCES users(id)`.

**R7** — La tabla `campaigns` SHALL incluir el campo `processing_contract_id UUID NOT NULL REFERENCES processing_contracts(id)`. **Ninguna campaña podrá crearse sin este campo.**

**R8** — La tabla `campaigns` SHALL incluir campos propios de petición: `category VARCHAR(50)`, `goal_count INTEGER`, `authority TEXT`, `asks JSONB DEFAULT '[]'`, `petition_body JSONB DEFAULT '{}'`, `hero_image_url TEXT`, `lifecycle_stage SMALLINT NOT NULL DEFAULT 0`.

**R9** — La tabla `campaigns` SHALL incluir `signer_type VARCHAR(10) NOT NULL DEFAULT 'natural'` con CHECK constraint (valores: `'natural'`, `'org'`, `'both'`). Este campo define qué tipo de firmantes acepta la campaña.

**R10** — La tabla `campaigns` SHALL incluir `archived_at TIMESTAMPTZ NULL`, `archived_by UUID NULL REFERENCES users(id)`.

---

## Tabla `signatures`

**R11** — El sistema SHALL crear la tabla `signatures` con RLS habilitado desde la migración inicial.

**R12** — La tabla `signatures` SHALL incluir: `id UUID PK`, `campaign_id UUID NOT NULL FK campaigns`, `org_id UUID NOT NULL FK organizations`, `name VARCHAR(255) NULL`, `email_encrypted TEXT NOT NULL`, `email_hash VARCHAR(128) NOT NULL`, `cedula_encrypted TEXT NULL` (NULL permitido para firmantes tipo `org`), `cedula_hash VARCHAR(128) NULL`, `provincia VARCHAR(100) NULL`, `signer_type VARCHAR(10) NOT NULL DEFAULT 'natural'` con CHECK (`'natural'`, `'org'`), `org_name VARCHAR(500) NULL`, `org_name_hash VARCHAR(128) NULL`, `visibility VARCHAR(10) NOT NULL DEFAULT 'anonima'` con CHECK (`'publica'`, `'anonima'`, `'secreta'`), `status VARCHAR(25) NOT NULL DEFAULT 'pending_confirmation'` con CHECK (`'pending_confirmation'`, `'confirmed'`, `'anulada'`), `source VARCHAR(50) NULL`, `confirmation_token VARCHAR(128) UNIQUE NULL`, `confirmation_token_expires_at TIMESTAMPTZ NULL`, `confirmed_at TIMESTAMPTZ NULL`, `ip_hmac VARCHAR(128) NULL`, `anulada_at TIMESTAMPTZ NULL`, `anulada_by UUID NULL REFERENCES users(id)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**R13** — El sistema SHALL crear índices únicos parciales en `signatures`:
- `UNIQUE (campaign_id, email_hash) WHERE signer_type = 'natural'`
- `UNIQUE (campaign_id, cedula_hash) WHERE signer_type = 'natural'`
- `UNIQUE (campaign_id, email_hash) WHERE signer_type = 'org'`
- `UNIQUE (campaign_id, org_name_hash) WHERE signer_type = 'org' AND org_name_hash IS NOT NULL`

**R14** — Cuando la campaña tiene `signer_type = 'natural'`, el router SHALL rechazar firmas sin `cedula_encrypted`. Cuando `signer_type = 'org'`, el router SHALL rechazar firmas sin `org_name`. La validación es responsabilidad del servicio, no de un constraint de BD.

**R15** — El router SHALL validar el algoritmo módulo-10 de la cédula ecuatoriana **antes** de calcular `cedula_hash`. Cédulas que no superen la validación son rechazadas con HTTP 422 sin llegar a la BD.

**R16** — El sistema SHALL habilitar RLS en `signatures` con dos políticas:
- Admin (con contexto org): `org_id = current_setting('app.current_org_id')::uuid`
- Pública (sin contexto): `status = 'confirmed' AND visibility IN ('publica', 'anonima')`

---

## Tabla `consents`

**R17** — El sistema SHALL crear la tabla `consents` con RLS habilitado.

**R18** — La tabla `consents` SHALL incluir: `id UUID PK`, `signature_id UUID NOT NULL FK signatures`, `campaign_id UUID NOT NULL FK campaigns`, `org_id UUID NOT NULL FK organizations`, `text_snapshot TEXT NOT NULL`, `version VARCHAR(20) NOT NULL`, `legal_basis VARCHAR(100) NOT NULL`, `consented_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `ip_hmac VARCHAR(128) NULL`, `subscribe_newsletter BOOLEAN NOT NULL DEFAULT false`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**R19** — La política RLS de `consents` SHALL ser idéntica a la de `signatures` (aislamiento por `org_id`).

---

## Tabla `privacy_config`

**R20** — El sistema SHALL crear la tabla `privacy_config` con una relación uno-a-uno con `campaigns`.

**R21** — La tabla `privacy_config` SHALL incluir: `id UUID PK`, `campaign_id UUID NOT NULL UNIQUE FK campaigns`, `aviso_privacidad TEXT NOT NULL`, `base_legal VARCHAR(100) NOT NULL`, `retention_days INTEGER NOT NULL DEFAULT 365`, `data_contact_name VARCHAR(255) NULL`, `data_contact_email VARCHAR(255) NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

---

## Tabla `lifecycle_events`

**R22** — El sistema SHALL crear la tabla `lifecycle_events`.

**R23** — La tabla `lifecycle_events` SHALL incluir: `id UUID PK`, `campaign_id UUID NOT NULL FK campaigns`, `stage VARCHAR(20) NOT NULL` con CHECK (`'lanzada'`, `'recoleccion'`, `'entrega'`, `'dialogo'`, `'decision'`), `stage_index SMALLINT NOT NULL`, `notes TEXT NULL`, `registered_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `registered_by UUID NULL REFERENCES users(id)`.

**R24** — Cuando se inserte un `lifecycle_event`, el servicio SHALL actualizar `campaigns.lifecycle_stage` al mismo `stage_index` **en la misma transacción** (no trigger — responsabilidad del servicio).

---

## Tabla `domains`

**R25** — El sistema SHALL crear la tabla `domains`: `id UUID PK`, `campaign_id UUID NOT NULL FK campaigns`, `host VARCHAR(255) NOT NULL UNIQUE`, `tls_status VARCHAR(20) NOT NULL DEFAULT 'pending'` con CHECK (`'pending'`, `'active'`, `'error'`), `verified_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

---

## Soft-delete unificado

**R26** — El sistema SHALL implementar soft-delete mediante `archived_at TIMESTAMPTZ NULL` en `campaigns`, `organizations` y `users`. `archived_at IS NULL` es la condición predeterminada en todas las queries de negocio.

**R27** — El sistema SHALL registrar `archived_by UUID NULL REFERENCES users(id)` en cada entidad archivable.

**R28** — Ningún registro en ninguna tabla de esta migración SHALL ser eliminado físicamente por rutas de negocio.

---

## Índices y triggers

**R29** — El sistema SHALL crear índices sobre: `signatures(campaign_id, status)`, `signatures(campaign_id, visibility)`, `signatures(email_hash)`, `consents(signature_id)`, `consents(campaign_id)`, `lifecycle_events(campaign_id, registered_at)`, `domains(host)`, `processing_contracts(org_id)`, `processing_contracts(validation_token)`.

**R30** — El sistema SHALL extender el trigger `update_updated_at` a `signatures`, `privacy_config` y `processing_contracts`.
