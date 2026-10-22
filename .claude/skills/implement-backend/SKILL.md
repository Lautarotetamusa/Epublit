---
name: implement-backend
description: Tercer paso del flujo de agentes de Epublit (ver specs/README.md) — implementa en /back el plan ya aprobado de specs/<NNN>-<slug>/plan.md, delegando en el subagente back-implementer. Usar cuando el usuario apruebe un plan y pida implementarlo, o invoque /implement-backend explícitamente.
argument-hint: "<NNN-slug de specs/, opcional>"
---

Arrancás el tercer paso del flujo: la implementación real del backend.

1. Buscá la carpeta de `specs/` que corresponde:
   - Si `$ARGUMENTS` ya es un `NNN-slug` existente en `specs/`, usá esa.
   - Si no, buscá en `specs/` la carpeta más reciente que tenga `plan.md`.
   - Si no hay ninguna (te piden implementar algo puntual sin plan
     previo), confirmá con el usuario que efectivamente no hace falta
     pasar por `/plan-backend` antes de seguir.
2. El `planner` nunca marca su propio plan como aprobado — confirmá con el
   usuario que el plan de esa carpeta ya está aprobado antes de arrancar
   la implementación real, salvo que ya te lo haya dicho explícitamente en
   este mismo turno.
3. Invocá el tool `Agent` con `subagent_type: "back-implementer"`,
   pasándole en el prompt la ruta exacta `specs/<NNN>-<slug>/`.
4. Cuando el agente responda, mostrale al usuario qué implementó, qué
   endpoints agregó/cambió, y qué criterios de aceptación del plan quedaron
   cubiertos por test. Si algo del plan no se pudo cumplir tal cual,
   asegurate de que esa parte del reporte no se pierda.
