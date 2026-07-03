# Design — firmas-recientes (retroactivo)

## Estado: IMPLEMENTADO

## Archivos

| Archivo | Rol |
|---------|-----|
| `apps/web/src/app/(campaign)/components/RecentSignatures.tsx` | Feed con polling cada 30s |
| `apps/web/src/app/(campaign)/CampaignPage.tsx` | Pasa `initial={recentSignatures}` desde SSR |
| `apps/web/src/app/page.tsx` | Fetch SSR de `getRecentSignatures(campaign.id, 10)` |
| `apps/api/app/routers/public_campaign.py` | `GET /{id}/signatures/recent` |
| `apps/api/app/services/signature_service.py` | `get_recent_signatures` filtra por `visibility='publica'` |

## Decisiones

- Carga inicial SSR + polling cliente cada 30s: evita flash en la carga y mantiene el feed actualizado sin SSE.
- Solo `visibility='publica'`: las firmas anónimas y secretas no aparecen nominalmente (R2).
- Nombre almacenado en DB como `null` si no es pública — no es una decisión de display, es de almacenamiento (R3).
- Límite de 20 firmas máximo en el endpoint para evitar respuestas pesadas.

## Seguridad
- RLS `sig_public`: SELECT público restringido a `confirmed` + `visibility in (publica, anonima)` cuando `app.current_org_id` IS NULL.
- El endpoint usa `get_db` (sin `set_config`), así que se aplica el filtro público de RLS automáticamente.
- No se expone email, cédula ni IP.
