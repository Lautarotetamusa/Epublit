# SDD (Spec-Driven Development) en Epublit

Flujo para cualquier feature o módulo nuevo (migración a Drizzle incluida): primero se escribe **qué** y **por qué** (spec), después **cómo** (plan), después se parte en pasos chicos (tasks), y recién ahí se escribe código. Cada fase la escribe un agente distinto, con el contexto mínimo que necesita — así el spec no se contamina con detalles de implementación, y el plan no se contamina con la redacción de historias de usuario.

Las reglas de estilo que todo el código debe cumplir están en `/CLAUDE.md` (la "constitución" del proyecto). Todos los agentes de este flujo las leen antes de escribir nada.

## Flujo

```
/specify <descripción del feature/módulo>   -> specs/<NNN-slug>/spec.md
/plan <slug>                                -> specs/<NNN-slug>/plan.md
/tasks <slug>                               -> specs/<NNN-slug>/tasks.md
/implement <slug> [task-id]                 -> código + tasks.md actualizado
/sdd-review <slug>                          -> revisión contra spec/plan/CLAUDE.md
```

Cada comando espera que el anterior ya exista y esté aprobado por vos — no se auto-encadenan. Si algo del spec o el plan queda mal, se corrige ese archivo y se vuelve a correr la fase siguiente.

## Carpetas

Cada feature/módulo vive en `specs/<NNN-slug>/`, con `NNN` incremental (001, 002, ...) y `slug` corto en kebab-case (ej. `003-migrar-cliente`). Adentro: `spec.md`, `plan.md`, `tasks.md`, y opcionalmente `review.md` (salida de `/sdd-review`).

`specs/_template/` tiene el esqueleto de cada archivo — los agentes parten de ahí.

## Estado actual de la migración a Drizzle/Postgres

El contexto de la migración en curso (decisiones ya tomadas, qué se hizo en la Fase 0 y en el piloto de `Persona`, bloqueadores de entorno pendientes) está en la memoria del proyecto, no acá — los agentes de plan/tasks deben tenerlo en cuenta cuando el feature sea "migrar el módulo X".
