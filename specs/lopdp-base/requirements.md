# Requisitos — lopdp-base
> EARS notation. Fecha: 2026-06-30 (revisado con decisiones del usuario)

---

## Contexto legal

Cauce Petition opera como **Encargado del Tratamiento** (Art. 26 LOPDP). Las organizaciones activistas son **Responsables**. Los firmantes son **Titulares**. Todo tratamiento de datos personales en una campaña requiere:

1. Contrato de encargo firmado entre Cauce Petition y la organización Responsable
2. Aviso de privacidad versionado por campaña, presentado al firmante antes de capturar sus datos
3. RAT (Registro de Actividades de Tratamiento) por cada tratamiento activo
4. Runbook operativo de notificación de brechas (Art. 39 LOPDP: 72h a SPDP)

---

## Sistema de plantillas

**R1** — El sistema SHALL usar Jinja2 como motor de plantillas para generar todos los textos legales. Las plantillas SHALL residir en archivos `.jinja2` en `app/legal/templates/`.

**R2** — El sistema SHALL almacenar en la base de datos cada texto legal generado (aviso de privacidad, contrato de encargo) como parte del registro consultable de tratamiento. El texto en DB es la fuente de verdad legal — no se re-renderiza en runtime.

**R3** — Cada función de renderizado SHALL aceptar un contexto dict con los datos del dominio y retornar el texto completo renderizado como string, sin efectos secundarios (funciones puras).

---

## Plantilla y versionado del aviso de privacidad

**R4** — El sistema SHALL disponer de una función `render_aviso_privacidad(context: dict) -> str` que renderice la plantilla `aviso_privacidad.jinja2` con el contexto provisto.

**R5** — La tabla `privacy_config` SHALL incluir un campo `version SMALLINT NOT NULL DEFAULT 1` para rastrear la versión activa del aviso de privacidad de cada campaña.

**R6** — WHEN el administrador modifique el aviso de privacidad de una campaña, el sistema SHALL incrementar `privacy_config.version` y actualizar `privacy_config.aviso_privacidad` con el nuevo texto renderizado.

**R7** — La tabla `consents` SHALL registrar en `consents.version` la versión del aviso bajo la cual firmó cada firmante. `consents.text_snapshot` preserva el texto exacto presentado. Juntos constituyen el registro legal inmutable del consentimiento de cada titular.

**R8** — Un firmante que ya consta en la campaña (deduplicado por `uq_sig_email_natural` o `uq_sig_cedula_natural`) SHALL ser rechazado en cualquier intento de volver a firmar, independientemente de la versión activa del aviso. Su firma original bajo la versión anterior sigue siendo válida y cuenta en el total de la campaña.

**R9** — El conteo total de firmas de una campaña SHALL incluir todas las firmas confirmadas independientemente de la versión del aviso bajo la que fueron captadas. Las versiones son trazabilidad legal, no segmentación de conteo.

**R10** — El aviso generado SHALL incluir obligatoriamente: identidad del Responsable, identidad del Encargado (Cauce Petition), finalidad, base de legitimación (Art. 7 LOPDP: consentimiento expreso), categorías de datos (condicionadas a `signer_type`), plazo de conservación, derechos del titular (Art. 18–23 LOPDP), canal para ejercer derechos, ausencia de transferencias internacionales, número de versión del aviso, fecha de vigencia.

**R11** — WHEN se cree una `PrivacyConfig` sin aviso de privacidad explícito, el sistema SHALL llamar a `render_aviso_privacidad` automáticamente para generar el texto base con versión 1.

---

## Política de retención base

**R12** — El sistema SHALL definir constantes de retención documentadas:
- `RETENTION_CAMPANA_CORTA = 180` días
- `RETENTION_CAMPANA_ESTANDAR = 365` días (default de `privacy_config.retention_days`)
- `RETENTION_CAMPANA_LARGA = 730` días

**R13** — La función `retention_label(days: int) -> str` SHALL retornar texto descriptivo del plazo para incluir en el aviso de privacidad renderizado.

---

## Plantilla del contrato de encargo de tratamiento

**R14** — El sistema SHALL disponer de una función `render_contrato_encargo(context: dict) -> str` que renderice la plantilla `contrato_encargo.jinja2`.

**R15** — El contrato generado SHALL incluir: identificación de partes (Responsable y Encargado), objeto del encargo, naturaleza y finalidad, categorías de datos y titulares, instrucciones del Responsable al Encargado, obligaciones del Encargado (Art. 26 lit. a–k LOPDP), medidas de seguridad técnicas y organizativas, condiciones de subencargo (no permitido sin autorización escrita), duración y terminación, asistencia al Responsable para derechos ARCO y brechas, cláusula de auditoría, bloque de firmas con referencia al `validation_token`.

**R16** — El texto renderizado SHALL ser almacenado en `processing_contracts.content_text` al crear el contrato. Una vez firmado (`signed_at IS NOT NULL`), el trigger de inmutabilidad garantiza que el texto no pueda modificarse.

**R17** — WHEN la organización Responsable requiera actualizar el contrato de encargo, el sistema SHALL crear un nuevo registro `processing_contracts` (nueva versión) manteniendo el anterior como histórico. Las campañas vinculadas al contrato anterior conservan su FK al contrato original.

**R18** — El sistema SHALL proveer `get_contrato_dev() -> str` que retorne el contrato renderizado con datos ficticios de desarrollo. La función SHALL lanzar `RuntimeError` si `settings.environment != "development"`, impidiendo su uso en producción.

---

## Plantilla del RAT

**R19** — El sistema SHALL disponer de una función `render_rat(context: dict) -> str` que renderice la plantilla `rat.jinja2` con datos de `campaigns`, `organizations` y `privacy_config`.

**R20** — El RAT generado SHALL incluir las secciones obligatorias del Art. 37 LOPDP: identificación del Responsable y Encargado, finalidades, categorías de titulares, categorías de datos (con indicación explícita de ausencia de datos sensibles en el caso estándar de firmas), destinatarios (`campaign.authority`), ausencia de transferencias internacionales, plazos de conservación, medidas de seguridad.

**R21** — El RAT SHALL incluir una sección de versiones del aviso de privacidad activo: listado de versiones (`privacy_config.version`) con fecha de vigencia de cada una, permitiendo al auditor relacionar firmantes con la versión bajo la que consintieron.

**R22** — La función `render_rat` SHALL generarse 100% desde datos existentes en la BD — sin campos adicionales que el administrador deba completar manualmente para el caso estándar.

---

## Runbook de notificación de brechas

**R23** — El sistema SHALL incluir `docs/legal/runbook_brechas.md` con el procedimiento de respuesta a brechas conforme al Art. 39 LOPDP.

**R24** — El runbook SHALL definir los plazos: T+0 detección, T+4h evaluación de riesgo, T+24h notificación al Responsable, T+72h notificación a SPDP si riesgo alto.

**R25** — El runbook SHALL incluir plantillas de notificación tipo para: SPDP, Responsable (organización activista), y titulares afectados (opcional).

**R26** — El runbook SHALL listar los datos mínimos requeridos por la SPDP en una notificación de brecha: naturaleza, categorías y volumen de titulares afectados, datos de contacto del punto focal, consecuencias probables, medidas adoptadas.

**R27** — El runbook SHALL documentar los canales de contacto de SPDP Ecuador, ARCOTEL y EcuCERT.

---

## Integración y módulo

**R28** — Todas las funciones de renderizado SHALL residir en `apps/api/app/legal/` como módulo Python. Las plantillas Jinja2 SHALL estar en `apps/api/app/legal/templates/`.

**R29** — El módulo `app/legal/__init__.py` SHALL exportar: `render_aviso_privacidad`, `render_contrato_encargo`, `render_rat`, `get_contrato_dev`, `RETENTION_CAMPANA_CORTA`, `RETENTION_CAMPANA_ESTANDAR`, `RETENTION_CAMPANA_LARGA`, `retention_label`.

**R30** — Las notificaciones por email (double opt-in de firma, entrega de contrato para firma, comunicaciones a SPDP) SHALL implementarse con **Resend** como proveedor. La integración de Resend queda fuera del scope de esta feature — se implementa en `formulario-firma` (double opt-in) y `contratos-lopdp` (entrega de contrato). Esta feature solo define los textos legales y el módulo de plantillas.
