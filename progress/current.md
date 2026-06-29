# Estado actual — cierre sesión 2026-06-28 (sesión 4)

## Resumen de sesión

Completados los últimos bloques de `infra-fork`:
- Verificación F1–F7 del entorno local: todos los checks pasan
- C4: adaptados `api.ts`, `api-server.ts`, `ExportButtons.tsx` (puertos y container names)
- C5: renombradas referencias forms-qsm en todos los scripts Python seed y migración 004_rls

El entorno local está completamente operativo y aislado de forms-qsm.

---

## Estado de features

| Feature | Estado | Notas |
|---------|--------|-------|
| `harness-setup` | **done** | Completo |
| `infra-fork` | **in_progress** | Local completo. Pendiente: D3 (VPS nginx real_ip) + F8 (primer push → Actions) |
| `ui-design-system` | pending | **Siguiente en Fase 0** |
| `modelo-base` | pending | Después de ui-design-system |
| `lopdp-base` | pending | Después de modelo-base |
| Fase 1 (6 features) | pending | Después de Fase 0 completa |

---

## Lo que falta de `infra-fork` para cerrarla completamente

| Tarea | Quién | Cuándo |
|-------|-------|--------|
| **D3** Verificar `real_ip_header CF-Connecting-IP` en `nginx.conf` del VPS | Usuario (VPS SSH) | Cuando se haga el primer deploy |
| **F8** Primer push a `main` → GitHub Actions completa sin timeout | Usuario | Cuando esté listo para deploy |
| **Cloudflare §5** DNS A, SSL, WAF, Turnstile widget real | Usuario (panel CF) | Antes del deploy a producción |
| **GitHub Secrets** Configurar `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DEPLOY_PATH` | Usuario (repo GitHub) | Antes de F8 |

Estas tareas son de VPS/producción, no bloquean el desarrollo local ni la siguiente feature.

---

## Archivos modificados esta sesión (pendientes de commit)

```
apps/web/src/lib/api.ts                    — fallback 8010 → 8011
apps/web/src/lib/api-server.ts             — container forms-api-dev → petition-api-dev
apps/web/src/app/admin/campaigns/[id]/ExportButtons.tsx  — fallback 8010 → 8011
apps/api/app/scripts/seed_admin.py         — container, org slug (qsm→cauce), nombres
apps/api/app/scripts/seed_dev.py           — org slug, nombre, email (qsm→cauce)
apps/api/app/scripts/reset_qsm_questions.py — container name
apps/api/app/scripts/seed_qsm_form.py      — container names + puerto 3001→3002
apps/api/migrations/versions/004_rls.py    — comentario forms_app→petition_app
specs/infra-fork/tasks.md                  — C4 y C5 marcados completados
```

---

## Estado del entorno local al cierre

- `make dev` levanta 4 contenedores: `petition-api-dev`, `petition-web-dev`, `petition-db-dev`, `petition-redis-dev`
- API health: `{"status":"ok","db":"ok","redis":"ok","version":"1.0.0"}`
- Web responde 307 (redirect normal Next.js)
- `petition_app` sin superusuario, RLS activo
- Base de datos `petition_cause` creada y accessible
- Sin colisión de puertos con `proy_forms-qsm` (3001/8010)

---

## Pasos antes del commit (tú los ejecutas)

**1. Verificar que el entorno sigue levantado:**
```bash
make status
```

**2. Probar el backend** — los cambios C4/C5 no tocan rutas, pero confirmar que la API sigue respondiendo:
```bash
curl http://localhost:8011/health
# Esperado: {"status":"ok","db":"ok","redis":"ok","version":"1.0.0"}
```

**3. Probar el frontend en el navegador:**
- Abrir `http://localhost:3002`
- Verificar que la app carga sin errores de consola relacionados a URLs de API
- Navegar a `/admin` o `/login` para confirmar que los fetch usan el puerto 8011

**4. Solo si todo pasa → hacer el commit:**
```bash
cd ~/Devs/proy_petition-cauce
git add apps/web/src/lib/api.ts \
        apps/web/src/lib/api-server.ts \
        "apps/web/src/app/admin/campaigns/[id]/ExportButtons.tsx" \
        apps/api/app/scripts/seed_admin.py \
        apps/api/app/scripts/seed_dev.py \
        apps/api/app/scripts/reset_qsm_questions.py \
        apps/api/app/scripts/seed_qsm_form.py \
        apps/api/migrations/versions/004_rls.py \
        specs/infra-fork/tasks.md \
        progress/

git commit -m "infra-fork: adapt web config, seed scripts and migrations from forms-qsm"
```

---

## Próxima sesión: iniciar `ui-design-system`

Feature `pending`, requiere:
1. Aprobar spec SDD (Claude genera `specs/ui-design-system/`)
2. Diseño en Claude Design (Adobe Express) — paleta, tipografía, componentes base
3. Exportar HTML → `specs/ui-design-system/design-export.html`
4. Implementar en Next.js + Tailwind

Ver instrucciones de inicio: CLAUDE.md §"Flujo de frontend — Claude Design + Next.js"
