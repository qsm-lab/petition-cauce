# Diseño técnico — lopdp-base
> Fecha: 2026-06-30 (revisado con decisiones del usuario)

---

## Archivos afectados

### Nuevos
| Archivo | Descripción |
|---------|-------------|
| `apps/api/app/legal/__init__.py` | Exporta funciones y constantes del módulo |
| `apps/api/app/legal/aviso_privacidad.py` | `render_aviso_privacidad(context)` |
| `apps/api/app/legal/contrato_encargo.py` | `render_contrato_encargo(context)` + `get_contrato_dev()` |
| `apps/api/app/legal/rat.py` | `render_rat(context)` |
| `apps/api/app/legal/retention.py` | Constantes + `retention_label()` |
| `apps/api/app/legal/templates/aviso_privacidad.jinja2` | Plantilla Jinja2 del aviso |
| `apps/api/app/legal/templates/contrato_encargo.jinja2` | Plantilla Jinja2 del contrato |
| `apps/api/app/legal/templates/rat.jinja2` | Plantilla Jinja2 del RAT |
| `apps/api/migrations/versions/007_lopdp_base.py` | Añade `version` a `privacy_config` |
| `docs/legal/runbook_brechas.md` | Runbook operativo Art. 39 LOPDP |

### Modificados
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/models/privacy_config.py` | Añadir campo `version: SmallInteger` |
| `apps/api/app/scripts/seed_dev.py` | Usar `render_contrato_encargo` y `render_aviso_privacidad` reales |

---

## Decisiones de diseño

### 1. Jinja2 como motor de plantillas + textos almacenados en DB

Las plantillas `.jinja2` viven en archivos (versionadas en git, auditables via `git log`). Los textos **renderizados** se almacenan en la BD:

- `processing_contracts.content_text` ← texto del contrato renderizado
- `privacy_config.aviso_privacidad` ← texto del aviso renderizado

La BD es el **registro consultable** de cada texto legal que existió: qué dijo el contrato firmado, qué dijo el aviso que leyó cada firmante. El texto en DB no se re-renderiza en runtime — es inmutable una vez persistido.

Cuando una plantilla `.jinja2` cambie (mejora de redacción), solo los textos generados a partir de esa fecha usan la nueva versión. Los textos históricos en DB quedan intactos.

```
app/legal/templates/aviso_privacidad.jinja2
    ↓ render con contexto de campaña
privacy_config.aviso_privacidad = "AVISO DE PRIVACIDAD — Campaña X..."
    ↓ firmante lee
consents.text_snapshot = mismo texto que vio
consents.version = "1"
```

### 2. Versionado del aviso de privacidad por campaña

`privacy_config.version` (nuevo campo, migración 007) rastrea la versión activa del aviso. Cuando el administrador modifica el aviso:

```
Flujo de actualización:
1. Admin modifica texto base o contexto de la campaña
2. Sistema llama render_aviso_privacidad(nuevo_contexto)
3. privacy_config.aviso_privacidad ← nuevo texto
4. privacy_config.version ← version + 1
5. Todos los nuevos firmantes ven y consienten la versión nueva
```

**Trazabilidad completa por firmante:**

| Firmante | `signatures.status` | `consents.version` | `consents.text_snapshot` |
|----------|--------------------|--------------------|--------------------------|
| firmante1 | confirmed | "1" | texto completo de v1 |
| firmante2 | confirmed | "2" | texto completo de v2 |

**Deduplicación**: `uq_sig_email_natural` y `uq_sig_cedula_natural` impiden que firmante1 firme bajo v2. Su consentimiento original (v1) permanece válido. Ambas firmas cuentan en el total de la campaña.

**Conteo**: `SELECT COUNT(*) FROM signatures WHERE campaign_id = X AND status = 'confirmed'` — no hay filtro de versión. El conteo es de personas, no de versiones.

**Para el RAT**: el auditor ve `SELECT DISTINCT version, consented_at FROM consents WHERE campaign_id = X ORDER BY consented_at` para listar las versiones de aviso que estuvieron activas.

### 3. Versionado del contrato de encargo

El contrato entre Cauce Petition y la organización Responsable es inmutable tras la firma (trigger). Si la organización necesita actualizar el contrato:

```
Flujo de nueva versión de contrato:
1. Nuevo ProcessingContract row (nuevo id, nueva version)
2. content_text ← render_contrato_encargo(contexto_actualizado)
3. Proceso de firma normal (borrador → firmado)
4. Nuevas campañas usan el nuevo contrato (FK al nuevo id)
5. Campañas existentes mantienen FK al contrato original — siguen válidas
```

No se toca el contrato v1 (inmutable por trigger). No hay FK que romper. Las campañas "heredan" la versión del contrato con el que fueron creadas.

### 4. Formulario de creación de usuarios admin/gestores

Requerido pero no urgente. Cuando se implemente: formulario en el admin panel (`/admin/usuarios/nuevo`) que crea un `User` con `role='gestor'` o `role='admin'` bajo el mismo `org_id`. El usuario admin actual puede crear gestores; solo superadmin puede crear otros admins. Sin relación con esta feature.

### 5. `get_contrato_dev()` — explicación completa

```python
def get_contrato_dev() -> str:
    if settings.environment != "development":
        raise RuntimeError("get_contrato_dev() solo disponible en entorno development")
    
    context = {
        "responsable_nombre": "Cauce Ecuador (ORGANIZACIÓN DE PRUEBA)",
        "responsable_rep": "Admin Dev",
        "responsable_email": "admin@cauce.ec",
        "encargado_nombre": "Cauce Petition SAS",
        # ... resto de datos ficticios pero realistas
    }
    return render_contrato_encargo(context)
```

**Por qué existe**: en desarrollo, el seed necesita poblar `processing_contracts.content_text` con texto legal real (no "placeholder"). Sin esta función, el seed debería construir el contexto completo del contrato manualmente cada vez. `get_contrato_dev()` encapsula eso.

**Por qué el guard de environment**: en producción, si alguien llama esta función por error, obtiene un contrato con datos ficticios (`ORGANIZACIÓN DE PRUEBA`) que podría persistirse en la BD y pasar a ser un contrato "firmado" con datos falsos. El RuntimeError previene eso antes de que llegue a la BD.

Es el equivalente de las Turnstile test keys: facilita el flujo local sin riesgo de contaminar producción.

### 6. Email — Resend

Las notificaciones por email usarán **Resend** como proveedor. `RESEND_API_KEY` se añade a `.env.example`. La integración de Resend no es parte de esta feature — esta feature solo produce los textos. Los flows de email se implementan en:

- `formulario-firma`: doble opt-in de confirmación de firma
- `contratos-lopdp`: entrega del contrato al representante legal para firma

El runbook de brechas incluye plantillas de texto para notificaciones a SPDP; el envío real vía Resend queda en el runbook como instrucción manual (no automatizado — la notificación de brecha requiere juicio humano antes de enviar).

---

## Estructura del módulo `app/legal/`

```
apps/api/app/legal/
├── __init__.py
├── aviso_privacidad.py
├── contrato_encargo.py
├── rat.py
├── retention.py
└── templates/
    ├── aviso_privacidad.jinja2
    ├── contrato_encargo.jinja2
    └── rat.jinja2
```

---

## Contextos de renderizado

### `render_aviso_privacidad(context: dict) -> str`

```python
context = {
    "responsable_nombre": org.name,
    "responsable_dominio": org.domain,
    "campaign_titulo": campaign.title,
    "campaign_authority": campaign.authority,
    "signer_type": campaign.signer_type,          # 'natural' | 'org' | 'both'
    "retention_days": privacy_cfg.retention_days,
    "retention_label": retention_label(privacy_cfg.retention_days),
    "data_contact_email": privacy_cfg.data_contact_email,
    "data_contact_nombre": privacy_cfg.data_contact_name,
    "aviso_version": privacy_cfg.version,
    "fecha_vigencia": date.today().isoformat(),
}
```

### `render_contrato_encargo(context: dict) -> str`

```python
context = {
    "responsable_nombre": org.name,
    "responsable_rep": org.rep_name,
    "responsable_email": ...,                      # email del rep legal
    "campaign_scope": {
        "signer_types": ["natural", "org"],        # de campaign.signer_type
        "data_categories": ["nombre", "cedula", "email", "provincia"],
        "authority": campaign.authority,
    },
    "retention_days": ...,
    "validation_token": str(contract.validation_token),
    "fecha": date.today().isoformat(),
}
```

### `render_rat(context: dict) -> str`

```python
context = {
    "responsable_nombre": org.name,
    "encargado_nombre": "Cauce Petition SAS",
    "campaign_titulo": campaign.title,
    "campaign_slug": campaign.slug,
    "authority": campaign.authority,
    "signer_type": campaign.signer_type,
    "retention_days": privacy_cfg.retention_days,
    "aviso_versiones": [                           # historial de versiones
        {"version": 1, "desde": "2026-06-01"},
        {"version": 2, "desde": "2026-07-15"},
    ],
    "fecha_generacion": date.today().isoformat(),
}
```

---

## Migración `007_lopdp_base.py`

```sql
ALTER TABLE privacy_config ADD COLUMN version SMALLINT NOT NULL DEFAULT 1;
```

Un solo `ALTER TABLE`. La migración 007 es mínima. Downgrade: `DROP COLUMN version`.

---

## Seguridad

| Aspecto | Decisión |
|---------|----------|
| Plantillas `.jinja2` | Sin autoescape de HTML (texto plano legal, no HTML) |
| `get_contrato_dev()` | Guard `settings.environment != "development"` |
| Textos en DB | Inmutables tras firma (trigger existente en `processing_contracts`) |
| Versionado aviso | `privacy_config.version` + `consents.version` proveen trazabilidad completa |
| Resend API key | En `.env.example` como `RESEND_API_KEY=`; nunca en código |

---

## LOPDP — cobertura

| Artículo | Cubierto en |
|----------|-------------|
| Art. 7 — Base de legitimación: consentimiento expreso | `aviso_privacidad.jinja2` |
| Art. 13 — Información al titular | `render_aviso_privacidad` |
| Art. 26 — Contrato de encargo | `render_contrato_encargo` |
| Art. 37 — RAT | `render_rat` |
| Art. 39 — Notificación de brechas 72h | `runbook_brechas.md` |
| Art. 18–23 — Derechos ARCO | Mencionados en aviso; flujo en `derechos-arco` (Fase 3) |

---

## Fuera de scope

| Tema | Feature |
|------|---------|
| Generación de PDF | `contratos-lopdp` |
| Envío por email (Resend) | `formulario-firma`, `contratos-lopdp` |
| Endpoint REST para RAT | `rat-autogenerado` (Fase 3) |
| Flujo ARCO self-service | `derechos-arco` (Fase 3) |
| Job de purga/anonimización | `retencion-datos` (Fase 3) |
| Formulario creación usuarios admin/gestores | feature pendiente (no urgente) |
