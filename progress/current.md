# Estado actual — cierre sesión 2026-07-01 (sesión 10)

## Resumen de sesión

Sesión de contingencia y orientación. Se resolvió la divergencia de historias git entre Mac casa y Mac oficina, se sincronizó el repo local con el remoto, y se verificó el funcionamiento del MVP Fase 1 en browser.

---

## Estado de features

| Feature | Estado | Notas |
|---------|--------|-------|
| `harness-setup` | **done** | Completo |
| `infra-fork` | **in_progress** | Local completo; pendiente Cloudflare/VPS/Secrets |
| `ui-design-system` | **in_progress** | Shell admin incorporado; V1/V3/V4 pendientes |
| `modelo-base` | **done** | Migración 006 aplicada y verificada ✓ |
| `lopdp-base` | **done** | Implementación completa y verificada ✓ |
| `multidominio` | **done** | Implementado y funcionando ✓ |
| `anti-fraude-basico` | **done** | Implementado (RLS, dedup, rate-limit) ✓ |
| `landing-campana` | **done** | Next.js renderiza correctamente ✓ |
| `formulario-firma` | **done** | Submit/confirm/dedup OK ✓ |
| `dashboard-firmas` | **pending** | Siguiente feature a implementar |

---

## Lo completado esta sesión

### Contingencia git — sincronización Mac casa con Mac oficina

| Acción | Resultado |
|--------|-----------|
| Diagnóstico: remote URL con alias SSH erróneo (`githubqsmlab` vs `github-qsmlab`) | Identificado |
| `git remote set-url origin git@github-qsmlab:qsm-lab/petition-cauce.git` | Remote corregido |
| `git fetch origin` + análisis de historial divergido | Local: 1 commit extra; remoto: 10 commits adelante (Fase 1 completa) |
| `git reset --hard origin/dev` | Local sincronizado con remoto — Fase 1 completa presente |

### Setup DB en Mac casa (después del reset)

| Acción | Resultado |
|--------|-----------|
| `docker compose up -d --build petition-api-dev` | Reconstruido con `jinja2` (faltaba en imagen anterior) |
| `alembic upgrade head` | Migraciones 006→009 aplicadas |
| `python -m app.scripts.seed_dev` | Org, admin, contrato, campaña, privacy_config, lifecycle_events creados |

### Verificación en browser

- Landing `http://localhost:3002/?slug=campana-dev-001` — ✓ funcional
- Sign Flow (modal de firma) — ✓ funcional
- Admin `http://localhost:3002/admin/resumen` — ✓ funcional (login admin@cauce.ec / admin123dev)
- Aviso de privacidad — ✓ funcional

---

## Credenciales de desarrollo (activas)

| Campo | Valor |
|-------|-------|
| Email | `admin@cauce.ec` |
| Password | `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| URL landing campaña | `http://localhost:3002/?slug=campana-dev-001` |
| Campaña dev | `campana-dev-001` (status=active, lifecycle_stage=1) |
| Contrato dev | `CONTRATO-DEV-001` (firmado) |

---

## Archivos pendientes de commit

Solo los archivos de progreso de esta sesión:

```
progress/current.md
progress/history.md
```

---

## Próxima sesión

### Regla de inicio obligatoria (dos Macs)
```bash
git pull --rebase origin dev   # SIEMPRE antes de tocar archivos
```

### Tareas disponibles (en orden de prioridad sugerida)

1. **`dashboard-firmas`** — spec y/o implementación del panel admin de firmas
   - Lista de firmas con paginación, conteo total, filtros básicos (fecha, región, visibilidad)
   - Export CSV protegido por org_id (RLS)
   - Acceso JWT + RBAC

2. **`infra-fork`** — Cloudflare DNS + GitHub Secrets + deploy VPS
   - Requiere acceso a cuenta Cloudflare y VPS
   - Bloque final antes del primer deploy real

3. **Commits de Fase 1** — cuando el usuario lo indique
   - Los commits ya están en el remoto (hecho desde Mac oficina)
   - No hay nada pendiente de commit excepto este cierre de sesión
