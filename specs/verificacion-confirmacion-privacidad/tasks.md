# verificacion-confirmacion-privacidad — Tareas

> Spec **aprobada por el usuario** (2026-11-07). D1 (V1) sigue abierta: depende de la consulta de confirmaciones < 10 s. D1 = A decidido. V4 (página) espera el diseño aprobado de V2.

- [x] **V1 · Decisión D1** (usuario, 2026-11-07): **A** (botón con `POST`). _R1_
- [x] **V2 · Diseño** de `/confirmar/<token>` en Claude Design y export a `design-export.html` (solo si D1 = A). _R1_ — export recibido el 2026-11-08 (7 marcos: antes, enviando, éxito con/sin nombre, vencido, no válido, error, sin JavaScript; paquete en `docs/diseno-confirmar-firma/`). **Aprobado por el usuario (2026-11-08).**
- [x] **V3 · API:** `GET` redirige a `/confirmar/<token>` sin confirmar, `POST` confirma (`public_campaign.py`); 7 tests en `tests/test_confirmacion_post.py`. **No desplegar sin V4**: el `GET` redirigiría a una página que aún no existe. _R1_
- [x] **V4 · Frontend:** `apps/web/src/app/(campaign)/confirmar/[token]/` (`page.tsx` + `ConfirmarFirma.tsx`), Tailwind, `confirmSignature` (POST) en `signatures-api.ts`
      (se retiró el helper antiguo por GET, sin uso). Verificado en navegador (Brave headless): 0 peticiones antes del clic, un solo POST aunque se haga clic 3 veces, éxito con/sin
      nombre → `/c/<slug>?confirmada=1[&nombre=Ana]`, vencido, no válido (también contra la API real), error 500 y 429 con enfriamiento de 5 s; medidas idénticas al diseño a 390 y 1160 px;
      sin desbordamiento a 360 px; `tsc` limpio y `next build` de producción correcto. API: `name` solo si la firma es `publica` (test). **V3 y V4 ya pueden desplegarse juntas.** _R1_
- [x] **V5 · Medición:** confirmación < 5 s p95 con k6 y con una firma de prueba en producción. _R2_
      **k6 (9 nov, entorno `lt-*` en Docker, escenario `confirm`):** 300 `POST /confirm/<token>` con tokens reales, 30 en paralelo → 300/300 `confirmed`, 0 errores 5xx, mediana 113 ms, p90 0,8 s, **p95 3,4 s** (< 5 s, cumple; la cola es el arranque simultáneo de 30 sobre 1 CPU de la API de carga; en producción el límite de 20/min por IP lo evita).
      **Firma real en producción (9 nov, campaña `test-fresh`):** correo y confirmación «inmediatos» según el usuario (sin cronómetro; la medición del contador en `fresh` fue de 10 s hasta verse en el borde). Recorrido completo: firma → correo → `/confirmar/<token>` → confirmación OK.
> V6–V10: material preparado el 9 nov en `preparacion-v6-v10.md` (tabla de buzones, comprobaciones de seguimiento, inventario de proveedores frente al RAT, guion ARCO y hechos/opciones de retención). Lo que requiere decisión está marcado ⏸ allí.
- [ ] **V6 · Buzones reales:** Gmail, Outlook/Hotmail, iCloud y corporativo; tabla de resultados. _R3_
- [ ] **V7 · Seguimiento:** revisar HTML y panel de Brevo/Resend (aperturas y clics desactivados). _R5_
- [ ] **V8 · Aviso de privacidad y RAT:** proveedores y finalidades reales; Cloudflare R2 (UE) como subencargado. _R4_
- [ ] **V9 · ARCO:** responsable, canal y plazo definidos; recorrido de `mis-datos` de extremo a extremo. _R6_
- [ ] **V10 · Retención** de `pending_confirmation`: decidir plazo y, si procede, purga con `retencion-datos`. _R7_
