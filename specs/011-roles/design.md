# Design: Roles por cuenta

Estado: aprobado por el usuario

## Historia

«Como usuario necesito poder cargar, listar, editar y eliminar roles. Una
persona trabaja en un libro con un rol.» Reglas: un rol en uso no se puede
borrar; renombrarlo lo cambia en todas las personas; toda cuenta arranca con
`autor` e `ilustrador`.

## Qué se construyó

Sección **Roles** completa (mismo patrón de ABM que Medios de pago: listado →
botón "Nuevo rol" → vista aparte → ficha como ruta propia) y el cableado del
rol dinámico en las pantallas que hoy usaban el enum fijo.

### Rutas y navegación

| Ruta | Pantalla |
| --- | --- |
| `/roles` | Listado de roles activos de la cuenta + botón "Nuevo rol". |
| `/roles/nuevo` | Alta: sólo el nombre. Al guardar navega a la ficha. |
| `/roles/:id` | Ficha: nombre editable + tarjeta "Dar de baja" con el bloqueo por uso. |
| `/libros/:isbn`, `/libros/nuevo` | "Personas en el libro": la tabla ahora dice el rol de la cuenta, y los diálogos eligen el rol desde el listado de la cuenta. |
| `/personas` | El filtro del listado pasó de un `SegmentedControl` fijo (Todos / Autores / Ilustradores) a un `Select` con los roles de la cuenta. |
| `/personas/:id` | Sección nueva "Libros en los que participa": cada libro con su rol. |
| `/liquidaciones` | El rol de cada línea de detalle (columna "Rol" del total por persona y columna "Rol" del detalle por persona) pasa a ser el rol de la cuenta: entran **todos** los roles, no sólo `autor` / `ilustrador`. |

Se agregó **Roles** al sidebar en CATÁLOGO, después de Personas, con el ícono
`tag` (una etiqueta que se le pone a una persona en un libro), y las tres rutas
en `front/src/App.tsx` (`front/src/layout/AppLayout.tsx`).

### Archivos principales

- `front/src/features/roles/RolesPage.tsx`, `NuevoRolPage.tsx`,
  `FichaRolPage.tsx`, `RolFormFields.tsx` — las tres pantallas y los campos
  compartidos entre alta y ficha.
- `front/src/features/roles/useRoles.ts` (listado, lo consumen también los
  selectores de libro y persona), `useNuevoRol.ts`, `useFichaRol.ts`,
  `useUsosDeRol.ts` (cuántas personas usan el rol).
- `front/src/features/roles/presentacionRol.ts` — casing del nombre, tono del
  badge y opciones de `Select`, para que las tres pantallas que muestran roles
  lo hagan igual (DRY).
- `front/src/features/personas/LibrosDePersonaSection.tsx` — los libros de la
  persona con su rol (nuevo en la ficha de persona).
- `front/src/features/liquidaciones/LiquidacionesPage.tsx`,
  `DetallePersonaDialog.tsx` y `rolesDePersona.ts` — la liquidación muestra el
  rol de la cuenta en cada línea de detalle (los dos `TIPO_LABEL` fijos y las
  dos copias de `rolesDePersona` se unificaron en un helper compartido, que
  deduplica por id de rol). `api/liquidacion.ts` traduce el `tipo` que todavía
  manda el backend y suma las participaciones del stand-in con el mismo
  criterio de importe que usa el backend (importe del libro × porcentaje).
- `front/src/features/libros/PersonasLibroSection.tsx` — la tabla y los dos
  diálogos pasaron de `TipoPersona` fijo a `Rol` de la cuenta; el rol también
  es lo que identifica la fila al editar el porcentaje o al quitarla.
- `front/src/api/rol.ts` (`Rol` + contrato del plan), `api/persona.ts`,
  `api/libro.ts`, `api/libroPersona.ts` — el rol por id en las lecturas y
  escrituras.
- `front/src/api/rolesStandIn.ts` — stand-in en memoria del backend que no
  existe todavía (ver "Datos necesarios", punto 8).
- Se borró `front/src/features/personas/tipoPersona.ts` (opciones fijas del
  filtro, ya no aplican).

### Decisiones de formato

- **La baja vive en la ficha, no en el listado**: hace falta lugar para
  explicar por qué está bloqueada (mismo criterio que colecciones y medios de
  pago). El listado es una sola columna —nombre— a propósito: mostrar "en uso"
  por rol exigiría una lectura por cada rol.
- **El bloqueo se ve antes de intentar**: `useUsosDeRol` cuenta las personas
  con ese rol y, si hay alguna, la ficha muestra un `Alert` de advertencia
  ("Está en uso: N personas lo usan en sus libros") y el botón "Dar de baja"
  queda deshabilitado. El 409 del backend sigue siendo la garantía; el front
  sólo adelanta el motivo.
- **El rol en uso se cuenta por personas, no por libros**: el dato que ofrece
  la lectura (`GET /persona?rol=<id>`) es el de personas que participan de al
  menos un libro con ese rol, que es la condición que evalúa la baja. La copia
  dice "N personas lo usan en sus libros", no "N libros".
- **Casing**: el nombre del rol es un dato de la cuenta y se muestra tal como
  se cargó, con la inicial en mayúscula (`nombreVisible`) para caer en el
  casing de sentencia del sistema. El campo de edición muestra el valor tal
  cual está guardado (los roles por defecto del backend son `autor` /
  `ilustrador` en minúscula). Ver "Preguntas para el planner / a revisar".
- **Tono del badge por rol**: los dos primeros roles de la cuenta (los que el
  plan crea por defecto) conservan los tonos que ya tenían autor e ilustrador
  —pino y violeta— y del tercero en adelante el badge pasa a neutro. Es
  presentación estable, no semántica inventada.
- **"Personas en el libro" en vez de "Autores e ilustradores"**: con N roles
  ese título ya no describe la tabla. El subtítulo dice la regla del modelo
  ("Una persona puede tener más de un rol en el mismo libro"), que además es
  la razón por la que el diálogo ya no esconde a alguien que está en el libro
  con otro rol.
- **La liquidación muestra roles, no el enum**: la query del backend ya traía
  todas las filas de la relación libro↔persona sin filtrar por `tipo` — el
  `tipo` era sólo la etiqueta que se dibujaba. Ahora esa etiqueta sale del rol
  de la cuenta, en la columna "Rol" del total por persona (un badge por rol
  distinto de esa persona en el período) y en la del detalle por persona (un
  badge por línea), con los mismos helpers de presentación que el resto
  (`nombreVisible`, `tonoDeRol`). El estado vacío dejó de nombrar el enum
  ("Ningún libro con ventas tiene personas con un rol cargado").
- **Estado defensivo sin roles**: si la cuenta se queda sin roles activos
  (puede pasar: se dan de baja los dos por defecto mientras nadie los usa), la
  sección del libro muestra un `Alert` explicando que sin roles no se puede
  asignar a nadie y ofrece "Nuevo rol"; los botones de alta quedan
  deshabilitados. Los `Select` de rol tampoco quedan vacíos, por el mismo
  motivo.
- **Sin comportamiento responsive nuevo**: la app no es responsive hoy (sidebar
  fijo de 248 px, ver specs/007-colecciones). Esta pantalla sigue ese criterio.

### Cómo probarlo

Con el dev server del front (`/roles`): el listado ya muestra `autor` e
`ilustrador`, creados por defecto en la cuenta.

- **Renombrar**: `/roles/1` → "Nombre" → "Guardar cambios". El nombre nuevo se
  ve en `/libros/9781000000011` (columna Rol) y en
  `/personas/1` (sección "Libros en los que participa") sin tocar nada más.
- **En uso** (no se puede borrar): `/roles/1` muestra "Está en uso — 6 personas
  lo usan en sus libros" y "Dar de baja" deshabilitado.
- **Sin uso** (se puede borrar): creá "Corrector" en `/roles/nuevo`, entrá a su
  ficha y "Dar de baja" → confirmar: avisa por toast y vuelve al listado sin el
  rol. Volver a crear un rol con ese nombre funciona (201), y repetir un nombre
  activo avisa "Ya tenés un rol «…»".
- **Rol nuevo en uso** (el camino completo): creá "Traductor", en
  `/libros/9781000000011` → "Persona existente" → Rol "Traductor" → Agregar; la
  fila aparece con su badge. En `/roles/<id>` de Traductor la baja ya queda
  bloqueada, en `/personas` el filtro por "Traductor" devuelve esa persona, y
  en su ficha el libro aparece con ese rol.
- **Persona sin libros**: `/personas/nuevo` → guardar → la ficha muestra
  "Todavía no participa de ningún libro".
- **Liquidación con todos los roles**: `/liquidaciones` → "Generar
  liquidación" (el rango por defecto, el mes en curso, ya trae las ventas del
  seed). La tabla "Total a pagar por persona" muestra un badge por rol de cada
  persona, y el detalle (`file-text`) una línea por libro y rol. Con el rol
  "Traductor" asignado en un libro vendido (ver el punto anterior), esa persona
  aparece con los dos badges —"Autor" y "Traductor"— y su detalle muestra las
  dos líneas del mismo libro con sus importes. Renombrar `ilustrador` a
  "Dibujante" y volver a generar la liquidación muestra el nombre nuevo.

Verificado renderizando con Chromium (1440×900): listado de roles, ficha en uso,
ficha sin uso, alta con nombre repetido, confirmación y baja, tabla de personas
del libro con dos roles distintos para la misma persona, diálogo de rol, alta de
un libro con una persona y un rol de la cuenta, filtro del listado, ficha de
persona con y sin libros, renombrar un rol y ver el nombre nuevo en el libro y
en la ficha de la persona, y la liquidación con dos roles de la misma persona en
el mismo libro (badges y detalle) más el renombre reflejado en la liquidación.
El único `console` que aparece son los 404 de `/rol` que disparan el stand-in
(esperados mientras el backend no exista).

## Datos necesarios

El contrato de API de esta historia ya está en `specs/011-roles/plan.md`; lo de
abajo es lo que cada pantalla **lee o escribe**, para que el planner confirme
que el plan lo cubre. No hay propuesta de rutas ni de forma del request: eso
está decidido en el plan.

### 1. Listar los roles activos de la cuenta (lectura)

Alimenta el listado de `/roles`, la ficha de un rol y todos los selectores de
rol (persona en un libro). Por cada rol: identificador y nombre. Sólo activos
(los dados de baja no se ofrecen). Cubierto por la tarea 4 del plan.

### 2. Crear, renombrar y dar de baja un rol (escrituras)

Cubierto por las tareas 5, 6 y 7. Lo que la pantalla necesita poder distinguir
y mostrarle al usuario:

- alta o renombre con nombre vacío o sólo espacios → rechazo (la pantalla lo
  evita, pero igual muestra el mensaje que devuelva la API);
- nombre ya usado por otro rol activo → rechazo, con el nombre en el mensaje;
- baja de un rol en uso → rechazo, **sin** darlo de baja;
- rol inexistente, de otra cuenta o ya dado de baja → rechazo, tanto al editar
  como al dar de baja.

Los tres mensajes salen hoy de la API tal cual (`getErrorMessage`) y la pantalla
no los reescribe, así que el texto del rechazo es parte de lo que se ve.

### 3. Saber si un rol tiene personas asignadas, y cuántas (lectura)

Es lo que permite mostrar el motivo del bloqueo **antes** de intentar la baja y
deshabilitar la acción (una lectura por ficha, no una por rol del listado). El
plan ya tiene con qué resolverlo: el filtro de personas por rol (tarea 10)
devuelve el total de personas que usan ese rol. Si al planner le parece mejor
exponer el dato agregado junto al rol, la pantalla lo consume igual — lo que
importa es que se pueda responder sin traer todas las personas.

### 4. Asignar, cambiar y quitar el rol de una persona en un libro (escrituras)

Cubierto por las tareas 8 y 9: el dato que identifica el rol pasa a ser el rol
de la cuenta, y la fila se identifica por la terna libro + persona + rol.

Dos consecuencias que la pantalla ya asume y conviene no perder de vista:

- **La misma persona puede tener dos roles en el mismo libro**: el diálogo
  filtra las personas disponibles por rol (no por persona), así que ofrece a
  alguien que ya está en el libro con otro rol. Hoy el backend rechaza eso
  ("Alguna persona ya trabaja en ese libro") porque la unicidad es por persona;
  con el plan pasa a ser por persona + rol.
- **Alta sin rol**: es un rechazo que la pantalla no puede disparar (el select
  siempre tiene un rol elegido), pero el mensaje de la API se muestra igual si
  llegara a pasar.

### 5. El detalle del libro con sus personas y su rol (lectura)

`GET /libro/:isbn` (tarea 11). Por cada persona del libro la pantalla necesita:
identificación de la persona, nombre, email, DNI, el rol de la cuenta
(`{id, nombre}`) y el porcentaje.

Un punto que la pantalla ya resolvió y el usuario confirmó: hoy el backend
parte las personas en dos arreglos fijos (`autores` / `ilustradores`, cada uno
con su `tipo`) y eso no puede seguir existiendo con N roles. **Confirmado: el
detalle del libro pasa a una única lista de personas, cada una con su rol**
(evita el split y los joins que no hacen falta). Renombrar un rol tiene que
cambiar el nombre que muestra esta lectura sin tocar la relación.

### 6. La ficha de la persona con sus libros y su rol (lectura)

`GET /persona/:id` (tarea 12). La sección "Libros en los que participa" es
**nueva en la UI** (hasta ahora la ficha no mostraba los libros, aunque la
lectura ya los devolvía): necesita, por libro, la identificación con la que se
abre la ficha del libro (ISBN), el título y el rol de la cuenta
(`{id, nombre}`). No necesita precio, fecha de edición ni stock. Renombrar un
rol cambia el nombre que muestra esta ficha sin reasignar la relación.

### 7. Filtrar el listado de personas por rol (lectura)

`GET /persona?rol=<id>` (tarea 10). Sin filtro el listado sigue mostrando todas
las personas, incluidas las que no participan de ningún libro. El front dejó de
usar el filtro por los valores fijos anteriores.

### 8. La liquidación con el rol de cada línea de detalle (lectura)

`GET /liquidacion` devuelve, por persona liquidada, un detalle con una línea por
libro y participación. Hoy cada línea trae el enum fijo (`autor` /
`ilustrador`) y la pantalla muestra esa etiqueta; con roles por cuenta la línea
tiene que devolver el **rol de la cuenta** (`{ id, nombre }`) —el rol con el que
esa persona participa de ese libro— y la liquidación tiene que incluir **todos**
los roles, no sólo los dos fijos.

- La lectura de base ya está: la query que arma el detalle trae todas las filas
  de la relación libro↔persona sin filtrar por rol, así que no hace falta
  agregar libros ni personas: lo que cambia es qué identifica al rol en cada
  línea (`{id, nombre}` en lugar del enum) y que el nombre salga del rol de la
  cuenta. Renombrar un rol tiene que cambiar el nombre que muestra la
  liquidación sin tocar las líneas.
- Los campos que la pantalla ya usa no cambian: por persona, identificación,
  nombre, total a pagar y su detalle; por línea de detalle, libro (identificación
  y título), rol, porcentaje e importe.
- El mismo rol puede aparecer en dos líneas de la misma persona (dos libros, o
  el mismo libro con dos roles): la deduplicación de los badges de la columna
  "Rol" la hace la pantalla por id de rol.

El backend todavía no tiene el módulo de roles, así que las pantallas se revisan
contra un stand-in en memoria: `front/src/api/rolesStandIn.ts`. Simula el
catálogo de roles con sus reglas (incluidos los dos roles por defecto y el
rechazo de baja de un rol en uso) y la relación libro↔persona con el rol por
id, para los roles que el enum fijo no puede representar. **No es una propuesta
de API ni un mock de datos de muestra**: es la parte del backend que todavía no
existe, puesta del lado del front para poder revisar las pantallas.

Consecuencias concretas de este stand-in, que desaparecen cuando el backend
exista:

- los roles creados por el usuario y sus asignaciones **se pierden al recargar
  la página** (navegar dentro de la app no los pierde);
- los dos roles por defecto que se ven hoy en el listado los crea el stand-in,
  no el backend (las tareas 1 y 2 del plan son las que los van a crear);
- mientras el backend siga guardando el rol como enum fijo, un rol que se llame
  como uno de los dos fijos viaja como ese valor (funciona de punta a punta) y
  cualquier otro se guarda en el stand-in. Las traducciones viven en
  `api/rol.ts` (fallback al stand-in cuando `/rol` responde 404),
  `api/libro.ts` (enum fijo → rol de la cuenta),
  `api/persona.ts` (idem, y el filtro por rol) y
  `api/libroPersona.ts` (rol → enum fijo cuando corresponde);
- cuando el módulo del backend esté, se borra `rolesStandIn.ts` y esas
  traducciones, y las pantallas quedan como están.

### 9. Datos de muestra de esta pasada (stand-in temporal, no es contrato)

El backend todavía no tiene el módulo de roles, así que las pantallas se revisan
contra un stand-in en memoria: `front/src/api/rolesStandIn.ts`. Simula el
catálogo de roles con sus reglas (incluidos los dos roles por defecto y el
rechazo de baja de un rol en uso) y la relación libro↔persona con el rol por
id, para los roles que el enum fijo no puede representar. **No es una propuesta
de API ni un mock de datos de muestra**: es la parte del backend que todavía no
existe, puesta del lado del front para poder revisar las pantallas.

Consecuencias concretas de este stand-in, que desaparecen cuando el backend
exista:

- los roles creados por el usuario y sus asignaciones **se pierden al recargar
  la página** (navegar dentro de la app no los pierde);
- los dos roles por defecto que se ven hoy en el listado los crea el stand-in,
  no el backend (las tareas 1 y 2 del plan son las que los van a crear);
- mientras el backend siga guardando el rol como enum fijo, un rol que se llame
  como uno de los dos fijos viaja como ese valor (funciona de punta a punta) y
  cualquier otro se guarda en el stand-in. Las traducciones viven en
  `api/rol.ts` (fallback al stand-in cuando `/rol` responde 404),
  `api/libro.ts` (enum fijo → rol de la cuenta),
  `api/persona.ts` (idem, y el filtro por rol),
  `api/libroPersona.ts` (rol → enum fijo cuando corresponde) y
  `api/liquidacion.ts` (idem, por línea de detalle);
- **en la liquidación**, una participación con un rol creado por el usuario no
  tiene fila real en `libros_personas`, así que el backend no la ve: el stand-in
  le arma su línea con el importe que sale de la misma regla que usa el backend
  (importe del libro en el período × el porcentaje de esa participación), y
  agrega a la persona si no venía en la respuesta. No es un importe inventado ni
  una tabla de prueba: es la misma cuenta sobre los datos reales de la venta;
- cuando el módulo del backend esté, se borra `rolesStandIn.ts` y esas
  traducciones, y las pantallas quedan como están.

### 10. Preguntas para el planner / a revisar

- **Respuestas de escritura**: el front asume el sobre estándar del backend
  (`{ success, data }`) en el alta y el renombre de un rol, igual que medios de
  pago. Conviene confirmarlo en el plan para que no haya que tocar el front.
- **Liquidación**: la lectura de la liquidación tiene que devolver el rol de la
  cuenta por línea de detalle, incluyendo todos los roles (punto 8). El resto de
  la liquidación (ventas, agrupación por libro, importes) no cambia. **El
  `plan.md` todavía no tiene una tarea para esto** (se ajustó el alcance después
  de aprobarlo): conviene que la agregue, porque al implementarse el front pasa
  a leer el rol tal cual y se van las traducciones de `api/liquidacion.ts`.
- **Casing de los nombres por defecto**: se muestran capitalizados ("Autor") en
  badges y títulos, y el campo de edición muestra el valor guardado tal cual
  (`autor`). Si se prefiere que los datos nazcan capitalizados, es una decisión
  del backend/planner, no de esta pantalla — pero conviene decidirlo antes de
  que el rol se use en un montón de lugares.

Agent: ses_ebef101e1ffe77THxmJ1dLVXyV
