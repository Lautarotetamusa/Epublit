---
name: plan
description: Segundo paso del flujo SDD del proyecto. Usar cuando el usuario pide /plan para un feature ya especificado, o dice "planifiquemos X" / "armemos el plan técnico de X".
---

# /plan

Genera el plan técnico para un feature cuyo spec ya está aprobado (ver
`specs/README.md`).

## Pasos

1. Resolvé el slug a partir de `args` (o preguntale al usuario cuál, si hay
   varias carpetas en `specs/` sin plan todavía y no queda claro cuál).
2. Verificá que `specs/<slug>/spec.md` exista. Si no existe, avisale al
   usuario que hay que correr `/specify` primero — no inventes un spec.
3. Lanzá el agente `sdd-planner` (`Agent`, `subagent_type: "sdd-planner"`)
   pasándole el slug y el path del spec. El agente lee CLAUDE.md y el
   código existente por su cuenta.
4. Cuando termine, decile al usuario dónde quedó el plan y pedile que lo
   revise antes de correr `/tasks`.

## Notas

- No planifiques vos mismo en el hilo principal: siempre a través del
  agente.
- Si el spec tiene preguntas abiertas sin resolver, decíselo al usuario
  antes de lanzar el agente — el plan que salga de un spec incompleto va a
  tener que rehacerse.
