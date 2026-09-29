---
description: "Flujo Epublit · paso 3: implementar en /back el plan aprobado (back-implementer)"
---

Iniciás el paso 3 del flujo de agentes de Epublit (ver `specs/README.md`): implementación de backend.

1. Resolvé la carpeta de `specs/`: si abajo vino un `NNN-slug` existente, usá esa; si no, buscá la más reciente que tenga `plan.md`. Si no hay ninguna (te piden implementar algo puntual sin plan previo), confirmá con el usuario que efectivamente no hace falta pasar por `/plan-backend`.
2. Confirmá con el usuario que ese plan ya está aprobado antes de arrancar (el `planner` nunca marca su propio plan como aprobado).
3. Delegá en el subagente `back-implementer` (herramienta `subagent`), pasándole la ruta exacta `specs/<NNN>-<slug>/`.
4. Mostrale al usuario qué implementó, qué endpoints agregó/cambió, y qué criterios de aceptación del plan quedaron cubiertos por test. Si algo del plan no se pudo cumplir tal cual, no dejes que esa parte del reporte se pierda.

Entrada (NNN-slug de specs/, opcional):
$ARGUMENTS
