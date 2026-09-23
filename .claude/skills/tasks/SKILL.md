---
name: tasks
description: Tercer paso del flujo SDD del proyecto. Usar cuando el usuario pide /tasks para un feature ya planificado, o dice "armemos las tareas de X".
---

# /tasks

Parte el plan técnico de un feature en tareas chicas y verificables (ver
`specs/README.md`).

## Pasos

1. Resolvé el slug a partir de `args`.
2. Verificá que `specs/<slug>/plan.md` exista. Si no existe, avisale al
   usuario que hay que correr `/plan` primero.
3. Lanzá el agente `sdd-task-breakdown` (`Agent`, `subagent_type:
   "sdd-task-breakdown"`) pasándole el slug y el path del plan.
4. Cuando termine, decile al usuario dónde quedó `tasks.md` y cuántas
   tareas salieron, y pedile que lo revise antes de correr `/implement`.

## Notas

- No partas las tareas vos mismo en el hilo principal: siempre a través del
  agente.
