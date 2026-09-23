# Plan: <título>

## Spec de referencia
specs/<slug>/spec.md

## Enfoque técnico
<estrategia general y decisiones de arquitectura; por qué esta y no otra>

## Capas afectadas
- schema (Drizzle, `src/schemas/`): ...
- validator (`src/validators/`): ...
- filter (`src/filters/`): ...
- service (`src/services/`): ...
- controller (`src/controllers/`): ...
- routes (`src/routes/`): ...
- tests (`test/`): ...

## Modelo de datos
<tablas/columnas nuevas o modificadas, PKs (recordar el patrón de PK compuesta
`(id, user)` para tablas "de un usuario"), FKs, índices>

## Compatibilidad con módulos no migrados
<qué otros módulos leen/escriben las mismas tablas y todavía no migraron;
cómo queda la integridad de datos mientras conviven MySQL y Postgres>

## Decisiones y trade-offs
<referenciar CLAUDE.md y la memoria del proyecto para decisiones ya tomadas>

## Riesgos
- ...

## Fuera de alcance / deuda aceptada
- ...
