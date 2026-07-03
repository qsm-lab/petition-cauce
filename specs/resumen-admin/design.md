# Design — resumen-admin

## Archivos afectados

### Backend
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/routers/dashboard.py` | Reescribir `dashboard_summary`: contar desde `signatures` (status=confirmed, org_id), contar campañas por status, retornar últimas 5 campañas con firma counts. |
| `apps/api/app/services/campaign_service.py` | Nuevo método estático `get_dashboard_summary(db, org_id)` que ejecuta las queries necesarias. |

### Frontend
| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/admin/resumen/page.tsx` | Convertir a Server Component async. Fetch `GET /v1/dashboard/summary` desde servidor con cookie. Mostrar KPIs reales. Sección campañas recientes con datos reales. Manejo de error no bloqueante. |

## Decisiones

- **Server Component para el fetch.** La página es estática por ruta, pero hace fetch en el servidor en cada request. No se usa `use client`; el JWT nunca sale al browser en esta página.
- **Cookie forwarding.** Next.js Server Component usa `cookies()` de `next/headers` para reenviar `access_token` al API. Patrón ya usado en `/admin/campanas/[id]/firmas/page.tsx`.
- **Error silencioso.** Si `fetch` falla, los KPIs muestran "—" y la tabla muestra "Sin datos". No se propaga el error al layout.
- **`total_goal`:** Si ninguna campaña activa tiene `goal_count`, el KPI muestra "—".
- **Sección "Actividad reciente" eliminada.** Reemplazada por accesos rápidos: "Ver firmas de [campaña activa]" y "Nueva campaña".
- **Refresh:** El usuario recarga la página para actualizar los datos. No hay polling ni SSE en esta fase.

## Seguridad
- El fetch del servidor reenvía `access_token` como cookie HTTP-Only → nunca expuesta al cliente.
- `org_id` se extrae del JWT en el backend; el frontend no envía org_id en el request.
- No hay PII en esta página (solo conteos y metadatos).

## No incluido en esta spec
- Gráficas de firmas por día (fase posterior).
- Auto-refresh / polling del contador.
