---
description: "Flujo Epublit · paso 2: plan de backend a partir de una historia/design.md (planner)"
---

Iniciás el paso 2 del flujo de agentes de Epublit (ver `specs/README.md`): plan de backend.

1. Resolvé la carpeta de `specs/` que corresponde: si abajo vino un `NNN-slug` existente, usá esa; si no, buscá la carpeta más reciente cuyo `design.md` coincida con la historia/tema. Si no hay ninguna (te piden planificar sin pasar por `front-designer`), seguí igual con la historia sola.
2. Si encontrás un `design.md` con `Estado: en revisión` (todavía no aprobado), avisale al usuario antes de seguir; no asumas en silencio que está aprobado.
3. Delegá en el subagente `planner` (herramienta `subagent`), pasándole la historia completa y, si existe, la ruta exacta `specs/<NNN>-<slug>/`.
4. Mostrale al usuario el plan completo. Queda pendiente de su aprobación explícita antes de pasar a `/implement-backend`.

Entrada (historia o NNN-slug):
$ARGUMENTS
