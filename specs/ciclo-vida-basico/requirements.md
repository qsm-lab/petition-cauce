# Requirements — ciclo-vida-basico

## Contexto
Indicador visual de las 5 etapas del ciclo de vida de una campaña, visible en la landing pública. Solo lectura. La gestión de etapas desde admin es `ciclo-vida-admin` (Fase 2).

## Requisitos

**R1** — La landing pública muestra un indicador de 5 etapas: Lanzada → Recolección → Entrega → Diálogo → Decisión.

**R2** — La etapa actual se resalta visualmente (relleno con color primario + halo); las etapas completadas muestran "✓"; las futuras aparecen atenuadas.

**R3** — El campo `lifecycle_stage` (0–4) de la campaña determina la etapa actual. Valor 0 = Lanzada, 4 = Decisión.

**R4** — Una barra de progreso conecta las etapas y se rellena proporcionalmente a la etapa actual.

**R5** — El componente es de solo lectura en la vista pública; sin interacción del usuario.

**R6** — El indicador aparece tanto en layout mobile (columna única) como desktop (columna principal izquierda).
