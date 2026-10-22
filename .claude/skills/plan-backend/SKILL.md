---
name: plan-backend
description: Segundo paso del flujo de agentes de Epublit (ver specs/README.md) — arranca la planificación del backend a partir de una historia y del specs/<NNN>-<slug>/design.md ya aprobado, delegando en el subagente planner. Usar cuando haya que planificar el backend de una historia (con o sin diseño de frontend previo), o el usuario invoque /plan-backend explícitamente.
argument-hint: "<historia de usuario o NNN-slug de specs/>"
---

Arrancás el segundo paso del flujo: el plan de backend.

1. Buscá la carpeta de `specs/` que corresponde:
   - Si `$ARGUMENTS` ya es un `NNN-slug` existente en `specs/`, usá esa.
   - Si no, leé `specs/` y buscá la carpeta más reciente cuyo `design.md`
     coincida con la historia/tema que te dieron.
   - Si no hay ninguna (te piden planificar sin haber pasado por
     `front-designer`), seguí igual: el planner puede trabajar sólo con la
     historia.
2. Si encontraste un `design.md`, leelo vos antes de invocar al agente y
   fijate su `Estado:`. Si sigue "en revisión" (no aprobado), avisale al
   usuario antes de seguir — no asumas en silencio que ya está aprobado.
   Si el usuario confirma que quiere planificar igual, seguí.
3. Invocá el tool `Agent` con `subagent_type: "planner"`. En el prompt
   pasale la historia completa y, si existe, la ruta exacta
   `specs/<NNN>-<slug>/` para que lea su `design.md`.
4. Cuando el agente responda, mostrale al usuario el plan completo. Queda
   pendiente de su aprobación explícita antes de pasar a
   `/implement-backend`.
