---
name: implement
description: Cuarto paso del flujo SDD del proyecto. Usar cuando el usuario pide /implement para un feature con tasks.md aprobado, o dice "implementemos X" / "arranquemos con el código de X".
---

# /implement

Ejecuta las tareas de un feature ya planificado y partido en tasks (ver
`specs/README.md`).

## Pasos

1. Resolvé el slug a partir de `args`. Si además viene un id de tarea
   (ej. `003-migrar-cliente T4`), es para correr solo esa tarea (y las que
   dependen de ella si hace falta) en vez del archivo completo.
2. Verificá que `specs/<slug>/tasks.md` exista. Si no existe, avisale al
   usuario que hay que correr `/tasks` primero.
3. Lanzá el agente `sdd-implementer` (`Agent`, `subagent_type:
   "sdd-implementer"`) pasándole el slug, el path de spec/plan/tasks, y si
   corresponde, qué tarea(s) puntuales correr.
4. Cuando termine, resumile al usuario: tareas hechas, tareas pendientes o
   bloqueadas y por qué, y el resultado del checkpoint (`tsc`, tests). No
   hagas commit vos — eso lo pide el usuario aparte si lo quiere.

## Notas

- El agente implementador para y reporta si una tarea revela que el plan
  estaba mal, en vez de improvisar — si eso pasa, no reintentes con otro
  approach por tu cuenta: mostrale el problema al usuario y esperá cómo
  quiere seguir (¿se ajusta el plan? ¿se ajusta la tarea?).
- Después de `/implement`, sugerí correr `/sdd-review` antes de dar el
  feature por terminado.
