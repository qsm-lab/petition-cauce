# Tasks — hardening-campana (primera propuesta de plan)

Borrador para revisión. Estado: `spec_ready`, **pendiente de aprobación**; nada implementado.
Referencias Rn → `requirements.md`; decisiones Dn → `design.md`.
Estimaciones en horas de trabajo efectivo, orientativas.

## Progreso (actualizado 2026-11-06)

Leyenda: `[x]` completada · `[~]` revisada o iniciada, **requiere ajustes** · `[ ]` pendiente
(incluye las bloqueadas). Cálculo: completada = 1, con ajustes = 0,5, pendiente = 0, sobre el
número de tareas de la fase. Es avance por **tareas**, no por horas; las de más esfuerzo
(T4.1, T3.4, T1.3b) pesan igual que las de una hora. "Completada" significa código y pruebas
locales terminados; **nada está desplegado en producción todavía**.

| Fase | Completadas | Con ajustes | Pendientes | Total | **Progreso** |
|------|:-----------:|:-----------:|:----------:|:-----:|:------------:|
| **Fase 1** — antes del lanzamiento | 6 | 11 | 8 | 25 | **46 %** |
| **Fase 2** — durante / después | 0 | 0 | 24 | 24 | **0 %** |
| **Total** | 6 | 11 | 32 | 49 | **23 %** |

Con ajustes = el código o el material está hecho y probado en local, pero falta algo concreto:
casi siempre **una acción manual en el VPS** (ver `docs/engineering/runbook_hardening_vps.md`) o una
verificación en entorno real. Lo que falta de cada una está en su tarea.

Decisiones de diseño ya tomadas (no cuentan como tareas): Sentry a Fase 2, monitor open source
en GreenGeeks compartido, alertas por correo, Resend Pro.

## Decisiones que necesito del usuario antes de arrancar

- [x] **Sentry:** *decidido* — fuera de la Fase 1; monitor open source ahora y
      rastreador de errores (GlitchTip propio o Sentry SaaS) en la Ola A. (D5, R14b)
- [x] **Canal de guardia:** *decidido* — solo correo, por una vía independiente de
      Resend/Brevo de la plataforma. (R6)
- [x] **Host del monitor:** *decidido* — GreenGeeks **compartido** (alias SSH `cqsmorg`): script
      con cron, sin Uptime Kuma. (D5)
- [x] **Correo transaccional:** *decidido* — Resend Pro (50.000/mes). Falta activar el plan
      en la cuenta y fijar `RESEND_PLATFORM_PLAN=pro` en producción. (R5, D7)
- [ ] **TOTP admin** dentro de la Fase 1 (≈1 día) o aceptar el riesgo con medidas mínimas. (R9)
- [ ] **Staging:** host temporal separado (preferible) o ventana en el VPS actual. (D6)
- [ ] **Destino de backups offsite** (almacenamiento de objetos) y quién guarda la clave
      privada de cifrado. (R4)
- [ ] **Fecha objetivo de lanzamiento** y persona de guardia los primeros 7 días. (R6, R13)

---

# FASE 1 — Antes del lanzamiento (objetivo: 5 días hábiles)

**Progreso de la fase: 46 %** (6 completadas, 11 con ajustes, 8 pendientes de 25).

Orden pensado para que lo que mide y protege vaya primero, y la prueba de carga se haga
**cuando ya estén aplicados los cambios** (no antes).

## Día 1 — Medir y cerrar lo crítico · *4/6*

- [~] **T1.1 · Diagnóstico de solo lectura en el VPS** (R1, R3, R4, R8) · 1 h
  *Preparada. Falta ejecutarla (SSH de `ssdn` rechazado desde esta sesión):
  `ssh ssdn 'bash -s' < infra/monitoring/vps_readonly_audit.sh` (Paso 1 del runbook).*
- [x] **T1.2 · Guarda de arranque de Turnstile + fail-closed** (R1, D1) · 1,5 h
  *Hecho: `config.py`, `turnstile_service.py`, 8 tests. Sin desplegar. Antes de desplegar, confirmar con
  T1.1 que `ENVIRONMENT=production` y la clave real existen en el VPS, o la API no arrancará.*
- [~] **T1.3 · Higiene de dependencias y secretos** (R11) · 2 h
  *Hecho: sin secretos reales en el historial (solo site keys públicas); `pip-audit` limpio
  («No known vulnerabilities found»); `pnpm audit` de 44 avisos a 3. Falta: parches del SO en el VPS
  (`apt list --upgradable`, en el script de T1.1), y decidir `zod` (alta, exige v4) y
  `postcss-selector-parser` (de Tailwind), sin solución sin salto mayor.*
- [~] **T1.3b · Next.js 14 → 15.5.29** (R11) · 1–2 días
  *Hecho: Next 15.5.29 + React 19.3.1, codemod async API (15 archivos), tipos OK, `next build` OK
  (24 páginas, con fuentes simuladas), prueba de runtime (landing SSR, `/admin` redirige, cabeceras
  CSP). Críticas 3 → 0. Falta: **(a)** build Docker real (esta máquina no llega a Google Fonts; el VPS
  sí), **(b)** revisión visual en navegador de landing, formulario de firma y admin (React 19),
  **(c)** reconstruir `petition-web-dev` local.*
- [x] **T1.3c · FastAPI/Starlette actualizados** (R11) · 0,5–1 día
  *Hecho: FastAPI 0.162.0, Starlette 1.10.0, `python-jose` → PyJWT 2.15.0, `cryptography` 50.0.2,
  `python-multipart` 0.0.33, `jinja2` 3.1.6, `pyarrow` retirado (no se usaba). 302 tests verdes.
  Imagen Docker de producción de la API construida correctamente (1,01 GB).*
- [~] **T1.4 · Correo transaccional: Resend Pro** (R5, D7) · 1 h + trámite
  *Decidido. Falta activar el plan y `RESEND_PLATFORM_PLAN=pro` (Paso 2 del runbook).*

- [ ] **T1.5 · Recuperación del correo de confirmación fuera de la petición** (R5) · 1 día · *MUST, aprobada; falta su spec*
  *Marca de envío por firma, reintentos con reclamo atómico (sin duplicados), límite de velocidad, tope de intentos, tokens nuevos si el enlace caducó, tres visibilidades. Requiere migración.*

## Día 2 — Datos y borde · *1,5/3*

- [~] **T2.1 · RLS: pruebas negativas (+ `042_force_rls` si hace falta)** (R3, D3) · 4 h
  *Hecho: 5 tests (`test_rls_isolation.py`): rol de la app sin superusuario/BYPASSRLS/no dueño, sin lectura,
  escritura, borrado ni inserción cruzada entre organizaciones, y sin firmas secretas/anuladas sin
  contexto. En dev `petition_admin` es dueño y `petition_app` no, así que `FORCE` no es necesario;
  falta confirmar lo mismo en producción (T1.1). **Hallazgos:** ver "Hallazgos" abajo.*
- [~] **T2.2 · Backups cifrados offsite + restore probado** (R4, D4) · 4 h
  *Scripts `infra/backup/pg_backup.sh` y `restore_test.sh` probados en dev (41 firmas = 41 restauradas,
  RTO 1 s). Falta instalarlos en el VPS, elegir el destino offsite y probar el restore real (Paso 4).*
- [~] **T2.3 · Copia de claves críticas** (R4) · 1 h
  *Script `infra/backup/backup_keys.sh` probado (cifra sin imprimir). Falta ejecutarlo en el VPS (Paso 5).*

- [x] **T2.4 · Contexto RLS aislado del pool** (R3) · 2 h
  *Hecho: `set_rls_context` + listener `checkin`; 5 tests con pool de 1 conexión. Ver «Hallazgo T2.4».*

## Día 3 — Borde, IP y observabilidad · *3/4*

- [x] **T3.1 · IP única y propia del proyecto** (R2, D2) · 3 h
  *Hecho: `app/client_ip.py` (solo confía en `CF-Connecting-IP` si la conexión viene de Cloudflare),
  usado por rate limit, `ip_hmac`, login, exportación y endpoint legado; 8 tests. Ya no depende del
  `real_ip` del conf de forms-qsm. Opcional: Paso 6 del runbook para logs de nginx con IP real.*
- [~] **T3.2 · Origen solo desde Cloudflare + validación de Host** (R2) · 2 h
  *Solo runbook (Pasos 6 y 7): servidor por defecto `444` y reglas ufw con rangos de Cloudflare.
  Acción manual en el VPS, con segunda sesión SSH y confirmando que forms-qsm también está tras Cloudflare.*
- [x] **T3.3 · Logs estructurados sin PII + alerta por 5xx** (R6a, D5) · 2 h
  *Hecho: `app/observability.py` (una línea JSON por petición: ruta-plantilla, estado, ms, `X-Request-ID`;
  sin query, cabeceras, cuerpo ni IP; ante excepción solo la clase), 3 tests; `business_signals.sh` alerta
  por 5xx (≥1 % aviso, ≥5 % crítico). La suite total es 305 passed. Sin desplegar.*
- [~] **T3.4 · Monitor externo, Netdata, señales de negocio y alertas por correo** (R6b–d) · 6 h
  *Hecho: `infra/monitoring/healthcheck_remote.sh` (GreenGeeks) y `business_signals.sh` (VPS: firmas
  sin confirmar, cola atascada, backup, disco, memoria, contenedores); SQL validado en dev. Falta
  instalarlos y la prueba real de correo (Pasos 8–10).*

## Día 4 — Capacidad · *1/3*

- [~] **T4.1 · Staging + scripts k6 S0–S7** (R7, D6) · 5 h
  *Hecho: `loadtest/signatures.js` (smoke, ramp, spike, simultaneous, race, soak, read, abuse) y
  `cleanup.sql`. Falta el staging con correo *stub*; **no se debe apuntar a la API dev actual**, que
  tiene `RESEND_API_KEY` real. S7 (caída de Redis/Turnstile) es manual.*
- [ ] **T4.2 · Ejecutar S0–S3 y S5–S7; ajustar** (R7, R8) · 4 h
  *Pendiente (depende del staging). Ajustar `pool_size`, workers, límites y rate limit (CGNAT).*
- [~] **T4.3 · Límites de recursos y pool** (R8) · 1,5 h
  *Hecho (valores iniciales): `mem_limit`/`cpus` en `docker-compose.yml`, `maxmemory` de Redis, pool
  `10 + 10` por worker (`DB_POOL_*`). Se afinan con T4.2.*

## Día 5 — Soak, admin y cierre · *1/6*

- [ ] **T5.1 · Soak S4 (2 h, en segundo plano)** (R7) · 2 h de reloj, 0,5 h de trabajo
- [x] **T5.2 · CSV injection + alerta de exportación anómala** (R10) · 2 h
  *Hecho: `app/csv_safe.py` aplicado a las dos exportaciones de firmas (incluido el sello); 12 tests;
  alerta de >3 exportaciones/hora en `business_signals.sh`. No se aplicó al CSV de portabilidad ARCO (datos del propio
  titular) ni a la exportación legada de formularios.*
- [ ] **T5.7 · Verificación mínima de confirmación y privacidad** (R12, R20) · 3 h · *aprobada; falta su spec*
  *Prueba con escáneres de enlaces (Outlook, Gmail, corporativo) y métrica de confirmaciones <5 s; contrastar aviso de privacidad con proveedores reales y pixel de Brevo; definir quién atiende ARCO y en qué plazo.*
- [ ] **T5.3 · TOTP admin** (R9, D8) · 6 h — *si se decide en Fase 1*; si no, medidas
      mínimas + riesgo aceptado con fecha de revisión · 1 h
- [ ] **T5.4 · Runbook de incidentes + playbooks mínimos** (R11) · 2 h
- [ ] **T5.5 · Congelamiento de cambios, lista de verificación y plan de reversión** (R12, R13) · 1 h
- [ ] **T5.6 · Actualizar `progress/current.md` y `history.md`.**

### Hallazgo T2.4 (contexto RLS filtrado por el pool) — CORREGIDO en código

`set_config(..., false)` dejaba `app.is_platform_admin`/`app.current_org_id` en la conexión física y la
petición siguiente los heredaba. Arreglo: `database.set_rls_context()` guarda el contexto en la sesión y lo
re-aplica con `is_local=true` en cada transacción (`after_begin`); además un listener `checkin` hace `RESET`
al devolver la conexión al pool. Usado en `get_db_with_org`, retención, cola de comunicaciones y el script de
nombres. `tests/test_pool_context_leak.py` (5 tests, pool de 1 conexión). Suite: 310 passed. Sin desplegar.

## Hallazgos nuevos de esta sesión (para decidir)

1. **RLS cubre 16 de las 25 tablas.** Sin RLS y con datos personales: `users`, `organizations`,
   `processing_contracts`, `campaign_allowlist`, `privacy_consents`, `login_audit`, `responses`
   (legada). Su aislamiento depende solo del código de cada endpoint admin → revisar en T7.2.
2. **Políticas anchas por diseño en `signatures`:** `sig_confirm_lookup` deja leer, y `sig_confirm_update`
   confirmar, **cualquier** firma pendiente desde una sesión sin organización; la protección real es
   el filtro por token del código. Los campos `name`, `provincia`, `org_name` e `ip_hmac` no están
   cifrados. Candidato a endurecer en T7.2 (p. ej. política con el token como parámetro de sesión).
3. **Campañas `draft` son legibles públicamente** a nivel de BD (modo prueba, con `is_test`). Intencional.
4. **Endpoint legado `POST /v1/public/verify-turnstile`** (del código de forms-qsm) responde si un
   token es válido: sirve de oráculo y no tiene límite propio. Y `/v1/public/c/{slug}/respond` es otra
   superficie heredada. Candidatos a retirar si ya no se usan.
5. **Resend Pro y cupo:** el contador de cupo de la app (`resend_daily_quota`, Redis) es del pool de
   comunicaciones; la alerta de uso del correo **transaccional** (R5) debe configurarse en el panel de
   Resend (no verifiqué que el envío de confirmación lo consulte).

> Si el plazo aprieta, el orden de recorte es: TOTP (T5.3 → medidas mínimas) → soak
> reducido a 30 min → S7 manual. **No se recorta:** T1.2, T2.1, T2.2, T3.1–T3.4, T4.2, R5. El monitoreo de la Fase 1 ya
> no incluye Sentry: su ausencia es un riesgo abierto (sin stack traces ni errores del
> navegador) hasta T6.1b.

### Criterios de salida (go / no-go de lanzamiento)

- [ ] Turnstile no puede quedar abierto en producción (arranque falla sin clave).
- [ ] Restore de backup probado, con RPO/RTO anotados.
- [ ] Pruebas de aislamiento entre organizaciones en verde; FORCE RLS aplicado o descartado con evidencia.
- [ ] Rate limit distingue IP reales (prueba con IP distintas); origen cerrado a Cloudflare.
- [ ] Confirmación por correo con capacidad ≥ 3.000/día y alerta al 70 %.
- [ ] S1–S3 y S5–S7 cumplen los criterios de R7; S4 sin fugas.
- [ ] Una alerta de prueba real llega **por correo** al canal de guardia, desde el monitor
      externo y desde Netdata, con el SMTP independiente; los logs de error no contienen PII.
- [ ] Sin vulnerabilidades altas/críticas abiertas sin decisión escrita.

### Umbrales de alerta iniciales (a calibrar con S1–S5)

| Señal | Aviso | Crítico |
|-------|-------|---------|
| `/api/health` | 1 fallo | 2 fallos seguidos (≈2 min) |
| 5xx del alta de firma | > 1 % en 5 min | > 5 % en 5 min |
| Latencia p95 del alta | > 1,5 s | > 3 s |
| Fallos de Turnstile | > 20 % | > 50 % (¿caída de Cloudflare o ataque?) |
| 429 (rate limit) | > 10 % | > 30 % |
| Firmas `pending_confirmation` > 15 min | > 10 % | > 25 % (correo roto) |
| Cupo de correo diario | 70 % | 90 % |
| Backlog de la cola de correo | > 1.000 | > 5.000 o lote en `sending` > 10 min |
| Conexiones de BD | > 70 % | > 90 % |
| Memoria de contenedor | > 75 % del límite | > 90 % |
| Disco | > 70 % | > 85 % |
| Backup diario | — | fallo u omitido |

---

# FASE 2 — Durante la campaña o al cierre

**Progreso de la fase: 0 %** (0 completadas, 0 con ajustes, 24 pendientes de 24).
Sub-avance por ola: A 0/8 · B 0/8 · C 0/8.

Se ejecuta por oleadas; el monitoreo decide qué se adelanta. Horizonte orientativo
(desde el lanzamiento): **Ola A** semanas 1–2 · **Ola B** semanas 3–6 · **Ola C** al cierre y después.

## Ola A — Primeras semanas (con la campaña en marcha, sin desplegar en picos)

- [ ] **T6.1 · Revisión diaria de tablero y alertas** durante 14 días; ajustar umbrales. (R6)
- [ ] **T6.1b · Rastreador de errores (GlitchTip propio o Sentry SaaS) con scrubbing
      verificado por tests, API + web.** Si es Sentry SaaS: RAT, contrato y adenda. (R14b)
- [ ] **T6.2 · TOTP admin** si quedó fuera de Fase 1. (R9)
- [ ] **T6.3 · Decisión sobre el pixel de Brevo y verificación de DPA/regiones** de los
      subencargados (Brevo, Resend, SES, Cloudflare, Sentry). (R26, R27)
- [ ] **T6.4 · Cloudflare:** MFA de hardware, tokens mínimos, DNSSEC, reglas de rate
      limiting/WAF para el endpoint de firma. (R27, R21)
- [ ] **T6.5 · Interfaz ARCO** (backend listo) y revisión del aviso de privacidad. (R26)
- [ ] **T6.6 · Caché del contador y de la landing** si S5/monitoreo lo piden
      (`cache-contador`). (R24)
- [ ] **T6.7 · Respuestas uniformes anti-enumeración** (R21) *y/o* confirmación POST
      anti-escáner (R22) según métricas de abuso.

## Ola B — Semanas 3–6 (estructurales, en staging y con ventana)

- [ ] **T7.1 · Cola de correo en worker separado** con persistencia incremental. (R23)
- [ ] **T7.2 · Roles de BD por función + pruebas de aislamiento en CI + revisión de
      bypass `platform_admin`.** (R16)
- [ ] **T7.3 · Logs de auditoría fuera del host (WORM) + alertas de privilegios, cambios
      de DNS/borde y exportaciones.** (R17)
- [ ] **T7.4 · CI/CD:** protección de ramas, SBOM, SCA continuo, imágenes por digest,
      escaneo de secretos, separación despliega/aprueba. (R18)
- [ ] **T7.5 · Exportación gobernada:** cifrado, expiración, *watermark*, doble aprobación. (R20)
- [ ] **T7.6 · Contenedores endurecidos** (no root, FS de solo lectura, `cap_drop`,
      seccomp). (R15)
- [ ] **T7.7 · Resolución multi-dominio endurecida y alta de dominio con verificación DNS.** (R25)
- [ ] **T7.8 · Prueba de restauración trimestral y ejercicio de caos** (caída de Redis,
      del proveedor de correo). (R23, R4)

## Ola C — Al cierre de la campaña y después

- [ ] **T8.1 · Gestión de claves madura:** envelope encryption (DEK por organización),
      KEK externa, rotación probada, claves HMAC por finalidad. (R14)
- [ ] **T8.2 · Producción en host/cuenta dedicada, red de egreso restringida, TLS interno.** (R15)
- [ ] **T8.3 · WebAuthn/FIDO2, bastion/VPN, cuentas *break-glass*, *offboarding*.** (R19)
- [ ] **T8.4 · Definición jurídica de “firma ciudadana”, EIPD/DPIA, RAT revisado, borrado
      coherente en backups.** (R26)
- [ ] **T8.5 · Tabletop** (fuga de PII, manipulación del conteo, ransomware, DNS,
      requerimiento legal) y playbooks completos. (R17)
- [ ] **T8.6 · Auditoría independiente** (Opción A o B) y **re-test** de críticos/altos;
      luego bug bounty privado. (R29)
- [ ] **T8.7 · Comité, registro de riesgos con aceptación formal y métricas de gobierno.** (R28)
- [ ] **T8.8 · Retrospectiva de la campaña y reordenamiento de la Fase 2.** (R30)

---

## Mapa hipótesis de la propuesta → tarea

| Hipótesis | Fase 1 | Fase 2 |
|-----------|--------|--------|
| H-01 Turnstile | T1.2 | — |
| H-02 IP/origen | T3.1, T3.2 | T6.4 |
| H-03 VPS compartido | T4.3 (límites) | T7.6, T8.2 |
| H-04 Custodia de claves | T2.3 | T8.1 |
| H-05 HMAC correlacionable | — | T8.1 |
| H-06 Aislamiento multi-tenant | T2.1 | T7.2 |
| H-07 Identidad admin | T5.3 | T6.2, T8.3 |
| H-08 Confirmación por GET | — | T6.7 |
| H-09 Abuso distribuido/enumeración | S6, T3.4 | T6.4, T6.7 |
| H-10 Exportación | T5.2 | T7.5 |
| H-11 Cola acoplada | S7 | T7.1 |
| H-12 Backups/recuperación | T2.2, T2.3 | T7.8 |
| H-13 Detección y respuesta | T3.3, T3.4, T5.4 | T6.1b, T7.3, T8.5 |
| H-14 Cadena de suministro | T1.3 | T7.4 |
| H-15 Host/multi-dominio | T3.2 | T7.7 |
| H-16 Capacidad/DDoS | T4.1–T4.3, T3.4 | T6.4, T6.6 |
| Hallazgo transversal (“firma”) | — | T8.4 |
| Gobierno y auditoría externa | — | T8.6, T8.7 |
