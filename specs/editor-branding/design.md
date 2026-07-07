# Design — editor-branding

---

## Archivos afectados

### Backend (2 archivos, sin nueva migración)

| Archivo | Cambio |
|---------|--------|
| `apps/api/app/schemas/campaign.py` | Agregar `branding: dict = {}` a `CampaignUpdate` |
| `apps/api/app/services/campaign_service.py` | Agregar `"branding"` a `_META_FIELDS` |

### Frontend (1 archivo principal + 1 nuevo componente)

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/admin/campanas/[id]/CampanaEditorClient.tsx` | Nueva sección "Identidad visual" con campos portados + picker de color primario |
| `apps/web/src/app/admin/campanas/[id]/BrandingColorPicker.tsx` | Nuevo: 3 chips de preset + `<input type="color">` + campo hex manual |

Los componentes heredados (`WelcomeConfigEditor`, `SocialLinksEditor`) de `/admin/campaigns/[id]/` NO se reutilizan directamente — su lógica se integra inline en `CampanaEditorClient` con el nuevo design system y sin botones de guardado propios.

---

## Decisiones técnicas

### D1 — Color primario: solo `--bp`

El design system Lime/Ink es la base. La única variable expuesta al administrador es `primary_color` (mapea a `--bp`). El token `on_primary_color` se calcula automáticamente (WCAG luminosidad):

```ts
function autoOnPrimary(hex: string): string {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const L = 0.299*r + 0.587*g + 0.114*b;
  return L > 0.5 ? "#16261F" : "#FFFFFF";
}
```

### D2 — `meta.branding` como objeto anidado

```json
{ "branding": { "primary_color": "#D7F24C", "on_primary_color": "#16261F" } }
```

La landing ya lee `campaign.meta?.branding` y llama `campaignStyleTag(branding)` — sin cambios en la landing.

### D3 — Presets como chips, no select

Tres botones pequeños "Bosque / Océano / Fuego" que rellenan el picker. No hay "Personalizado" como opción — si el admin cambia el color manualmente, simplemente no hay chip activo.

### D4 — Sin botón de guardado propio

Los campos de branding se incluyen en el `buildPayload()` del submit principal. El flujo de guardado no cambia para el usuario.

### D5 — Campos avanzados colapsados

`welcome_title_size`, `welcome_slogan_size`, `welcome_title_color`, `welcome_slogan_color` van bajo un `<details>` "Opciones avanzadas" para no saturar la UI. Son poco usados.

### D6 — Miniatura de logo

Si `welcome_logo_url` tiene valor, mostrar `<img>` 40×40 con `object-contain` al lado del input. Si la URL da 404, el `<img>` simplemente no renderiza (onerror → hide).

---

## Privacidad y seguridad

- Sin PII en esta feature.
- `welcome_logo_url` es URL externa — solo se muestra como `<img>`, no se hace proxy ni fetch server-side.
- `primary_color` sanitizado con regex hex antes de guardar (ya lo hace `campaignStyleTag` en la landing; el backend también con `_META_FIELDS`).
