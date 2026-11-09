# Runbook de incidentes (hardening-campana T5.4)

Para quien está de guardia durante la campaña. Cada alerta llega por correo con el asunto `[Cauce][NIVEL] id`
(el chequeo externo de GreenGeeks usa `[Cauce] CAIDA:`). Esta guía dice qué mirar primero y cómo revertir.

**Reglas de oro**
- Ningún comando imprime secretos. No usar `bash -x`, `cat .env` ni `docker inspect` sin filtrar. Para ver si una variable
  tiene valor: `docker exec petition-api sh -c 'test -n "$VAR" && echo con-valor || echo vacia'`.
- No desplegar con un envío masivo en curso (ver `runbook_colas_asincronas_email.md`).
- Sin PII en el chat ni en capturas: solo conteos y estados.
- Si hay datos personales expuestos o en riesgo, pasar de inmediato a `docs/legal/runbook_brechas.md` (plazo de 72 h).
- Anotar la hora de cada paso. Es el registro que pide el runbook de brechas.

`P` es la carpeta del repositorio en el VPS. Contenedores: `petition-api`, `petition-web`, `petition-db`, `petition-redis`.

## 1. Triage en 2 minutos
```bash
cd $P && docker compose ps                                   # ¿todo "running"?
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
df -h / | tail -1; free -m | sed -n 2p
curl -s -o /dev/null -w '%{http_code}\n' https://<dominio>/v1/health
docker compose logs --since 10m petition-api | grep -cE ' 5[0-9][0-9] '   # solo un conteo
```
Si `health` no responde 200, ir a la fila de la tabla de abajo. Si responde 200 y la alerta es de negocio, mirar su fila.

## 2. Alertas → primera acción
| Alerta (id) | Qué significa | Primera acción | Si no se resuelve |
|---|---|---|---|
| `contenedor_*` CRITICO | Un contenedor no está `running` | `docker compose ps`; `docker compose logs --since 15m <c> \| tail -50`; `docker compose up -d <c>` | Revertir al commit anterior (sección 4) |
| `errores_5xx` | La API devuelve errores | Ver el log por ruta y código (sin PII). `TimeoutError` del pool ⇒ lecturas masivas: ver la spec `cache-lecturas-publicas` | Subir la caché (si ya está) o limitar en Cloudflare; revertir si empezó tras un despliegue |
| `pending_confirmacion` | Casi nadie confirma | ¿Llega el correo? Probar con una firma propia. Revisar cuota y estado del proveedor (Resend/Brevo) | Ver `correo_*` y la sección 3.1 |
| `correo_atascado` / `correo_gave_up` | La cola de confirmación no sale o se rindió | Proveedor: cuota diaria, claves, estado. Los `gave_up` se recuperan con el reenvío del firmante o relanzándolos a `pending` | Cambiar de proveedor (pool) y `--force-recreate` de la API |
| `cola_backlog` / `cola_atascada` | Comunicaciones masivas | `runbook_colas_asincronas_email.md` | No reiniciar a ciegas la API durante el envío |
| `backup_atrasado` | Sin respaldo correcto en 26 h | `tail -20 $BACKUP_DIR/*.log`; probar `pg_backup.sh` a mano; revisar `rclone` y espacio | Respaldo manual antes de cualquier cambio (`runbook_backup_restore.md`) |
| `disco` | Disco ≥ 70 % / 85 % | `docker system df`; `journalctl --disk-usage`; rotar logs; `docker image prune` | No borrar volúmenes. Ampliar disco |
| `memoria` | Memoria del host alta | `docker stats`; reiniciar solo el contenedor que crece | Bajar workers o ampliar RAM |
| `exportaciones_pii` | Más de 3 exportaciones en 1 h | Confirmar con los administradores si fueron ellos | Si nadie las reconoce: playbook B de `runbook_brechas.md` |
| `CAIDA:` (GreenGeeks) | La web no responde desde fuera | Sección 3.3 (DNS/Cloudflare) y la fila `contenedor_*` | — |

## 3. Escenarios frecuentes
### 3.1 El correo de confirmación no sale
1. Estados en la base (solo conteos): `docker exec petition-db psql -U petition_admin -d petition_cause -At -c "select confirmation_email_status, count(*) from signatures where created_at > now() - interval '3 hours' group by 1"`.
2. `pending` creciendo y `sent` plano ⇒ proveedor o cuota. `failed` creciendo ⇒ errores del proveedor (ver el log, sin direcciones).
3. Cambiar de proveedor: ajustar `EMAIL_PROVIDER`/`EMAIL_POOL` en el `.env` del VPS (sin imprimirlo) y `docker compose up -d --force-recreate petition-api` (un `restart` no relee el `.env`).
4. Recuperar los `gave_up` (solo si el proveedor ya funciona): pasarlos a `pending` con `confirmation_email_attempts=0`. El loop los toma solo.

### 3.2 La web responde lento o con 503
1. `docker stats`: ¿la API está al límite de CPU o memoria? ¿`petition-db` tiene muchas conexiones? (`select count(*) from pg_stat_activity`).
2. Un `503` con `Retry-After` indica pool agotado: es la protección, no una caída. Esperar y bajar la presión (Cloudflare, caché).
3. No reiniciar la base de datos con tráfico. Reiniciar solo la API si su proceso está colgado.

### 3.3 Caída de DNS o Cloudflare
- Comprobar `https://www.cloudflarestatus.com` y que el dominio resuelve (`dig +short <dominio>`).
- Si Cloudflare está caído: el VPS solo acepta 80/443 desde Cloudflare (`ufw`), así que **no hay acceso directo por diseño**. No abrir
  el puerto al mundo para «arreglarlo» salvo decisión explícita, porque se pierde Turnstile y el rate limit por IP real.
- Si el DNS apunta mal: restaurar los registros desde la anotación de la zona (guardar una copia fuera de Cloudflare antes del lanzamiento).
- Comunicar en las redes de la campaña: «estamos con una incidencia, sus firmas no se pierden; vuelvan en un rato».

## 4. Reversión de un despliegue
Plan por tipo de cambio (R12). Siempre respaldo antes: `pg_backup.sh` a mano y comprobar `LAST_OK`.
| Cambio | Reversión |
|---|---|
| Código (API/web) | `git checkout <commit-anterior> && docker compose up -d --build` (el deploy corre con cualquier push a `main`: para revertir, revertir el commit en `main`) |
| Variable de entorno | Restaurar el valor anterior y `docker compose up -d --force-recreate <servicio>` |
| Migración Alembic | Solo si la migración trae `downgrade` probado; si no, restaurar el respaldo (`runbook_backup_restore.md`, RTO 20 s en la prueba, objetivo 2 h) |
| nginx | `nginx -t` antes de recargar; volver al archivo anterior y `systemctl reload nginx` |
| Regla de Cloudflare | Desactivar la regla; no borrarla |

Objetivos: RPO ≤ 1 h, RTO ≤ 2 h.

## 5. Después del incidente
- Anotar hora de inicio, detección, causa, acciones y cierre (2 líneas por hecho).
- Si hubo datos personales involucrados, completar el registro de `runbook_brechas.md`, sección 5.
- Si un umbral de alerta falló (no avisó o avisó tarde), corregirlo en `business_signals.sh` y probar el envío.
- Si fue un error de código, añadir un test que lo cubra antes de cerrar.

## 6. Contactos de guardia (completar antes del lanzamiento)
| Rol | Nombre | Canal | Horario |
|---|---|---|---|
| Guardia técnica principal | _por definir_ | _por definir_ | _por definir_ |
| Guardia técnica de respaldo | _por definir_ | _por definir_ | _por definir_ |
| Responsable LOPDP | _por definir_ | _por definir_ | — |
| Contacto de la organización activista | _por definir_ | _por definir_ | — |
