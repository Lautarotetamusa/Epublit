---
name: design-frontend
description: Primer paso del flujo de agentes de Epublit (ver specs/README.md) — arranca el diseño de una pantalla/flujo nuevo a partir de una historia de usuario, delegando en el subagente front-designer. Usar cuando el usuario pida diseñar/explorar una pantalla a partir de una historia, o invoque /design-frontend explícitamente.
argument-hint: "<historia de usuario>"
---

Arrancás (o continuás) el primer paso del flujo de agentes de este proyecto: diseño de frontend.

1. Si `$ARGUMENTS` está vacío, pedile la historia de usuario al usuario antes de seguir — no la inventes.

2. Encontrá si ya existe un `front-designer` para esta misma historia, en este orden (nunca arranques uno nuevo para una historia que ya tiene diseño en curso — perdés todo el contexto acumulado y obligás al usuario a re-explicar lo mismo):
   - Si el usuario te dio (o ya tenés de un turno anterior) una carpeta `specs/<NNN>-<slug>/` para esta historia, leé su `design.md`. Si tiene una línea `Agent: <id>` al final, ESE es el agente a resumir — no hace falta `ListAgents` para confirmarlo, andá directo a `SendMessage` con ese id.
   - Si no tenés esa referencia, recién ahí usá `ListAgents` para ver si hay un `front-designer` corriendo o reciente que coincida con la historia.
   - Sólo si ninguna de las dos vías encuentra nada, arrancás un agente nuevo con el tool `Agent`, `subagent_type: "front-designer"`.

3. Si arrancaste un agente nuevo: apenas el tool `Agent` te devuelva el `agentId`, antes de nada más, anotalo en `specs/<NNN>-<slug>/design.md` agregando (o reemplazando) al final del archivo una línea `Agent: <id>` — es lo que te permite (a vos o a una sesión futura) encontrar este mismo agente para la próxima ronda de feedback sin depender de que siga apareciendo en `ListAgents` (que no lo muestra una vez que pasa un rato inactivo, aunque siga siendo resumible). En el prompt (nuevo agente o mensaje al existente), incluí la historia completa tal cual te la dieron y recordale que tiene que cerrar su pasada escribiendo/actualizando `specs/<NNN>-<slug>/design.md` con la sección "Datos necesarios" (eligiendo el próximo número libre de `specs/` si es una historia nueva) — sin pisar la línea `Agent:` que vos ya agregaste.

4. Cuando el agente responda, mostrale al usuario su reporte completo (qué construyó, dónde verlo corriendo, y qué pide de la revisión) — no lo resumas de una forma que pierda el pedido explícito de aprobación. Si el usuario da feedback (ajustes, no aprobación), volvé al paso 2: se resume el MISMO agente, nunca uno nuevo. El siguiente paso del flujo (`/plan-backend`) sólo tiene sentido una vez que el usuario aprobó explícitamente ese diseño.
