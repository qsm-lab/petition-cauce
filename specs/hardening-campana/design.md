# Design — hardening-campana

Ver `requirements.md` (R1–R30). Esta spec es transversal: una feature con tareas
separadas por fase y por área, cada una desplegable y reversible por separado.

## Archivos afectados (Fase 1)

| Área | Archivos |
|------|----------|
| Turnstile / config | `apps/api/app/services/turnstile_service.py`, `apps/api/app/config.py`, `apps/api/app/main.py` (guarda de arranque) |
| IP / origen | `infra/nginx/cauce.ecuadornotlc.org.conf` (+ archivo incluido con rangos Cloudflare), `apps/api/app/limiter.py`, `apps/api/app/services/signature_service.py`, firewall del VPS (fuera del repo, documentado en `docs/engineering/`) |
| Host | `apps/api/app/dependencies.py` o middleware de resolución de dominio; `apps/web/src/middleware.ts` |
| RLS | nueva migración `042_force_rls.py`, `apps/api/tests/test_rls_isolation.py` |
| Backups | `infra/backup/` (script, cron, README), `docs/engineering/runbook_backup_restore.md` |
| Correo transaccional | `apps/api/app/services/email_service.py`, `app/config.py`, métrica de cupo |
| Monitoreo (Fase 1) | `apps/api/app/observability.py` (logs JSON sin PII, `request_id`), `infra/monitoring/` (script de señales de negocio, config de Netdata, script de disponibilidad/Uptime Kuma, README) |
| Rastreador de errores (Ola A) | `apps/api/app/main.py`, `apps/web/sentry.*.config.ts`, `apps/web/next.config.js` (CSP), `apps/api/requirements.txt` |
| Carga | `loadtest/` (k6: scripts + README), staging compose |
| Recursos | `docker-compose.yml` (`mem_limit`, `cpus`), `apps/api/app/database.py` (pool) |
| Admin | `apps/api/app/routers/auth.py`, nueva migración (secreto TOTP cifrado), UI de login/enrolamiento |
| Exportación | servicio de export CSV, `pii_export_audit` |

## Decisiones

**D1 — Turnstile fail-closed (R1).** Guarda en el arranque (como `HMAC_SECRET_KEY`),
no solo en la verificación. Se mantiene el bypass explícito en `development`/`test`.

**D2 — IP única (R2).** La verdad es lo que nginx restaura desde `CF-Connecting-IP`,
confiando solo en rangos de Cloudflare (`set_real_ip_from`). FastAPI lee `X-Real-IP`
(el valor ya restaurado) en rate limit y en `ip_hmac`; se elimina la divergencia. Los
rangos de Cloudflare cambian poco: lista versionada + script de actualización. Con el
origen cerrado a Cloudflare, un cliente no puede falsificar la cabecera.
*Nota CGNAT:* en Ecuador muchos usuarios móviles comparten IP; 5/min por IP puede
bloquear firmas legítimas el día del pico. Se valida en R7 y se ajusta (p. ej. 10/min +
límite por huella de dispositivo o por campaña) antes de lanzar.

**D3 — RLS (R3).** Primero se **mide** (consulta a `pg_roles`, `pg_class.relowner`).
Si `petition_app` es dueño de las tablas, la migración transfiere la propiedad a un
rol de migraciones, aplica `FORCE ROW LEVEL SECURITY` en las tablas con PII y se
prueba con la suite completa. Los bypass `platform_admin` por transacción en rutas
públicas se mantienen y se documentan (Fase 2, R16).

**D4 — Backup (R4).** `pg_dump -Fc` diario → cifrado (`age`/GPG, clave pública en el
VPS, privada fuera) → copia offsite (almacenamiento de objetos con retención y, si es
posible, *object lock*). Retención sugerida 14 diarios + 8 semanales. Las claves
`.env` críticas, en gestor de secretos o sobre cifrado aparte. Restore trimestral y
tras cada cambio de esquema mayor. Consecuencia LOPDP: el backup contiene PII; la
política de retención/borrado debe contemplarlo (R26).

**D5 — Monitoreo (R6, R14b).** Decisión (sesión 45): Sentry **no** entra en la Fase 1
(su carga legal —subencargado, RAT, DPA, adenda— y de pruebas de scrubbing compite con
tareas críticas). La Fase 1 usa herramientas de código abierto; el canal de guardia es
**solo correo**.
- *Errores (Fase 1):* logs JSON de la API con ruta, código y `request_id`, sin PII; un
  script revisa el conteo de 5xx por ventana y avisa.
- *Errores (Ola A, R14b):* **GlitchTip** autoalojado en el host del monitor (o Sentry
  SaaS) con el SDK de Sentry (`sentry-sdk[fastapi]`, `@sentry/nextjs`),
  `send_default_pii=False`, `before_send`/`before_breadcrumb` que eliminan cuerpos,
  cabeceras, cookies, query strings y campos con nombre de PII; sin *session replay*;
  `traces_sample_rate` 0,05–0,1; CSP ajustada. Pasar de uno a otro es cambiar la DSN.
  Sentry autoalojado queda descartado (~16 GB de RAM).
- *Disponibilidad:* **Uptime Kuma** en un host **fuera del VPS principal** (GreenGeeks u
  otro). Si el plan del hosting es compartido (cPanel) y no admite contenedores, se usa
  un script PHP/shell por cron (cada 1–5 min según el plan) que pide `/api/health` y la
  landing y avisa tras dos fallos seguidos; sin panel ni histórico. Si es VPS, Uptime
  Kuma completo con monitores *push*.
- *Host y contenedores:* **Netdata** en el VPS (CPU, RAM, disco, red por contenedor),
  alertas enviadas hacia fuera.
- *Señales de negocio:* script cron que consulta la BD (firmas `pending_confirmation`
  envejecidas, backlog de `send_batch`, cupo de correo por proveedor, último backup) y
  reporta a Uptime Kuma (monitor *push*) o directamente por correo.
- *Canal:* correo a los responsables de guardia. El SMTP de las alertas es independiente
  de Resend/Brevo de la plataforma (SMTP del hosting o cuenta aparte), de modo que un
  agotamiento de cupo no silencie las alertas. Los correos de alerta nunca incluyen PII.
- *Métricas de negocio y capacidad:* endpoint interno `/metrics` (no público) o
  logs estructurados con contadores: firmas por minuto, tasa `pending_confirmation`
  > 15 min, fallos de Turnstile, 429, latencia, backlog de `send_batch`, cupo de
  correo por proveedor, pool de BD, memoria/CPU por contenedor (cAdvisor o
  `docker stats` periódico) y disco. Umbrales iniciales en `tasks.md`.
- *Alertas:* canal doble (correo + mensajería móvil), con quien está de guardia
  nombrado y horario durante los primeros 7 días del lanzamiento.

**D6 — Pruebas de carga y saturación (R7).**
- Herramienta: **k6** (scripts JS versionados en `loadtest/`), ejecutado **desde fuera
  del VPS** (laptop o máquina cloud), nunca desde el servidor probado.
- Entorno: staging con la misma imagen y configuración, base de datos sintética,
  Turnstile con clave de prueba y transporte de correo *stub* (sin enviar). Si staging
  comparte el VPS con forms-qsm, se acuerda una ventana y se aplican límites de CPU/RAM
  a los contenedores de prueba para que no afecten a forms-qsm; preferible un host
  temporal separado.
- Escenarios (cada uno con umbrales en k6 `thresholds`):

| # | Escenario | Perfil | Qué busca |
|---|-----------|--------|-----------|
| S0 | Smoke | 1–5 usuarios, 1 min | Sanidad del script y entorno |
| S1 | Rampa | 0 → 30 firmas/s en 10 min | Punto de quiebre y cuello de botella |
| S2 | Pico (spike) | 5 → 100 usuarios/s en 30 s, 2 min, vuelta a 5 | Saturación súbita, recuperación, 429/503 controlados |
| S3 | Simultaneidad | 200 envíos en el mismo segundo | Carreras en índice único, pool de BD, Redis |
| S4 | Soak | 5 firmas/s, 2 h | Fugas de memoria/conexiones, deriva del lock de la cola |
| S5 | Lectura masiva | 500 usuarios navegando landing + contador + feed | SSR, caché, `resolveDomain` |
| S6 | Abuso | Un mismo IP y muchos IP con reutilización de correo/cédula | Rate limit, 409/422, sin firmas duplicadas |
| S7 | Fallo de dependencia | Detener Redis / simular timeout de Turnstile y proveedor de correo | Degradación y recuperación, sin pérdida de firmas |

  Los datos generados llevan un dominio de correo reservado (`@loadtest.invalid`) y se
  purgan al terminar. Cada ejecución produce un informe (p50/p95/p99, errores, CPU/RAM,
  conexiones de BD, backlog de correo) en `loadtest/reports/` (ignorado si contiene datos).
- Resultado: valores finales de workers, `pool_size`, límites de memoria y rate limit.

**D7 — Correo transaccional (R5).** El flujo de firma usa `EMAIL_PROVIDER`
(hoy Resend Free: 100/día + pool de lotes con Brevo/Resend para envíos masivos). Con
20.000 firmas, los topes gratuitos no alcanzan en picos. Opciones: Resend Pro
(50.000/mes; ya se usó en sesión 42), SES fuera de sandbox (pendiente de AWS) o
Brevo de pago. Mientras no haya capacidad, las firmas quedan `pending_confirmation`
y el usuario no recibe el enlace: **el conteo público se estanca aunque haya firmas**.
Diseño: alerta de cupo al 70 %, y reenvío masivo de pendientes reutilizando la cola.

**D8 — TOTP (R9).** `pyotp`, secreto cifrado con AES-GCM, códigos de recuperación
hasheados, aplicación en el login tras la contraseña. Alcance mínimo: roles `admin` y
gestores exportadores. Sin SMS.

## Seguridad / LOPDP

- En la Fase 1 el monitor solo guarda URLs y estados (sin PII) y no es subencargado. El
  rastreador de errores de la Ola A (GlitchTip propio o Sentry SaaS) sí trata PII
  incidental: si es Sentry SaaS → `app/legal/subencargados.py`, RAT, contrato y adenda
  (ver `docs/legal/subencargados_email.md` §4); si es GlitchTip propio, se documenta como
  almacenamiento propio.
- `privacy_config`: esta feature **no recoge PII nueva** de los firmantes. Trata PII
  incidental en errores/logs; el control es el scrubbing de D5 y de R14b. Los datos de las
  pruebas de carga son sintéticos. Los backups contienen PII cifrada (D4).
- Sin pantallas nuevas salvo el enrolamiento TOTP del admin (formulario mínimo con el
  sistema de diseño existente; se confirma con el usuario si requiere pasar por Claude
  Design antes de implementar, según CLAUDE.md).

## Riesgos y reversión

- `FORCE RLS` puede romper rutas que dependen de ser dueño de las tablas: prueba con la
  suite completa y en staging; la migración tiene `downgrade`.
- Cerrar el origen a Cloudflare puede dejar fuera al propio equipo (acceso directo); se
  mantiene el acceso por SSH/túnel y una regla de emergencia documentada.
- La guarda de Turnstile impide arrancar si la clave falta: se verifica la variable en el
  VPS **antes** de desplegar. Reversión: variable temporal `ALLOW_INSECURE_TURNSTILE=1`
  solo en `staging`.
- Las pruebas de carga pueden afectar a forms-qsm si comparten host: ventana acordada,
  límites de recursos, plan de parada (R7).
