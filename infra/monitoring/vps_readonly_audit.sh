#!/usr/bin/env bash
# hardening-campana T1.1 — diagnóstico de SOLO LECTURA del VPS.
# No modifica nada y no imprime valores de secretos (solo si existen y su forma).
# Uso (desde el Mac):  ssh ssdn 'bash -s' < infra/monitoring/vps_readonly_audit.sh
set -u

section() { printf '\n== %s\n' "$1"; }

section "host"
hostname; echo "vCPU: $(nproc)"; free -h | sed -n 1,3p; df -h / | tail -1; uptime

section "contenedores"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

section "uso por contenedor"
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>&1 | head -30

section "límites y restart de petition-*"
for c in $(docker ps --format '{{.Names}}' | grep -i '^petition'); do
  printf '%s: ' "$c"
  docker inspect -f 'mem={{.HostConfig.Memory}} cpus={{.HostConfig.NanoCpus}} restart={{.HostConfig.RestartPolicy.Name}} user={{.Config.User}} ro_fs={{.HostConfig.ReadonlyRootfs}}' "$c"
done

section "variables críticas de petition-api (solo forma)"
docker exec petition-api sh -c '
  v="$TURNSTILE_SECRET_KEY"
  if [ -z "$v" ]; then echo "TURNSTILE_SECRET_KEY=VACIA  <-- CRITICO"
  else case "$v" in 1x0000000000000000000000000000000*) echo "TURNSTILE_SECRET_KEY=CLAVE_DE_PRUEBA  <-- CRITICO";;
       *) echo "TURNSTILE_SECRET_KEY=definida (len=${#v})";; esac; fi
  echo "ENVIRONMENT=${ENVIRONMENT:-<sin definir>}"
  echo "EMAIL_PROVIDER=${EMAIL_PROVIDER:-<sin definir>}  EMAIL_POOL=${EMAIL_POOL:-<vacio>}  RESEND_PLATFORM_PLAN=${RESEND_PLATFORM_PLAN:-<sin definir>}"
  for k in PROVIDER_SECRET_KEY HMAC_SECRET_KEY PII_ENCRYPTION_KEY JWT_SECRET_KEY; do
    eval "x=\${$k:-}"; [ -n "$x" ] && echo "$k=definida" || echo "$k=VACIA"
  done
  [ "${PROVIDER_SECRET_KEY:-}" = "${PII_ENCRYPTION_KEY:-x}" ] && echo "PROVIDER_SECRET_KEY IGUAL a PII_ENCRYPTION_KEY  <-- separar"
' 2>&1

section "PostgreSQL: roles, dueño de tablas y RLS (petition-db)"
docker exec petition-db psql -U petition_admin -d petition_cause -At -c "
  select 'rol '||rolname||' super='||rolsuper||' bypassrls='||rolbypassrls from pg_roles where rolname like 'petition%';
  select 'dueño '||tableowner||' tablas='||count(*) from pg_tables where schemaname='public' group by tableowner;
  select 'rls '||relname||' enabled='||relrowsecurity||' forced='||relforcerowsecurity from pg_class
    where relname in ('signatures','consents','campaigns','arco_requests','pii_export_audit','comms_upload','org_email_config') order by relname;
  show max_connections;
  select 'conexiones_activas='||count(*) from pg_stat_activity;
" 2>&1

section "backups y cron"
crontab -l 2>&1 | grep -v '^#' | head
ls /etc/cron.d 2>/dev/null
find / -xdev \( -name '*.dump' -o -name '*.sql.gz' -o -name '*pg_dump*' -o -name '*backup*.sh' \) \
  -not -path '*/proc/*' -not -path '*/node_modules/*' -not -path '*/overlay2/*' 2>/dev/null | head

section "nginx: real_ip y origen"
grep -rn 'real_ip' /etc/nginx 2>/dev/null | head -8
ss -tlnp 2>/dev/null | awk 'NR==1 || /:(80|443|3001|3002|8010|8011|5432|6379) /'

section "firewall"
(ufw status 2>&1 || sudo -n ufw status 2>&1) | head -15
sudo -n iptables -S 2>/dev/null | head -15

section "versiones"
docker --version; lsb_release -ds 2>/dev/null; uname -r
echo "paquetes pendientes de actualización:"; apt list --upgradable 2>/dev/null | grep -c upgradable
