---
name: sdd-review
description: Paso final (opcional) del flujo SDD del proyecto. Usar cuando el usuario pide /sdd-review para un feature ya implementado, o dice "revisemos X contra el spec".
---

# /sdd-review

Revisa una implementación terminada contra su spec, su plan y CLAUDE.md (ver
`specs/README.md`). Distinto del skill `code-review` genérico: este compara
contra los documentos del feature, no solo el diff en el vacío.

## Pasos

1. Resolvé el slug a partir de `args`.
2. Verificá que `specs/<slug>/spec.md` y `specs/<slug>/plan.md` existan.
3. Lanzá el agente `sdd-reviewer` (`Agent`, `subagent_type:
   "sdd-reviewer"`) pasándole el slug.
4. Cuando termine, mostrale al usuario los hallazgos (separando bloqueantes
   de sugerencias) y dónde quedó `specs/<slug>/review.md`.

## Notas

- No arregles los hallazgos vos mismo en este paso — el reviewer solo
  reporta. Si el usuario quiere que se corrijan, es un `/implement` nuevo
  (o una tarea nueva en `tasks.md`) sobre esos hallazgos puntuales.
