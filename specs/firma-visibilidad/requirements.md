# Requirements — firma-visibilidad

## Contexto
El firmante elige cómo quiere que aparezca su firma. La plataforma respeta esa elección en todos los puntos donde se muestra información de firmas.

## Requisitos

**R1** — El formulario de firma ofrece hasta 3 opciones de visibilidad (configurables por campaña vía `form_config.visibility_options`):
- **Pública**: nombre visible en el feed de firmas recientes
- **Anónima**: solo aparece en el contador, no en el feed
- **Secreta**: no aparece en el contador público ni en el feed (pero sí en el total admin)

**R2** — La opción por defecto es `anonima` si está disponible en la config; si no, la primera opción disponible.

**R3** — El nombre del firmante se almacena en la DB **solo si `visibility='publica'`**; en caso contrario `name=null`.

**R4** — El feed de firmas recientes (`/v1/public-campaign/{id}/signatures/recent`) solo retorna firmas con `visibility='publica'` y `status='confirmed'`.

**R5** — El counter total de firmas (usado en `ActionBlock` y barra de progreso) cuenta todas las firmas `confirmed` sin filtro de visibilidad.

**R6** — El dashboard admin ve todas las firmas con su visibilidad real (badge Pública / Anónima / Secreta) y puede filtrar por visibilidad.

**R7** — La política RLS `sig_public` permite SELECT público solo para firmas `confirmed` con `visibility in (publica, anonima)` cuando `app.current_org_id` es NULL, asegurando que las firmas secretas nunca sean expuestas en endpoints públicos.
