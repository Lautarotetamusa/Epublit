# specs/

Carpeta de trabajo del flujo de agentes de Epublit. Cada historia de
usuario que pasa por el flujo completo tiene su propia carpeta acá,
numerada:

```
specs/<NNN>-<slug>/
  design.md   # escrito por front-designer
  plan.md     # escrito por planner
```

`<NNN>` es un número correlativo de 3 dígitos (`001`, `002`, ...) según la
próxima carpeta libre en `specs/`. `<slug>` es un nombre corto en
kebab-case que resume la historia (ej. `alta-consignacion-express`).

## Flujo

```
Historia de usuario
        │
        ▼
  front-designer ──▶ specs/<NNN>-<slug>/design.md
        │              (pantalla real en /front + "Datos necesarios")
        ▼
    planner ────────▶ specs/<NNN>-<slug>/plan.md
        │              (plan de tareas backend, a partir del historia +
        │               los "Datos necesarios" del design.md)
        ▼
  back-implementer     (implementa el plan en /back)
```

1. **front-designer** recibe la historia, diseña la pantalla/flujo real
   dentro de `/front` (con datos de muestra si hace falta) y cierra su
   trabajo escribiendo `design.md`. La sección **"Datos necesarios"** de
   ese archivo es el contrato: es lo único que el resto del flujo necesita
   saber sobre el front para seguir. Describe la CAPACIDAD que hace falta
   ("poder filtrar por X", "poder subir una imagen"), nunca la solución
   técnica — nada de rutas, query params, client-side vs. server-side, ni
   mecanismos de storage: eso es diseño de API y es trabajo exclusivo del
   `planner`, que además tiene el contexto real del schema que
   `front-designer` no tiene. Requiere aprobación humana antes de
   considerarse cerrado (ver `.claude/agents/front-designer.md`).

2. **planner** lee la historia + `design.md` (no tiene acceso al código
   fuente, sólo a `back/docs/`, `back/db/migrations/` y `specs/`, ver el
   hook `planner-file-guard.sh`) y arma el plan de tareas backend
   (contrato de API + criterios de aceptación). Lo persiste en `plan.md` y
   también lo devuelve como respuesta — igual que antes, el plan queda
   pendiente de aprobación del usuario.

3. **back-implementer** toma `plan.md` ya aprobado e implementa el backend
   real en `/back`, siguiendo `/CLAUDE.md`.

Cada carpeta de `specs/` es el historial de esa historia: sirve para
retomar el trabajo, para que un agente nuevo entienda qué se decidió sin
tener que releer toda la conversación, y como referencia futura (mismo
criterio que ya usan los comentarios `ver specs/...` en `back/src/`).

## Cómo disparar cada paso

Cada paso tiene un skill propio (`.claude/skills/`) que arma el pedido al
subagente correspondiente y encuentra sola la carpeta de `specs/` que
corresponde:

- `/design-frontend <historia>` → `front-designer`
- `/plan-backend [historia o NNN-slug]` → `planner`
- `/implement-backend [NNN-slug]` → `back-implementer`

No hace falta invocar los subagentes (`front-designer`, `planner`,
`back-implementer`) directamente por nombre salvo un caso puntual fuera
del flujo normal — los skills ya resuelven qué carpeta de `specs/` usar y
qué pasarle a cada uno.
