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

---

## 8. Playbooks mínimos (hardening-campana R11)

Complementan el cronograma de la sección 3. Primer paso común: anotar la hora, limitar la conversación a conteos y estados
(sin PII) y seguir `docs/engineering/runbook_incidentes.md` para la parte técnica.

### Playbook A — Fuga de datos personales
1. **Contener (T+0 a T+1h):** identificar el vector (exportación, respaldo, log, base expuesta, correo mal enviado). Cortarlo:
   revocar el enlace o la clave, cerrar el puerto, retirar el archivo. No borrar evidencia: copiar los logs de acceso al lugar seguro.
2. **Dimensionar:** campos afectados (¿cédula/correo cifrados o en claro?), campañas y número de titulares. Los datos cifrados con
   `PII_ENCRYPTION_KEY` intacta tienen riesgo menor; si la clave también salió, es riesgo ALTO (sección 2).
3. **Rotar** lo que haya podido filtrarse: claves de proveedor de correo, `JWT_SECRET_KEY` (cierra sesiones), contraseñas de base.
   Rotar `PII_ENCRYPTION_KEY` o `HMAC_SECRET_KEY` solo con plan de re-cifrado: cambiarlas sin migrar rompe los datos existentes.
4. **Decidir la notificación** con el árbol de la sección 2 y seguir los plazos de la sección 3 (organización a T+24 h, SPDP a T+72 h).
5. Registrar en la sección 5 y hacer el análisis de causa raíz (sección 7).

### Playbook B — Toma de una cuenta de administrador
1. **Contener (de inmediato):** desactivar al usuario en la base y revocar sus sesiones (cambiar su contraseña y, si hace falta,
   rotar `JWT_SECRET_KEY`, lo que cierra todas las sesiones).
2. **Revisar el rastro:** auditoría de ese usuario desde la hora sospechosa: exportaciones de firmas, cambios de campaña,
   comunicaciones enviadas, altas de otros usuarios. La alerta `exportaciones_pii` ayuda a fijar la hora de inicio.
3. **Alcance:** si hubo exportaciones o lectura de firmas, es una fuga: pasar al Playbook A. Si solo hubo acceso sin lectura de PII,
   registrar en el log interno (riesgo medio, sección 2).
4. **Restablecer:** nueva contraseña por canal distinto al correo comprometido; revisar usuarios creados o con rol cambiado.
5. Mientras no exista TOTP (T5.3), exigir contraseña nueva y única y limitar a 2 los administradores activos durante la campaña.

### Playbook C — Caída de DNS o de Cloudflare
1. Confirmar el alcance: estado de Cloudflare, `dig +short <dominio>` y la alerta `[Cauce] CAIDA:` del chequeo externo.
2. No hay brecha de datos por una caída, solo indisponibilidad: **no** abrir el origen al mundo ni desactivar Turnstile.
3. Si el DNS está mal configurado, restaurar los registros desde la copia guardada fuera de Cloudflare. Si es una caída del
   proveedor, esperar y comunicar en las redes de la campaña que las firmas no se pierden.
4. Al recuperarse, revisar que `real_ip` siga mostrando IPs reales y que los respaldos y alertas sigan corriendo.
5. Si la indisponibilidad supera 2 h (RTO), avisar a la organización responsable.

### Contactos (completar antes del lanzamiento)
Ver la tabla de guardia al final de `docs/engineering/runbook_incidentes.md`. Añadir aquí: responsable LOPDP, delegado de protección
de datos (si existe), un contacto por organización y el canal oficial de la SPDP.
