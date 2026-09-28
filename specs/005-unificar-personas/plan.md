# Plan: Unificar autores e ilustradores

## Historia

Unificar autores e ilustradores en un solo listado con filtro por rol. El
alta de personas debe permitir cargar la imagen (hoy sólo se puede después
de que la persona ya existe).

## Diseño de API

### Filtro por rol en el listado

No cambia nada respecto a lo que ya existe: `GET /persona?tipo=autor` y
`GET /persona?tipo=ilustrador` ya filtran las personas que participan de al
menos un libro con ese rol (join contra la relación libro-persona, donde
vive el rol — no es un atributo propio de la persona). `GET /persona` sin
`tipo` sigue devolviendo todas. El nuevo filtro de la UI (control único con
"Todos"/"Autores"/"Ilustradores" en vez de dos rutas separadas) es sólo un
cambio de cuándo se dispara esa misma llamada, no de la API.

Esta iteración no agrega ni modifica endpoints por este punto — se deja
documentado acá porque `design.md` lo dejó explícitamente como decisión
pendiente del planner, y la decisión es "sigue igual".

### Foto en el alta de persona

`specs/004-persona-foto-bio/plan.md` ya define `POST /persona/:id/foto`
como segundo paso multipart, posterior a la creación de la persona (mismo
patrón que la portada de libro). Esta historia agrega una sola pregunta:
¿conviene que la foto se pueda mandar en el mismo `POST /persona/` que crea
la persona?

Decisión: no, se mantiene el patrón de dos pasos de 004 tal cual está
planificado, sin cambios. `POST /persona/` sigue siendo JSON puro
(nombre/dni/email/bio); la foto se asocia después con `POST
/persona/:id/foto` usando el `id` recién creado — igual que ya hace
`POST /libro/:isbn/portada` con la portada de libro. Mezclar creación
multipart con creación JSON obligaría a soportar dos content-types distintos
en el mismo endpoint para un beneficio marginal (ahorrarse una request que
además ya es transparente para quien use la UI), y rompería la simetría con
el precedente de libro. No hay tarea nueva por este punto: la capacidad ya
está cubierta por las tareas 4-9 de `specs/004-persona-foto-bio/plan.md`.

## Ambigüedad

Ninguna.

## Tareas

Esta historia no requiere endpoints nuevos ni cambios de schema propios:
el filtro por rol ya existe tal cual se necesita, y la foto en el alta se
resuelve con el patrón de dos pasos que ya planificó
`specs/004-persona-foto-bio/plan.md` (sin implementar todavía). Ese plan es
prerrequisito de esta historia: `back-implementer` tiene que completarlo
(en particular las tareas de foto, 4 a 9) antes de que el alta de persona
pueda ofrecer la carga de imagen que pide esta historia.

La única tarea propia de 005 es confirmar, con pruebas explícitas, que el
comportamiento de filtro por rol que el nuevo listado unificado va a
consumir se sostiene tal cual lo necesita el front.

### 1. Confirmar el filtro por rol del listado de personas
`GET /persona` sin `tipo` devuelve todas las personas del usuario;
`GET /persona?tipo=autor` y `GET /persona?tipo=ilustrador` devuelven sólo
las que participan de al menos un libro con ese rol.

Criterios de aceptación:
- [ ] `GET /persona` sin `tipo` devuelve tanto personas que sólo son autoras, sólo ilustradoras, ambas cosas, y personas sin ningún libro asociado.
- [ ] `GET /persona?tipo=autor` devuelve únicamente personas que participan como autoras de al menos un libro (incluye a quienes además son ilustradoras de otro libro).
- [ ] `GET /persona?tipo=ilustrador` devuelve únicamente personas que participan como ilustradoras de al menos un libro.
- [ ] Una persona sin ningún libro asociado no aparece en ninguno de los dos filtros por rol.
- [ ] Un valor de `tipo` distinto a `autor`/`ilustrador` devuelve 400.
