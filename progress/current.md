# Estado actual — tras sesión 26 (2026-07-08)

## Resumen de sesión 26

Sesión de UI sobre la landing pública (iteraciones desktop + móvil con capturas del
usuario), marca **+Cauces.org**, OrgCard expandible con datos de la org desde el API,
y fix del filtro de provincia del admin (T26). Todo commiteado por el usuario
(4 commits, último: `810ba42`). Sin migraciones ni variables de entorno nuevas.

---

## Lo que se hizo

### Landing — desktop
- **Tarjeta de firma "viajera"** (estrategia final tras 3 iteraciones): al hacer
  scroll down se comprime a solo el botón e **intercambia lugar** con las tarjetas
  de organización y compartir (máquina de 3 posiciones `ctaPos` en `CampaignPage`,
  animación **FLIP** — cta 700ms, desplazadas 600ms, easeOutCubic; colapso 650ms
  sincronizado). En la última posición queda `sticky top-8` (nada debajo → nunca se
  sobrepone). Scroll up deshace posición por posición con histéresis; se expande
  solo al recuperar el primer lugar. Trigger del CTA flotante móvil ahora observa
  **el botón**, no la tarjeta (clave en pantallas 13-14").
- **Hero**: eslogan (`meta.welcome_slogan`) en Anton grande, loop 9s (3s visible /
  5.5s oculto, keyframe `cauce-slogan-loop`), color según **luminancia real** de la
  imagen (canvas, fallback oscuro por CORS); "Impulsada por" + logo org en esquina
  inferior derecha (texto claro — el gradiente oscurece la base); tag de categoría
  arriba-derecha 20% más pequeño.
- **Título dentro de la columna principal** (el sidebar sube a su altura); h1 móvil
  separado con `md:hidden`.
- **Compartir compacto**: botones circulares solo-icono 48px (Facebook/X/Email/
  Copiar-con-check); la fila de URL es solo móvil; QR intacto (decisión usuario);
  documentos destacados (`prominentDocs`) también en desktop.
- **Footer** oscuro pequeño: "Plataforma sin fines de lucro hecha en Ecuador ·
  +Cauces.org · Todos los derechos reservados 2026".

### Landing — móvil
- Nav compacto, marca atenuada; portada full-bleed sin bordes redondeados.
- Tag de categoría: esquina sup. derecha, **esquema invertido** (fondo ink, texto en
  `categoryColor` vía CSS var `--tag-c`).
- "Impulsada por" centrada bajo el bloque de firma; estado de campaña debajo de
  "Por qué importa", centrado y simétrico (fix: la última etapa ya no lleva
  `flex: 1` — eliminaba el espacio muerto a la derecha).
- Eslogan animado también en móvil (`clamp(24px, 4.6vw, 56px)`).
- Botones compartir solo-icono también en móvil; fila URL/copiar se mantiene.

### Marca +Cauces.org (desktop + móvil + admin)
- "+" en Poppins semibold `1.2em` + "Cauces.org" en Anton. En landing (nav, 19px/55%
  desktop, 12px/40% móvil — reducida 15% y atenuada a pedido) y en el sidebar admin
  (reemplaza "Cauce Petition"; el chip "C" se conserva).

### OrgCard expandible (desktop + móvil)
- Chevron rotatorio; expande descripción + email de contacto (max-height/opacity
  300ms). El serializer público (`public_campaign.py::_serialize`) ahora expone
  `org.description` y `org.contact_email` (datos institucionales del Responsable,
  no PII de firmantes); tipo `CampaignOrg` actualizado. Sin detalles → sin chevron.

### Otros
- "Lo que pedimos": **letras A–E** (círculo 11px) en landing y editor admin
  (placeholders "Pedido A…E"). Aplica a los 5 asks máximo.
- **Fix T26**: el filtro provincia del admin listaba 6 provincias hardcodeadas →
  `lib/provincias.ts` fuente única (24 + "Otra") compartida con `StepForm`.

### Validaciones del usuario al inicio de sesión
- `PII_ENCRYPTION_KEY` nueva ya en el `.env` del VPS ✓ (punto 1 deploy cifrado-reposo)
- T25 y T27 de dashboard-firmas OK en browser; T26 revisado → bug encontrado y
  corregido. T28 pendiente.
- tasks.md de dashboard-firmas actualizado (T25-T27 ✓).

---

## Datos dev

| Campo | Valor |
|-------|-------|
| Email | `admin@cauce.ec` |
| Password | `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| Landing con eslogan | `http://localhost:3002/c/prueba-001` (única con `welcome_slogan`) |
| Landing por path | `http://localhost:3002/c/campana-dev-001` |
| Migración activa | `017` |

## Datos producción

| Campo | Valor |
|-------|-------|
| Primera campaña real | `https://cauce.ecuadornotlc.org/c/soberania-tlc-ecu-usa` |
| Campaign ID | `63867787-5498-401e-90f7-990f46b1e09e` |
| Organización | Plataforma por la Soberanía Alimentaria |
| Migraciones en prod | 015-017 aplicadas; PII cifrada verificada (`enc:v1:`) |

---

## Estado de features (sin cambios de estado en sesión 26)

Orden de implementación fase 3 acordado:
**retencion-datos → supresion-admin → derechos-arco** (specs aprobadas).
`cifrado-reposo` implementado y desplegado; usuario decide `done`.
`enlace-corto-qr` (fase 2) spec aprobada, pendiente de turno.

## Pendientes para próxima sesión

1. Implementar **`retencion-datos`** (siguiente de fase 3)
2. Usuario en VPS: acción manual #2 pendiente (probar clic del email en prod tras
   `RESEND_FROM_EMAIL`/`API_PUBLIC_URL`)
3. Usuario en admin prod: `welcome_slogan` de la campaña TLC (sin él no aparece el
   eslogan del hero), texto del aviso en la política asignada, logo de la org
4. Checks browser menores: dashboard-firmas **T28**, editor-branding T14 (social
   links en StepThanks), resumen-admin T6-T7
5. Deploy de sesión 26: solo `git push` → CI/CD (sin migraciones ni env nuevas)
6. Opcional: reconstruir `history.md` sesiones 6–23

## Al inicio de la próxima sesión

```bash
docker compose -f docker-compose.dev.yml up -d
```
