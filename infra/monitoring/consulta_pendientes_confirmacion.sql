-- Solo lectura. Solo agregados: ningún correo, nombre, cédula ni IP. Excluye firmas de prueba y anuladas.
-- Uso: ssh ssdn 'docker exec -i petition-db psql -U petition_admin -d petition_cause' < infra/monitoring/consulta_pendientes_confirmacion.sql
BEGIN READ ONLY;

\echo '== 1) Firmas reales por estado'
select status, count(*) as firmas
from signatures where not is_test and anulada_at is null
group by 1 order by 2 desc;

\echo '== 2) Por semana de alta: total, confirmadas, pendientes y % confirmadas (busca la caida)'
select date_trunc('week', created_at)::date as semana,
       count(*) as total,
       count(*) filter (where status = 'confirmed') as confirmadas,
       count(*) filter (where status = 'pending_confirmation') as pendientes,
       round(100.0 * count(*) filter (where status = 'confirmed') / count(*)) as pct_confirmadas
from signatures where not is_test and anulada_at is null
group by 1 order by 1;

\echo '== 3) Pendientes de confirmar por campana y antiguedad'
select c.slug, c.status as estado_campana,
       count(*) filter (where s.created_at > now() - interval '24 hours') as menos_de_24h,
       count(*) filter (where s.created_at <= now() - interval '24 hours'
                          and s.created_at > now() - interval '7 days') as de_1_a_7_dias,
       count(*) filter (where s.created_at <= now() - interval '7 days') as mas_de_7_dias,
       count(*) as total
from signatures s join campaigns c on c.id = s.campaign_id
where s.status = 'pending_confirmation' and not s.is_test and s.anulada_at is null
group by 1, 2 order by total desc;

\echo '== 4) Pendientes: enlace vigente o vencido (24 h de validez)'
select count(*) filter (where confirmation_token_expires_at > now()) as enlace_vigente,
       count(*) filter (where confirmation_token_expires_at <= now()
                           or confirmation_token_expires_at is null) as enlace_vencido
from signatures
where status = 'pending_confirmation' and not is_test and anulada_at is null;

ROLLBACK;
