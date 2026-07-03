# Requirements — resumen-admin

## Contexto
La página `/admin/resumen` muestra datos stub (ceros). Se conecta al endpoint `GET /v1/dashboard/summary` para mostrar KPIs reales. El endpoint actual cuenta desde la tabla `responses` (herencia forms-qsm); se corrige para usar `signatures`.

---

## Requisitos

**R1** — La página `/admin/resumen` muestra 4 KPIs reales obtenidos de la API:
- **Total firmas confirmadas** — `signatures` donde `status='confirmed'` y `org_id=user.org_id`
- **Campañas activas** — campañas donde `status='active'` y `org_id=user.org_id`
- **Campañas en borrador** — campañas donde `status='draft'` y `org_id=user.org_id`
- **Meta total** — suma de `goal_count` de campañas activas (muestra "—" si todas tienen null)

**R2** — La sección "Campañas recientes" muestra las últimas 5 campañas con: título, estado (badge), firmas confirmadas, meta, enlace a la página de edición.

**R3** — El endpoint `GET /v1/dashboard/summary` retorna:
```json
{
  "total_confirmed_signatures": 0,
  "active_campaigns": 0,
  "draft_campaigns": 0,
  "total_goal": null,
  "recent_campaigns": [
    {
      "id": "...",
      "title": "...",
      "slug": "...",
      "status": "draft",
      "confirmed_signatures": 0,
      "goal_count": null,
      "ends_at": null
    }
  ]
}
```

**R4** — El endpoint filtra todo por `Campaign.org_id == user.org_id` (sin join a forms).

**R5** — La página hace fetch del endpoint en el servidor (Next.js Server Component) usando la cookie de sesión, sin exponer el JWT al cliente.

**R6** — Si el fetch falla (API caída, 401), la página muestra los KPIs como "—" con un aviso de error no bloqueante; no crashea.

**R7** — La sección "Actividad reciente" se elimina o se reemplaza por un acceso rápido a las páginas más usadas (Firmas de campaña activa, Nueva campaña).
