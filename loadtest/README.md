# Pruebas de carga (hardening-campana T4.1 / T4.2)

**Nunca contra producción ni contra forms-qsm.** Hay dos formas de correrlas:

## A. Entorno local aislado (`docker-compose.loadtest.yml`)
Detecta carreras, errores 5xx, fugas de conexiones y fallos de lógica. **Sus tiempos no representan al
VPS** (depende de tu Mac); para capacidad real usar la opción B.

```bash
docker compose -f docker-compose.loadtest.yml up -d --build
docker exec lt-api alembic upgrade head
docker exec lt-api python -m app.scripts.seed_dev     # crea org, admin y campaña de prueba
docker exec lt-db psql -U petition_admin -d petition_cause -At -c \
  "select id||' '||slug from campaigns where status in ('active','online') limit 1"

export CAMPAIGN_ID=<uuid>  CAMPAIGN_SLUG=<slug>  BASE_URL=http://localhost:${LT_API_PORT:-8021}   # si 8021 está ocupado: LT_API_PORT=8031 en el up y aquí
k6 run -e SCENARIO=smoke        loadtest/signatures.js
k6 run -e SCENARIO=race         loadtest/signatures.js     # exactamente 1 firma creada
k6 run -e SCENARIO=abuse        loadtest/signatures.js     # tiene que aparecer 429
k6 run -e SCENARIO=nominal      loadtest/signatures.js     # OBLIGATORIA: 1/s x 30 min + ráfaga 10/s x 5 min (NOMINAL_MINUTES=3 BURST_MINUTES=2 para una prueba corta)
k6 run -e SCENARIO=simultaneous loadtest/signatures.js     # pico: 100 a la vez
k6 run -e SCENARIO=ramp         loadtest/signatures.js
k6 run -e SCENARIO=spike        loadtest/signatures.js
k6 run -e SCENARIO=read         loadtest/signatures.js

docker compose -f docker-compose.loadtest.yml down -v      # borra todo
```

## B. Staging real (capacidad)
Mismo `docker-compose.yml` de producción en un host temporal o con ventana acordada, con **correo en modo
stub** (sin `RESEND_API_KEY`/`BREVO_API_KEY`), `ENVIRONMENT=development` (Turnstile de prueba) y datos
sintéticos. `k6` se ejecuta **desde otra máquina**, no desde el servidor probado. Si comparte VPS con
forms-qsm: ventana acordada, límites de CPU/RAM y plan de parada.

## Niveles de carga
| Nivel | Escenarios | Criterio |
|---|---|---|
| **Nominal (obligatorio)** | `nominal` (1 firma/s × 30 min + ráfaga 10/s × 5 min ≈ 3 000/h) | p95 de alta < 1,5 s, 0 errores 5xx, correos recuperados |
| **Pico (obligatorio)** | `simultaneous` (100 a la vez), `race` | sin 5xx, exactamente 1 firma por persona |
| **Estrés (exploratorio)** | `ramp`, `spike`, `soak`, `read` | sin pasa/falla de capacidad: solo que degrade con 429/503 y sin pérdida de datos |
El correo usa un proveedor simulado (`EMAIL_FAKE_ENABLED`: 300–800 ms, 5 % de errores, 2 % de timeouts de 10 s). Después de cada
carga: `bash loadtest/verify_email_recovery.sh` comprueba que el loop cierra todo lo pendiente.

## Notas
- Para medir capacidad el script simula clientes distintos con `X-Real-IP` aleatorio y golpea la API directo
  (el límite es 5 firmas/min por IP). `RANDOM_IP=0` usa la IP real de la máquina de pruebas; `abuse` fija una IP.
- Datos sintéticos: nombre `LoadTest …`, correo `@loadtest.invalid`. Limpieza: `loadtest/cleanup.sql` (solo staging).
- Umbrales (k6 `thresholds`): p95 de alta < 1,5 s, 0 errores de servidor, `race` crea exactamente 1 firma.
- No apuntar a `petition-api-dev` (el contenedor dev tiene `RESEND_API_KEY` real).
