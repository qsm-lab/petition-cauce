# Requisitos — dashboard-firmas
> EARS notation. Fecha: 2026-07-01
> Feature: dashboard-firmas · Fase 1 · Área: fullstack

---

## Contexto

Panel admin para gestionar las firmas recibidas por campaña.
Accesible desde `/admin/campanas/[id]/firmas`.
El sidebar global `/admin/firmas` actúa como redirect a campañas (stub existente — no cambia).

---

## Acceso y autenticación

**R1** — La página `/admin/campanas/[id]/firmas` SHALL requerir JWT válido (cookie `access_token`).
Si no hay sesión, SHALL redirigir a `/admin/login`.

**R2** — La API SHALL verificar que la campaña `[id]` pertenece al `org_id` del usuario autenticado
mediante RLS (`app.current_org_id`). Si la campaña no existe o pertenece a otra org, SHALL retornar 404.

**R3** — Solo usuarios con `role = 'admin'` o `role = 'gestor'` SHALL tener acceso.

---

## Header de la página

**R4** — El header SHALL mostrar el nombre de la campaña (no el slug) y un contador
en formato "**N** firmas confirmadas".

**R5** — El header SHALL incluir un breadcrumb "Campañas / [nombre campaña] / Firmas"
con el primer ítem como enlace a `/admin/campanas`.

---

## Resumen estadístico

**R6** — Encima de la tabla SHALL mostrarse tres cifras:
total confirmadas, total pendientes, total anuladas.
Formato: chips en línea — "823 confirmadas · 14 pendientes · 2 anuladas".

---

## Tabla de firmas

**R7** — La tabla SHALL mostrar las columnas siguientes en orden:
`Nombre`, `Provincia`, `Visibilidad`, `Estado`, `Confirmada el`, `Registrada el`.

**R8** — La columna `Visibilidad` SHALL mostrar badges de color:
- Pública → verde (`#18794A`)
- Anónima → gris neutro (`var(--bmut)`)
- Secreta → rojo (`#c2410c`)

**R9** — La columna `Estado` SHALL mostrar badges de color:
- Confirmada → verde
- Pendiente → naranja/amarillo
- Anulada → rojo

**R10** — Las filas con `status = 'anulada'` SHALL mostrarse con opacidad reducida (0.45).

**R11** — La tabla SHALL estar ordenada por `created_at DESC` por defecto (más recientes primero).
No se requiere ordenación interactiva en Fase 1.

**R12** — La columna `Nombre` SHALL mostrar el valor `name` de la firma.
Email y cédula NO SHALL mostrarse en la tabla (PII cifrado — Fase 3).

---

## Paginación

**R13** — La tabla SHALL paginar resultados en bloques de 50 por página (`per_page=50`).

**R14** — SHALL existir controles de paginación: botones "Anterior" / "Siguiente" y un
indicador de rango y total — "Mostrando 1–50 de 823 firmas".

**R15** — WHEN el total de resultados es ≤ 50, THEN los controles de paginación SHALL ocultarse.

**R16** — El número de página SHALL estar en el query param `?page=N` de la URL.
Navegar con el botón atrás del navegador SHALL restaurar la página anterior.

---

## Filtros

**R17** — La barra de filtros SHALL tener tres selects:
1. **Provincia** — opciones: "Todas", Azuay, Pichincha, Guayas, Loja, Cañar, Otra
2. **Visibilidad** — opciones: "Todas", Pública, Anónima, Secreta
3. **Estado** — opciones: "Todos", Confirmada, Pendiente, Anulada

**R18** — WHEN el usuario aplica un filtro, THEN la tabla SHALL recargarse con los
resultados filtrados y el contador de rango SHALL actualizarse.

**R19** — Los filtros SHALL funcionar combinados (AND lógico entre filtros).

**R20** — Los filtros activos SHALL reflejarse en los query params de la URL
(`?provincia=Pichincha&visibility=publica`), de modo que la URL sea compartible.

---

## Export CSV

**R21** — SHALL existir un botón "Exportar CSV" que descargue un archivo `.csv`
con todas las firmas de la campaña que cumplan los filtros activos.

**R22** — El CSV SHALL tener las columnas:
`id`, `nombre`, `provincia`, `visibilidad`, `estado`, `confirmada_el`, `registrada_el`.
Email y cédula NO SHALL incluirse en el CSV de Fase 1 (PII cifrado — pendiente Fase 3).

**R23** — El nombre del archivo SHALL seguir el patrón `firmas-{slug}-{YYYY-MM-DD}.csv`.

**R24** — El botón de export SHALL estar desactivado mientras no haya firmas que exportar
(`total_count = 0`).

---

## Estado vacío

**R25** — WHEN una campaña no tiene firmas (o los filtros activos no retornan resultados),
THEN la tabla SHALL mostrar un estado vacío con mensaje "No hay firmas que coincidan".
Si no hay filtros activos el mensaje SHALL ser "Esta campaña aún no tiene firmas registradas".

---

## Accesibilidad

**R26** — La tabla SHALL usar `<table>`, `<thead>`, `<th scope="col">`, `<tbody>`, `<tr>`, `<td>`.
No usar divs para simular una tabla.

**R27** — Los botones de paginación SHALL tener `aria-label` — "Página anterior", "Página siguiente".
El botón desactivado SHALL tener `aria-disabled="true"` y `disabled`.

**R28** — Los badges de visibilidad y estado SHALL tener texto legible (no solo color).
SHALL incluir un atributo `aria-label` si el texto es abreviado.
