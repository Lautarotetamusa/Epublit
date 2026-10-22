# Design: Colecciones (crear, editar, borrar y asignar libros)

Estado: aprobado por el usuario

> Nota de numeración: al empezar esta historia el próximo número libre era
> `006`, pero mientras se trabajaba quedó creada la carpeta
> `specs/006-bulk-ficha-cliente/` (otra historia, ya aprobada). Se usó `007`
> para no repetir número. Si se prefiere el `006` original, alcanza con
> renombrar la carpeta: el contenido es el que importa.

## Historia

Como usuario quiero poder crear, actualizar y eliminar una colección. Cada
colección tiene una imagen de portada, un título, una descripción y muchos
libros. Cada libro pertenece a una colección o a ninguna, y su colección se
puede cambiar en cualquier momento. Una colección que todavía tiene libros no
se puede eliminar.

## Qué se construyó

Colecciones no existía en ninguna capa: ni en el backend (verificado, no hay
ninguna mención a "colección" en `back/src`, `back/db`, `back/seeders`) ni en el
front. Por eso esta pasada es una pantalla nueva completa, con datos de muestra
en memoria (ver "Datos necesarios"), y el backend queda como paso siguiente.

### Pantallas y rutas

| Ruta | Pantalla |
| --- | --- |
| `/colecciones` | Listado de colecciones en tarjetas (portada, título, descripción, cantidad de libros) + botón "Nueva colección". |
| `/colecciones/nuevo` | Alta: portada (opcional), título y descripción. Al guardar navega a la ficha de la colección recién creada. |
| `/colecciones/:id` | Ficha: portada + título + descripción editables; tabla "Libros de la colección" con agregar/quitar; tarjeta "Eliminar colección". |
| `/libros/:isbn` | Se sumó el campo **Colección** al formulario existente (ver más abajo). |
| `/libros/nuevo` | Idem, para poder asignar la colección al crear el libro. |

Se agregó **Colecciones** al sidebar, en la sección CATÁLOGO, entre Libros y
Personas, con el ícono `book-open` (`library` ya estaba tomado por Libros).

### Archivos principales

- `front/src/api/coleccion.ts` — tipos `Coleccion` / `CreateColeccionInput` /
  `UpdateColeccionInput`. A propósito **no** llama a la API: es sólo la forma
  que necesita la pantalla, mientras no exista el contrato real.
- `front/src/features/colecciones/coleccionesMock.ts` — mock en memoria:
  colecciones, y la pertenencia libro → colección por ISBN.
- `front/src/features/colecciones/useColecciones.ts` — listado (lo usa también
  el selector de la ficha de libro).
- `front/src/features/colecciones/useNuevaColeccion.ts`,
  `useFichaColeccion.ts`, `useLibrosDeColeccion.ts` — alta, ficha y
  pertenencia de los libros.
- `front/src/features/colecciones/ColeccionesPage.tsx` + `ColeccionCard.tsx` —
  listado en tarjetas.
- `front/src/features/colecciones/NuevaColeccionPage.tsx`,
  `FichaColeccionPage.tsx`, `ColeccionFormFields.tsx` — alta y ficha, con los
  campos compartidos.
- `front/src/features/colecciones/LibrosDeColeccionSection.tsx` — tabla de
  libros de la colección + diálogo "Agregar libros" (buscador, no listado
  completo: ver "Iteración 3").
- `front/src/features/colecciones/useBusquedaLibros.ts` — búsqueda del diálogo:
  debounce + paginación contra la API.
- `front/src/features/colecciones/buscarLibros.ts` — búsqueda acotada en el
  catálogo (y asignación de libros a una colección). Stand-in del mock para la
  capacidad #9.
- `front/src/features/colecciones/librosDeColeccion.ts` — libros de una
  colección, acotado a esa colección. Stand-in del mock para la capacidad #7.
- `front/src/features/libros/LibroFormFields.tsx` — campo Colección, en la
  primera fila del formulario junto a Título (compartido por alta y ficha de
  libro).
- `front/src/design-system/components/feedback/Dialog.jsx` — arreglo del
  diálogo del sistema (alto máximo + cuerpo con scroll propio): ver
  "Iteración 2".
- `front/src/features/libros/useFichaLibro.ts` y `useNuevoLibro.ts` — guardan la
  colección elegida en el mock, sin tocar el payload real de libro.
- `front/src/App.tsx`, `front/src/layout/AppLayout.tsx` — rutas y navegación.

### Decisiones de formato

- **Listado en tarjetas, no en tabla**: el resto de los listados (libros,
  personas, clientes, ventas) usa `Table`, pero una colección es un objeto
  visual: su portada es lo que la identifica y una descripción no entra en una
  celda. La tarjeta pone la portada a la izquierda y el texto a la derecha. Por
  lo mismo el título de la página va **fuera** de un `Card`: una tarjeta dentro
  de otra tarjeta está descartada por el sistema.
- **Portada vertical, sin componente nuevo**: se reusa `CoverUpload` tal cual
  (120×168), porque el sistema de diseño sólo prevé material fotográfico
  vertical — las tapas de libro (ver `design-system/readme.md`, sección
  Imágenes). No se inventó un formato de imagen nuevo para las colecciones.
  Sin portada, la tarjeta muestra el mismo marcador del sistema: fondo
  `pino-800` con ícono.
- **Alta en dos pasos para la portada**: se puede elegir la imagen en el alta,
  pero se sube después de crear la colección (necesita existir), igual que la
  portada de libro y la foto de persona. En la ficha se cambia con "Guardar
  cambios", igual que la portada de libro.
- **La colección del libro se guarda con el botón del formulario**, no de forma
  automática al cambiar el select: el formulario de la ficha de libro ya tiene
  "Guardar cambios" y mezclar guardados inmediatos con diferidos confunde.
- **Eliminar vive en la ficha, no en el listado**: hace falta espacio para
  explicar por qué está bloqueado. Con libros, la tarjeta muestra un `Alert` de
  advertencia ("Todavía tiene libros") y el botón queda deshabilitado; sin
  libros, se pide confirmación y se vuelve al listado.
- **Agregar/quitar libros desde la ficha de la colección; mover, desde el
  libro**: el diálogo "Agregar libros" sólo ofrece libros que no están en
  ninguna colección (no le saca libros a otra colección a tus espaldas). Mover
  un libro de una colección a otra se hace desde la ficha del libro, que es lo
  que pide la historia ("puedo cambiar la colección del libro en cualquier
  momento").
- **Estados**: listado vacío con `EmptyState` que ofrece crear la primera
  colección; tabla de libros vacía con el texto que explica cómo llenarla;
  colección bloqueada para borrar con el motivo a la vista. Hover de tarjeta
  con fondo `papel-100` + borde `pino-500`; foco de teclado con el anillo
  violeta del sistema.
- **Sin comportamiento responsive nuevo**: la app no es responsive hoy (el
  sidebar fijo de 248 px no colapsa, ninguna pantalla lo hace). Esta pantalla
  sigue ese criterio; la grilla de tarjetas se acomoda sola dentro del ancho de
  contenido (`auto-fill`), pero en un viewport de teléfono la pantalla se ve
  recortada igual que el resto del sistema. Es una limitación del shell, no de
  esta historia.

### Iteración 2 (feedback del usuario)

**1. El diálogo "Agregar libros" se recortaba.** El bug estaba en el propio
`Dialog` del sistema de diseño, no en esta pantalla: el panel no tenía tope de
alto, así que con contenido largo crecía más que el viewport y —como va
centrado— el sobrante se repartía arriba y abajo. Se recortaban a la vez el
encabezado (título + botón de cerrar) y el pie, y no había forma de llegar a
ellos porque el fondo tampoco scrolleaba. Medido en un viewport de 700 px, el
título quedaba por encima del borde superior de la pantalla.

Arreglo en el primitivo, así que vale para todos los diálogos del sistema:

- `maxHeight: calc(100vh - var(--space-12))` en el panel, con `display:flex`
  en columna;
- el cuerpo scrollea por dentro (`overflowY:auto`, `minHeight:0`), mientras
  encabezado y pie quedan fijos (`flex: 0 0 auto`);
- el fondo scrollea como red de seguridad para viewports muy bajos.

Además, el contenido se rehizo con un patrón que el sistema ya tenía —**`Table`
con selección múltiple**, el mismo que usa el catálogo para armar una venta— en
vez de un "+" gris por fila:

| Antes | Después |
| --- | --- |
| `+` ghost sin etiqueta, de a un libro por vez | Checkbox por fila + fila clickeable, con el hover de fila del sistema |
| El pie existía pero quedaba fuera del viewport | Pie siempre visible: "Cancelar" + "Agregar N libros" (deshabilitado con 0) |
| Encabezado y buscador recortados en viewports bajos | Título, descripción, buscador y cerrar siempre visibles |
| Lista larga sin forma de acotarla | Buscador por título o ISBN (`Input iconStart="search"`) + cuerpo con scroll interno |

**2. El selector de colección del libro era poco visible.** Existía y guardaba
bien, pero estaba entre "Brief" y "Book trailer", al final del formulario,
donde no se encontraba. Ahora:

- está en la **primera fila del formulario, al lado de Título** (`2fr 1fr`),
  tanto en `/libros/nuevo` como en `/libros/:isbn`;
- la ayuda dice la regla: "Una colección o ninguna. Podés cambiarla cuando
  quieras.";
- en la ficha, el subtítulo de la tarjeta muestra la colección actual
  ("ISBN 9781000000011 · Serie Aljibe", o "· Sin colección"), así se ve sin
  bajar hasta el campo.

Se respetan las reglas desde acá: el select ofrece "Sin colección" y la lista de
colecciones, siempre una sola a la vez (elegir otra reemplaza, nunca acumula).

Verificado midiendo el DOM renderizado, no a ojo:

- Diálogo en 1440×700: panel en `top:24 / bottom:676`, con encabezado y pie
  dentro del viewport y `bodyScrolls: true` (el scroll quedó adentro del
  cuerpo).
- Diálogo en 1440×420 (viewport muy bajo): panel en `top:24 / bottom:396`,
  encabezado y pie igual visibles.
- Buscador con "cine": queda una sola fila ("Breve historia del cine").
- Hover de fila: `rgb(249,248,244)` = `--papel-50`.
- Selección múltiple: tildar 2 filas marca 2 checkboxes y el pie pasa a
  "Agregar 2 libros"; al confirmar, los 2 libros aparecen en la tabla de la
  colección y el borrado queda bloqueado con "sus 2 libros".
- Persistencia del selector: en `/libros/9781000000011` elegí "Serie Aljibe" y
  guardé; el subtítulo pasó a "ISBN 9781000000011 · Serie Aljibe" y el select
  quedó con el valor guardado.

### Iteración 3 (feedback del usuario): la búsqueda del popup

El diálogo traía el catálogo entero (`page=1&pageSize=200`) y filtraba en
memoria. Eso no escala ni es realista: el catálogo de una editorial crece y
nadie va a mandar todos los libros al navegador para elegir unos pocos. Se
rehizo como **búsqueda contra la API**:

- **Sin término no se pide nada.** Estado inicial claro ("Buscá un libro") en
  vez de una lista. Verificado por red: abrir el popup no dispara ningún
  request.
- **Con término, se consulta la API** por título o ISBN, `pageSize: 8`, con
  **debounce de 350 ms** y descartando respuestas viejas si el usuario siguió
  escribiendo.
- **Resultados paginados** con el `Pagination` del sistema ("N registros ·
  Página X de Y"), y la lista de resultados acotada en alto para que el pie del
  diálogo no se vaya de pantalla.
- **Sin término / sin resultados / todos ya asignados** son tres estados
  distintos, con su propio texto.
- El filtro por título del backend es parcial (`ILIKE %…%`); el de ISBN es de
  igualdad, así que el buscador pide el **ISBN completo** y lo dice.

También se dejó de asumir el catálogo entero en la otra mitad de la pantalla:
la tabla "Libros de la colección" ya no filtra un catálogo completo en memoria,
**pide los libros de esa colección** (`librosDeColeccion.ts`), acotado a su
tamaño. Las dos cosas son stand-ins del mock sobre capacidades que todavía no
existen, y quedaron anotadas como tales en "Datos necesarios" (#7 y #9).

Antes / después, medido por red:

| Acción | Antes | Después |
| --- | --- | --- |
| Entrar a la ficha de una colección | `GET /libro?page=1&pageSize=200` | ningún request al catálogo (0 libros en la colección) |
| Abrir "Agregar libros" | (ya estaba todo en memoria) | ningún request |
| Escribir "cine" | — | `GET /libro?titulo=cine&page=1&pageSize=8` → 1 fila |
| Escribir "e" y pasar de página | — | `…?titulo=e&page=1&pageSize=8` → 8 filas, "11 registros · Página 1 de 2"; página 2 → `…?page=2&pageSize=8` → 3 filas |
| Escribir un ISBN completo | — | `GET /libro?isbn=9781000000011&page=1&pageSize=8` → 1 fila |

Verificado además renderizando: estado inicial, resultados, sin resultados,
"los resultados ya están en una colección" (buscando un libro recién agregado),
selección múltiple con el pie en "Agregar 2 libros", y viewport bajo (480 px)
con encabezado y pie a la vista.

### Cómo probarlo

Con el dev server de siempre (`/libros`, `/colecciones`): el listado ya trae 3
colecciones de muestra. El botón de eliminar de una colección sin libros
funciona; para ver la regla de negocio, agregá libros desde la ficha de la
colección —"Agregar libros" abre el buscador: escribí parte de un título (o un
ISBN completo), tildá varios y confirmá juntos— y el botón de eliminar queda
deshabilitado con la advertencia.

La colección del libro se cambia desde `/libros/:isbn` (campo al lado de
Título) o desde `/libros/nuevo`, y se refleja en la ficha de la colección y en
el subtítulo de la ficha del libro.

## Datos necesarios

Ninguno de estos datos existe hoy: no hay nada de colecciones en el backend.
Acá va sólo la **capacidad** que necesita la pantalla; cómo se expone (rutas,
forma del request/response, si pagina o filtra, dónde se guarda la imagen) lo
decide el planner.

### 1. Listar colecciones (lectura)

Para el listado y para el selector de la ficha de libro. Por cada colección:

| Dato | Notas |
| --- | --- |
| Identificador | para poder abrir la ficha y para referenciarla desde un libro |
| Título | obligatorio |
| Descripción | opcional; puede no existir |
| Portada | opcional; puede no existir |
| Cantidad de libros | para mostrarla en la tarjeta sin traer los libros |

### 2. Ver una colección (lectura)

Los mismos datos, por identificador.

### 3. Crear una colección (escritura)

Título (obligatorio) y descripción (opcional). La portada no: se asocia después
de que la colección existe (ver #6).

### 4. Actualizar una colección (escritura)

Título y descripción.

### 5. Eliminar una colección (escritura) — con regla de negocio

Poder eliminar una colección **sólo si no tiene libros**. La validación no
puede quedar del lado del front: tiene que rechazarse también en el servidor,
porque el estado de "tiene libros" puede cambiar entre que se dibuja el botón y
se hace la acción. La pantalla necesita poder mostrar el motivo del rechazo
(ya lo hace: el botón llega deshabilitado y, si igual se dispara, se muestra el
mensaje que devuelva la API).

### 6. Asociar, reemplazar y quitar la imagen de portada de una colección (escritura)

- Una imagen por colección; subir una nueva reemplaza la anterior, no acumula.
- Poder dejar una colección sin portada.
- Poder representar "sin portada" en el listado y en la ficha (el front ya lo
  resuelve con el marcador del sistema de diseño).
- Sólo hace falta que la colección ya exista para poder asociarle la imagen.
- Tipo de archivo, peso y resolución: hoy el front acepta las mismas que la
  portada de libro (PNG/JPG, hasta 5 MB, sin recorte ni proporción exigida; se
  muestra con `object-fit: cover`). Si la API quiere imponer límites propios,
  es decisión del planner.

El proyecto ya tiene el mismo patrón de subida con reemplazo en la portada de
libro (`specs/003-libro-campos-extendidos/design.md`) y en la foto de persona
(`specs/004-persona-foto-bio/design.md`), que el planner puede evaluar como
referencia: no es una propuesta cerrada de esta pasada.

### 7. Listar los libros de una colección (lectura) — acotado a la colección

Título, ISBN, precio y portada de cada libro (es lo que muestra la tabla de la
ficha). La pantalla navega a la ficha del libro usando el ISBN, que ya es el
identificador de libro del sistema.

Tiene que ser una lectura **acotada a esa colección** (o a una página de ella):
la pantalla no puede depender de tener el catálogo entero en memoria para
después filtrarlo.

### 8. Asignar, cambiar o quitar la colección de un libro (escritura) — regla de negocio

- Un libro pertenece **a lo sumo a una colección**: nunca a dos. Asignar una
  colección a un libro que ya tenía otra tiene que reemplazarla, no agregar.
- Poder dejar un libro sin colección.
- Poder cambiar la colección de un libro en cualquier momento, sin condiciones
  (por ejemplo, pasar un libro de la colección A a la B).
- El libro tiene que poder devolver su colección actual al leerlo (hoy lo
  resuelve el mock; la ficha necesita saber qué mostrar en el selector).

### 9. Buscar en el catálogo de forma acotada, excluyendo lo ya asignado (lectura)

Alimenta el diálogo "Agregar libros". Es una **búsqueda**, no un listado: el
catálogo es grande y no se puede traer entero, así que la pantalla necesita:

- poder buscar por **título** (coincidencia parcial) y por **ISBN**, de a
  resultados acotados y paginados, con el total de coincidencias para poder
  mostrar "página X de Y";
- que la búsqueda **excluya los libros que ya pertenecen a una colección**
  (cualquiera, no sólo la que se está editando): un libro está en una sola. Hoy
  lo resuelve el mock descartándolos de la página ya devuelta, así que el total
  que muestra la paginación puede estar un poco por encima de lo que se ve;
  con esta capacidad, el total ya vendría sin ellos;
- el ISBN hoy se puede buscar **completo**: el filtro existente es de igualdad,
  no parcial. Poder buscar un ISBN incompleto es una capacidad aparte, no algo
  que esta pantalla dé por hecho.

Un libro de la lista tiene que poder ofrecer, por libro: identificador, título
y ISBN (más el precio, que es lo que hoy muestra la tabla).

### 10. Datos de muestra inventados en esta pasada (mock temporal, no es contrato)

Sólo para que la pantalla se pueda revisar sin cargar todo a mano. Viven en
`front/src/features/colecciones/coleccionesMock.ts` y se pierden al recargar:

| Colección | Título | Descripción | Portada | Libros |
| --- | --- | --- | --- | --- |
| 1 | Clásicos recuperados | "Títulos fundacionales del catálogo, reeditados con nueva traducción y prólogo." | ninguna | 0 |
| 2 | Serie Aljibe | "Narrativa argentina contemporánea en tapa blanda." | ninguna | 0 |
| 3 | Álbum ilustrado | "Primeros lectores y libros de imágenes, de 3 a 8 años." | ninguna | 0 |

- Son textos inventados para la demo (sintéticos), no datos de la editorial.
- Ninguna trae portada a propósito: el sistema de diseño no tiene material
  fotográfico provisto, y la representación de "sin portada" es el marcador del
  propio sistema.
- Ninguna trae libros al inicio: la pertenencia se arma desde la pantalla. Los
  libros que se pueden agregar son los reales del catálogo (`libros`), que hoy
  son 12.
