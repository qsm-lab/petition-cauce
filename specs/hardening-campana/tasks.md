# Tasks — hardening-campana (primera propuesta de plan)

Estado: `in_progress` (spec aprobada). Referencias Rn → `requirements.md`; decisiones Dn → `design.md`.
Estimaciones en horas de trabajo efectivo, orientativas. **Empezar por la «Ruta crítica al lanzamiento»** (abajo): reordena lo
pendiente según lo que protege la campaña y deja fuera lo que puede esperar.

## Progreso

**Al 14 nov 2026 (`bash infra/progress.sh`):** Fase 1 **78 %** (17 completadas, 5 con ajustes, 3 pendientes de 25) · Fase 2 0 %.
La tabla de abajo es la foto del 6 nov y se conserva como histórico.

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
- [ ] **Staging:** de hecho se usó un entorno aislado en el Mac (ver T4.1). Confirmar que basta o pedir un host temporal para el soak y S7. (D6)
- [x] **Destino de backups offsite:** *decidido* — R2 UE. Falta anotar quién guarda la clave privada de cifrado. (R4)
- [ ] **Fecha objetivo de lanzamiento** y persona de guardia los primeros 7 días. *Abierta a propósito: se define cuando se decida crear la nueva campaña.* (R6, R13)

---

# Ruta crítica al lanzamiento (reordenada el 14 nov 2026)

Análisis de la sesión 48: lo que protege de verdad ya está en producción (Turnstile fail-closed, aislamiento RLS, respaldos con
restauración probada, origen cerrado a Cloudflare, caché de lecturas, pruebas de carga y soak). El riesgo principal ya no es un
ataque sino que **el correo de confirmación no llegue** (52 % de confirmación en la campaña anterior, Outlook lo manda a Junk).
Lo que queda se agrupa en tres bloques; **≈ 1,5–2 días** de trabajo en total.

## Bloque A — Código (Claude, ≈ 3 h, un solo deploy) · *hecho en local, sin commitear ni desplegar*

- [x] **A1 · Límite de altas por IP configurable, 5 → 20/min** (`SIGNATURE_RATE_LIMIT`). CGNAT móvil y wifi de actos presenciales;
      Turnstile, cédula e índice único siguen frenando el abuso. Cerrar en caliente: runbook de incidentes §3.5. *Cierra el ajuste de rate limit de T4.2.*
- [x] **A2 · Retirado `POST /v1/public/verify-turnstile`** (hallazgo 4): sin uso en la web, sin límite de tasa, oráculo de tokens y
      una petición saliente a Cloudflare por llamada. `/c/{slug}/respond` se queda: lo usa `FormRenderer` (formularios heredados).
- [x] **A3 · Entregabilidad del correo:** todos los correos llevan **parte en texto plano** (`app/services/email_text.py`; Resend `text`,
      SES `Body.Text`, Brevo `textContent`) y la confirmación sale con el **nombre de la organización** como remitente visible
      (`"Colectivo Río" <info@…>`; nombre saneado, *encoded-word* en SES). Antes: solo HTML y sin nombre visible (señales de spam).
- [x] **A4 · Criterios go/no-go** marcados con la evidencia que ya existía; S7 (Turnstile caído) documentado en el runbook §3.4.
- [ ] **A5 · Desplegar** A1–A3 (fuera de cualquier envío masivo; R12). Tras el deploy: una firma real de prueba y «Mostrar original»
      para ver `text/plain` y el nombre del remitente. **Si se cambia `RESEND_FROM_EMAIL` a un valor con nombre, ese nombre manda.**

Tests: `tests/test_entregabilidad_correo.py` (12). Suite: 406 passed + 1 fallo del test inestable conocido de
`test_confirmation_email.py` (falla también sin estos cambios, un test distinto en cada pasada: deuda abierta).

## Bloque B — Verificación manual (usuario, ≈ 2–3 h, **una sola sesión** con `test-fresh` activa)

- [ ] **B1 · V6 reducido:** Gmail (app), un Outlook/Hotmail **antiguo** y un corporativo. iCloud y Yahoo, opcionales.
- [ ] **B2 · S8:** confirmar desde el correo, página de éxito y redirección.
- [ ] **B3 · S5 (accesibilidad):** 360 px en un Android y recorrido completo con teclado (Tab/Enter/Esc) en el diálogo de firma.
- [ ] **B4 · Escáner:** con el corporativo, **sin pulsar nada**, la firma sigue en `pending_confirmation`.
- [ ] **B5 · V9:** recorrido ARCO de extremo a extremo (`/mis-datos` → portal → rectificar → solicitud visible en admin).
- [ ] **B6 · Cierre:** `test-fresh` de vuelta a `draft` y firmas de prueba anuladas.

## Bloque C — Decisiones y textos (usuario + organización responsable, ≈ 2 h)

- [ ] **C1 · T1.4:** Resend Pro, `RESEND_PLATFORM_PLAN=pro`, alerta del 70 % en el panel de Resend.
- [ ] **C2 · V8:** el aviso de privacidad de la campaña declara Cloudflare (proxy y Turnstile), R2 UE y el VPS.
- [ ] **C3 · V9:** responsable, canal y plazo de ARCO (confirmar el plazo legal de la LOPDP); el aviso dice lo mismo.
- [ ] **C4 · T5.3 (recomendado):** aceptar el riesgo de no tener TOTP con medidas mínimas — `PLATFORM_ADMIN_EMAILS` al mínimo, rotar
      contraseñas, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` de 120 a 60 — con fecha de revisión (T6.2). Ahorra ≈ 6 h.
- [ ] **C5 · Contador público:** decidir **antes** del lanzamiento si cuenta las `pending_confirmation` (hoy sí; 48 % en la campaña
      anterior). Cambiarlo con la campaña en marcha hace bajar la cifra en público.
- [ ] **C6 · T5.4:** nombres y canales de guardia en el runbook.
- [ ] **C7 · T5.5:** fecha de lanzamiento → congelamiento (48 h antes / 72 h después) y **reversión rápida por imagen**: el build web
      tarda ≈ 16 min y el deploy hasta 40; antes de cada deploy, etiquetar las imágenes actuales (`petition-web:prev`, `petition-api:prev`)
      para volver en segundos sin reconstruir.
- [ ] **C8 · Regla operativa:** nada de envíos masivos por Resend en los días pico (comparte cuenta y ritmo con las confirmaciones).

## Pospuesto con disparador (no bloquea el lanzamiento)

| Pendiente | Por qué puede esperar | Hacerlo antes de… |
|---|---|---|
| Baja de Anuncios por `GET` (`/signatures/{id}/unsubscribe`): un escáner puede dar de baja sin que la persona lo sepa | Solo afecta a comunicaciones posteriores | **el primer envío masivo** (junto con `List-Unsubscribe` de un clic, que Gmail/Yahoo exigen a envíos masivos) |
| Portal ARCO verifica el token al cargar: un escáner con JavaScript lo gasta | No expone datos; se pide otro enlace | Ola A |
| R8: `GET /confirm-visibility` cambia estado | Lo inicia un admin y es raro | Ola A |
| V7: pixel de Brevo | El correo de confirmación sale por Resend, sin pixel | usar Brevo para comunicaciones |
| V10: 1 137 pendientes de la campaña cerrada | No afecta a la campaña nueva | fecha dentro de 30 días (minimización) |
| Netdata sin evidencia de alerta | `business_signals.sh` ya cubre memoria y disco | Ola A |
| Tablas sin RLS, políticas anchas de `signatures` | El aislamiento por código está probado (T2.1) | T7.2 |
| Capacidad real del VPS (las pruebas fueron en el Mac, el VPS es compartido) | Pico previsto ≈ 1 alta/s frente a ≈ 100/s medidas; lecturas en caché | se vigila con el monitoreo |
| GlitchTip, TOTP completo, buzones iCloud/Yahoo, repetir el soak, build de 16 min | — | Fase 2 |

---

# FASE 1 — Antes del lanzamiento (objetivo: 5 días hábiles)

**Progreso de la fase: 78 %** (17 completadas, 5 con ajustes, 3 pendientes de 25; `bash infra/progress.sh`, 14 nov 2026). Lo pendiente está ordenado en la «Ruta crítica» de arriba.

Orden pensado para que lo que mide y protege vaya primero, y la prueba de carga se haga
**cuando ya estén aplicados los cambios** (no antes).

## Día 1 — Medir y cerrar lo crítico · *4/6*

- [x] **T1.1 · Diagnóstico de solo lectura en el VPS** (R1, R3, R4, R8) · 1 h
  *Preparada. Falta ejecutarla (SSH de `ssdn` rechazado desde esta sesión):
  `ssh ssdn 'bash -s' < infra/monitoring/vps_readonly_audit.sh` (Paso 1 del runbook).*
  **Actualizado 10 nov 2026:** ejecutado (`audit_vps.txt`, 10 nov). VPS compartido: 12 vCPU, 47 GiB (36 libres), disco 31 %, 240 días de uptime. `petition-api` healthy; límites activos (api 1,5 GiB/2 CPU, web 1 GiB/1,5, db 2 GiB/2, redis 512 MiB/0,5); `restart=unless-stopped`. `ENVIRONMENT=production`, Turnstile con clave real (len 35), `RESEND_PLATFORM_PLAN=free`, `EMAIL_POOL=brevo,resend`; `PROVIDER_SECRET_KEY` vacía (usa `PII_ENCRYPTION_KEY`, ya conocido). Puertos internos solo en `127.0.0.1`; solo 80/443 públicos. Lo que no pudo leer por falta de `sudo` (ufw/iptables, crontab completo) pasa a T3.2 y T3.4.
- [x] **T1.2 · Guarda de arranque de Turnstile + fail-closed** (R1, D1) · 1,5 h
  *Hecho: `config.py`, `turnstile_service.py`, 8 tests. Sin desplegar. Antes de desplegar, confirmar con
  T1.1 que `ENVIRONMENT=production` y la clave real existen en el VPS, o la API no arrancará.*
  **Actualizado 10 nov 2026:** en `main` y desplegado (la API arranca en producción con la guarda activa).
- [x] **T1.3 · Higiene de dependencias y secretos** (R11) · 2 h
  *Hecho: sin secretos reales en el historial (solo site keys públicas); `pip-audit` limpio
  («No known vulnerabilities found»); `pnpm audit` de 44 avisos a 3. Falta: parches del SO en el VPS
  (`apt list --upgradable`, en el script de T1.1), y decidir `zod` (alta, exige v4) y
  `postcss-selector-parser` (de Tailwind), sin solución sin salto mayor.*
  **Actualizado 10 nov 2026:** VPS (10 nov): 55 paquetes pendientes, **0 de seguridad**. **Reinicio pendiente confirmado:** está instalado `linux-image-6.8.0-147` y corre el `-85` (240 días de uptime); reiniciar afecta a todos los servicios del VPS compartido → ventana a decidir. Docker **no** está fijado y 6 paquetes suyos están entre los pendientes (`docker-ce` 29.3.1→29.9.3, `containerd.io`, `docker-compose-plugin`…): fijar con `apt-mark hold` antes de cualquier `apt upgrade`. **`pnpm audit --prod` sobre el lockfile actual (Next 14): 3 críticas y ≈ 20 altas, casi todas de `next`** (parche solo en ≥ 15.5.x): ver T1.3b. `zod` (alta, memoria en colecciones enormes; exige v4): **corregido 10 nov:** no se importa en ningún archivo de `apps/web/src` y ninguna otra dependencia lo necesita (solo figuraba en `package.json`), así que se quita en vez de aceptarlo. `postcss-selector-parser`, `postcss`, `browserslist`, `source-map-js`, `nanoid` son de build.
  **Actualizado 10 nov 2026 (tarde):** rama `chore/quita-zod-y-parser` (worktree `../proy_petition-cauce-deps`, sin commitear): se quita `zod` de `package.json` y se añade el override `postcss-selector-parser: ">=6.1.5 <7"` (resuelve 6.1.6; solo lo usa Tailwind en el build). `pnpm audit --prod`: **«No known vulnerabilities found»** (antes `zod` alta + `postcss-selector-parser` moderada y baja). Verificado: `tsc` limpio, 18/18 tests de `src/lib`, `next build` correcto y el **CSS generado idéntico byte a byte** (60 043 bytes, mismo hash) con el lockfile anterior y el nuevo. `pnpm audit` completo sigue con 18 avisos, todos de devDependencies (`eslint-config-next`, etc.) que no entran en la imagen de producción. **Desplegado el 11 nov 2026** (PR #39/#40 y #42): `alembic current` = 043, `/health` ok (db y redis ok), contenedores api y web recreados y sanos. Los dos primeros intentos cortaron por `command_timeout: 20m` (el build web tarda ≈ 16 min); `deploy.yml` pasó a **40m** (PR #42). Una edición manual del `deploy.yml` en el VPS hizo abortar un `git pull`: **no editar archivos versionados en el VPS**. **Docker fijado (11 nov 2026):** `apt-mark showhold` lista los 6 paquetes (`containerd.io`, `docker-buildx-plugin`, `docker-ce`, `docker-ce-cli`, `docker-ce-rootless-extras`, `docker-compose-plugin`). **Falta en T1.3:** (c) ventana para el reinicio del kernel (`-85` → `-147`).
  **Cerrado 11 nov 2026:** reinicio del VPS hecho a las 05:45 UTC tras respaldo fresco, comprobar que los 31 contenedores tienen `unless-stopped`/`always` y que `docker`, `nginx`, `cron`, `ufw` y `ssh.socket` arrancan solos. Verificado: kernel `6.8.0-147` (antes `-85`), los 31 contenedores de vuelta (petition-api/db/redis sanos), `/health` ok, `ufw` activo, landing y favicon 200 por Cloudflare (≈ 5 s en frío durante el arranque con load 11; ≈ 1 s a los pocos minutos). Docker fijado (`apt-mark showhold`, 6 paquetes). `twenty-crm-production-server-1` (otro proyecto) salió `unhealthy` en el arranque; revisar. Los demás paquetes pendientes (≈ 49, 0 de seguridad) se dejan para una ventana tranquila: no hay urgencia.
- [~] **T1.3b · Next.js 14 → 15.5.29** (R11) · 1–2 días
  *Hecho: Next 15.5.29 + React 19.3.1, codemod async API (15 archivos), tipos OK, `next build` OK
  (24 páginas, con fuentes simuladas), prueba de runtime (landing SSR, `/admin` redirige, cabeceras
  CSP). Críticas 3 → 0. Falta: **(a)** build Docker real (esta máquina no llega a Google Fonts; el VPS
  sí), **(b)** revisión visual en navegador de landing, formulario de firma y admin (React 19),
  **(c)** reconstruir `petition-web-dev` local.*
  **Actualizado 10 nov 2026:** *decisión del usuario: migrar ahora (no hay campaña activa).* Rama `chore/next-15-react-19` con `dev` fusionado (sin conflictos), en un worktree aparte. Verificado: `tsc` limpio, 18 tests de `src/lib`, `next build` OK, **imagen Docker de producción** con Next 15.5.29 y React 19.3.1 (todas las rutas 200, CSP y cabeceras intactas); revisión visual Next 14 vs 15 en 36 capturas (390 y 1160 px, públicas y admin tras login) con diferencias solo de ruido, y el flujo de firma (revisión, triple clic = 1 POST, «Revisa tu correo», reenvío, paso a compartir) idéntico. `pnpm audit --prod`: de 3 críticas y ≈ 20 altas a **0 críticas y 3 avisos** (`zod` alta, `postcss` moderada, `postcss-selector-parser` baja; los tres de build o del renderizador heredado). Se quitó el `favicon.ico` duplicado de `public/` (Next 15 lo marca como conflicto). **Desplegada el 10 nov 2026** (PR a `dev` y `main`): el primer deploy cortó por `command_timeout: 20m` (el build web tarda ≈ 16 min en el VPS); se construyó la imagen a mano en el VPS y se relanzó el job. Verificado: `alembic current` = 043, `/health` ok. **Falta:** revisión visual de la landing y del login de admin en producción; decidir subir `command_timeout` a 40m.
- [x] **T1.3c · FastAPI/Starlette actualizados** (R11) · 0,5–1 día
  *Hecho: FastAPI 0.162.0, Starlette 1.10.0, `python-jose` → PyJWT 2.15.0, `cryptography` 50.0.2,
  `python-multipart` 0.0.33, `jinja2` 3.1.6, `pyarrow` retirado (no se usaba). 302 tests verdes.
  Imagen Docker de producción de la API construida correctamente (1,01 GB).*
- [~] **T1.4 · Correo transaccional: Resend Pro** (R5, D7) · 1 h + trámite
  *Decidido. Falta activar el plan y `RESEND_PLATFORM_PLAN=pro` (Paso 2 del runbook).*
  **Actualizado 10 nov 2026:** *decisión del usuario:* Resend queda en **free** (`RESEND_PLATFORM_PLAN=free`, 150/día) **hasta que se cree la nueva campaña**; entonces se activa Pro y se fija `RESEND_PLATFORM_PLAN=pro` (Paso 2 del runbook). Pro estuvo activo en sesiones anteriores (50.000/mes). Hasta entonces no hay capacidad de 3.000/día.

- [x] **T1.5 · Recuperación del correo de confirmación fuera de la petición** (R5) · 1 día · *MUST*
  *Código y tests hechos (spec `specs/correo-recuperacion/`, 342 passed). Falta C10 (k6 con proveedor simulado) y desplegar. Corrige además un defecto previo: no salía ningún correo de confirmación al firmar (ver spec). Marca de envío por firma, reintentos con reclamo atómico (sin duplicados), límite de velocidad, tope de intentos, tokens nuevos si el enlace caducó, tres visibilidades. Requiere migración.*
  **Actualizado 10 nov 2026:** desplegado (migración 042 en producción). C10 hecho: k6 `race`/`simultaneous` con proveedor simulado; 1.662 firmas del `nominal` quedaron en `sent` (ver `specs/correo-recuperacion/tasks.md`).

## Día 2 — Datos y borde · *1,5/3*

- [x] **T2.1 · RLS: pruebas negativas (+ `042_force_rls` si hace falta)** (R3, D3) · 4 h
  *Hecho: 5 tests (`test_rls_isolation.py`): rol de la app sin superusuario/BYPASSRLS/no dueño, sin lectura,
  escritura, borrado ni inserción cruzada entre organizaciones, y sin firmas secretas/anuladas sin
  contexto. En dev `petition_admin` es dueño y `petition_app` no, así que `FORCE` no es necesario;
  falta confirmar lo mismo en producción (T1.1). **Hallazgos:** ver "Hallazgos" abajo.*
  **Actualizado 10 nov 2026:** verificado en producción: la API conecta como `petition_app` (4 conexiones; `petition_admin` solo la sesión de diagnóstico), que no es superusuario, ni `BYPASSRLS`, ni dueño. Dueño de las 30 tablas: `petition_admin`. **`FORCE RLS` descartado con evidencia** (solo importaría si la app conectara como dueña). RLS activo en las 7 tablas con PII o de campaña. **Hallazgo:** en dev 16 tablas no tienen RLS (`users`, `login_audit`, `organizations`, `privacy_consents`, `privacy_config`, `lifecycle_events`, `exports_log`, `responses`, `response_answers`…): metadatos, autenticación y formularios heredados, no firmas; se revisan en T7.2.
- [x] **T2.2 · Backups cifrados offsite + restore probado** (R4, D4) · 4 h
  *Scripts `infra/backup/pg_backup.sh` y `restore_test.sh` probados en dev (41 firmas = 41 restauradas,
  RTO 1 s). Falta instalarlos en el VPS, elegir el destino offsite y probar el restore real (Paso 4).*
  **Actualizado 10 nov 2026:** instalado y con cron horario+diario a R2 (UE). Restauración real probada: 2.373 firmas, RTO 20 s; RPO = 1 h. Pendiente: reglas de ciclo de vida del bucket y registrar R2 como subencargado en el RAT (V8).
- [x] **T2.3 · Copia de claves críticas** (R4) · 1 h
  *Script `infra/backup/backup_keys.sh` probado (cifra sin imprimir). Falta ejecutarlo en el VPS (Paso 5).*
  **Actualizado 10 nov 2026:** ejecutado en el VPS. `PROVIDER_SECRET_KEY` vacía: se usa `PII_ENCRYPTION_KEY`.

- [x] **T2.4 · Contexto RLS aislado del pool** (R3) · 2 h
  *Hecho: `set_rls_context` + listener `checkin`; 5 tests con pool de 1 conexión. Ver «Hallazgo T2.4».*

## Día 3 — Borde, IP y observabilidad · *3/4*

- [x] **T3.1 · IP única y propia del proyecto** (R2, D2) · 3 h
  *Hecho: `app/client_ip.py` (solo confía en `CF-Connecting-IP` si la conexión viene de Cloudflare),
  usado por rate limit, `ip_hmac`, login, exportación y endpoint legado; 8 tests. Ya no depende del
  `real_ip` del conf de forms-qsm. Opcional: Paso 6 del runbook para logs de nginx con IP real.*
- [x] **T3.2 · Origen solo desde Cloudflare + validación de Host** (R2) · 2 h
  *Solo runbook (Pasos 6 y 7): servidor por defecto `444` y reglas ufw con rangos de Cloudflare.
  Acción manual en el VPS, con segunda sesión SSH y confirmando que forms-qsm también está tras Cloudflare.*
  **Actualizado 10 nov 2026:** `ufw` activo (deny entrante por defecto): 443 solo desde los 15 rangos IPv4 de Cloudflare más la red de Docker, 80 sin regla pública, 22 abierto a cualquiera (clave + fail2ban). Solo hay una regla IPv6 (22): el 443 por IPv6 cae en el deny por defecto. Rangos renovados por `/etc/cron.d/update-cloudflare-ips` (domingos 03:00). Prueba externa: el origen no responde fuera de Cloudflare (curl 28 por 443 y 80).
- [x] **T3.3 · Logs estructurados sin PII + alerta por 5xx** (R6a, D5) · 2 h
  *Hecho: `app/observability.py` (una línea JSON por petición: ruta-plantilla, estado, ms, `X-Request-ID`;
  sin query, cabeceras, cuerpo ni IP; ante excepción solo la clase), 3 tests; `business_signals.sh` alerta
  por 5xx (≥1 % aviso, ≥5 % crítico). La suite total es 305 passed. Sin desplegar.*
  **Actualizado 10 nov 2026:** en `main` y desplegado.
- [x] **T3.4 · Monitor externo, Netdata, señales de negocio y alertas por correo** (R6b–d) · 6 h
  *Hecho: `infra/monitoring/healthcheck_remote.sh` (GreenGeeks) y `business_signals.sh` (VPS: firmas
  sin confirmar, cola atascada, backup, disco, memoria, contenedores); SQL validado en dev. Falta
  instalarlos y la prueba real de correo (Pasos 8–10).*
  **Actualizado 10 nov 2026:** instalado: `business_signals.sh` en el cron del VPS cada 5 min, alertas por SMTP propio probadas y chequeo externo en GreenGeeks. Netdata sin evidencia de prueba de alerta.

## Día 4 — Capacidad · *1/3*

- [x] **T4.1 · Staging + scripts k6 S0–S7** (R7, D6) · 5 h
  *Hecho: `loadtest/signatures.js` (smoke, ramp, spike, simultaneous, race, soak, read, abuse) y
  `cleanup.sql`. Falta el staging con correo *stub*; **no se debe apuntar a la API dev actual**, que
  tiene `RESEND_API_KEY` real. S7 (caída de Redis/Turnstile) es manual.*
  **Actualizado 10 nov 2026:** el «staging» fue un entorno aislado en el Mac (`petition_loadtest_net`, proveedor de correo simulado), no un host aparte. Limitación: la CPU del Mac no es la del VPS; las cifras son relativas.
- [~] **T4.2 · Ejecutar S0–S3 y S5–S7; ajustar** (R7, R8) · 4 h
  *Pendiente (depende del staging). Ajustar `pool_size`, workers, límites y rate limit (CGNAT).*
  **Actualizado 10 nov 2026:** ejecutados `smoke`, `nominal`, `ramp`, `spike`, `simultaneous`, `race`, `abuse`, `read` (2.100 req/s sin errores tras la caché) y Redis caído (3 corridas, 0 errores 500). Faltan: S7 con Turnstile caído y ajustar `pool_size`/workers/rate limit frente a CGNAT.
  **Actualizado 14 nov 2026:** rate limit frente a CGNAT → A1 (20/min, configurable). S7 con Turnstile caído: no se ensaya, el comportamiento es por diseño (fail-closed, 422 sin guardar la firma) y queda en el runbook §3.4. `pool_size`/workers se mantienen (spike: ≈ 100 altas/s, cuello en CPU, no en el pool). Queda: desplegar A1 (A5).
- [~] **T4.3 · Límites de recursos y pool** (R8) · 1,5 h
  *Hecho (valores iniciales): `mem_limit`/`cpus` en `docker-compose.yml`, `maxmemory` de Redis, pool
  `10 + 10` por worker (`DB_POOL_*`). Se afinan con T4.2.*
  **Actualizado 10 nov 2026:** límites iniciales aplicados (`feef0d4`); con `spike` el límite es la CPU de los 2 workers. Falta afinarlos con T4.2.

## Día 5 — Soak, admin y cierre · *1/6*

- [x] **T5.1 · Soak S4 (2 h, en segundo plano)** (R7) · 2 h de reloj, 0,5 h de trabajo
  *Hecho el 11 nov 2026 en el entorno aislado (Docker Desktop: 8 CPU, ~3,8 GiB; no mide capacidad del VPS, busca fugas).
  36 001 altas a 5/s durante 2 h (la corrida duró 2 h 21 min: el Mac se durmió ~28 min a las 02:50 pese a `caffeinate`;
  explica el único máximo de 28,7 s). 0 errores 5xx y 0 de red; 35 892 firmas creadas y 109 duplicadas (colisión de cédula
  aleatoria, respuesta controlada). Latencia: mediana 20,7 ms, p95 34,8 ms. **Sin fugas:** memoria de la API 263→268 MiB,
  descriptores 90→116 (estables), conexiones a la base 16→21, Redis 1,3→1,4 MiB, sin conexiones colgadas (`idle in
  transaction` ≤ 9, transitorias). Correo: el envío está limitado a 2/s (`confirm_email_max_per_second`) y se firmaba a 5/s,
  así que la cola creció a ~3/s (15 397 pendientes al final, 0 `gave_up`, reintentos ≤ 3 con 7 % de fallos simulados); drenó
  ~1,7/s durante la verificación. Con tráfico real (picos de pocas firmas/s) no se acumula, pero un pico sostenido > 2/s retrasa
  la confirmación por correo: avisar en el runbook. Entorno desmontado (`down -v`).*
- [x] **T5.2 · CSV injection + alerta de exportación anómala** (R10) · 2 h
  *Hecho: `app/csv_safe.py` aplicado a las dos exportaciones de firmas (incluido el sello); 12 tests;
  alerta de >3 exportaciones/hora en `business_signals.sh`. No se aplicó al CSV de portabilidad ARCO (datos del propio
  titular) ni a la exportación legada de formularios.*
- [~] **T5.7 · Verificación mínima de confirmación y privacidad** (R12, R20) · 3 h · *spec aprobada; D1 = A; V1–V4 hechas (API POST + página `/confirmar`, sin desplegar); faltan V5–V10: `specs/verificacion-confirmacion-privacidad/`*
  *Prueba con escáneres de enlaces (Outlook, Gmail, corporativo) y métrica de confirmaciones <5 s; contrastar aviso de privacidad con proveedores reales y pixel de Brevo; definir quién atiende ARCO y en qué plazo.*
  **Actualizado 10 nov 2026:** V1–V5 hechas (V5 cerrada el 10 nov con firma real). Quedan V6–V10 (`preparacion-v6-v10.md`); la verificación de datos pasó a un paso en el diálogo de firma (`revision-datos-al-firmar`).
- [ ] **T5.3 · TOTP admin** (R9, D8) · 6 h — *si se decide en Fase 1*; si no, medidas
      mínimas + riesgo aceptado con fecha de revisión · 1 h
- [x] **T5.4 · Runbook de incidentes + playbooks mínimos** (R11) · 2 h
      `docs/engineering/runbook_incidentes.md` (alertas → acción, reversión) y playbooks A/B/C en `docs/legal/runbook_brechas.md` §8.
      Pendiente tuyo: nombres y canales de guardia (tablas «por definir»).
- [ ] **T5.5 · Congelamiento de cambios, lista de verificación y plan de reversión** (R12, R13) · 1 h
- [ ] **T5.6 · Actualizar `progress/current.md` y `history.md`.**

### Hallazgo T2.4 (contexto RLS filtrado por el pool) — CORREGIDO en código

`set_config(..., false)` dejaba `app.is_platform_admin`/`app.current_org_id` en la conexión física y la
petición siguiente los heredaba. Arreglo: `database.set_rls_context()` guarda el contexto en la sesión y lo
re-aplica con `is_local=true` en cada transacción (`after_begin`); además un listener `checkin` hace `RESET`
al devolver la conexión al pool. Usado en `get_db_with_org`, retención, cola de comunicaciones y el script de
nombres. `tests/test_pool_context_leak.py` (5 tests, pool de 1 conexión). Suite: 310 passed. Sin desplegar.

## Respaldo fuera del VPS en R2 (capa gratuita) — estimación

Base real: dump cifrado de **1,23 MB** con 2 373 firmas (producción, 2026-11-07). Con +20 000 firmas y márgenes:
≈ 12 MB al final de la campaña (peor caso 25 MB). Plan: horario en `hourly/` (3 días) + diario en `daily/` (30 días).
Almacenamiento: 72 + 30 objetos × 12 MB ≈ **1,2 GB** (peor caso ≈ 2,6 GB) frente a 10 GB gratis. Operaciones de clase A:
≈ 4–6 por respaldo × 744 al mes ≈ **4 500** frente a 1 M gratis; clase B despreciable (10 M gratis); salida gratuita.
Sin ciclo de vida el almacenamiento crecería sin límite (el script solo borra lo local): las dos reglas son obligatorias.
Holgura: aun con retención de 30 días horaria (≈ 9–18 GB) el exceso costaría centavos (0,015 USD/GB·mes).

## T2.2 cerrada (2026-11-07)

Restauración probada en producción: 2 373 firmas restauradas = 2 373 originales, `consents` y `alembic=042` correctos, RTO 20 s
(objetivo 2 h). Cron horario con subida a R2 (UE) y copia diaria; ver `docs/engineering/runbook_backup_restore.md`.
Pendiente de comprobar: el primer respaldo horario automático (tras las 05:00) y las reglas de ciclo de vida del bucket.

## T2.3 (copia de claves) — hecha en el VPS, falta custodiar

`backup_keys.sh` corregido (contaba `PROVIDER_SECRET_KEY=` vacía como presente): estado real en producción
`PII_ENCRYPTION_KEY`, `HMAC_SECRET_KEY` y `JWT_SECRET_KEY` con valor (64 caracteres); `PROVIDER_SECRET_KEY` **vacía**
(el sistema usa `PII_ENCRYPTION_KEY` de respaldo; definir una propia exige re-cifrar credenciales por organización,
Fase 2). Pendiente del usuario: traer `claves-cauce.age` al Mac, comprobar que descifra a 4 líneas y guardarlo
separado de la identidad privada de `age`; luego `shred -u` en el VPS.

## T3.4 — alertas por correo probadas (2026-11-07)

`business_signals.sh` instalado en el VPS con cron cada 5 min; SMTP propio (`smtps://`) probado: llegó el correo de prueba y una
alerta forzada `[Cauce][AVISO] memoria` (umbral bajado con `MEM_WARN`/`MEM_CRIT`). El script rechaza un `SMTP_URL` sin esquema.
Incidente: la contraseña SMTP se imprimió en pantalla por un error de `source` (comillas); contraseña **rotada** por el usuario (2026-11-07).
Chequeo externo `healthcheck_remote.sh` en GreenGeeks (cron cada 5 min, acceso por clave `host-cqsmorg-mac1`): prueba de caída
con URL inexistente → contador 2 y correo `CAIDA` recibido. Corregidas las cabeceras MIME/UTF-8 de ambos scripts (el asunto con tilde llegaba roto).
No probado: el correo `RECUPERADO` ni Netdata (opcional).

## T3.2 cerrada (2026-11-07)

Firewall ya aplicado (`ufw`: 80/443 solo Cloudflare). `real_ip_header CF-Connecting-IP` ya era global (forms-qsm): el log de `cauce` muestra IPs
reales (no de Cloudflare). Servidor por defecto en 443 con `ssl_reject_handshake` (`/etc/nginx/conf.d/00-default-reject.conf`):
`Host` desconocido → `000`; los sitios del VPS siguen respondiendo. HTTP/2 del origen verificado (`http=2`).

## T4.2 — resultados de estrés (entorno aislado, 2026-11-07)

`nominal`, `simultaneous`, `race`, `abuse`, `smoke`: pasan. `ramp` (hasta 30 altas/s): 11 180 firmas, p95 22 ms, 1 error 5xx. `spike` (100 altas/s): 15 352
firmas, p95 105 ms, 0 errores. **`read` (300 lectores): 21 % de 5xx, p95 11 s** — agotamiento del pool en `by-slug`, `/{id}` y `signatures/recent`
(sin caché; `by-slug` hace 4 consultas). Escritura OK; lectura es el cuello. Spec: `specs/cache-lecturas-publicas/` (pendiente de aprobación).
Nota: el entorno corre en un Mac con Docker (≈ 28 000 firmas sintéticas); la capacidad real del VPS se mide en staging.

## Despliegue en producción (verificado 2026-11-07, PR #27 → `a3623c8`)

Desplegado y comprobado en el VPS: Turnstile fail-closed (T1.2), IP única (T3.1), PyJWT/FastAPI (T1.3c), contexto RLS
en el pool (T2.4), CSV injection (T5.2), logs estructurados (T3.3, 3 eventos en 10 min, 0 errores) y límites de
recursos (T4.3: api 1,5 GiB/2 CPU, web 1 GiB, db 2 GiB, redis 512 MiB, `volatile-lru`). Los cuatro contenedores se
recrearon (≈1 h de actividad) y `/health` responde `ok`. El repo del VPS está en la rama `dev` (el workflow hace
`git pull origin main` sobre ella; funciona, pero conviene dejarlo en `main`).

## Datos reales de la campaña anterior (consulta de solo lectura, 2026-11-07)

2 373 firmas reales (6–26 jul 2026, campaña `soberania-tlc-ecu-usa`, cerrada): **1 236 confirmadas (52 %) y 1 137
pendientes (48 %)**, estable semana a semana (54/51/52 %). Todas las pendientes tienen más de 7 días y el enlace
vencido. Consecuencias: (1) el defecto del correo **no afectó a esa campaña** (no hay caída en la serie; el código
con el defecto se desplegó después), pero sí afectaría a la nueva; (2) la línea base de no confirmación es ~48 %, así
que la alerta de tasa se recalibró a 75 %/90 % (antes 10 %/25 % habría sido crítica permanente); (3) con 10–20 mil
firmas esperadas, cabe esperar ~5–10 mil confirmadas: T5.7 (escáneres, bandeja de spam) importa; (4) **retención:**
1 137 registros no confirmados con datos personales llevan > 7 días en una campaña cerrada y `retention_service`
no parece purgar `pending_confirmation`; revisar con el plazo de la política y decidir su borrado (minimización LOPDP).

## Hallazgo crítico: el correo de confirmación no salía al firmar (CORREGIDO en código)

Desde `af10af8` (2026-07-12) `create_signature` pasaba `entered_*` y `arco_review_url` a `send_confirmation_email`,
que no los aceptaba: `TypeError` capturado por `except Exception` → warning y **ningún correo**. Solo el reenvío
manual (que no pasaba esos argumentos) funcionaba. Corregido dentro de T1.5. **El código desplegado hoy en
producción (main) tiene el defecto**: priorizar el despliegue de T1.5 antes del lanzamiento, y comprobar con una
firma real de prueba que llega el correo con el resumen de datos.

## Hallazgos nuevos de esta sesión (para decidir)

1. **RLS cubre 16 de las 25 tablas.** Sin RLS y con datos personales: `users`, `organizations`,
   `processing_contracts`, `campaign_allowlist`, `privacy_consents`, `login_audit`, `responses`
   (legada). Su aislamiento depende solo del código de cada endpoint admin → revisar en T7.2.
2. **Políticas anchas por diseño en `signatures`:** `sig_confirm_lookup` deja leer, y `sig_confirm_update`
   confirmar, **cualquier** firma pendiente desde una sesión sin organización; la protección real es
   el filtro por token del código. Los campos `name`, `provincia`, `org_name` e `ip_hmac` no están
   cifrados. Candidato a endurecer en T7.2 (p. ej. política con el token como parámetro de sesión).
3. **Campañas `draft` son legibles públicamente** a nivel de BD (modo prueba, con `is_test`). Intencional.
4. **[Retirado el 14 nov, A2]** **Endpoint legado `POST /v1/public/verify-turnstile`** (del código de forms-qsm) responde si un
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

- [x] Turnstile no puede quedar abierto en producción (arranque falla sin clave). _T1.2, en `main`._
- [x] Restore de backup probado, con RPO/RTO anotados. _2.373 firmas, RTO 20 s, RPO 1 h._
- [x] Pruebas de aislamiento entre organizaciones en verde; FORCE RLS aplicado o descartado con evidencia. _T2.1: 5 tests; `FORCE` descartado en producción (la app no es dueña de las tablas)._
- [~] Rate limit distingue IP reales (prueba con IP distintas); origen cerrado a Cloudflare. _Origen cerrado: verificado (ufw + prueba externa). Falta la prueba de rate limit con IP distintas en producción._
- [ ] Confirmación por correo con capacidad ≥ 3.000/día y alerta al 70 %. _Diferido: requiere Resend Pro, que se activa al crear la nueva campaña._
- [x] S1–S3 y S5–S7 cumplen los criterios de R7; S4 sin fugas. _Todos ejecutados salvo S7-Turnstile (por diseño, runbook §3.4); S4 sin fugas (T5.1). En el entorno aislado del Mac, no en el VPS._
- [~] Una alerta de prueba real llega **por correo** al canal de guardia, desde el monitor
      externo y desde Netdata, con el SMTP independiente; los logs de error no contienen PII. _Monitor externo y alertas SMTP probados; falta evidencia de Netdata._
- [x] Sin vulnerabilidades altas/críticas abiertas sin decisión escrita. _T1.3: `pip-audit` y `pnpm audit --prod` limpios (11 nov)._

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
