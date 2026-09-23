# Spec: Migrar el módulo `cliente` a la nueva arquitectura

## Estado
Aprobado

## Resumen
Migrar la gestión de clientes (alta, edición, baja, consulta) y el stock de
libros que cada cliente inscripto tiene en consignación, de su
implementación actual sobre MySQL a la arquitectura Postgres que ya usan
`user`, `libro`, `persona` y `libro_persona`, preservando el comportamiento
observable actual salvo las correcciones puntuales que se listan más abajo.

## Motivación / por qué
El orden de migración acordado es `user` -> `libro` -> `libro_persona` ->
`persona` -> `cliente`; los cuatro primeros ya están migrados. `user` ya
crea, al dar de alta un usuario, sus clientes por defecto ("CONSUMIDOR
FINAL" y "MOSTRADOR") directamente en la tabla Postgres de clientes
(`src/services/user.service.ts`, `createUser`), así que hoy ya existen
filas reales de cliente en Postgres, pero ningún endpoint de `cliente`
sabe leerlas ni escribirlas ahí: todo el CRUD de clientes sigue operando
sobre la tabla MySQL vieja. Esta migración cierra ese hueco.

Se incorpora también el stock de libros por cliente (antes reservado para
la migración de `venta`/`transaccion`) porque es información propia del
cliente —qué libros y cuánto stock tiene en consignación, y a qué precio—
que se consulta y actualiza de forma independiente de cualquier venta o
transacción concreta, y así queda todo el módulo `cliente` completo en
Postgres en una sola etapa.

## Alcance

### Incluye
- Alta de un cliente nuevo tipo "inscripto" a partir de su CUIT
  (`POST /cliente`), completando razón social, condición fiscal y
  domicilio con los datos que devuelve AFIP para ese CUIT.
- Edición de los datos propios de un cliente (`PUT /cliente/:id`):
  nombre, email y/o cuit; si cambia el cuit, se vuelven a completar razón
  social/condición fiscal/domicilio con los datos de AFIP del nuevo cuit.
- Baja de un cliente propio (`DELETE /cliente/:id`).
- Consulta de un cliente propio por id (`GET /cliente/:id`) y de todos los
  clientes propios, opcionalmente filtrados por tipo (`GET /cliente?tipo=...`).
  El consumidor final propio del usuario autenticado se obtiene con este
  mismo listado filtrado (`GET /cliente?tipo=particular`); no existe un
  endpoint dedicado (ver "No incluye" y "Datos existentes" sobre la
  eliminación de `GET /cliente/consumidor_final`).
- Consulta del stock actual de libros de un cliente propio
  (`GET /cliente/:id/stock`): para cada libro que el cliente tiene en
  consignación, su título, isbn y precio y stock actuales.
- Consulta del stock de libros de un cliente propio a una fecha dada
  (`GET /cliente/:id/stock?fecha=...`): mismo listado, pero con el precio
  que tenía cada libro en esa fecha según su historial, en vez del precio
  vigente hoy.
- Actualización de precios de stock de un cliente inscripto
  (`PUT /cliente/:id/stock`): sincroniza el precio de cada libro en el
  stock del cliente con el precio actual del libro cuando difieren,
  dejando registro del precio anterior en el historial, y devuelve el
  stock actualizado del cliente.
- Las validaciones de negocio equivalentes a las actuales: no se puede
  cargar como cliente al propio usuario autenticado (mismo cuit), no se
  puede duplicar un cliente "inscripto" con el mismo cuit para el mismo
  usuario, no se puede editar el cuit de un cliente hacia uno que ya usa
  otro cliente inscripto propio, no se puede editar el cliente "consumidor
  final", no se puede eliminar el cliente "consumidor final" ni el cliente
  "MOSTRADOR" propios, y sólo un cliente "inscripto" puede tener stock
  (actualizar precios de stock de un cliente que no es inscripto responde
  con un error de validación).
- Que el aislamiento por usuario dueño se mantenga: sólo se puede
  ver/editar/eliminar clientes propios, y sólo se puede consultar/
  actualizar el stock de clientes propios.

### No incluye
- `GET /cliente/:id/ventas`: depende de las tablas de ventas/transacciones,
  que pertenecen a módulos (`venta`, `transaccion`) todavía no migrados.
  Queda fuera de este feature; se migra junto con `venta`/`transaccion`.
- La lógica interna de reserva/liberación/verificación de stock de un
  cliente al registrar o anular una venta o transacción (hoy resuelta en
  el modelo de `cliente` como `addStock`, `reduceStock` y `haveStock`,
  pero invocada exclusivamente desde `venta`/`transaccion`, nunca desde un
  endpoint propio de `cliente`): queda fuera de este feature porque no es
  parte del CRUD ni de la consulta/edición de stock propios de `cliente`,
  sino lógica de escritura de stock disparada por operaciones de venta
  que todavía no migran. Moverla ahora dejaría esos métodos sin nadie que
  los invoque desde Postgres hasta que `venta`/`transaccion` migren; se
  migran junto con esos módulos.
- La ruta `GET /cliente/consumidor_final` se elimina en esta migración (no
  se migra): se reemplaza por `GET /cliente?tipo=particular`, que ya cubre
  el mismo caso de uso a través del filtro por tipo (ver "Comportamiento
  esperado" y "Datos existentes"). Como la ruta desaparece, el bug de
  shadowing que tenía hoy (`GET /cliente/:id`, registrada antes, la
  interceptaba siempre) deja de aplicar y no requiere corrección.
- Migrar ningún otro módulo (`liquidacion`, `transaccion`, `venta`); esos
  siguen en MySQL.
- Garantizar que los módulos todavía no migrados (`transaccion`, `venta`)
  queden sin ningún impacto: como ya se decidió en migraciones anteriores,
  el objetivo de esta etapa es avanzar la migración, no evitar a toda
  costa romper algo de lo que todavía no migró. Sí importa que quede
  documentado qué puede quedar roto (ver "Datos existentes /
  integraciones a tener en cuenta").

## Comportamiento esperado

- Como usuario autenticado, quiero dar de alta un cliente inscripto a
  partir de su CUIT, para poder facturarle y registrarle ventas.
  - Criterio de aceptación: `POST /cliente` con `{nombre, cuit, tipo,
    email?}` válidos responde 201 y devuelve el cliente creado, con
    `razon_social`, `cond_fiscal` y `domicilio` completados con los datos
    de AFIP correspondientes al cuit, y `tipo` forzado a "inscripto" sin
    importar lo que se haya enviado en el body (igual que hoy: no se puede
    crear un cliente que no sea inscripto por este endpoint).
  - Criterio de aceptación: si el cuit enviado es el mismo que el del
    usuario autenticado, responde con un error de validación y no crea
    nada.
  - Criterio de aceptación: si ya existe un cliente inscripto propio con
    ese cuit, responde con un error de duplicado y no crea nada.

- Como usuario autenticado, quiero editar el nombre, email y/o cuit de un
  cliente propio, para mantener sus datos actualizados.
  - Criterio de aceptación: `PUT /cliente/:id` responde 201 y devuelve el
    cliente actualizado con los campos enviados aplicados; los campos no
    enviados no cambian.
  - Criterio de aceptación: si se envía un cuit distinto al actual, se
    vuelven a completar `razon_social`, `cond_fiscal` y `domicilio` con
    los datos de AFIP del nuevo cuit.
  - Criterio de aceptación: si el nuevo cuit ya lo usa otro cliente
    inscripto propio, responde con un error de duplicado y no modifica
    nada.
  - Criterio de aceptación: editar el cliente "consumidor final" propio
    (tipo particular) responde con un error de validación y no modifica
    nada.
  - Criterio de aceptación: editar un cliente que no existe o no es propio
    responde con un error de "no encontrado".

- Como usuario autenticado, quiero eliminar un cliente propio, para dejar
  de operar con él.
  - Criterio de aceptación: `DELETE /cliente/:id` sobre un cliente propio
    que no sea el "consumidor final" ni el "MOSTRADOR" responde 200 y,
    después de eso, ese cliente deja de aparecer en `GET /cliente` y
    `GET /cliente/:id` responde "no encontrado".
  - Criterio de aceptación: `DELETE /cliente/:id` sobre el cliente
    "MOSTRADOR" propio (tipo "negro", autocreado al alta del usuario,
    ver "Datos existentes") responde con un error de validación y no
    elimina nada (mismo tratamiento que ya tiene "no se puede editar el
    consumidor final", pero para baja y sobre el MOSTRADOR).
  - Criterio de aceptación: `DELETE /cliente/:id` sobre el cliente
    "consumidor final" propio (tipo "particular") responde con un error
    de validación y no elimina nada.
  - Criterio de aceptación: eliminar un cliente que no existe o no es
    propio responde con un error de "no encontrado" y no elimina nada.

- Como usuario autenticado, quiero consultar mis clientes (todos, uno por
  id, o filtrados por tipo), para ver con quién puedo operar.
  - Criterio de aceptación: `GET /cliente` devuelve todos los clientes
    propios (no eliminados) ordenados por nombre ascendente.
  - Criterio de aceptación: `GET /cliente?tipo=inscripto` (o `particular`
    o `negro`) devuelve sólo los clientes propios de ese tipo; un valor de
    `tipo` inválido se ignora y se comporta como si no se hubiera
    enviado (igual que hoy).
  - Criterio de aceptación: `GET /cliente/:id` devuelve el cliente propio
    con ese id, o un error de "no encontrado" si no existe, está
    eliminado o pertenece a otro usuario.
  - Criterio de aceptación: el usuario obtiene su "consumidor final"
    filtrando `GET /cliente?tipo=particular`, que devuelve el/los
    cliente(s) tipo "particular" del usuario autenticado (en la práctica
    un único resultado, ya que cada usuario tiene un solo "CONSUMIDOR
    FINAL" autocreado al alta, ver "Datos existentes"); no un consumidor
    final global compartido entre todos los usuarios.

- Como usuario autenticado, quiero consultar el stock de libros de un
  cliente propio, para saber qué tiene en consignación y a qué precio.
  - Criterio de aceptación: `GET /cliente/:id/stock` sobre un cliente
    propio responde 200 con la lista de libros que tiene en stock
    (título, isbn, precio y stock actuales), ordenada por título
    ascendente; un cliente sin libros en stock responde con una lista
    vacía.
  - Criterio de aceptación: `GET /cliente/:id/stock?fecha=...` responde
    con la misma lista de libros en stock, pero con el precio que tenía
    cada libro en esa fecha según su historial de precios, en vez del
    precio actual.
  - Criterio de aceptación: consultar el stock de un cliente que no existe
    o no es propio responde con un error de "no encontrado".

- Como usuario autenticado, quiero sincronizar los precios del stock de un
  cliente inscripto con los precios actuales de los libros, para que no
  queden desactualizados.
  - Criterio de aceptación: `PUT /cliente/:id/stock` sobre un cliente
    inscripto propio actualiza, para cada libro en stock cuyo precio
    difiere del precio actual del libro, el precio del stock al nuevo
    precio, deja registrado en el historial de precios el valor anterior,
    y responde 200 con el stock actualizado del cliente
    (equivalente a `GET /cliente/:id/stock`).
  - Criterio de aceptación: si ningún libro en stock tiene un precio
    desactualizado, responde igualmente 200 con el stock (sin cambios).
  - Criterio de aceptación: `PUT /cliente/:id/stock` sobre un cliente
    propio que no es "inscripto" responde con un error de validación y no
    modifica nada.
  - Criterio de aceptación: actualizar el stock de un cliente que no
    existe o no es propio responde con un error de "no encontrado".

## Casos borde
- Enviar `tipo` en el body de `POST /cliente` no tiene efecto: siempre se
  crea como "inscripto" (igual que hoy).
- Actualizar sólo `nombre` o sólo `email` en `PUT /cliente/:id` sin tocar
  el cuit no debe volver a consultar AFIP.
- El cliente "MOSTRADOR" (tipo "negro") autocreado por usuario al alta es
  una entidad especial, igual que el "CONSUMIDOR FINAL": no se puede
  eliminar (ver "Comportamiento esperado", `DELETE /cliente/:id`), aunque
  sí se puede editar igual que cualquier otro cliente propio (a diferencia
  del "consumidor final", que tampoco se puede editar). La protección de
  borrado es específicamente sobre ese cliente MOSTRADOR autocreado, no
  una regla general para todo tipo "negro"; en la práctica hoy son
  equivalentes porque no existe ningún endpoint que permita crear otro
  cliente tipo "negro" además del MOSTRADOR autocreado (`POST /cliente`
  siempre fuerza tipo "inscripto"), así que todo cliente tipo "negro" que
  exista es, por construcción, el MOSTRADOR. Si en el futuro se permitiera
  crear otros clientes tipo "negro", la regla debería revisarse para no
  bloquear su borrado por error.
- Un usuario nuevo, recién creado, ya tiene sus clientes "CONSUMIDOR
  FINAL" y "MOSTRADOR" en Postgres desde que se creó (por
  `user.service.ts`); esta migración no debe duplicar esa lógica de alta
  automática, sólo debe permitir leer/editar/eliminar (salvo las
  excepciones de arriba) esos clientes por los endpoints existentes.
- Un cliente "particular" o "negro" recién creado, sin ningún libro
  agregado todavía a su stock (porque `addStock` sólo lo invocan
  `venta`/`transaccion`, fuera de alcance), responde `GET /cliente/:id/stock`
  con una lista vacía, no con un error.

## Datos existentes / integraciones a tener en cuenta
- `src/services/user.service.ts` (`createUser`) ya inserta, dentro de la
  misma transacción de alta de usuario, dos clientes en la tabla Postgres
  de clientes: uno tipo "particular" ("CONSUMIDOR FINAL") y uno tipo
  "negro" ("MOSTRADOR"). Esta migración es la primera en exponer CRUD
  real sobre esos datos vía HTTP; conviene verificar que ambos sigan
  apareciendo con los endpoints migrados.
- **Breaking change de API**: se elimina la ruta `GET /cliente/consumidor_final`.
  Los consumidores de la API que la usaban deben migrar a
  `GET /cliente?tipo=particular`. En el código legado, `getCliente()`
  (controller viejo) tenía un caso especial para
  `req.params.id == "consumidor_final"`; en la arquitectura nueva ese caso
  especial ya no hace falta porque la ruta desaparece y el filtro por
  `tipo` cubre el mismo caso de uso.
- Ya existe `src/schemas/clientes.schema.ts` (tabla Drizzle de clientes,
  con FK a `usersTable`) del trabajo de Fase 0. No tiene hoy columna de
  borrado lógico ni clave compuesta por dueño; si hace falta ajustarla
  para soportar baja lógica y el patrón de ownership ya usado en `libro`
  y `persona`, queda para la fase de plan, no de este spec.
- También existen, de la misma Fase 0, `src/schemas/libroCliente.schema.ts`
  (tabla `libro_cliente`, el stock de libros por cliente: qué libro, qué
  cliente, cuánto stock y a qué precio) y
  `src/schemas/precioLibroCliente.schema.ts` (tabla `precio_libro_cliente`,
  el historial de precios que tuvo cada libro para cada cliente). Esta
  migración incorpora el CRUD de lectura/actualización sobre esas dos
  tablas vía los endpoints de stock listados en "Incluye". A diferencia de
  `clientesTable`, `libroClienteTable` no tiene columna propia de usuario
  dueño: su ownership se hereda transitivamente a través de `id_cliente`
  (FK a `clientesTable`, que sí tiene dueño) y de `id_libro` (FK a
  `librosTable`, que también tiene dueño). Si ese patrón de ownership
  heredado (sin columna `user` propia) necesita algún ajuste para
  aplicarse de forma consistente con `libro_persona`, queda para la fase
  de plan, no de este spec.
- `venta.controller.ts` y `transaccion.controller.ts` (no migrados) usan
  hoy `Cliente.getById` del modelo MySQL para validar el cliente de una
  venta/transacción, y `venta.model.ts`/`transaccion.model.ts` invocan
  métodos del cliente MySQL (`reduceStock`, `addStock`, `haveStock`) para
  mover su stock. Mientras `venta`/`transaccion` no migren, van a seguir
  dependiendo del modelo y la conexión MySQL vieja de cliente (incluida su
  tabla de stock) aunque este feature migre el resto del módulo, incluido
  el CRUD de stock de lectura/actualización de precios, a Postgres; es un
  quiebre esperado (ver "No incluye") que se resuelve cuando se migren
  esos módulos, no ahora. En particular, el stock que muevan
  `addStock`/`reduceStock` seguirá escribiéndose en la tabla MySQL vieja,
  no en `libro_cliente` de Postgres, hasta que `venta`/`transaccion`
  migren.
- `getAfipData` (`src/afip/Afip.ts`) es el mismo mecanismo de consulta a
  AFIP que ya usa el código actual; no cambia con esta migración.
- El aislamiento por usuario dueño y el patrón de servicios con
  `ServiceBuilder`/bradb, validadores con zod, ya aplicado en `user`,
  `libro`, `persona` y `libro_persona`, es la referencia de este feature.
- El "precio vigente a la fecha `fecha`" de `GET /cliente/:id/stock?fecha=...`
  debe interpretarse en huso horario GMT-3 (Argentina). El modelo MySQL
  legado resolvía esto con una ventana de tolerancia hardcodeada de 3
  horas (`DATE_SUB(...INTERVAL 3 HOUR)`, con un comentario propio
  `TODO: No hardcodear el datetime`); esa ventana no es una regla de
  negocio a preservar, es un intento poco prolijo de corregir la zona
  horaria del servidor. Para esta migración alcanza con que el criterio de
  "precio vigente a la fecha dada" se calcule correctamente en GMT-3, por
  cualquier mecanismo razonable (por ejemplo, ajustar el offset en la
  query de Postgres); no hace falta reproducir la ventana de 3 horas. La
  forma prolija de resolverlo de raíz (configurar el timezone del
  contenedor/DB) queda fuera de alcance de este feature.
