# verificacion-confirmacion-privacidad — Tareas

- [ ] **V1 · Decisión D1** (usuario): A, B o C. Sin esto no se implementa R1. _R1_
- [ ] **V2 · Diseño** de `/confirmar/<token>` en Claude Design y export a `design-export.html` (solo si D1 = A). _R1_
- [ ] **V3 · API:** `GET` redirige, `POST` confirma, tests (GET no confirma, POST sí, idempotente, vencido, enlaces viejos). _R1_
- [ ] **V4 · Frontend:** página con botón, estados de éxito/vencido/error, Tailwind. _R1_
- [ ] **V5 · Medición:** confirmación < 5 s p95 con k6 y con una firma de prueba en producción. _R2_
- [ ] **V6 · Buzones reales:** Gmail, Outlook/Hotmail, iCloud y corporativo; tabla de resultados. _R3_
- [ ] **V7 · Seguimiento:** revisar HTML y panel de Brevo/Resend (aperturas y clics desactivados). _R5_
- [ ] **V8 · Aviso de privacidad y RAT:** proveedores y finalidades reales; Cloudflare R2 (UE) como subencargado. _R4_
- [ ] **V9 · ARCO:** responsable, canal y plazo definidos; recorrido de `mis-datos` de extremo a extremo. _R6_
- [ ] **V10 · Retención** de `pending_confirmation`: decidir plazo y, si procede, purga con `retencion-datos`. _R7_
