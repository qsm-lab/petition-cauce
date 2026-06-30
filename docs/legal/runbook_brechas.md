# Runbook: Notificación de Brechas de Seguridad

Base legal: Art. 39 LOPDP — plazo 72 horas desde conocimiento de la brecha.

---

## 1. Definición de brecha

Una brecha de seguridad de datos personales es cualquier incidente que cause, de forma
accidental o ilícita, la destrucción, pérdida, alteración, comunicación o acceso no
autorizado a datos personales tratados por Cauce Petition.

---

## 2. Árbol de decisión — ¿se notifica a la SPDP?

```
¿Hay datos personales expuestos o en riesgo?
  NO → registrar internamente y cerrar
  SÍ ↓
¿El riesgo para los titulares es probable (no meramente hipotético)?
  NO → registrar en log interno (Art. 39.5 LOPDP) y cerrar
  SÍ ↓
→ NOTIFICAR A SPDP EN MÁXIMO 72 HORAS (Art. 39.1 LOPDP)
```

Criterios de probabilidad de riesgo:
- Datos cifrados (cédula/correo) con clave comprometida → RIESGO ALTO
- Dump de tabla con email_hash o cedula_hash expuesto → RIESGO MEDIO-ALTO
- Acceso no autorizado al panel admin con rol limitado → RIESGO MEDIO
- Log interno accedido sin datos PII en claro → RIESGO BAJO

---

## 3. Protocolo de respuesta — cronograma

### T+0: Detección

- Quien detecta la brecha notifica inmediatamente al responsable del tratamiento
  de Cauce Petition (Encargado) y al responsable de la organización afectada.
- Iniciar registro escrito del incidente con timestamp exacto.
- Aislar el sistema afectado si es posible sin pérdida de evidencia.

### T+1h: Evaluación inicial

- Determinar: ¿qué datos?, ¿cuántos titulares afectados?, ¿cómo ocurrió?
- Aplicar árbol de decisión (sección 2).
- Si se requiere notificación: preparar borrador del formulario SPDP.

### T+4h: Contención

- Revocar accesos comprometidos (sesiones JWT, claves API).
- Rotar credenciales si hay indicios de compromiso de secretos.
- Preservar logs de auditoría para investigación forense.

### T+24h: Notificación a Responsables

- Notificar por escrito a cada organización Responsable cuyos datos hayan
  sido afectados, con descripción del incidente y medidas tomadas.
- Documentar notificación (fecha, medio, destinatario).

### T+48h: Preparación de notificación SPDP

Recopilar para el formulario de notificación:
- Descripción de la naturaleza de la brecha.
- Categorías de datos afectados.
- Número aproximado de titulares afectados.
- Nombre y datos de contacto del delegado de protección de datos (si aplica).
- Consecuencias probables de la brecha.
- Medidas adoptadas o propuestas para remediar la brecha.

### T+72h: Notificación a SPDP (plazo máximo legal)

- Presentar notificación a la Superintendencia de Protección de Datos Personales
  del Ecuador a través del canal oficial (spdp.gob.ec o el disponible al momento).
- Archivar acuse de recibo.

### T+72h+: Notificación a titulares (si aplica)

Si la brecha puede generar un alto riesgo para los titulares, notificarles
directamente en lenguaje claro. Usar el canal de email de doble opt-in si disponible.
Coordinación con el Responsable de cada campaña afectada.

---

## 4. Contenido mínimo de la notificación a SPDP

Conforme al Art. 39.2 LOPDP:

```
1. Naturaleza de la brecha de seguridad de datos personales
2. Categorías y número aproximado de titulares afectados
3. Categorías y número aproximado de registros afectados
4. Nombre y datos de contacto del delegado de protección de datos (si existe)
   o del punto de contacto para mayor información
5. Consecuencias probables de la brecha
6. Medidas adoptadas o propuestas para remediar la brecha,
   incluidas las medidas para mitigar sus posibles efectos negativos
```

---

## 5. Registro interno de brechas

Todo incidente de seguridad, independientemente de si requiere notificación,
debe registrarse en el log interno con:

- Fecha y hora de detección
- Descripción del incidente
- Sistemas y datos afectados
- Número de titulares potencialmente afectados
- Decisión de notificación (sí/no) y justificación
- Acciones tomadas con timestamps
- Fecha de cierre del incidente

Ubicación del registro: gestionado por el Encargado de Cauce Petition.
Retención del registro: mínimo 5 años.

---

## 6. Contactos de emergencia

| Rol | Responsabilidad |
|-----|----------------|
| Encargado técnico (Cauce Petition) | Contención técnica, rotación de credenciales |
| Responsable LOPDP (Cauce Petition) | Decisión de notificación, comunicación con SPDP |
| Responsable de cada organización | Notificación a sus titulares afectados |

SPDP Ecuador: spdp.gob.ec

---

## 7. Post-incidente

- Análisis de causa raíz documentado.
- Actualización de medidas de seguridad si corresponde.
- Actualización del RAT si el incidente revela un riesgo no contemplado.
- Revisión del presente runbook si el protocolo falló en algún punto.
