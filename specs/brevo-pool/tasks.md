# Tasks — brevo-pool

> No implementar hasta que el usuario apruebe la spec (sdd:true).

## Fuera del código (usuario) — ruta crítica, empezar ya
- [ ] Crear cuenta Brevo y pasar su verificación
- [ ] Autenticar el dominio en Brevo (registros en Cloudflare, DNS only) y un remitente
- [ ] API key + IP autorizada del VPS; confirmar tope diario real del plan
- [ ] Variables en `.env` dev y VPS (usuario)

## Backend
- [x] T1 settings + validación de arranque, `.env.example` (R3, R5)
- [x] T2 `BrevoTransport` + fábrica por nombre + `email_enabled`/`default_from` (R1, R2, R4)
- [x] T3 `platform_quota_key(name)` (R10)
- [x] T4 `platform_pool()` y cola: contexto con pool, reparto, tamaño de lote (R5–R9)
- [x] T5 `/comms/quota` con detalle del pool (R11)
- [x] T6 Tests: Brevo ok/errores/429, pool 1 miembro = igual que hoy, reparto 2 miembros con cupos, sin duplicados, org con config propia sin pool, validación de arranque (R1–R10)
- [x] T7 conftest: bloquear Brevo real (R13)
- [x] T8 Prueba real: un correo a dirección propia vía Brevo (usuario) — 2026-10-23/24: llegó a Gmail con SPF, DKIM y DMARC en pass (dominio `ecuadornotlc.org`, return-path `camp.ecuadornotlc.org`)
