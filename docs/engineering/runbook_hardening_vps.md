# Runbook — hardening del VPS antes de la campaña (se aplica a mano)

Origen: `specs/hardening-campana/` (Fase 1). Estos pasos tocan el VPS y los hace el usuario;
el código ya está preparado en el repo. Cada paso tiene **verificación** y **reversión**.

Convenciones: `ssdn` = alias SSH del VPS principal; `cqsmorg` = alias del hosting compartido de
GreenGeeks. Las rutas del proyecto en el VPS se escriben `$P` (ajusta si difiere):

```bash
export P=~/proy_petition-cauce        # raíz del proyecto en el VPS
```

**Reglas generales**
- No pegar contenido de `.env` en chats ni tickets. Los comandos de abajo nunca lo imprimen.
- Ningún comando debe mostrar secretos ni contraseñas. Si un comando puede hacerlo (p. ej. `env`, `docker inspect`, `cat` de configs, `curl -v`), se indica **qué líneas filtrar antes de copiar la salida**.
- Antes de recrear contenedores: confirmar que **no hay un envío masivo en curso** (Paso 0).
- Hacer cada paso por separado y verificar antes del siguiente. Mantener una segunda sesión SSH
  abierta mientras se toca el firewall o nginx.

---

## Paso 0 — Comprobar que no hay envío en curso

```bash
docker exec petition-db psql -U petition_admin -d petition_cause -At -c \
 "select 'envios_activos='||count(*) from scheduled_send where status in ('sending','scheduled','pending');
  select 'lotes_pending_o_sending='||count(*) from send_batch where status in ('pending','sending');"
```
Esperado: ambos en `0`. Si no, **esperar** antes de recrear `petition-api`.

## Paso 1 — Diagnóstico de solo lectura (T1.1)

Desde tu Mac, en la raíz del repo:
```bash
ssh ssdn 'bash -s' < infra/monitoring/vps_readonly_audit.sh | tee /tmp/audit_vps.txt
```
Pégame la salida (no contiene secretos) o léela tú. Qué mirar:
- `TURNSTILE_SECRET_KEY=definida` y `ENVIRONMENT=production` → si no, **no desplegar el Paso 3**
  (la API no arrancaría por diseño).
- Roles: `petition_app super=false bypassrls=false` y dueño de tablas ≠ `petition_app`.
- Que existan cron/archivos de respaldo (si no, Paso 4 es urgente).
- `real_ip` de nginx y puertos 5432/6379 **no** expuestos (solo `127.0.0.1` o ausentes).
- Límites de memoria/CPU de contenedores, ufw, paquetes pendientes.

## Paso 2 — Activar Resend Pro (T1.4)

1. En el panel de Resend, subir la cuenta de **plataforma** a Pro y comprobar el dominio remitente.
2. En el VPS, fijar el plan en el `.env` (edición manual tuya, sin imprimir el archivo):
```bash
cd $P
grep -q '^RESEND_PLATFORM_PLAN=' .env \
  && sed -i 's/^RESEND_PLATFORM_PLAN=.*/RESEND_PLATFORM_PLAN=pro/' .env \
  || echo 'RESEND_PLATFORM_PLAN=pro' >> .env
grep '^RESEND_PLATFORM_PLAN=' .env
```
3. Si usabas el pool `brevo,resend` solo por el tope de Resend Free, puedes dejarlo o quitar
   `EMAIL_POOL`. Para el flujo de **firma** (transaccional): `EMAIL_PROVIDER=resend` (valor por defecto).
4. Aplicar (recrear, **no** `restart`; ver Paso 0):
```bash
cd $P && docker compose up -d --force-recreate petition-api
docker exec petition-api sh -c 'echo plan=$RESEND_PLATFORM_PLAN'
curl -s http://127.0.0.1:8011/health
```
Verificación: en el admin, `GET /comms/quota` debe mostrar `daily_quota: null` y `monthly_quota: 50000`.
Reversión: poner `RESEND_PLATFORM_PLAN=free` y recrear.

## Paso 3 — Desplegar el código (Turnstile fail-closed, IP, límites, dependencias, Next 15)

**Solo después de** revisar/commitear/mergear tú el cambio y de cumplir el Paso 1 (Turnstile y
`ENVIRONMENT=production`). Si usas el workflow de Actions, es el mismo flujo de siempre (`git pull` +
`docker compose up -d --build`). Manualmente:
```bash
cd $P && git pull origin main
docker compose up -d --build
sleep 20
docker ps --format 'table {{.Names}}\t{{.Status}}'
curl -s http://127.0.0.1:8011/health        # {"status":"ok","db":"ok","redis":"ok"}
docker exec petition-api alembic current     # 041 (head), sin migraciones nuevas
docker logs --tail 30 petition-api           # sin trazas de ValidationError de Turnstile
```
Verificación de límites: `docker inspect -f '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}' petition-api`.
Reversión: `git checkout <commit-anterior> && docker compose up -d --build`.

## Paso 4 — Respaldos cifrados con restore probado (T2.2)

**4.1 Claves de cifrado (en tu Mac, no en el VPS).** La clave privada **nunca** se guarda en el VPS.
```bash
brew install age            # o: apt install age en el VPS solo para el binario
age-keygen -o ~/petition-backup-IDENTIDAD.txt     # guardarla en gestor de contraseñas + copia offline
age-keygen -y ~/petition-backup-IDENTIDAD.txt > /tmp/recipients.txt   # clave PÚBLICA
```
**4.2 En el VPS** (instalar y dejar solo la clave pública):
```bash
sudo apt-get update && sudo apt-get install -y age
sudo mkdir -p /etc/petition-backup /var/backups/petition
sudo chown javofox: /var/backups/petition && sudo chmod 700 /var/backups/petition
# desde tu Mac:
scp /tmp/recipients.txt ssdn:/tmp/recipients.txt
# en el VPS:
sudo mv /tmp/recipients.txt /etc/petition-backup/recipients.txt && sudo chmod 644 /etc/petition-backup/recipients.txt
```
**4.3 Scripts y primer respaldo:**
```bash
scp infra/backup/*.sh ssdn:~/        # desde el Mac
# en el VPS:
sudo install -m 755 ~/pg_backup.sh ~/restore_test.sh ~/backup_keys.sh /usr/local/bin/
/usr/local/bin/pg_backup.sh
ls -la /var/backups/petition
```
**4.4 Copia fuera del VPS (R2 de Cloudflare, dentro de la capa gratuita).** Bucket **privado**, clase de
almacenamiento **Estándar** (otras clases no cuentan en la capa gratuita) y dos reglas de ciclo de vida:
prefijo `hourly/` → borrar a los **3 días**; prefijo `daily/` → borrar a los **30 días**.
Crea un token de API de R2 con permiso *Object Read & Write* **solo sobre ese bucket** (no de cuenta).
```bash
sudo apt-get install -y rclone
rclone config            # remoto "r2" (S3, proveedor Cloudflare). Las claves quedan en ~/.config/rclone/rclone.conf
chmod 600 ~/.config/rclone/rclone.conf
```
**Actualizar rclone (el de `apt` en Ubuntu 24.04 es la 1.60 y R2 responde `501` en el primer intento de cada subida).**
Se instala en `/usr/local/bin` (el script ya lo antepone al `PATH`; el cron no lo trae):
```bash
cd /tmp && V=$(curl -fsS https://downloads.rclone.org/version.txt | awk '{print $2}')     # p. ej. v1.xx.x
curl -fsSLO "https://downloads.rclone.org/$V/rclone-$V-linux-amd64.zip"
curl -fsSLO "https://downloads.rclone.org/$V/SHA256SUMS"
grep " rclone-$V-linux-amd64.zip" SHA256SUMS | sha256sum -c -        # debe decir: OK
unzip -q "rclone-$V-linux-amd64.zip" && sudo install -m 755 "rclone-$V-linux-amd64/rclone" /usr/local/bin/rclone
hash -r && rclone version | head -1                                  # debe mostrar la versión nueva
```
(`SHA256SUMS` está firmado con GPG; verificar la firma es opcional y exige importar la clave publicada en rclone.org.)
La configuración (`~/.config/rclone/rclone.conf`) no cambia. Si tras actualizar sigue el `501` en el primer intento,
es inocuo: rclone reintenta (3 intentos) y, si todos fallan, `pg_backup.sh` no escribe `LAST_OK` y la alerta avisa.

Valores de `rclone config` (bucket con **jurisdicción UE**): `provider=Cloudflare`, `env_auth=false`,
*Access Key ID* y *Secret Access Key* del token (no los pegues en chats; no uses `rclone config create ... secret=...`
en la línea de comandos, quedaría en el historial), `region=auto`, **endpoint
`https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`** (con `.eu.`; el endpoint sin jurisdicción no ve este bucket),
y en «edit advanced config» `no_check_bucket=true` (un token de objetos no puede crear buckets y rclone daría 403).
Un token limitado a un bucket **no puede listar buckets**: verifica con la ruta del bucket, no con `rclone lsd r2:`.
```bash
# Prueba con `copyto` (subida simple, lo que usa pg_backup.sh). `rcat` (streaming) dio 501 con rclone 1.60; no se probó con la nueva.
echo prueba > /tmp/prueba.txt
rclone copyto /tmp/prueba.txt r2:petition-backups/_prueba.txt && echo copia-ok
rclone lsf r2:petition-backups      # NUNCA pegar `rclone config show` (imprime las claves)
rclone delete r2:petition-backups/_prueba.txt && rm /tmp/prueba.txt && echo r2-ok
```
Alta de Cloudflare R2 (UE) como **subencargado** (almacenamiento cifrado de respaldos) en el RAT y en el contrato de encargo.
*Alternativa mínima:* `rsync` del `.age` al hosting de GreenGeeks, si el plan admite respaldos.

**4.5 Cron: cada hora (RPO ≤ 1 h) y una copia diaria de 30 días.** El respaldo local se conserva 7 días.
```bash
( crontab -l 2>/dev/null | grep -v '^PATH='
  echo 'PATH=/usr/local/bin:/usr/bin:/bin'   # cron no incluye /usr/local/bin (ahí está el rclone nuevo)
  echo '0 * * * * OFFSITE_REMOTE=r2:petition-backups/hourly RETENTION_DAYS=7 /usr/local/bin/pg_backup.sh >> /var/log/petition-backup.log 2>&1'
  echo '45 3 * * * f=$(ls -t /var/backups/petition/*.dump.age | head -1) && rclone copyto "$f" "r2:petition-backups/daily/$(basename "$f")" --quiet && rclone copyto "$f.sha256" "r2:petition-backups/daily/$(basename "$f").sha256" --quiet >> /var/log/petition-backup.log 2>&1'
) | crontab -
sudo touch /var/log/petition-backup.log && sudo chown javofox: /var/log/petition-backup.log
```
Cuota estimada (ver `specs/hardening-campana/tasks.md`): ≈ 1–2 GB y < 6 000 operaciones de clase A al mes frente a
10 GB y 1 M gratuitos. Comprobar en el panel de R2 durante la primera semana.

**4.6 Prueba de restauración (obligatoria).** Copia temporalmente la identidad privada al VPS, prueba y bórrala:
```bash
# desde el Mac
scp ~/petition-backup-IDENTIDAD.txt ssdn:/tmp/id.txt
# en el VPS
f=$(ls -t /var/backups/petition/*.dump.age | head -1)
/usr/local/bin/restore_test.sh "$f" /tmp/id.txt
shred -u /tmp/id.txt
```
Esperado: `signatures`/`campaigns` restauradas = originales, `alembic=042`, y un RTO en segundos.
Anota RPO (24 h con el cron diario) y RTO en `docs/engineering/runbook_backup_restore.md` (por crear).
Reversión: `crontab -e` y quitar la línea.

## Paso 5 — Copia de las claves críticas (T2.3)

```bash
# en el VPS (no imprime valores):
/usr/local/bin/backup_keys.sh $P/.env /etc/petition-backup/recipients.txt ~/claves-cauce.age
# debe decir "4 de 4 presentes" (si dice menos, falta definir alguna: PROVIDER_SECRET_KEY suele faltar)
scp ssdn:~/claves-cauce.age ~/        # desde el Mac; guardar en lugar distinto a los respaldos de datos
shred -u ~/claves-cauce.age           # en el VPS
```
Sin estas claves los respaldos de PII no se pueden leer. Guardar `claves-cauce.age` y la identidad
privada en lugares distintos. Si `PROVIDER_SECRET_KEY` está vacía, el sistema usa `PII_ENCRYPTION_KEY`
como respaldo: **definir una propia** (`openssl rand -hex 32`) requiere re-cifrar las credenciales de
proveedores por organización; consultarlo antes de cambiarla.

## Paso 6 — IP real y nginx (T3.1 / T3.2)

El código ya no depende de esto para ser correcto (usa `CF-Connecting-IP` solo si la conexión viene
de Cloudflare), pero conviene que nginx y los logs vean la IP real.
```bash
sudo grep -rn 'real_ip' /etc/nginx/
sudo nginx -T 2>/dev/null | grep -nE 'server_name|default_server' | head -20
```
- Si ya existe `real_ip_header CF-Connecting-IP;` con `set_real_ip_from` de Cloudflare (hoy en el conf de
  forms-qsm), está bien. **No duplicar** `real_ip_header` (nginx falla).
- Prueba de que funciona (el log debe mostrar tu IP real, no una de Cloudflare):
```bash
curl -s -o /dev/null https://cauce.ecuadornotlc.org/api/health
sudo tail -n 2 /var/log/nginx/cauce.access.log
```
- **Servidor por defecto en 443** (rechaza `Host`/SNI desconocidos). Hoy `sites-enabled/default` solo cubre el puerto 80;
  sin un `default_server` en 443, nginx entrega el primer servidor que escucha ahí (certificado y contenido de otro sitio).
  Se resuelve **sin certificado** con `ssl_reject_handshake` (nginx ≥ 1.19.4). Antes de crearlo:
```bash
nginx -v 2>&1                                     # debe ser >= 1.19.4
curl -sk -o /dev/null -w '%{http_code}\n' --resolve host-falso.test:443:127.0.0.1 https://host-falso.test/   # hoy: 200/301/404
```
Con una **segunda sesión SSH abierta**, crear `/etc/nginx/conf.d/00-default-reject.conf`:
```nginx
server {
    listen 443 ssl http2 default_server;      # mismas opciones que los demás sitios (si no, nginx avisa y manda las del default)
    listen [::]:443 ssl http2 default_server;
    server_name _;
    ssl_reject_handshake on;
}
```
```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sk -o /dev/null -w '%{http_code}\n' --resolve host-falso.test:443:127.0.0.1 https://host-falso.test/   # ahora: 000 (handshake rechazado)
for u in https://cauce.ecuadornotlc.org/api/health https://forms.quitosinmineria.org/ https://boletin.ecuadornotlc.org/; do
  curl -s -o /dev/null -w "%{http_code} $u\n" "$u"; done                      # los sitios reales siguen respondiendo
```
Los sitios legítimos tienen `server_name` explícito y no se ven afectados. Los avisos `protocol options redefined` de `nginx -t` ya existían en otros vhosts y son inofensivos. Verificado el 2026-11-07: `host-falso.test` → `000`, IP real de cliente en `cauce.access.log`. Reversión inmediata: `sudo rm /etc/nginx/conf.d/00-default-reject.conf && sudo nginx -t && sudo systemctl reload nginx`.

## Paso 7 — Origen cerrado a Cloudflare (T3.2) — **ya aplicado en el VPS; solo verificar**

Verificado el 2026-11-06 (`ufw status`): política `deny (incoming)`; 80/443 solo desde los rangos IPv4 e IPv6
de Cloudflare y desde la red Docker `172.20.0.0/16`; 22 abierto a todos. **No hay que tocar ufw para 80/443.**
```bash
sudo ufw status verbose | head -8
curl -sk --max-time 5 -o /dev/null -w '%{http_code}\n' https://IP-DEL-VPS/   # desde fuera: debe expirar
```
Pendiente de decidir (no urgente): 22 abierto a Internet con `PasswordAuthentication yes` (`50-cloud-init.conf`)
y `PermitRootLogin` con líneas contradictorias en `sshd_config`. Ver el valor **efectivo** con
`sudo sshd -T | grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication)'`.
**No desactivar la contraseña mientras la clave de `ssdn` no autentique**: hoy el login cae a contraseña.
Además: revisar `fail2ban` (`systemctl is-active fail2ban`) y, si procede, limitar 22 a IPs conocidas.

## Paso 8 — Monitoreo de señales de negocio en el VPS (T3.4)

```bash
scp infra/monitoring/business_signals.sh ssdn:~/        # desde el Mac
# en el VPS
sudo install -m 755 ~/business_signals.sh /usr/local/bin/
sudo install -m 600 /dev/null /etc/petition-monitor.env
sudo mkdir -p /var/lib/petition-monitor && sudo chown javofox: /var/lib/petition-monitor
sudoedit /etc/petition-monitor.env
```
Contenido de `/etc/petition-monitor.env` (SMTP **independiente** de Resend/Brevo, p. ej. el del hosting):
```bash
SMTP_URL="smtps://mail.TU-HOSTING.com:465"
SMTP_USER="monitor@tu-dominio.ec"
SMTP_PASS='********'
ALERT_FROM="monitor@tu-dominio.ec"
ALERT_TO="guardia1@correo.ec guardia2@correo.ec"
```
Probar y programar (cada 5 min):
```bash
sudo chown javofox: /etc/petition-monitor.env
REPEAT_MIN=0 bash -x /usr/local/bin/business_signals.sh 2>&1 | tail -20   # sin alertas si todo está bien
( crontab -l; echo '*/5 * * * * /usr/local/bin/business_signals.sh' ) | crontab -
```
Usa **comillas simples** en todos los valores (el archivo se carga con `source` y una contraseña con `$`, `<`, `[` o `!`
rompe las dobles o ninguna). `SMTP_URL` debe empezar por `smtps://` (puerto 465) o `smtp://` (587 con `--ssl-reqd`); sin esquema
`curl` habla HTTP y el servidor responde `501`. Para revisar el archivo sin mostrar valores: `sed 's/=.*/=…/' /etc/petition-monitor.env`.

Prueba de que el correo de alerta llega (criterio de salida): envía un mensaje de prueba por el mismo SMTP.
```bash
source /etc/petition-monitor.env
printf 'From: %s\nSubject: [Cauce] prueba de alertas\n\nOK\n' "$ALERT_FROM" | \
  curl -sS --ssl-reqd --url "$SMTP_URL" --user "$SMTP_USER:$SMTP_PASS" \
       --mail-from "$ALERT_FROM" --mail-rcpt "${ALERT_TO%% *}" -T -
```
Debe llegar a la primera dirección de `ALERT_TO`. Si no llega, revisar `SMTP_URL`/puerto y credenciales.

## Paso 9 — Chequeo externo desde GreenGeeks (T3.4)

```bash
scp infra/monitoring/healthcheck_remote.sh cqsmorg:~/petition-monitor/      # desde el Mac
ssh cqsmorg
mkdir -p ~/petition-monitor && chmod +x ~/petition-monitor/healthcheck_remote.sh
cat > ~/.petition-monitor.env <<'EOF'
ALERT_TO="guardia1@correo.ec guardia2@correo.ec"
ALERT_FROM="monitor@tu-dominio.ec"
CHECK_URLS="https://cauce.ecuadornotlc.org/api/health https://cauce.ecuadornotlc.org/"
EOF
chmod 600 ~/.petition-monitor.env
~/petition-monitor/healthcheck_remote.sh && echo "ejecuta sin error"
( crontab -l 2>/dev/null; echo '*/5 * * * * $HOME/petition-monitor/healthcheck_remote.sh' ) | crontab -
```
Si el plan no permite `crontab`, usar «Cron Jobs» de cPanel con el mismo comando. Prueba de caída: cambiar
temporalmente `CHECK_URLS` a una URL inexistente, esperar 2 ciclos (10 min) y comprobar el correo; luego revertir.
Nota: usa el `sendmail` del hosting, independiente de Resend/Brevo.

## Paso 10 — Netdata (opcional, T3.4)

Gráficas de CPU/RAM/red por contenedor. **Sin telemetría y sin exponer el puerto 19999.**
```bash
curl -fsSL https://get.netdata.cloud/kickstart.sh -o /tmp/netdata-kickstart.sh
less /tmp/netdata-kickstart.sh                  # leerlo antes de ejecutarlo
sudo bash /tmp/netdata-kickstart.sh --stable-channel --disable-telemetry --non-interactive
sudo sed -i 's/^\s*#\?\s*bind to = .*/    bind to = 127.0.0.1/' /etc/netdata/netdata.conf
sudo systemctl restart netdata
ss -tlnp | grep 19999                           # debe decir 127.0.0.1:19999
```
Acceso: `ssh -L 19999:127.0.0.1:19999 ssdn` y abrir `http://localhost:19999`. El VPS es compartido:
revisar antes con el administrador del servidor que instalar un servicio global es aceptable (regla del proyecto).

## Resumen de orden recomendado (hoy → domingo)

1. Paso 1 (diagnóstico) y Paso 0 antes de cualquier recreación.
2. Pasos 4 y 5 (respaldos y claves) — protegen contra la pérdida total; no cambian la aplicación.
3. Paso 2 (Resend Pro).
4. Paso 8 y 9 (alertas) — luego se ven los efectos de las pruebas de carga.
5. Paso 3 (despliegue del código), cuando el cambio esté revisado y la web de Next 15 verificada.
6. Pasos 6 y 7 (nginx y firewall) al final, con ventana y segunda sesión SSH.
