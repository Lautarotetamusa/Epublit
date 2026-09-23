# Reglas de estilo

Estas reglas son la "constitución" del flujo SDD del proyecto — ver
`specs/README.md` para el proceso de `/specify` → `/plan` → `/tasks` →
`/implement` → `/sdd-review` que las aplica en cada feature nuevo.

- **Inyección de dependencias > herencia.** Preferir funciones/objetos que reciban sus dependencias como parámetros antes que jerarquías de clases con lógica compartida por herencia.
- **DRY.** No duplicar lógica. Si algo se repite, se extrae a una función/helper compartido.
- **Comentarios y documentación solo explican el *por qué*, nunca el *qué*.** Lo que hace una función tiene que quedar claro con su nombre (y el de sus parámetros/variables). Si hace falta un comentario para entender qué hace el código, el problema es el nombre o la estructura, no la falta de comentario.
- **Una función, una responsabilidad.** Si una función hace más de una cosa, se separa en funciones más chicas, cada una con un nombre que refleje su responsabilidad. No crear wrappers/indirección que no agreguen lógica (ver ejemplo: no envolver `builder.update()` en una función `update` que solo lo reenvía).
