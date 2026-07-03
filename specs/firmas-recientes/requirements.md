# Requirements — firmas-recientes

## Contexto
Feed de firmas recientes en la landing pública. Prueba social que respeta la privacidad elegida por el firmante.

## Requisitos

**R1** — La landing muestra un feed de hasta 10 firmas recientes confirmadas.

**R2** — Solo se muestran firmas con `visibility='publica'`. Las firmas `anonima` y `secreta` no aparecen en el feed.

**R3** — Las firmas `anonima`/`secreta` sí se contabilizan en el contador total, pero no aparecen nominalmente en el feed.

**R4** — Cada entrada del feed muestra: avatar (inicial del nombre o icono de candado si anónima), nombre, provincia, tiempo relativo desde la confirmación.

**R5** — El feed se carga con datos iniciales server-side (SSR) y se refresca por polling cada 30 segundos desde el cliente.

**R6** — Si no hay firmas públicas, el feed muestra el mensaje "Sé el primero en firmar".

**R7** — Un indicador visual (punto pulsante verde) marca el feed como "en vivo".

**R8** — Un aviso explica que las firmas anónimas y secretas aparecen como "Anónimo".
