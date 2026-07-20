# Requirements — programacion-historial-comunicaciones

## Contexto

`comunicaciones-cierre-campana` (sesión 32) dejó 3 tipos de envío masivo a
adherentes en el popup "Comunicación con adherentes": invitación al evento,
aviso de cierre, mensaje libre. Hoy los 3 son "disparar ahora o nada" — no
queda registro de qué se mandó, ni se puede programar un envío para más
adelante. Esta spec agrega ambas capacidades a los 3 tipos por igual.

Es la primera vez que este trabajo de sesión (rama `feat/comunicaciones-cierre-campana`,
partida de `main`) necesita una migración — todo lo anterior fue código sin
tocar el schema. Por eso pasa por spec formal antes de tocar la base.

**Prioridad del usuario**: primero programar envío, después historial.

## Requisitos

### Programar envío
- **R1** El admin DEBERÁ poder programar cualquiera de los 3 tipos de envío
  (invitación al evento, aviso de cierre, mensaje libre) para una fecha/hora
  futura, desde la misma pestaña donde hoy están "Vista previa"/"Enviar
  prueba"/"Enviar a firmantes".
- **R2** El sistema DEBERÁ persistir el envío programado con todos los
  campos necesarios para reconstruir el email al momento de dispararse (no
  alcanza con guardar "vamos a mandar el tipo X" — hay que guardar el
  contenido completo).
- **R3** Un proceso en segundo plano (loop asíncrono in-process, arrancado
  en el lifespan de FastAPI — sin agregar Celery/APScheduler como
  dependencia nueva) DEBERÁ revisar cada 60s los envíos programados vencidos
  (`scheduled_at <= now()`, `status='pending'`) y dispararlos, reusando las
  mismas funciones de armado/envío de email ya existentes (sin duplicar
  lógica de construcción de HTML).
- **R4** El claim de un envío vencido DEBERÁ ser atómico (`UPDATE ...
  WHERE status='pending' RETURNING id`) para que no se mande dos veces si
  en algún momento el proceso corre en más de un worker.
- **R5** El admin DEBERÁ poder cancelar un envío programado mientras siga
  `pending`. Un envío programado NO DEBERÁ poder editarse una vez creado —
  se cancela y se crea uno nuevo (simplificación deliberada, evita edición
  concurrente de un envío a punto de dispararse).
- **R6** Si el envío programado falla al dispararse (ej. error del
  proveedor de email), DEBERÁ quedar en `status='failed'` con el error
  registrado — nunca reintentar solo, ni quedar en un limbo `pending` para
  siempre.
- **R7** El admin DEBERÁ ver, dentro de cada pestaña o en un panel común,
  la lista de envíos programados pendientes de esa campaña con su
  fecha/hora y opción de cancelar.

### Historial de envíos
- **R8** Cada envío real (no de prueba) que se dispare — inmediato o
  programado — DEBERÁ quedar registrado: tipo, asunto, cantidad de
  destinatarios, quién lo disparó (o "programado" si vino del scheduler),
  fecha/hora de envío.
- **R9** Los envíos de prueba (`test_emails`) también DEBERÁN registrarse,
  pero distinguibles por `mode='test'` — no deben mezclarse visualmente con
  los envíos reales en el historial por defecto.
- **R10** El admin DEBERÁ poder consultar el historial de la campaña desde
  una pestaña o sección nueva del popup "Comunicación con adherentes",
  ordenado del más reciente al más antiguo.
- **R11** El historial NO DEBERÁ guardar el contenido/HTML del email — solo
  metadatos de auditoría (tipo, asunto, conteo, quién, cuándo). El contenido
  real ya no es necesario después de enviado.

### Seguridad / multi-tenant
- **R12** Ambas tablas nuevas DEBERÁN llevar RLS con el mismo patrón que el
  resto de tablas admin (org_id + políticas org/`is_platform_admin`) — una
  org no puede ver ni cancelar envíos programados de otra.
- **R13** Los endpoints nuevos DEBERÁN exigir JWT + rol `admin`/`gestor` +
  scope de campaña, mismo patrón que los endpoints de envío ya existentes.

### Fuera de alcance (explícito)
- **R14** NO se construye un editor de envíos programados (solo
  crear/cancelar, no editar in-place — ver R5).
- **R15** NO se reintenta automáticamente un envío fallido (R6) — el admin
  decide manualmente si programar de nuevo.
- **R16** NO se integra con `apps/api/app/scheduler.py` de la rama `dev`
  (retención) — ese archivo no existe todavía en esta rama (parte de
  `main`). Si `dev` se mergea antes de implementar esto, evaluar consolidar
  ambos loops en un único proceso en vez de tener dos; si no, este feature
  arranca su propio loop independiente.

### Tests
- **R17** Tests de servicio: claim atómico de un envío vencido no lo deja
  disponible para un segundo claim concurrente; un envío `cancelled` o ya
  `sent` nunca se dispara.
- **R18** Test de que cada tipo de envío (evento/cierre/mensaje) reconstruye
  el HTML/contenido correcto desde el `payload` guardado.
- **R19** Test de que el historial no persiste HTML/contenido, solo
  metadatos (R11).
