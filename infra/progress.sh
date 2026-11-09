#!/usr/bin/env bash
# % de avance de hardening-campana desde tasks.md. [x]=1, [~]=0,5 (revisada, con ajustes), [ ]=0.
# Uso: bash infra/progress.sh
f="$(dirname "$0")/../specs/hardening-campana/tasks.md"
awk '
/^- \[.\] \*\*T[0-9]/ {
  fase = ($0 ~ /\*\*T[1-5]\./) ? 1 : 2
  e = substr($0, 4, 1); t[fase]++
  if (e == "x") d[fase]++; else if (e == "~") a[fase]++; else p[fase]++
}
END {
  for (i = 1; i <= 2; i++) {
    n = t[i]; pct = n ? (d[i] + 0.5 * a[i]) / n * 100 : 0
    printf "Fase %d: %.0f %%  (%d completadas, %d con ajustes, %d pendientes de %d)\n", i, pct, d[i], a[i], p[i], n
    tot += d[i] + 0.5 * a[i]; all += n
  }
  printf "Total:  %.0f %%  (%d tareas)\n", tot / all * 100, all
}' "$f"
