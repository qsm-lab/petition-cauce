# Requirements — hardening-campana

Origen: propuesta de auditoría `docs/auditoria-ciberseguridad-plataforma-firmas.pdf`
(local, no versionada; hipótesis H-01…H-16), contrastada con el código el 2026-11-06.
Alcance completo de la propuesta, dividido en dos momentos.

**Carga objetivo:** 10.000–20.000 firmas en 30–45 días. Promedio bajo (~300–700
firmas/día) pero con **picos**: lanzamiento, difusión en redes y cierre. Hipótesis
de diseño: hasta ~3.000 firmas en la primera hora y ~100 envíos simultáneos de
formulario en el pico más agudo.

**Fase 1 — Antes del lanzamiento (3–5 días).** Pertinente y necesario para operar la
campaña con riesgo aceptable.
**Fase 2 — Durante la campaña o al cierre.** Estructural, de revisión o de
maduración; se ajusta según lo que muestre el monitoreo de la Fase 1.

Prioridad: **MUST** = bloquea el lanzamiento · **SHOULD** = recomendado si cabe en el plazo.

---

## FASE 1 — Antes del lanzamiento

- **R1 (MUST, H-01)** — WHEN `ENVIRONMENT=production`, la API SHALL negarse a arrancar si
  `TURNSTILE_SECRET_KEY` está vacía o es una clave de prueba de Cloudflare. `verify_turnstile`
  SHALL fallar cerrado (devolver `False`) ante error de red, timeout o respuesta inválida
  en producción, y registrar el evento como métrica.
- **R2 (MUST, H-02, H-15)** — La IP real del cliente SHALL derivarse de una única fuente
  confiable (`CF-Connecting-IP` restaurada por nginx con `set_real_ip_from` de rangos
  Cloudflare) **definida en la configuración de este proyecto**, no en la de forms-qsm.
  El rate limit y `ip_hmac` SHALL usar la misma IP. El origen (443) SHALL aceptar tráfico
  solo desde rangos de Cloudflare. El `Host` SHALL validarse contra la tabla `domains`
  (host desconocido → 404/421, sin branding ni enlaces generados con ese host).
- **R3 (MUST, H-06)** — El rol `petition_app` SHALL NO ser dueño de las tablas ni tener
  `BYPASSRLS`/superusuario. Las tablas con PII SHALL tener `FORCE ROW LEVEL SECURITY`.
  SHALL existir pruebas negativas automatizadas: gestor de la organización A no ve ni
  modifica firmas, consentimientos, exportaciones ni comunicaciones de B (API y consulta
  directa con el contexto GUC cruzado).
- **R4 (MUST, H-12, H-04 mínimo)** — SHALL existir respaldo diario de `petition-db`
  (`pg_dump` cifrado), copia fuera del VPS, retención definida y **un restore real
  probado** en una base temporal con medición de RPO/RTO. Las claves `PII_ENCRYPTION_KEY`,
  `HMAC_SECRET_KEY` y `PROVIDER_SECRET_KEY` SHALL tener copia cifrada y separada de los
  backups de datos, con procedimiento de recuperación escrito. `PROVIDER_SECRET_KEY`
  SHALL ser dedicada (sin fallback a `PII_ENCRYPTION_KEY`).
- **R5 (MUST, H-16 / correo)** — La capacidad de correo **transaccional** (confirmación de
  firma y agradecimiento) SHALL cubrir el pico: con ≈20.000 firmas y confirmación por
  correo, el proveedor del flujo de firma SHALL permitir ≥ 3.000 correos en un día. SHALL
  decidirse y activarse un plan de pago o un proveedor aprobado (SES fuera de sandbox,
  Resend Pro) y alertar cuando el uso diario supere el 70 % del cupo. Las confirmaciones
  no enviadas SHALL quedar reintentables (cola o reenvío masivo), no perdidas.
- **R6 (MUST)** — Monitoreo y alertas de código abierto (ver `design.md` D5):
  (a) errores de la API SHALL registrarse como logs estructurados (ruta, código, id de
  petición, sin cuerpo, cabeceras, cookies, correo, cédula, nombre ni IP en claro) con
  alerta por conteo de 5xx; el rastreador de errores (GlitchTip o Sentry) pasa a la Fase 2
  (R14b);
  (b) monitor de disponibilidad **fuera del VPS principal** sobre `/api/health` y la
  landing (Uptime Kuma, o un script con cron si el host disponible no admite contenedores);
  (c) alertas por **correo** a los responsables de guardia por: tasa de 5xx, latencia p95
  del alta de firma, fallos de Turnstile, 429 anómalos, firmas `pending_confirmation`
  envejecidas, backlog de la cola de correo, cupo de correo, espacio en disco, memoria
  de contenedores y fallo del backup. El correo de alertas SHALL salir por una vía
  **independiente** de Resend/Brevo de la plataforma (SMTP del hosting o cuenta aparte),
  para que un agotamiento de cupo no silencie las alertas;
  (d) métricas de host y contenedores con Netdata (u equivalente) y alertas hacia fuera;
  (e) si el host del monitor guarda datos de terceros, SHALL registrarse como subencargado
  (RAT / contrato); un monitor que solo guarda URLs y estados no lo requiere.
- **R7 (MUST)** — Pruebas de carga y saturación (ver `design.md` D6): SHALL ejecutarse
  contra un entorno de staging, con datos sintéticos y Turnstile de prueba, los
  escenarios *smoke*, *rampa*, *pico (spike)*, *simultaneidad* y *soak*, más lectura
  masiva de la landing/contador. Criterios de aceptación: p95 del alta ≤ 1,5 s y tasa de
  error de servidor < 1 % con 100 envíos simultáneos; sin firmas perdidas ni duplicadas;
  conexiones de BD por debajo del tope; memoria estable en *soak*; la API degrada con
  429/503 controlados, no con caída. Las pruebas NO SHALL apuntar a producción ni a
  forms-qsm.
- **R8 (MUST, H-16, H-03 mitigación)** — Los contenedores SHALL tener límites de memoria
  y CPU, `restart` y `healthcheck`; el pool de conexiones SQLAlchemy SHALL
  dimensionarse explícitamente (`pool_size`, `max_overflow`, `pool_timeout`) según el
  tope de `max_connections` de PostgreSQL y los 2 workers de uvicorn. Los resultados de
  R7 SHALL fijar los valores.
- **R9 (SHOULD, H-07)** — El acceso a `/admin` SHALL exigir segundo factor TOTP para los
  roles `admin` (plataforma) y gestores con permiso de exportación; sesión corta y
  revocación al cambiar la contraseña. Si no cabe en el plazo: reducir
  `PLATFORM_ADMIN_EMAILS` al mínimo, rotar contraseñas, acortar el JWT y registrar la
  aceptación de riesgo con fecha de revisión (Fase 2, R19).
- **R10 (MUST, H-10 mínimo)** — Toda exportación CSV/Excel SHALL neutralizar *CSV
  injection* (prefijos `= + - @` y tab/CR en celdas de texto) y quedar en
  `pii_export_audit`; SHALL alertarse una exportación fuera de lo normal (volumen o
  frecuencia).
- **R11 (MUST, H-13/H-14 mínimo)** — Antes del lanzamiento: `pip-audit` y `npm audit`
  sin vulnerabilidades altas/críticas sin explicación; escaneo de secretos del repo
  (que es público) y del historial; parcheo del SO del VPS; revisión de que
  `.env`/claves no estén en imágenes ni logs. `docs/legal/runbook_brechas.md` SHALL
  completarse con contactos, árbol de decisión y tres playbooks mínimos (fuga de PII,
  toma de cuenta admin, caída de DNS/Cloudflare).
- **R12 (MUST)** — Cada tarea de Fase 1 con efecto en producción SHALL tener plan de
  reversión. Ningún despliegue SHALL ocurrir con un envío masivo en curso (ver
  runbook de colas).
- **R13 (MUST)** — Control de cambios: congelar despliegues no urgentes desde 48 h antes
  del lanzamiento hasta 72 h después.

## FASE 2 — Durante la campaña o al cierre

Cada requisito indica su disparador de adelanto: una señal del monitoreo que lo sube a
urgente.

- **R14 (H-04, H-05)** — Gestión de claves madura: envelope encryption con DEK por
  organización/finalidad y KEK externa (KMS u otra custodia fuera del host), rotación
  probada de las claves de cifrado y de HMAC (con re-hash/re-cifrado controlado), y
  separación de claves HMAC por finalidad (búsqueda, rate limit, tokens, logs).
  *Adelantar si:* sospecha de fuga del `.env` o del host.
- **R14b (H-13)** — Rastreador de errores (Ola A, semanas 1–2 de campaña): **GlitchTip
  autoalojado** en el host del monitor (preferido, sin subencargado nuevo) o **Sentry
  SaaS**, ambos con el SDK de Sentry en API y web, `send_default_pii=False`, scrubbing
  verificado por tests (sin cuerpos, cabeceras, cookies, correo, cédula, nombre ni IP),
  sin *session replay* y muestreo bajo. Cambiar entre ambos SHALL requerir solo cambiar
  la DSN.
- **R15 (H-03)** — Aislamiento de infraestructura: producción en host o cuenta dedicada
  (fuera del VPS compartido con forms-qsm), red de egreso restringida, contenedores
  endurecidos (usuario no root, sistema de archivos de solo lectura, `cap_drop`,
  seccomp/AppArmor), PostgreSQL/Redis sin exposición ni comandos peligrosos, TLS
  interno y firewall de origen verificado.
- **R16 (H-06)** — Pruebas adversariales de aislamiento multi-tenant en CI en cada
  cambio de migración o política; roles de BD por función (app, jobs, lectura); revisión
  de `SECURITY DEFINER`, `search_path` y de cada bypass `app.is_platform_admin` en rutas
  públicas (confirmación por token, firma con política).
- **R17 (H-13)** — Detección y respuesta: logs de auditoría fuera del host (WORM/almacenamiento
  inmutable), NTP confiable, alertas sobre exportaciones, cambios de rol/privilegios,
  accesos fuera de patrón y cambios de DNS/borde; ejercicio *tabletop* (fuga de PII,
  manipulación del conteo, ransomware, DNS comprometido, requerimiento legal).
- **R18 (H-14)** — Cadena de suministro: SBOM por release, SCA continuo, imágenes fijadas
  por digest, protección de ramas y revisiones obligatorias, secretos de CI mínimos,
  *runners* aislados, firma de artefactos, y separación de quien despliega y quien aprueba.
- **R19 (H-07)** — Identidad privilegiada alta: WebAuthn/FIDO2 para todo el que administra,
  SSO si procede, cuentas *break-glass* selladas y revisadas, acceso SSH por bastion/VPN
  con claves de hardware, inventario de accesos y *offboarding*.
- **R20 (H-10)** — Exportación gobernada: archivo cifrado con clave aparte, enlace con
  expiración y un solo uso, *watermark* por solicitante, doble aprobación para volúmenes
  altos y revocación; inventario de copias secundarias (exportaciones, backups, colas,
  logs, correo).
- **R21 (H-09)** — Anti-abuso y enumeración: respuestas uniformes que no revelen si un
  correo/cédula ya firmó (o con límite y retardo), límite por campaña y por rango de IP
  además del límite por IP, reglas WAF/rate limiting de Cloudflare, detección de
  ráfagas, y la feature `deduplicacion-robusta`.
- **R22 (H-08)** — Confirmación a prueba de escáneres: la visita GET al enlace del correo
  muestra una página intermedia y la confirmación ocurre con POST (o validación de
  interacción humana), sin romper idempotencia; evidencia de acto consciente en el
  consentimiento.
- **R23 (H-11)** — Cola de correo desacoplada de la API: *worker* propio (otro contenedor)
  con persistencia incremental dentro de lotes, reintentos idempotentes, *backpressure* y
  métricas; la caída de Redis o del proveedor se ensaya y no pierde ni duplica envíos.
- **R24 (H-16)** — Capacidad sostenida: caché Redis del contador (`cache-contador`), caché
  de borde para la landing pública, `Cache-Control` correcto y claves de caché por host,
  pruebas de carga periódicas y planes de capacidad con vCPU/uso medidos por
  contenedor; revisión de DDoS con Cloudflare (reglas, *under attack*).
- **R25 (H-14, H-15)** — Resolución multi-dominio endurecida: normalización de Host/IDNA,
  allowlist en nginx y API, claves de caché por host, controles contra *takeover* de
  dominios y alta de dominio propio con verificación DNS (hoy es manual).
- **R26 (privacidad, hallazgo transversal)** — Definición jurídica y probatoria de “firma
  ciudadana” (qué se firma, qué evidencia se conserva, qué anonimato se promete, cómo se
  demuestra integridad con el mínimo de datos); EIPD/DPIA por tratarse de datos de
  afiliación/apoyo ambiental; RAT revisado; avisos por capas; interfaz ARCO completa
  (el backend ya existe); borrado coherente en réplicas y backups según la política de
  retención; verificación de DPA y regiones de cada subencargado (Brevo, Resend, SES,
  Cloudflare, Sentry, hosting).
- **R27 (H-03, proveedores)** — Cuenta de Cloudflare con MFA de hardware, tokens de API
  mínimos, DNSSEC y registrar protegido con *registry lock*; decisión sobre el pixel de
  seguimiento de Brevo (abierta desde sesión 44); plan de *bypass*/continuidad si cae un
  proveedor de correo o de borde.
- **R28 (gobierno)** — Comité mínimo (producto, seguridad, privacidad/legal, operaciones),
  registro de riesgos con aceptación formal y fecha de revisión, separación de
  funciones, y métricas: tiempo de parcheo, edad de secretos, restauraciones exitosas,
  accesos privilegiados, copias de PII activas, MTTD/MTTR.
- **R29** — Auditoría independiente post-campaña: **Opción A** (diagnóstico focalizado)
  si el presupuesto es limitado, **Opción B** (integral, ASVS L2) con re-test
  obligatorio de críticos/altos; pentest de la aplicación y API con autorización
  escrita y entorno de staging; bug bounty privado una vez cerrados los críticos.
- **R30** — Retrospectiva de la campaña: revisar los datos del monitoreo (picos reales,
  errores, correos, abuso), actualizar el modelo de amenaza y reordenar la Fase 2.
