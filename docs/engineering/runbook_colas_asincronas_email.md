# Runbook: colas asíncronas de envío de email (Resend u otro proveedor)

> Origen: incidente real en producción, sesión 42 (2026-07-28/29),
> `centro-comunicaciones` Fase 3. Un envío de cierre de campaña a 1236
> destinatarios reales quedó parcialmente entregado —y marcado como
> completo— dos veces, antes de identificarse la cadena completa de causas.
> Los 1236 correos terminaron entregándose sin fallos, pero costó ~8 horas
> de intervención manual. Este documento existe para que la próxima
> feature de envío masivo (en este proyecto o en otro) no repita los mismos
> cinco errores de diseño.

**Aplica a:** cualquier feature que procese trabajo en background fuera
del ciclo de vida de un request HTTP (loop `asyncio` propio, APScheduler,
Celery, etc.) y que además dependa de RLS de PostgreSQL y/o de un
proveedor de email con límites de cuota (Resend, SendGrid, SES, Mailgun).

---

## 1. Resumen del incidente

Un loop asíncrono in-process (`comms_scheduler_loop.py`) procesa una cola
de envíos programados troceados en lotes (`send_batch`) para respetar la
cuota diaria del proveedor. Un lote de ~100 destinatarios reales quedó
huérfano tres veces distintas, por tres causas independientes que se
fueron descubriendo una tras otra:

1. Un reinicio de contenedor (`docker compose restart` /
   `--force-recreate`) cortó un lote a mitad de envío — el disparador
   original, evitable con más cuidado operativo.
2. La lógica de "¿terminó el envío?" solo miraba lotes `pending`, no
   `sending` — en cuanto un lote quedaba huérfano en `sending` (por
   cualquier motivo, incluida la causa 1), el sistema daba el envío
   completo por cerrado igual, sin haber terminado.
3. Un GUC de RLS (`app.is_platform_admin`) se seteaba de forma
   **transaccional** (`SET LOCAL`) en vez de **de sesión** (`SET`) — se
   perdía en el primer `commit()` del tick, dejando el resto de las
   consultas de ese mismo tick sin visibilidad RLS.
4. Bajo ticks concurrentes sobre el mismo envío (un lock de Redis con TTL
   más corto que el tiempo real de envío de un lote grande dejaba
   solapar ticks), una asignación ORM (`objeto.status = "sent"` +
   `commit()`) disparaba `StaleDataError` si otro tick ya había cerrado
   la fila entre medio.

Cada causa se descubrió recién después de corregir la anterior y ver que
el síntoma persistía con otra forma. **La lección meta-nivel es la más
importante: en un sistema con reintentos automáticos, un síntoma que
"parece" resuelto (el envío avanza) puede estar enmascarando una causa
distinta que todavía no se manifestó.**

---

## 2. Los cinco errores de diseño (generalizados)

### 2.1 GUC de RLS transaccional en vez de sesión, fuera de un request

Cualquier código que corre **fuera del ciclo de vida de un request HTTP**
(loops de background, jobs programados, workers) y necesita bypassear RLS
como `platform_admin` para operar sobre filas de múltiples organizaciones
debe setear el GUC con `is_local=False`:

```python
# MAL — se pierde en el primer commit() del bloque
await db.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))

# BIEN — dura toda la sesión/conexión, sobrevive a múltiples commits
await db.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
```

`is_local=True` (`SET LOCAL`) es lo correcto **dentro de un request**,
donde una sola transacción cubre todo el ciclo de vida. Fuera de un
request, con múltiples `commit()` dentro del mismo bloque de trabajo, hay
que usar `is_local=False`. Antes de escribir un GUC en código nuevo,
copiar el patrón de un módulo que YA corre en este mismo contexto
(`retention_service.py` en este proyecto) en vez de asumir.

### 2.2 "¿Terminó?" debe cubrir TODOS los estados no-terminales

Si un recurso puede estar en más de un estado "todavía no terminado"
(`pending`, `sending`, `claimed`, `processing`...), la condición de cierre
debe excluir TODOS esos estados, no solo el más obvio:

```python
# MAL — un lote "sending" huérfano no bloquea el cierre
.where(SendBatch.status == "pending")

# BIEN
.where(SendBatch.status.in_(["pending", "sending"]))
```

Un estado "en curso" que ya no tiene nadie trabajándolo (huérfano) es
indistinguible, para esta consulta, de uno que SÍ tiene un tick
concurrente activo en este momento. Tratarlos igual (ambos bloquean el
cierre) es lo seguro — un falso "todavía no terminó" solo cuesta un tick
más de espera; un falso "ya terminó" pierde destinatarios reales.

### 2.3 Transiciones de estado bajo concurrencia: UPDATE atómico, no ORM assign+commit

Para cualquier cambio de estado que pueda competir con otro tick/worker
concurrente sobre la MISMA fila, usar un `UPDATE` condicionado
(estilo Core) con chequeo de `rowcount`, no una asignación de atributo
ORM seguida de `commit()`:

```python
# MAL — bajo concurrencia dispara StaleDataError si otro proceso ya
# cambió la fila entre el SELECT que la cargó y este commit()
send.status = "sent"
db.add(send)
await db.commit()

# BIEN — atómico, el que pierde la carrera simplemente no actualiza nada
result = await db.execute(
    update(ScheduledSend)
    .where(ScheduledSend.id == send.id, ScheduledSend.status == "sending")
    .values(status="sent")
)
await db.commit()
if result.rowcount != 1:
    return  # otro tick ya lo cerró — no hacer nada más, no relanzar
```

Mismo patrón que ya se usaba correctamente para el "claim" de un lote
(`_claim_batch`) — el bug fue no aplicar el mismo patrón a la
**finalización**, tratándola como "solo pasa una vez" cuando en realidad
puede competir igual que el claim.

### 2.4 Cualquier `db.get()`/lectura después de un claim puede fallar — nunca dejar que eso orfanee el recurso

Si un recurso se reclama (`pending`→`sending`) y luego se vuelve a leer
en la misma función, ese `get()` puede fallar por la razón que sea (bug
de GUC, race genuinamente no diagnosticado, lo que sea). El guard contra
ese caso no debe limitarse a loguear y saltar — debe **liberar el
recurso** activamente para que un tick futuro lo reintente:

```python
batch = await db.get(SendBatch, batch_id)
if batch is None:
    logger.error("lote %s reclamado pero no encontrado, se libera", batch_id)
    await db.execute(update(SendBatch).where(SendBatch.id == batch_id).values(status="pending"))
    await db.commit()
    continue
```

Preferir sistemas que se **autoreparan ante síntomas conocidos** por
sobre perseguir la causa raíz exacta de una condición de carrera bajo
presión de un incidente en vivo — la causa raíz exacta de por qué
`db.get()` devolvía `None` incluso con el GUC ya corregido no se llegó a
confirmar al 100% en este incidente; el guard de auto-liberación resolvió
el síntoma de todos modos, sin dejar el sistema dependiendo de que se
entienda el mecanismo exacto.

### 2.5 Lock de coordinación: TTL mayor al peor caso real, no al intervalo de polling

Si el lock de un loop de polling tiene el mismo TTL que el intervalo de
polling, y una sola iteración puede tardar más que ese intervalo (por
ejemplo, mandar ~100 correos reales por red, uno por uno), el lock va a
expirar a mitad de una iteración en curso y dejar que la siguiente
arranque en paralelo:

```python
# MAL — un tick que tarda >30s por trabajo real de red deja que el
# siguiente tick (30s después) tome el lock en paralelo
await redis.set(LOCK_KEY, token, nx=True, ex=comms_queue_poll_seconds)  # 30

# BIEN — TTL desacoplado del intervalo de polling, dimensionado al peor
# caso real de una iteración (no al ritmo con que se decide *intentar*)
_LOCK_TTL_SECONDS = 300
await redis.set(LOCK_KEY, token, nx=True, ex=_LOCK_TTL_SECONDS)
```

Además, la adquisición del lock (la llamada a `redis.set(...)`) debe
estar protegida por su propio `try/except` — si esa llamada específica
falla (Redis momentáneamente inalcanzable) y queda fuera del bloque
`try` del resto del tick, la excepción se propaga sin capturar y puede
matar la tarea de `asyncio` completa en silencio, sin loguear nada, hasta
el próximo reinicio del proceso.

---

## 3. Checklist para la próxima feature de envío masivo

Antes de dar por diseñada una cola de envíos (email, SMS, push, lo que
sea) con procesamiento en background:

- [ ] Cualquier GUC de RLS seteado fuera de un request usa `is_local=False`.
- [ ] La condición de "terminado" excluye TODOS los estados no-terminales
      del recurso, no solo el que parece más común.
- [ ] Toda transición de estado que puede competir con otro worker
      concurrente es un `UPDATE` atómico con chequeo de `rowcount`, nunca
      `objeto.campo = valor` + `commit()`.
- [ ] Todo `get()`/lectura posterior a un "claim" tiene un guard que
      **libera** el recurso si falla, no solo loguea.
- [ ] El TTL del lock de coordinación está dimensionado al peor caso real
      de una iteración (con llamadas de red reales incluidas), no al
      intervalo de polling.
- [ ] La adquisición del lock está protegida por su propio `try/except`,
      separado del resto de la lógica del tick.
- [ ] (Recomendado, no implementado en este incidente) Persistir progreso
      de forma incremental dentro de un lote grande — commitear cada N
      destinatarios en vez de uno solo al final — para que un crash a
      mitad de lote pierda como máximo N envíos sin registrar, no el
      lote entero.
- [ ] Antes de reiniciar/recrear el contenedor que hostea el loop,
      verificar si hay un envío real en curso (`SELECT status FROM
      <tabla> WHERE status IN ('sending', 'processing')`) — un
      reinicio a mitad de un envío real corta trabajo en progreso sin
      commitear.

## 4. Nota operativa aparte: `docker compose restart` no relee `.env`

No es un bug de esta feature, pero se descubrió en el mismo incidente:
`docker compose restart <servicio>` reinicia el proceso del contenedor
con las variables de entorno que tenía al momento de crearse — no vuelve
a leer `.env`. Cualquier cambio de `.env` en producción necesita
`docker compose up -d --force-recreate <servicio>` (o `up -d` si el
compose detecta el cambio de config), nunca `restart`. Verificar siempre
con `docker exec <contenedor> env | grep <VAR>` antes de asumir que un
cambio de `.env` se aplicó.
