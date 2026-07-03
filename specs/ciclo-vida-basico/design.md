# Design — ciclo-vida-basico (retroactivo)

## Estado: IMPLEMENTADO

## Archivos

| Archivo | Rol |
|---------|-----|
| `apps/web/src/app/(campaign)/components/LifecycleSteps.tsx` | Componente visual de 5 etapas |
| `apps/web/src/app/(campaign)/CampaignPage.tsx` | Monta `<LifecycleSteps currentStage={campaign.lifecycle_stage} />` |
| `apps/api/app/models/campaign.py` | `lifecycle_stage: SmallInteger, default=0` |
| `apps/api/app/routers/public_campaign.py` | `_serialize` incluye `lifecycle_stage` en respuesta pública |

## Decisiones

- `lifecycle_stage` es un entero 0–4 (no un enum string) para simplificar incrementos y el cálculo del progreso visual (`progressPct = (stage/4) * 84%`).
- Sin interacción en vista pública; la gestión es exclusiva del admin (feature `ciclo-vida-admin`, Fase 2).
- El 84% (no 100%) de la barra de progreso evita que el último nodo quede fuera del contenedor.

## Seguridad
No hay datos personales. Campo público de solo lectura.
