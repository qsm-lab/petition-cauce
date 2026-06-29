# Plan de validación — Plataforma de campañas de firmas

> Documento de trabajo (v2, borrador para validar). Fecha: 2026-06-26.
> Base: extender el proyecto **QSM Forms** (`forms.quitosinmineria.org`) hacia una
> plataforma multi-tenant de campañas de recolección de firmas, estilo Change.org,
> orientada a **campañas ambientales** cuyas firmas se agrupan como **documento de
> apoyo para presentación a autoridades**.
> Arquitectura elegida: **multi-tenant en el mismo proyecto** (no fork).
>
> Alcance: campañas ambientales / ciudadanas de presión y apoyo. **No** incluye
> firmas de respaldo electoral validadas por el CNE ni tratamiento de afiliación
> política. Una firma aquí es un **apoyo ciudadano con datos personales**, no un
> respaldo electoral con peritaje grafotécnico.

---

## 0. TL;DR (para decidir)

- **Viabilidad técnica: ALTA.** El 70–80% de lo que necesita una plataforma de firmas ya existe en QSM Forms: API FastAPI multi-org con `org_id`/`campaign_id`, RLS en PostgreSQL, auth con JWT, rate limiting, anti-bot Turnstile, renderizador público de formularios, dashboard admin y un sistema de diseño por campaña. Construir desde cero costaría meses; extender lo existente reduce el riesgo y el tiempo a la mitad o menos.
- **Viabilidad legal: MEDIA-ALTA, condicionada.** Recolectar datos personales para sustentar un documento de apoyo dirigido a una autoridad es legal en Ecuador, **pero** activa de lleno la LOPDP (vigente, con régimen sancionatorio aplicándose ya en 2025). Es manejable con diseño correcto; no es un bloqueante.
- **Naturaleza del producto (importante):** una firma en esta plataforma es un **apoyo ciudadano** (modelo Change.org) que se agrupa en un documento entregable a la autoridad competente. Sirve para presión pública, visibilidad y como insumo formal de respaldo; no es un respaldo electoral validado por el CNE y el copy debe ser honesto sobre eso.
- **Recomendación:** sí avanzar, en fases. Empezar por un MVP de petición/apoyo sobre un dominio (reutiliza casi todo), luego multi-dominio y branding, y después el cumplimiento LOPDP como producto y el export con valor probatorio.

---

## 1. Qué se quiere construir

Una plataforma que permita lanzar y operar **campañas ambientales de recolección de firmas/apoyos** donde cada campaña:

- Vive bajo su **propio dominio** y con su **propio look and feel** (branding, colores, tipografías, landing).
- **Recolecta datos personales** de las personas firmantes (nombre, cédula, correo, etc.) para sustentar un **documento de apoyo** que se presenta formalmente a una autoridad competente según la naturaleza de la campaña.
- Se gestiona desde un **back-office común** (multi-tenant): una sola plataforma operando muchas campañas, sin duplicar infraestructura.

El referente funcional es Change.org (página de campaña, contador de firmas, compartir, llamado a la acción). La diferencia de fondo: los datos viven en tu infraestructura (no en un tercero extranjero), se recogen orientados a un expediente de apoyo local, y hay obligaciones LOPDP concretas sobre esos datos.

---

## 2. Punto de partida: qué ya tienes (y por qué importa)

QSM Forms no es "un proyecto parecido": es **casi la mitad de esta plataforma ya construida y endurecida en seguridad**. Inventario de activos reutilizables:

| Activo existente en QSM Forms | Reutilización en plataforma de firmas | Estado |
|---|---|---|
| API FastAPI + SQLAlchemy async + Alembic | Núcleo de la nueva API | Directo |
| Modelo multi-org con `org_id` y `campaign_id` | Base del multi-tenant | Directo, a extender |
| **RLS en PostgreSQL** (`forms`, `campaigns`) con `app.current_org_id` | Aislamiento de datos entre campañas/organizaciones | Directo — activo de oro |
| Renderizador público `/c/[slug]` (Next.js) | Base de la landing pública de campaña | Adaptar |
| Sistema de diseño por campaña (`meta` JSONB: colores, copys) | Look and feel por campaña sin migraciones | Directo — clave para multi-branding |
| Auth JWT + account lockout + audit log HMAC | Back-office y seguridad de acceso | Directo |
| Rate limiting (slowapi + Redis) + Turnstile anti-bot | Anti-fraude de firmas | Directo — crítico aquí |
| CSP, security headers, CORS restrictivo, WAF Cloudflare | Cumplimiento "seguridad desde el diseño" LOPDP | Directo |
| `generateMetadata` / Open Graph por campaña | Compartibilidad social (esencial en peticiones) | Directo |
| Harness SDD (specs/, feature_list.json, progress/) | Mismo flujo de trabajo para construir esto | Directo |
| CI/CD GitHub Actions → VPS Docker Compose | Mismo pipeline de deploy | Directo |

**Conclusión del inventario:** lo que falta es esencialmente (a) el dominio "firma/petición" en el modelo de datos, (b) ruteo y branding por **múltiples dominios**, (c) las piezas legales LOPDP como features de producto (consentimiento granular, derechos ARCO, retención), y (d) flujos específicos de firma (contador, verificación ligera, agrupación y exportación para autoridad). Nada de esto exige reescribir el stack.

---

## 3. Análisis de viabilidad

### 3.1 Viabilidad técnica — ALTA

**A favor:**
- La arquitectura ya es multi-org. Pasar de "una org con campañas" a "muchas campañas con branding y dominio propios" es una extensión natural, no un rediseño.
- El patrón `meta` JSONB para configuración visual por campaña ya resuelve el "look and feel distinto por campaña" sin migraciones. Es exactamente lo que se necesita para multi-branding.
- La RLS ya construida resuelve el problema más difícil y peligroso del multi-tenant: que una campaña no pueda ver los firmantes de otra. Ese trabajo (con sus lecciones de `is_local=true`, fail-closed, `forms_app` no superusuario) ya está hecho y endurecido.
- El anti-bot y rate limiting ya están, y son justamente la defensa central contra firmas falsas/infladas.

**Retos técnicos nuevos (manejables):**
1. **Multi-dominio real.** Hoy es un dominio (`forms.quitosinmineria.org`). Servir N dominios con la misma app requiere: ruteo por `Host` header en nginx/Next.js, una tabla `domains → campaign`, certificados TLS por dominio (Cloudflare o Let's Encrypt/Caddy), y resolución de branding en el primer byte del request. Es trabajo conocido, pero es la mayor pieza de ingeniería nueva.
2. **Anti-fraude de firmas.** Una petición que se presenta a una autoridad necesita defensas más fuertes que una encuesta: deduplicación por cédula/correo, verificación de email (doble opt-in), y validación ligera de cédula (algoritmo de dígito verificador ecuatoriano). Turnstile ayuda contra bots, pero no contra una persona llenando 50 firmas falsas.
3. **Agrupación y exportación con valor probatorio.** Para presentar a una autoridad hace falta un export íntegro, fechado, con sello de tiempo y, deseablemente, hash de integridad del lote. Esto es nuevo respecto a "exportar respuestas de encuesta".
4. **Escala/picos.** Una petición viral genera picos de tráfico muy superiores a una encuesta. El VPS compartido y el plan Free de Cloudflare (1 regla WAF, según tus notas) pueden quedar cortos. Hay que dimensionar.

**Veredicto técnico:** viable y eficiente reutilizando el stack. El riesgo se concentra en multi-dominio y anti-fraude, no en el núcleo.

### 3.2 Viabilidad de producto — ALTA

El producto "petición online ambiental con branding propio + back-office" tiene demanda clara en el activismo ecuatoriano y no hay un equivalente local fuerte. El diferenciador frente a Change.org es: **dominio propio, datos en tu infraestructura (no en un tercero extranjero), y orientación a un documento de apoyo local**.

El copy debe ser honesto: una firma es un **apoyo ciudadano** que se agrupa y entrega como respaldo a la autoridad; no se presenta como un respaldo electoral con validación oficial. Esa honestidad protege la credibilidad de cada entrega.

### 3.3 Viabilidad legal — MEDIA-ALTA, condicionada (detalle en §4)

No hay impedimento legal para construir esto. Sí hay un **conjunto de obligaciones LOPDP que deben estar en el diseño desde el día uno**. Con el diseño correcto es plenamente viable. El mayor riesgo legal no es la prohibición, sino **operar sin cumplimiento** (multas reales ya aplicándose en 2025).

---

## 4. Análisis legal — LOPDP Ecuador

> Aviso: no soy abogado y esto no es asesoría legal. Es un análisis técnico-funcional de requisitos para que el diseño nazca conforme. Antes de producción con campañas reales conviene una validación por un abogado especialista en protección de datos en Ecuador.

### 4.1 Marco aplicable

- **Ley Orgánica de Protección de Datos Personales (LOPDP)**, publicada en el Registro Oficial el 26 de mayo de 2021.
- **Reglamento General a la LOPDP**, expedido en noviembre de 2023 (Decreto Ejecutivo 904).
- **Régimen sancionatorio en vigencia desde el 26 de mayo de 2023.** Ya no es teórico: la **Superintendencia de Protección de Datos Personales (SPDP)** emitió sus **primeras sanciones por infracciones graves en diciembre de 2025**. La autoridad está activa y sancionando.
- Reforma vía **Ley Orgánica de Ciberseguridad (LOFC):** añade obligaciones de notificación de incidentes a CSIRT, además de SPDP y ARCOTEL.

**Roles que asumes:** la organización que opera la plataforma es **Responsable del tratamiento** (define fines y medios). Si operas campañas para terceros (otras organizaciones activistas), tú podrías ser **Encargado** y cada organización el Responsable — eso exige **contrato de encargo de tratamiento** entre las partes. Conviene definir esta distinción pronto.

### 4.2 Obligaciones LOPDP que se vuelven requisitos de producto

Cada obligación legal se traduce en una feature concreta. Esta tabla conviene que guíe el backlog:

| Obligación LOPDP | Qué exige | Traducción a feature |
|---|---|---|
| **Base de legitimación (Art. 7 y ss.)** | Todo tratamiento necesita base legal: consentimiento, interés legítimo, obligación legal, contrato, interés vital. | Para firmas, la base será típicamente **consentimiento**. Registrar qué base aplica por campaña. |
| **Consentimiento válido (Art. 8)** | Debe ser **libre, específico, inequívoco e informado**. No vale casilla pre-marcada ni consentimiento "empaquetado". | Checkbox **no pre-marcado**, separado, con enlace a aviso de privacidad. Texto específico del fin ("presentar tu firma ante [autoridad]"). |
| **Consentimiento revocable** | El titular puede retirarlo en cualquier momento, sin justificar; no afecta licitud previa. | Mecanismo de **revocación** (enlace en email / endpoint). Registrar fecha de revocación. |
| **Información al titular / aviso de privacidad** | Informar identidad del responsable, fines, plazo de conservación, destinatarios, derechos, autoridad de control. | **Aviso de privacidad por campaña** (puede vivir en `meta` JSONB), visible antes de firmar. |
| **Derechos del titular (ARCO + portabilidad + oposición)** | Acceso, rectificación, eliminación/supresión, oposición, portabilidad (formato estructurado). | **Flujo de derechos**: que un firmante pida ver, corregir, borrar u oponerse. Self-service o canal definido. |
| **Minimización y finalidad** | Pedir solo los datos necesarios para el fin declarado. | No pedir más campos de los que la autoridad destino realmente exige. Diseñar formularios mínimos. |
| **Conservación / retención** | Conservar solo mientras dure la finalidad; luego suprimir o anonimizar. | **Política de retención por campaña** + job de purga/anonimización tras presentar el expediente. |
| **Seguridad (seguridad desde el diseño y por defecto)** | Medidas técnicas y organizativas, análisis de riesgo, evaluación de impacto cuando aplique. | Ya tienes mucho (RLS, HMAC, CSP, lockout). Falta **cifrado en reposo de PII**, **EIPD** y documentación. |
| **Notificación de vulneraciones** | Notificar brecha a la SPDP (y ARCOTEL / CSIRT según LOFC) en plazos breves (referencias de ~5 días a SPDP/ARCOTEL; 72 h a CSIRT). | **Runbook de brecha** + el `login_audit`/logs ya existentes ayudan a la trazabilidad. |
| **Registro de actividades de tratamiento (RAT)** | Documentar qué datos, fines, bases, plazos, flujos. | Un **RAT** por campaña; parte puede autogenerarse de la config de la campaña. |
| **Delegado de Protección de Datos (DPO)** | Exigible según volumen y naturaleza del tratamiento. | Evaluar si el volumen de firmantes obliga a designar **DPO**. |

### 4.3 Exposición sancionatoria (para dimensionar el riesgo)

- **Sector privado:** infracciones graves 0,7%–1% y muy graves 1%–2% del **volumen de negocio** del ejercicio anterior.
- **Sector público:** graves 10–20 SBU; muy graves 20–30 SBU.
- Medidas correctivas adicionales: cese del tratamiento, supresión de datos, prohibición temporal/definitiva, publicación de la sanción.

Para una organización activista sin fines de lucro la multa porcentual puede ser baja en cifras absolutas, pero las **medidas correctivas** (orden de cesar el tratamiento / suprimir datos en plena campaña) y el **daño reputacional** son el verdadero riesgo.

---

## 5. Arquitectura propuesta (multi-tenant, mismo proyecto)

### 5.1 Principio

Extender QSM Forms a un modelo donde **una sola base de código y una sola BD** sirven muchas campañas, cada una con su dominio y branding, manteniendo el aislamiento por RLS que ya existe. No fork, no proyecto separado: se aprovecha todo el endurecimiento ya hecho y se evita mantener dos códigos.

### 5.2 Jerarquía de datos

```
Organization (org_id)  ── ya existe; el "dueño" de la campaña
   └── Campaign (campaign_id) ── ya existe; se enriquece
         ├── Domain(s)         ── NUEVO: dominio(s) propio(s) + branding
         ├── PrivacyConfig     ── NUEVO: aviso, base legal, retención
         ├── SignatureForm     ── adaptación del Form actual (campos mínimos)
         ├── Lifecycle         ── NUEVO: estado del ciclo (lanzada→…→decisión) + meta
         └── Signature          ── NUEVO: el "response" especializado en firma
               ├── PII (cifrada en reposo)
               ├── region / territorio (habilita mapa y apoyo por región)
               ├── visibility (pública / anónima / secreta)
               ├── source (referente de origen)
               ├── consent (texto, versión, timestamp, base legal)
               └── verification (email verificado, cédula válida, dedupe)
```

### 5.3 Multi-dominio y branding

- Nueva tabla `domains (host, campaign_id, tls_status, ...)`.
- nginx enruta por `Host`; Next.js resuelve campaña y branding desde el `Host` en server-side (sin flash de contenido).
- Branding sigue el patrón ya probado: vive en `meta` JSONB (colores, tipografías, copys, imágenes), **sin migraciones por campaña**. Es exactamente el mecanismo que ya usas para `welcome_*`.
- TLS: Cloudflare (cobertura por dominio) o un reverse proxy con emisión automática (Caddy/Let's Encrypt) si hay muchos dominios.

### 5.4 Lo que NO cambia (y por eso conviene esta vía)

- RLS, auth, rate limiting, Turnstile, CSP, CI/CD, harness SDD: se reutilizan tal cual. Esto es el grueso del valor.

### 5.5 Capas legales como módulos

- `consent_service`: registra consentimiento versionado (texto + versión + base legal + timestamp + IP hmac).
- `rights_service`: atiende ARCO/portabilidad/oposición (lookup por cédula+email verificados, export, borrado).
- `retention_job`: purga/anonimiza según política por campaña.
- `breach_runbook`: documento + alertas; apoyado en los logs ya existentes.

---

## 6. Plan de desarrollo por fases

Estructurado para encajar en tu harness SDD (cada fase = uno o varios `specs/<feature>/` con `requirements.md` EARS, `design.md`, `tasks.md`). Las estimaciones son de esfuerzo relativo, no fechas, dado que es proyecto de un desarrollador con doble objetivo (producto + aprendizaje).

> Las features marcadas **(ref.)** provienen del análisis de plataformas referentes (openPetition, MoveOn, Ekō) y se ubican por **complejidad** y **relevancia** para el objetivo (documento de apoyo entregable a autoridades). Ver matriz en §6.1.

### Fase 0 — Fundaciones legales y de modelo (habilitadora)
**Objetivo:** que nada se construya sin la base legal en el modelo.
- Definir roles (Responsable vs Encargado) y, si aplica, contrato de encargo.
- Redactar **aviso de privacidad** plantilla y política de retención.
- Modelo de datos: extender `Campaign` con `privacy_config`, y crear `domains`, `signatures`, `consents`, `organizations`.
- Campos mínimos por campaña (minimización), incluyendo **región/territorio del firmante** (habilita el mapa más adelante) y `signature_visibility` (pública/anónima/secreta).
- Definir el modelo del **ciclo de vida de la campaña** (estados: lanzada → recolección → entrega → diálogo → decisión). **(ref.)**
- **Entregable:** specs aprobadas + migraciones Alembic base.

### Fase 1 — MVP de petición/apoyo (un solo dominio primero)
**Objetivo:** una campaña de "apoyo" funcionando punta a punta, reutilizando el renderizador actual.
- Landing pública de campaña (adaptar `/c/[slug]`): título, descripción, CTA.
- **Meta + barra de % de avance** por campaña (objetivo explícito, no solo contador). **(ref.)**
- **Indicador del ciclo de vida de 5 etapas** mostrado al público (etapa actual resaltada). **(ref.)**
- Formulario de firma con campos mínimos + **consentimiento no pre-marcado** + aviso de privacidad.
- **Visibilidad de firma elegible por el firmante** (pública / anónima / secreta); default privado. **(ref.)**
- **Consentimiento con revocación en línea** (enlace de baja desde el inicio). **(ref.)** *(se completa en Fase 3 con self-service ARCO)*
- **Firmas recientes en vivo** (prueba social, respetando la visibilidad elegida). **(ref.)**
- **Botones de compartir** (WhatsApp, Telegram, Facebook, X, email) — base del kit de difusión. **(ref.)**
- Persistencia de `Signature` con consentimiento versionado y región.
- Anti-bot Turnstile (ya existe) + rate limiting (ya existe) + **verificación de email (doble opt-in)**.
- Dashboard admin: lista de firmas, conteo, export CSV básico (con RLS).
- **Entregable:** una campaña real de apoyo, en el dominio actual o un subdominio.

### Fase 2 — Multi-dominio, branding y difusión
**Objetivo:** cada campaña con su dominio, look and feel y herramientas de propagación.
- Tabla `domains` + ruteo por `Host` en nginx y Next.js; branding server-side desde `meta` JSONB; TLS por dominio (Cloudflare/Caddy).
- Editor de branding en el admin (colores, logo, copys, imágenes de la landing).
- **Perfiles de organización + taxonomía (temas / regiones)**: las campañas pertenecen a una organización y se clasifican. **(ref.)**
- **Enlace corto + código QR** por campaña. **(ref.)**
- **Volante con QR (tear-off) en PDF** para difusión presencial en territorio. **(ref.)**
- Gestión del ciclo de vida desde el admin (avanzar de etapa, fechas).
- **Entregable:** dos campañas distintas, dos dominios, dos identidades visuales, misma plataforma.

### Fase 3 — Cumplimiento LOPDP y relación con el firmante
**Objetivo:** pasar de "seguro" a "conforme y demostrable", y mantener viva la causa.
- `rights_service`: flujo ARCO + portabilidad + oposición (self-service); cierra el ciclo de la **revocación en línea**.
- `retention_job`: purga/anonimización programada por campaña.
- **Cifrado en reposo** de PII.
- Registro de Actividades de Tratamiento (RAT) autogenerado por campaña.
- Runbook de notificación de brechas (SPDP/ARCOTEL/CSIRT).
- **Updates / News por campaña**: el iniciador publica novedades del trámite. **(ref.)**
- **Embudo post-firma (compartir → suscribir)** con consentimiento separado para novedades. **(ref.)**
- **Entregable:** checklist LOPDP verificable + documentación + canal de novedades conforme.

### Fase 4 — Anti-fraude, agrupación, mapa y entrega con valor probatorio
**Objetivo:** que las firmas resistan escrutinio y la entrega tenga peso formal.
- Deduplicación robusta (cédula + email normalizados) + **validación de cédula ecuatoriana** (dígito verificador).
- **Firma híbrida: hoja de recolección en PDF + subir firmas en papel** y conciliarlas con el lote digital. **(ref.)**
- **Mapa de distribución geográfica + apoyo por región** (a partir de la región capturada en Fase 1). **(ref.)**
- Conexión del ciclo de vida con la entrega real: etapas *entrega → diálogo → decisión* ligadas al lote.
- Agrupación del lote en documento de apoyo entregable, fechado, con **hash de integridad** y sello de tiempo.
- Métricas anti-abuso (velocidad de firmas, IPs, patrones) sobre los logs existentes.
- **Entregable:** documento de apoyo defendible (digital + papel conciliado) para entrega a autoridad.

### Fase 5 — Escala, alcance y operación
**Objetivo:** soportar picos, multiplicar alcance y profesionalizar la operación.
- Dimensionar VPS/CDN para picos virales; evaluar upgrade de Cloudflare (límite de 1 regla WAF en plan Free).
- Caché del contador de firmas (Redis) para no golpear la BD en picos.
- **Tracking de origen de firmas (referente)** con analítica self-hosted (Matomo), sin enviar PII a terceros. **(ref.)**
- **Widget / banner embebible** para que sitios aliados alojen la caja de firma. **(ref.)**
- **Multi-idioma / traducción comunitaria (español + kichwa + inglés)**. **(ref.)**
- Observabilidad y alertas.
- **Entregable:** plataforma escalable, medible y con alcance ampliado.

### 6.1 Matriz de features referentes → fase

Complejidad (C) y relevancia (R) en escala Baja / Media / Alta. Relevancia = aporte al objetivo de documento de apoyo creíble ante autoridades.

| Feature (ref.) | C | R | Fase | Nota |
|---|---|---|---|---|
| Meta + barra de % por campaña | Baja | Alta | 1 | Objetivo explícito; alto impacto, bajo costo |
| Firmas recientes en vivo | Baja | Media | 1 | Prueba social; respeta visibilidad elegida |
| Visibilidad de firma (pública/anónima/secreta) | Media | Alta | 1 (modelo en 0) | Control de privacidad = consentimiento granular LOPDP |
| Consentimiento con revocación en línea | Media | Alta | 1 → 3 | Inicio en 1; self-service ARCO en 3 |
| Ciclo de vida de 5 etapas | Media | Alta | 0 (modelo) · 1 (vista) · 2 (admin) · 4 (entrega) | Seguimiento del trámite; columna vertebral |
| Kit de difusión: WhatsApp/Telegram + enlace corto + QR | Baja-Media | Alta | 1 (botones) · 2 (link corto + QR) | WhatsApp/Telegram y QR clave en Ecuador |
| Perfiles de organización + taxonomía | Media | Media | 2 | Encaja con multi-tenant; ordena el catálogo |
| Volante con QR (tear-off) PDF | Media | Media | 2 | Difusión offline en territorio |
| Updates / News por campaña | Media | Media | 3 | Re-contacto con consentimiento |
| Embudo post-firma (compartir → suscribir) | Media | Media | 3 | Consentimiento separado para novedades |
| Firma híbrida: PDF de hoja + subir papel | Alta | Alta | 4 | Da peso formal a la entrega; complejo |
| Mapa de distribución geográfica + apoyo por región | Media-Alta | Alta | 4 (captura en 1) | Demuestra respaldo territorial |
| Tracking de origen de firmas (referente) | Media | Media | 5 | Matomo self-hosted, sin terceros |
| Widget / banner embebible | Media-Alta | Media | 5 | Multiplica alcance en sitios aliados |
| Multi-idioma (es + kichwa + inglés) | Alta | Media | 5 | Inclusión territorial; alto esfuerzo |

**Criterio de fasing:** lo de **alta relevancia y baja-media complejidad** entra temprano (Fase 1–2); lo de **alta complejidad** (firma híbrida, mapa, widget, multi-idioma) se difiere a Fase 4–5 aunque su relevancia sea alta, porque depende de fundaciones previas (región capturada, lote de entrega, escala).

---

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Operar sin cumplimiento LOPDP | Sanción + medida correctiva (cese de tratamiento en plena campaña) | Fase 0 y 3 antes de campañas reales; validación con abogado |
| Firmas falsas inflando una petición | Pérdida de credibilidad ante autoridad | Doble opt-in, validación cédula, dedupe, anti-bot (Fase 4) |
| Pico viral tumba el VPS compartido | Caída en el peor momento | Caché de contador, dimensionar CDN, Fase 5 |
| Fuga entre campañas (multi-tenant) | Brecha grave de datos | RLS ya existente; tests de aislamiento obligatorios |
| Multi-dominio TLS mal gestionado | Campañas caídas / inseguras | Automatizar emisión (Cloudflare/Caddy), monitoreo |
| Confusión Responsable/Encargado con terceros | Responsabilidad legal difusa | Definir roles y contratos en Fase 0 |
| Sobre-prometer el valor de la firma | Reputacional | Copy honesto: apoyo ciudadano, no respaldo electoral oficial |

---

## 8. Decisiones abiertas (para la siguiente conversación)

1. **¿Operas campañas solo propias o también para terceros?** Define si eres Responsable o Encargado, y los contratos.
2. **¿Cuántos dominios se esperan a corto plazo?** Define la estrategia TLS (Cloudflare vs Caddy).
3. **¿Hay presupuesto para salir del plan Free de Cloudflare** dado el límite de 1 regla WAF y los picos esperados?
4. **¿Validación legal externa** antes de la primera campaña real? Recomendable.
5. **¿Mismo VPS compartido o infra dedicada** para los datos de firmantes?

---

## 9. Recomendación final

Avanzar, sí, y por la vía multi-tenant sobre QSM Forms — es claramente la opción de mayor retorno: reutiliza el activo más caro (seguridad y aislamiento ya endurecidos) y reduce el riesgo. Pero **secuenciar con disciplina**: primero la base legal en el modelo (Fase 0), luego un MVP de apoyo honesto sobre un dominio (Fase 1), y solo después multi-dominio, cumplimiento como producto y export probatorio.

El cuello de botella real de este proyecto no es la tecnología —que ya tienes en gran parte— sino **cumplir la LOPDP por diseño** y **ser honesto sobre qué representa cada firma**. Si esas dos quedan claras desde el inicio, el resto es ejecución incremental sobre una base sólida.

---

## Fuentes

- [LOPDP — texto de la ley (Consejo de Comunicación)](https://www.consejodecomunicacion.gob.ec/wp-content/uploads/downloads/2021/07/lotaip/Ley%20Org%C3%A1nica%20de%20Protecci%C3%B3n%20de%20Datos%20Personales.pdf)
- [Reglamento General a la LOPDP (COSEDE)](https://www.cosede.gob.ec/wp-content/uploads/2023/12/REGLAMENTO-GENERAL-A-LA-LEY-ORG%C3%81NICA-DE-PROTECCION-DE-DATOS-PERSONALES_compressed-1.pdf)
- [Guía LOPDP — Orizontel](https://orizontel.ec/guia-lopdp-ecuador/)
- [Protección de datos en Ecuador: avances y debates — Lexis](https://www.lexis.com.ec/blog/proteccion-de-datos-ecuador/proteccion-de-datos-personales-en-ecuador-avances-desafios-y-debates-actuales)
- [Reglamento LOPDP 2023 — NMS Law](https://nmslaw.com.ec/blog/2023/11/08/ecuador-reglamento-lopdp-2023/)
- [SPDP emite sus primeras sanciones por infracciones graves — RIPD](https://www.redipd.org/noticias/spdp-emite-sus-primeras-sanciones-por-infracciones-graves-LOPDP)
- [Cómo calcular las multas por infracción a la LOPDP — Kahu Data Solutions](https://kahudata.com/como-calcular-las-multas-por-infraccion-a-la-lopdp/)
- [Plazo de notificación de vulneración de seguridad LOPDP — Cumple.ec](https://cumple.ec/blog/plazo-maximo-notificar-vulneracion-seguridad-lopdp-ecuador)
- [Ley de Ciberseguridad Ecuador (LOFC) — Meythaler & Zambrano](https://www.meythalerzambranoabogados.com/post/ley-ciberseguridad-ecuador-lofc)
