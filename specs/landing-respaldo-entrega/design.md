# Design — landing-respaldo-entrega

## Flujo

```
Autoridad / cualquiera con el link o el QR impreso
  → GET https://{dominio-campaña}/c/{slug}/respaldo   (o /c/{slug}/respaldo
    en el dominio genérico de la plataforma, según cómo se resuelva la
    campaña — mismo mecanismo que landing-campana)
  → Next.js (Server Component) resuelve la campaña por slug/Host
  → GET /v1/public-campaign/by-slug/{slug}/respaldo   (nuevo endpoint,
    público, sin auth, NO bloquea por archived_at)
  ← { campaña, org, conteos por tipo, conteos por origen, fechas,
      privacy_policy resumida }
  → Render server-side: detalles, cuantificación, fechas, seguridad
    (texto fijo), fiabilidad (texto fijo), privacidad (resumen + link)
  → Botón "Descargar QR" (client component) genera el PNG en el navegador
    con la librería `qrcode` ya en apps/web/package.json — no hay backend
    nuevo para el QR.
```

No hay estado, no hay formulario, no hay escritura — es una vista de solo
lectura. No hay borrador, no hay preview/envío como en
`comunicaciones-cierre-campana`.

## Backend

### Endpoint nuevo
`GET /v1/public-campaign/by-slug/{slug}/respaldo` en
`apps/api/app/routers/public_campaign.py`.

Diferencia clave con el resto de endpoints de este router: **no** hace
`if not campaign or campaign.archived_at is not None: 404` — solo 404 si
el slug no existe. Se implementa como su propio chequeo, no reutilizando
el helper que sí filtra archivadas (para no arriesgar que un cambio futuro
en ese helper rompa esta página sin querer).

### Agregación — nueva función en `signature_service.py`

```python
async def get_respaldo_stats(db: AsyncSession, campaign_id: uuid.UUID) -> dict:
    """Conteos agregados para la landing de respaldo — sin PII, solo
    números. Mismo criterio de 'confirmada' y de agrupación 'Internacional'
    que el dashboard admin de firmas (columna Origen)."""
    # total confirmadas
    # por visibility (pública/anónima/secreta)
    # por origen: provincia si country IS NULL, si no country
    #   (agrupar países no-Ecuador bajo "Internacional" + su propio
    #   desglose por país, igual que ya hace el dashboard)
```

Reutiliza `Signature.status == "confirmed"`, `Signature.visibility`,
`Signature.provincia`, `Signature.country` — todas columnas ya existentes,
sin migración. Hoy el agrupado "Internacional" del dashboard admin
(`FiltrosBar.tsx`) es puramente de presentación en el frontend, no una
agregación de backend — para esta feature el backend expone un desglose
plano por provincia (si `country IS NULL`) y por país (si no), y el
frontend decide cómo agruparlos visualmente (p. ej. sumar todos los países
bajo un total "Internacional" con detalle expandible), sin duplicar listas
de países en Python.

### Fechas — nueva función en `campaign_service.py`

```python
async def get_respaldo_dates(db, campaign) -> dict:
    # lanzamiento: primer lifecycle_event stage_index=0, o created_at
    # cierre: ends_at, o lifecycle_event de "Entrega" si ya ocurrió
    # generado_al: datetime.now(timezone.utc)  (se calcula en cada request)
```

### Texto fijo de seguridad/fiabilidad/privacidad

Vive como constantes en el propio endpoint o en un módulo nuevo
`app/content/respaldo_content.py` (texto en español, ya redactado en R12/R13
de requirements.md) — **no en la base de datos**, no editable por campaña,
consistente con la decisión tomada. Cambiarlo en el futuro es un commit de
código, no una acción de admin.

### Schema de respuesta

Nuevo `RespaldoPublicOut` en `app/schemas/campaign.py` (o
`schemas/signature.py`, a definir en tasks) con: campaña (título, org,
autoridad, categoría, asks), conteos (total, por_tipo, por_origen), fechas
(lanzamiento, cierre, generado_al), privacy (resumen + url si hay
`privacy_policy_id`).

## Frontend

### Ruta nueva
`apps/web/src/app/c/[slug]/respaldo/page.tsx` — Server Component, junto a
la ya existente `apps/web/src/app/c/[slug]/page.tsx` (mismo patrón de
fetch server-side, mismo layout base). Sin estado de cliente salvo el
botón de descarga de QR.

### Componente cliente
`DownloadQrButton.tsx` — recibe la URL completa (ya resuelta server-side)
y genera el PNG con `qrcode` (mismo paquete que
`CampanaEditorClient.tsx`), dispara la descarga con un `<a download>`
sintético. Sin llamada a backend.

### Meta `noindex`
Vía `export const metadata = { robots: { index: false, follow: false } }`
en el `page.tsx` (patrón estándar de Next.js App Router).

## Diseño visual (Claude Design)

**Pendiente de diseño en Claude Design (Adobe Express) antes de
implementar** — regla del proyecto: "Ninguna feature frontend se
implementa sin diseño Claude Design aprobado". Contenido a maquetar:
encabezado (campaña + org + autoridad), bloque de cuantificación (total +
2 desgloses), línea de tiempo/fechas, 3 bloques de texto fijo (seguridad,
fiabilidad, privacidad) y el botón de descarga de QR. Tono: documento
formal/institucional (va a manos de una autoridad), no el tono de
campaña/activismo del landing principal.

## LOPDP / privacidad

- **Sin PII en ningún punto** — ni en el HTML ni en el JSON del endpoint.
  Solo conteos agregados (R17). Verificado con test dedicado (R18).
- El desglose por tipo de visibilidad (incluye conteo de `secreta`) no
  viola la promesa hecha a quien firmó secreta: esa promesa es "no
  identificable", no "no contás". Mismo principio que ya aplica el conteo
  público total (que también incluye secretas).
- El resumen de privacidad enlaza a la política **vigente en el momento en
  que se consulta la página**, no a un snapshot congelado del momento de
  la entrega — aceptable porque no hay compromiso de mostrar la versión
  histórica acá (eso vive en `consents.text_snapshot` por firma, no en
  esta landing).
- No requiere `privacy_config` nueva (no es una feature que recolecta o
  procesa PII nueva, solo agrega y muestra lo que ya existe).

## Sin migraciones

Todo dato usado ya existe en columnas actuales. El QR no se persiste (se
genera en el navegador a partir del slug, determinístico). No hay
conflicto de orden con la cadena de migraciones pendiente en `dev`
(retención/supresión/ARCO) ni con `programacion-historial-comunicaciones`.
