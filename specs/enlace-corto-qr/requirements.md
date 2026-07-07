# Requirements — enlace-corto-qr

## Contexto

El QR por campaña ya existe (generado en el editor admin con la librería `qrcode`,
persistido en `campaigns.qr_code_data`, mostrado en la landing si `show_qr`).
Esta feature agrega lo faltante: **enlace corto** por campaña, QR apuntando al
enlace corto con tracking de origen, y descarga desde el admin (insumo del
volante-pdf de fase 2).

## Requisitos

### Enlace corto
- **R1** El sistema DEBERÁ generar un código corto único por campaña (6-8 chars, alfabeto sin ambiguos `0/O/1/l`), persistido en `campaigns`.
- **R2** CUANDO se visite `/s/{short_code}` en cualquier dominio de la plataforma, el sistema DEBERÁ redirigir (302) a la landing de la campaña con `?source=short`.
- **R3** SI el código no existe o la campaña está archivada, ENTONCES el sistema DEBERÁ responder 404 con página amigable.
- **R4** El código corto DEBERÁ ser estable (no cambia al editar la campaña) y visible en el panel del editor admin junto al QR.

### QR
- **R5** El QR de campaña DEBERÁ codificar el enlace corto con `?source=qr` (no la URL larga) — habilita tracking de origen (fase 5) y QRs de menor densidad.
- **R6** El admin DEBERÁ poder descargar el QR como PNG (1024px, apto para impresión) desde el editor.
- **R7** CUANDO se regenere el QR (p. ej. tras cambiar slug), el enlace corto codificado DEBERÁ seguir siendo el mismo (R4); el QR impreso nunca se invalida.

### Tracking
- **R8** El parámetro `source` (`qr`, `short`, y los ya usados por difusión social) DEBERÁ propagarse al campo `signatures.source` al firmar (columna ya existente).

### Tests
- **R9** Los tests DEBERÁN cubrir: unicidad y estabilidad del código, redirect 302 con source, 404 en código inexistente/campaña archivada, y persistencia de `source` en la firma.

## Fuera de alcance

- Dominio acortador dedicado (se usa el dominio de la campaña / plataforma).
- Estadísticas de clics del enlace corto (fase 5, tracking-origen con Matomo).
- Volante PDF (feature volante-pdf, consume esta).
