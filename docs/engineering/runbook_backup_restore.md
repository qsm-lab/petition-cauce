# Respaldo y restauración de `petition-db`

## Objetivos aceptados (hardening-campana)
- **RPO ≤ 1 hora** (respaldo horario durante la campaña) y **RTO ≤ 2 horas**.

## Qué hay
- `pg_backup.sh` (VPS, cron cada hora): `pg_dump` cifrado con `age` (clave pública en el VPS; la privada vive fuera,
  en el gestor de contraseñas y copia offline), suma `sha256`, retención local 7 días, marca `LAST_OK`.
- Copia fuera del VPS: bucket **R2 de Cloudflare, jurisdicción UE**, privado, clase Estándar. `hourly/` (3 días) y
  `daily/` (30 días, copia de las 03:45), con reglas de ciclo de vida. Token de R2 *Object Read & Write* solo sobre ese bucket.
- `restore_test.sh <archivo.age> <identidad>`: restaura en una base temporal y compara conteos con el original.
- `backup_keys.sh`: copia cifrada de las 4 claves críticas (sin imprimir valores).

## Prueba de restauración — 2026-11-07 (producción)
| Concepto | Resultado |
|---|---|
| Archivo | dump cifrado de 1,23 MB, `rclone` 1.76 |
| `signatures` restauradas / originales | 2 373 / 2 373 |
| `campaigns` | 1 / 1 |
| `consents` restauradas | 2 373 |
| Versión de Alembic restaurada | 042 |
| **RTO medido** | **20 s** (objetivo: 2 h) |
La identidad privada se copió al VPS solo para la prueba y se borró con `shred -u`.

## Repetir la prueba
Trimestral y antes de cada campaña grande: `restore_test.sh` con el último respaldo y la identidad privada
(copiarla, probar, `shred -u`). Comprobar que el último `LAST_OK` tiene menos de 2 h y que `hourly/` tiene archivos nuevos.

## Restaurar de verdad (resumen)
1. Parar la API y la web (`docker compose stop petition-api petition-web`).
2. Descifrar: `age -d -i <identidad> -o dump.sql <archivo.age>` y verificar la suma `sha256`.
3. Restaurar en `petition_cause` con `pg_restore` (ver `restore_test.sh` para las opciones exactas) y comprobar conteos.
4. `alembic current` debe coincidir con el código desplegado; levantar API y web y revisar `/health`.
5. Pérdida máxima de datos: la última hora (RPO).

## Notas
- El `501` de R2 con `rclone` 1.60 (versión de `apt`) desapareció al actualizar a la 1.76; el cron usa `PATH=/usr/local/bin:...`.
- Custodia de claves: la identidad privada de `age` y las claves de `.env` se guardan en lugares distintos (T2.3).
