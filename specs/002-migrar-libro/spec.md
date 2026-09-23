# Spec: Migrar el módulo `libro` a la nueva arquitectura

## Estado
Draft

## Resumen
Migrar el módulo `libro` (alta, baja, edición, consulta y historial de
precios) de su implementación actual sobre MySQL a la arquitectura Postgres
que se viene aplicando en el resto del proyecto (`user` y `persona` ya
están migrados y sirven de referencia). Aprovechando la migración, el
libro pasa a identificarse internamente por un id generado (en vez de
tratar el isbn como si fuera la clave primaria), con el isbn como valor
único. El resultado observable para quien usa la API debe ser el mismo que
hoy, salvo por ese cambio de identificación y por la consulta de ventas de
un libro, que queda fuera de esta migración.

## Motivación / por qué
El proyecto sigue migrando módulo por módulo de MySQL a Postgres, en el
orden acordado: `user` -> `libro` -> `libro_persona`. `user` ya está
migrado; `libro` es el siguiente porque es la entidad central de la que
depende buena parte del resto del sistema (precios, y la relación con
autores/ilustradores que hoy vive en `libro_persona`). Migrarlo ahora
permite seguir avanzando hacia sacar MySQL de encima, módulo por módulo.
De paso, se corrige que el isbn (un dato del mundo real, no generado por el
sistema) se use hoy como si fuera la clave primaria del libro en varias
operaciones (`update`, `delete`, `getByIsbn`), reemplazándolo por un id
generado con isbn como valor único.

## Alcance

### Incluye
- Alta de un libro (`POST /libro`): validación de datos, evitar isbn
  duplicado (entre los libros no eliminados del mismo usuario) y creación
  del primer registro de precio. El alta de un libro no toca
  `libro_persona` en absoluto: se crea sin ninguna persona asociada; la
  asociación de autores/ilustradores queda exclusivamente a cargo de los
  endpoints de `libro_persona` (`POST`/`PUT`/`DELETE /libro/:isbn/personas`,
  fuera de este feature).
- Baja de un libro (`DELETE /libro/:isbn`): baja lógica (soft delete), que
  además deja de considerar al libro asociado a sus autores/ilustradores
  actuales.
- Edición de un libro (`PUT /libro/:isbn`): actualización parcial de los
  campos editables; si el precio enviado difiere del precio actual, queda
  un nuevo registro en el historial de precios además de actualizarse el
  precio vigente del libro.
- Consulta de un libro por isbn (`GET /libro/:isbn`), incluyendo sus
  autores e ilustradores.
- Consulta de la lista de libros del usuario autenticado (`GET /libro`),
  con filtros por campo (isbn, título, etc. vía query params) y con
  soporte de paginación (`?page=`).
- Descarga de la lista de libros en CSV (`GET /libro/lista_libros`).
- Consulta del historial de precios de un libro (`GET /libro/:isbn/precio`).
- Que cada libro se identifique internamente por un id generado por el
  sistema, y que el isbn deje de cumplir el rol de identificador interno
  (clave primaria) que tiene hoy, pasando a ser un valor único por libro.
  Los endpoints públicos que hoy reciben el isbn en la URL (`GET
  /libro/:isbn`, `PUT /libro/:isbn`, `DELETE /libro/:isbn`, `GET
  /libro/:isbn/precio`) lo siguen recibiendo igual; el cambio es interno.
- Que el aislamiento por usuario dueño (un usuario no puede ver, editar ni
  eliminar libros de otro usuario, ni sus precios) se mantenga igual que
  hoy.
- Que la baja de un libro (`DELETE /libro/:isbn`), que hoy depende de
  `libro_persona` para desasociar a sus autores/ilustradores actuales, siga
  funcionando correctamente, aunque `libro_persona` en sí no se migre en
  este feature. Los endpoints de autores/ilustradores de un libro
  (`POST`/`PUT`/`DELETE /libro/:isbn/personas`) no son parte de este
  feature.

### No incluye
- La consulta de ventas de un libro particular (`GET
  /libro/:isbn/ventas`); no hace falta mantenerla funcionando como parte
  de esta migración.
- Migrar el módulo `libro_persona` (`POST`/`PUT`/`DELETE
  /libro/:isbn/personas`); sigue en MySQL y es el siguiente en la lista
  después de este feature.
- Migrar ningún otro módulo (`liquidacion`, `cliente`, `transaccion`,
  `venta`); esos siguen en MySQL.
- Cambiar el comportamiento observable de ningún endpoint (agregar
  funcionalidad nueva, cambiar validaciones existentes, cambiar formatos
  de respuesta) más allá de lo estrictamente necesario para que el
  resultado sea equivalente al actual y del cambio de identificación
  interna descripto arriba.
- Garantizar que los módulos todavía no migrados (`libro_persona`, etc.)
  queden sin ningún impacto: como ya se decidió en la migración de `user`,
  el objetivo de esta etapa es avanzar la migración, no evitar a toda
  costa romper algo de lo que todavía no migró.

## Comportamiento esperado

- Como usuario autenticado, quiero dar de alta un libro, para empezar a
  gestionar su stock y precio.
  - Criterio de aceptación: `POST /libro` con datos válidos (isbn, título,
    fecha de edición, precio, stock) responde 201 y devuelve el libro
    creado (incluido su id generado), sin ninguna persona asociada.
  - Criterio de aceptación: si falta algún campo obligatorio del libro,
    responde 400 y no crea nada.
  - Criterio de aceptación: si ya existe un libro no eliminado con ese isbn
    para el usuario autenticado, responde con un error de duplicado y no
    crea nada.
  - Criterio de aceptación: al crear el libro queda un registro inicial en
    su historial de precios con el precio de alta.
  - Criterio de aceptación: si cualquier paso de la creación falla (libro o
    precio), no queda nada creado a medias (ni el libro, ni el precio).

- Como usuario autenticado, quiero editar los datos de un libro propio,
  para mantener su información al día.
  - Criterio de aceptación: `PUT /libro/:isbn` actualiza únicamente los
    campos enviados; los campos no enviados quedan intactos.
  - Criterio de aceptación: si el `precio` enviado es distinto del precio
    actual del libro, queda un nuevo registro en el historial de precios
    con el precio nuevo, además de actualizarse el precio vigente del
    libro; si el precio enviado es igual al actual, no se agrega ningún
    registro nuevo al historial.
  - Criterio de aceptación: editar un isbn que no existe, o que pertenece a
    otro usuario, responde con un error de "no encontrado".

- Como usuario autenticado, quiero eliminar (dar de baja) un libro propio,
  para dejar de gestionarlo sin perder su historial.
  - Criterio de aceptación: `DELETE /libro/:isbn` responde 200 y el libro
    deja de aparecer en la consulta de uno (`GET /libro/:isbn`) y en el
    listado (`GET /libro`).
  - Criterio de aceptación: eliminar un libro deja de asociarlo con sus
    autores/ilustradores actuales (ya no figuran como personas trabajando
    en ese libro).
  - Criterio de aceptación: eliminar un isbn que no existe, o que
    pertenece a otro usuario, responde con un error de "no encontrado".

- Como usuario autenticado, quiero consultar un libro propio por isbn con
  sus autores e ilustradores, para ver el detalle completo.
  - Criterio de aceptación: `GET /libro/:isbn` de un libro propio y no
    eliminado responde 200 con los datos del libro (incluido su id
    generado) y sus listas de autores e ilustradores (cada uno con al
    menos id, dni, nombre, email y el porcentaje que le corresponde en ese
    libro); esas listas pueden venir vacías si el libro no tiene personas
    asociadas.
  - Criterio de aceptación: consultar un isbn que no existe, que fue
    eliminado, o que pertenece a otro usuario, responde con un error de
    "no encontrado".

- Como usuario autenticado, quiero listar mis libros con filtros y
  paginación, para encontrar rápidamente lo que busco.
  - Criterio de aceptación: `GET /libro` sin filtros responde 200 con
    todos los libros no eliminados del usuario autenticado, ordenados por
    título.
  - Criterio de aceptación: `GET /libro` con filtros por query params
    (por ejemplo isbn o título) responde solo los libros propios que
    matchean esos filtros.
  - Criterio de aceptación: `GET /libro?page=N` responde una página de
    resultados (10 libros no eliminados del usuario, en el orden que ya
    define la paginación actual).
  - Criterio de aceptación: nunca aparecen en estas respuestas libros de
    otro usuario ni libros eliminados.

- Como usuario autenticado, quiero descargar la lista de mis libros en
  CSV, para tener un respaldo o compartirla fuera del sistema.
  - Criterio de aceptación: `GET /libro/lista_libros` responde con un
    archivo CSV descargable con los libros no eliminados del usuario
    autenticado.

- Como usuario autenticado, quiero consultar el historial de precios de un
  libro, para ver cómo evolucionó a lo largo del tiempo.
  - Criterio de aceptación: `GET /libro/:isbn/precio` responde 200 con la
    lista de precios registrados para ese isbn, del más reciente al más
    antiguo.

## Casos borde
- Dar de alta un libro con isbn duplicado (para el mismo usuario, entre
  los no eliminados) no debe dejar nada creado a medias.
- Un isbn eliminado (soft delete) puede volver a usarse para dar de alta
  un libro nuevo con ese mismo isbn (la validación de duplicado sólo
  considera libros no eliminados), igual que hoy; esto sigue siendo
  compatible con que el isbn sea un valor único, siempre que esa unicidad
  se evalúe sólo entre libros activos (ver "Preguntas abiertas").
- El precio que figura en el libro y el que figura en su historial de
  precios deben quedar siempre consistentes: cada cambio de precio real
  agrega una entrada al historial, no se pierden entradas ni se agregan
  entradas cuando el precio no cambió.
- Los filtros de `GET /libro` y la paginación son dos formas de consulta
  distintas y no combinables hoy (si se manda `page`, se ignoran los demás
  filtros); el comportamiento migrado debe seguir siendo así salvo que se
  decida lo contrario en otra etapa.

## Datos existentes / integraciones a tener en cuenta
- `libro.user` identifica al dueño del libro, igual que `persona.user`; se
  espera el mismo patrón de aislamiento por dueño que ya usa `persona` en
  Postgres (no se puede consultar, editar, ni eliminar un libro de otro
  usuario).
- `libro_persona` (autores/ilustradores) sigue en MySQL y es el próximo
  módulo a migrar. La interacción de `libro` con `libro_persona` queda
  acotada a lectura y limpieza: al consultar un libro, se muestran sus
  autores/ilustradores actuales (lista que puede venir vacía); al
  eliminarlo, se quitan esas asociaciones. El alta de un libro ya no
  interactúa con `libro_persona`: la asociación de autores/ilustradores
  (personas existentes o nuevas, con su porcentaje) es responsabilidad
  exclusiva de los endpoints de `libro_persona`, que es el próximo módulo a
  especificar y migrar.
- El historial de precios (`precio_libros`) es una tabla aparte ligada al
  libro por isbn, que se alimenta tanto en el alta como en la edición
  cuando cambia el precio; no tiene endpoints propios de alta directa, sólo
  se llena como efecto de crear/editar un libro.
- La consulta de ventas de un libro particular queda fuera de esta
  migración: `libro` deja de exponer ese cruce con `libros_ventas`/
  `ventas` (módulo `venta`, no migrado) como parte de este feature.
- El módulo `persona` ya migrado es la referencia directa para el patrón
  de aislamiento por dueño (PK compuesta `(id, user)`) y para cómo se
  resuelve la relación con `libro_persona` desde el lado de `persona`
  (`personaService.getLibros`). Conviene mantener el mismo criterio en
  `libro` para no generar un patrón distinto entre módulos hermanos.
- La dependencia de `libro` respecto de `user` (dueño) ya no es un riesgo
  nuevo de esta migración: `user` ya migró a Postgres, así que a
  diferencia de lo que pasó cuando se migró `persona` (que quedó sin
  vínculo íntegro a `usersTable` porque `user` todavía estaba en MySQL),
  acá sí es viable resolver el modelo de datos con una relación real a la
  tabla de usuarios en Postgres.

## Preguntas abiertas
- El alcance de la unicidad del isbn: hoy la validación de duplicado es
  por usuario (un mismo isbn puede existir para dos usuarios distintos,
  pero no dos veces activo para el mismo usuario). No quedó claro si
  "isbn único" significa mantener ese mismo alcance (único por usuario,
  entre libros activos) o pasar a que sea único globalmente. Se asume que
  se mantiene el alcance actual (único por usuario, entre libros no
  eliminados) salvo que se indique lo contrario, ya que cambiar eso sería
  una regla de negocio nueva no pedida explícitamente.
- El listado paginado (`GET /libro?page=`) no acepta hoy combinarse con
  filtros de texto/número; no quedó claro en el código si eso es una
  limitación intencional o una deuda pendiente. Se documenta el
  comportamiento actual como el esperado, salvo que se indique lo
  contrario.
