# Design — firma-visibilidad (retroactivo)

## Estado: IMPLEMENTADO

## Archivos

| Archivo | Rol |
|---------|-----|
| `apps/web/src/components/sign-flow/StepForm.tsx` | Selector de visibilidad (Pública/Anónima/Secreta) |
| `apps/web/src/components/sign-flow/SignFlow.tsx` | Estado `visibility`, default desde `form_config.visibility_options` |
| `apps/api/app/services/signature_service.py` | `create_signature`: `name=null` si no pública; `visibility` almacenada |
| `apps/api/app/services/signature_service.py` | `get_recent_signatures`: filtra `visibility='publica'` |
| `apps/api/app/services/admin_signature_service.py` | Admin ve todas; filtro por visibilidad disponible |
| `apps/web/src/app/admin/campanas/[id]/firmas/page.tsx` | Badges de visibilidad en tabla admin |

## Decisiones

- **`name` en DB**: el nombre se almacena solo si `visibility='publica'`. Esto es una decisión de minimización de datos (LOPDP), no solo de display. Las firmas anónimas/secretas tienen `name=null`.
- **`secreta` vs `anonima`**: la diferencia operativa es el feed público. Ambas van al contador; solo `publica` aparece en el feed. La diferencia entre `anonima` y `secreta` es que `anonima` sí aparece en el filtro de admin con "Anónima", mientras que `secreta` aparece como "Secreta". Ambas están en el contador público de la landing.
- **RLS**: la política `sig_public` cubre `(publica, anonima)` en SELECT público. Las firmas `secreta` solo son visibles para el admin con `app.current_org_id` set.
- **form_config**: `visibility_options` en `meta` de la campaña permite al admin controlar qué opciones ofrece el formulario. Default: `["publica", "anonima"]`.

## LOPDP
- Minimización: nombre almacenado solo si el firmante eligió firma pública.
- El firmante puede cambiar su visibilidad ejerciendo derechos ARCO (Fase 3, `derechos-arco`).
