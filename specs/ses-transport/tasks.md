# Tasks — ses-transport

> No implementar hasta que el usuario apruebe la spec (sdd:true).

## Fuera del código (usuario, consola AWS — guía en la sesión 44)
- [ ] Elegir región y verificar identidad de dominio (DKIM Easy DKIM + SPF + MAIL FROM) en Cloudflare DNS
- [ ] Usuario IAM + política mínima + access key
- [ ] Solicitar production access (salir de sandbox)
- [ ] Agregar variables SES a `.env` dev y VPS (usuario)

## Backend (R1–R11)
- [x] T1 `aioboto3` en requirements + settings + validación de arranque (R3)
- [x] T2 `SesTransport` + registro + `platform_transport()` por proveedor (R1, R2, R6, R8)
- [x] T3 `email_enabled()` / `default_from_email()` y reemplazo de guardas (R4, R5)
- [x] T4 Clave de cuota por proveedor (R7) y `/comms/quota` (R9)
- [x] T5 `.env.example` documentado (R10)
- [x] T6 Tests con cliente mockeado: envío ok, MessageRejected, throttle, dev sin claves, switch vía env, retrocompat Resend (R1–R8)
- [ ] T7 Prueba real en sandbox a dirección verificada (manual, usuario)
