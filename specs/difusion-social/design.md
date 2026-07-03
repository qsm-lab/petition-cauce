# Design — difusion-social (retroactivo)

## Estado: IMPLEMENTADO

## Archivos

| Archivo | Rol |
|---------|-----|
| `apps/web/src/app/(campaign)/components/ShareSection.tsx` | Botones de compartir + URL copiable |
| `apps/web/src/app/(campaign)/CampaignPage.tsx` | Monta en aside (desktop) y al final (mobile) |
| `apps/web/src/app/page.tsx` | Construye `campaignUrl` (dominio propio o `/?slug=`) |

## Decisiones

- WhatsApp destacado como primer botón (full-width, color primario) porque es el canal principal en Ecuador.
- Sin parámetro de tracking en esta fase — el tracking de origen es `tracking-origen` (Fase 5). Los links de compartir no tienen `utm_source` por ahora.
- QR placeholder visual en la sección; la generación real es feature `enlace-corto-qr` (Fase 2).
- `campaignUrl` se construye en el server: dominio asignado en producción, `/?slug=` en local.

## Seguridad
Sin datos personales. Los links de compartir son URLs públicas.
