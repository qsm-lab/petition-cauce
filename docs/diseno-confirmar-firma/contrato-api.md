# Contrato de la página con la API (V3, ya implementada)

El diseño solo puede prometer lo que este contrato permite. Fuente: `apps/api/app/routers/public_campaign.py`, `tests/test_confirmacion_post.py`.

## Cómo llega la persona
1. El correo trae un botón a `…/v1/public-campaign/confirm/<token>` (`GET`).
2. Ese `GET` **no confirma**: responde `302` a `<APP_URL>/confirmar/<token>`. Un escáner de enlaces solo hace `GET`, así que no confirma.
3. La página `/confirmar/<token>` muestra el botón. Al pulsarlo hace el `POST` de abajo.

## Petición de la página
```
POST /v1/public-campaign/confirm/<token>      (sin cuerpo; límite 20 por minuto por IP)
```

## Respuestas → estado de pantalla
| Respuesta | Significado | Estado a mostrar |
|---|---|---|
| `200 {"status":"confirmed","slug":"…","name":"Ana García"}` | Confirmada. `name` es el de quien firma (lo recibe solo quien tiene el token). También se obtiene si **ya estaba confirmada** (idempotente) | Éxito → redirigir a `/c/<slug>?confirmada=1&nombre=<Nombre>` |
| `200 {"status":"expired","slug":"…"}` | El enlace superó las 24 h | Vencido → botón a `/c/<slug>?confirmada=expirada` |
| `200 {"status":"invalid"}` | Token desconocido o mal formado. Respuesta genérica a propósito: no revela si existe | No válido |
| `429` | Demasiados intentos | Error (reintentar tras unos segundos) |
| `5xx` o fallo de red | Servidor o conexión | Error (reintentar) |

## Reglas que el diseño debe respetar
- La página **no hace ninguna petición antes del clic** y no conoce campaña, nombre ni correo antes de él.
- «Éxito» e «ya confirmada» son el mismo estado visual.
- «No válido» no distingue entre «no existe» y «ya usado».
- Redirección tras el éxito: a `/c/<slug>?confirmada=1&nombre=<Nombre>` (solo el primer nombre, codificado en la URL). La landing ya muestra
  el popup de agradecimiento y de compartir (`ConfirmedSharePopup`) y limpia esos parámetros.
- El enlace del correo dura 24 horas; el texto del correo lo dice y el diseño debe coincidir.

## Hallazgo a resolver en V4 (no afecta al diseño)
La API devuelve `name` **sin mirar la visibilidad** de la firma (el comentario del código dice «si es pública», pero no lo aplica; ya era así
con el `GET` anterior). Si la página lo pone en `?nombre=` de la URL, una persona con firma `anonima` o `secreta` dejaría su nombre en el historial
y en los registros de acceso. Propuesta: que la API devuelva `name` solo si `visibility == "publica"`, con un test. Lo trato al implementar V4.
