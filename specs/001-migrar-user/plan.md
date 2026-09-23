# Plan: Migrar el módulo `user` a la nueva arquitectura

## Spec de referencia
specs/001-migrar-user/spec.md

## Enfoque técnico

`user` pasa a ser dueño de su propia tabla en Postgres (`usersTable`,
`src/schemas/users.schema.ts`, ya creada en una fase anterior) y todos sus
endpoints (`register`, `login`, `GET /user`, `PUT /user`, `PUT /user/afip`,
`uploadCert`) leen/escriben exclusivamente contra Postgres a partir de ahora.
Postgres es la fuente de verdad, y la **única** base para el módulo `user`:
no se escribe nada en la tabla `users` de MySQL ni se depende del trigger
`crear_clientes_por_usuario` (`db/migrations/auto_client_inserts.sql`) que
hoy crea ahí los clientes por defecto.

Esto es una decisión deliberadamente simple y con una consecuencia dura,
aceptada explícitamente: como `clientes`, `libros`, `transacciones` y
`precio_libros` en MySQL tienen FK real a `users(id)`, un usuario creado
después de este cambio (que sólo existe en Postgres) va a hacer fallar con
violación de FK cualquier intento de crear un libro/cliente/transacción/venta
en MySQL para ese usuario. No es una divergencia de datos silenciosa: es un
error duro e inmediato en los módulos no migrados en cuanto se los use con un
usuario nuevo. Ver "Compatibilidad con módulos no migrados" y "Riesgos".

Ya existe en Postgres la tabla `clientesTable`
(`src/schemas/clientes.schema.ts`) con FK a `usersTable.id`, migrada en una
fase anterior pero sin ningún módulo que la use todavía (`cliente` sigue en
MySQL). Este plan usa esa tabla como el único lugar donde viven los clientes
por defecto ("MOSTRADOR"/"CONSUMIDOR FINAL") de un usuario nuevo: se insertan
ahí, dentro de la misma transacción Postgres que crea el usuario, sin tocar
MySQL para nada. Cuando `cliente` migre, va a encontrar esos datos ya
armados para los usuarios creados durante la convivencia.

Se sigue el patrón de capas de `persona` (schema Drizzle + validator
drizzle-zod + filter + service con `ServiceBuilder` de bradb + controller
fino), con una diferencia clave: `users` no es una tabla "de un usuario" (no
tiene dueño, cada fila **es** un usuario), así que su PK es simple (`id`),
no la compuesta `(id, user)` que usa `personas`.

## Capas afectadas

- **schema** (`src/schemas/users.schema.ts`): ya existe y no necesita
  cambios estructurales (columnas ya alineadas 1:1 con `UserSchema`/MySQL
  `users`). Se agrega un comentario documentando por qué no tiene columnas
  `deletedAt` (no hay soft delete de usuarios hoy, ni lo pide el spec) y por
  qué la PK es simple.
- **validator** (`src/validators/user.validator.ts`): se agregan los
  validators nuevos estilo `persona.validator.ts`
  (`userValidator.{select, insert, update, pk}` con `createInsertSchema` /
  `createSelectSchema` de drizzle-zod sobre `usersTable`, más un schema de
  login `loginUserValidator` y uno de creación `createUserValidator` que
  sólo exponen `username, password, cuit, email` como body de entrada). El
  `select` **excluye siempre `password`** (`createSelectSchema(usersTable).omit({password: true})`)
  para que sea estructuralmente imposible devolver el hash en una respuesta.
  Se mantienen sin tocar los exports viejos (`UserSchema`, `SaveUser`,
  `UpdateAfipUser`, `TokenUser`) porque siguen siendo usados por
  `src/models/user.model.ts` (MySQL) y por `src/middleware/auth.ts`
  (`TokenUser`), ninguno de los cuales se migra en este plan.
- **filter** (`src/filters/user.filter.ts`, nuevo): `FilterMap` vacío. El
  `ServiceBuilder` de bradb exige un `FilterMap` en su constructor aunque no
  se use `findAll` (no hay endpoint de listado: `User.getAll` es código
  muerto y el spec confirma que no se migra).
- **service** (`src/services/user.service.ts`, nuevo): `ServiceBuilder` de
  bradb sobre `usersTable` para `findOne`/`create`/`update` (con `select`
  que excluye `password`), más las funciones a medida descriptas abajo:
  `existsByUsername`, `existsByCuit`, `getPasswordHash`, `createUser` (alta
  completa: transacción Postgres con `usersTable` + `clientesTable`, seguida
  de los pasos de AFIP/filesystem) y `updateAfipData`.
- **controller** (`src/controllers/user.controller.ts`): se reescribe para
  usar `userService`/`userValidator` en vez de `User` (modelo MySQL). Mismos
  5 métodos (`create`, `login`, `update`, `getOne`, `uploadCert`,
  `updateAfipData`), mismo contrato HTTP (paths, status codes, forma del
  JSON de respuesta) — el spec pide explícitamente comportamiento observable
  idéntico para el propio módulo `user`.
- **routes** (`src/routes/user.routes.ts`): sin cambios; ya apunta al
  default export de `user.controller.ts` y a `auth` middleware.
- **middleware** (`src/middleware/auth.ts`): sin cambios. Sólo depende de
  `TokenUser` (id + cuit) y de `JWT_SECRET`; el origen del id (antes MySQL,
  ahora exclusivamente Postgres) le es indiferente.
- **afip** (`src/afip/Afip.ts`): se relaja el tipo del parámetro de
  `createCSR(user: User)` a `createCSR(user: Pick<User, 'cuit' | 'razon_social'>)`.
  Es el único punto de `Afip.ts` que hoy exige una instancia de la clase
  `User` (MySQL) durante el alta; con el tipo relajado acepta la fila de
  Postgres sin necesitar convertirla a `User`. No cambia ningún
  comportamiento de la integración AFIP (mismo CSR, mismos parámetros).
- **modelo legado** (`src/models/user.model.ts`): no se toca, pero queda
  efectivamente roto para cualquier usuario creado después de este cambio
  (ver "Compatibilidad con módulos no migrados"). Sigue siendo el único
  punto de acceso para los módulos que no migran en este plan
  (`venta.controller.ts`, `transaccion.controller.ts`, que hacen
  `User.getById(res.locals.user.id)` para leer `cuit`, `punto_venta`,
  `production` al facturar), pero sólo va a encontrar algo para usuarios
  viejos que ya existían en MySQL antes de esta migración.
- **tests** (`test/user.test.ts` y setup compartido): la limpieza entre
  corridas pasa a borrar contra Postgres (`usersTable`, `clientesTable`) por
  `cuit`/`username`, en vez de contra MySQL como hoy
  (`conn.query('delete from users where cuit=... or username = ...')`). Los
  demás tests que dependen de `POST /user/register` para tener un usuario
  autenticado (`test/venta.test.ts`, `test/cliente.test.ts`,
  `test/persona.test.ts`, `test/consignacion.test.ts`,
  `test/venta_consignacion.test.ts`) van a necesitar revisión módulo por
  módulo: los que ejercitan `cliente`/`venta`/`transaccion` con un usuario
  registrado a través del nuevo `POST /user/register` van a fallar por la
  ruptura de FK descripta arriba, no por un bug de este plan — es la
  consecuencia esperada y aceptada de migrar `user` antes que esos módulos.

## Modelo de datos

- `usersTable` (`src/schemas/users.schema.ts`), PK simple `id`
  (`generatedAlwaysAsIdentity`). No compuesta: a diferencia de `personas`,
  una fila de `users` no pertenece a otro usuario, así que no hay nada de
  qué protegerla con una segunda columna en la PK; el aislamiento por dueño
  no aplica acá.
- No se agrega FK desde `usersTable` hacia ninguna otra tabla en este plan.
- **No se agrega FK `personas.user → usersTable.id`** aunque ahora
  `usersTable` va a tener filas reales. Ver trade-off explícito abajo.
- Se reutiliza `clientesTable` (`src/schemas/clientes.schema.ts`, ya con
  FK `user → usersTable.id`) para insertar los dos clientes por defecto al
  crear un usuario; `user.service.ts` es, por ahora, el único código que
  escribe ahí (no hay `cliente.service.ts` todavía). Es la única copia de
  ese dato: no hay nada equivalente en MySQL para usuarios nuevos.
- MySQL: no se toca ni se escribe. El DDL de `users` y el trigger
  `crear_clientes_por_usuario` siguen existiendo tal cual, pero dejan de
  dispararse para usuarios nuevos porque nada vuelve a insertar en la
  `users` de MySQL.

## Compatibilidad con módulos no migrados

- **Usuarios nuevos (creados después de este cambio) rompen duro los
  módulos no migrados.** `clientes`, `libros`, `transacciones` y
  `precio_libros` en MySQL tienen FK real a `users(id)`. Un usuario que sólo
  existe en Postgres no tiene fila en `users` de MySQL, así que cualquier
  intento de:
  - `POST /cliente` (crear un cliente para ese usuario),
  - `GET /cliente` (los "MOSTRADOR"/"CONSUMIDOR FINAL" del trigger nunca se
    crearon en MySQL para este usuario, así que devuelve vacío en vez de
    los dos clientes por defecto),
  - crear/editar un libro, una transacción o vender (`venta`/`transaccion`,
    que además hacen `User.getById` contra MySQL y ni siquiera van a
    encontrar al usuario, mucho antes de llegar a la FK),

  va a fallar. En los módulos que insertan contra MySQL, falla con
  violación de FK; en los que primero leen el usuario vía
  `User.getById(res.locals.user.id)` (`venta`, `transaccion`), falla antes,
  con "usuario no encontrado". Es una ruptura dura e inmediata, no una
  divergencia de datos silenciosa. El usuario del proyecto la aceptó
  explícitamente sabiendo esto en estos términos.
- **Usuarios viejos (creados antes de este cambio) tienen el problema
  inverso: no pueden loguearse.** Sus datos siguen sólo en MySQL (no se
  migran, ver "Decisión ya tomada" más abajo) y el login ahora consulta
  únicamente Postgres. `venta`/`transaccion`/`cliente`/`libro` para esos
  usuarios viejos siguen funcionando igual que hoy (siguen sólo en MySQL,
  consistentes entre sí) mientras no intenten loguearse con el nuevo
  `/user/login`.
- **`liquidacion`, `libro_persona`** (MySQL): no llaman a `User`/`user`
  directamente; se ven afectados sólo indirectamente, a través de si el
  usuario autenticado es nuevo (JWT válido pero sin fila en MySQL) o viejo.

## Decisiones ya tomadas (no abiertas a discusión)

- **No se migran los datos de usuarios existentes de MySQL a Postgres.**
  Postgres arranca con la tabla `users` vacía. Los usuarios que ya existían
  en MySQL antes de esta migración no van a poder loguearse después de
  desplegar este plan: tienen que volver a registrarse. Confirmado por el
  usuario del proyecto.

## Decisiones y trade-offs

1. **PK simple para `users`, no compuesta.** A diferencia de `personas`
   (dueño = `user`), una fila de `users` no tiene dueño: es ella misma la
   entidad "dueño". Aplicar el patrón `(id, user)` no tiene sentido acá
   (no hay una segunda columna de aislamiento posible). Se gana simplicidad,
   no se pierde nada: no hay ningún escenario de "usuario de otro usuario"
   que proteger.

2. **Alta de usuario en una sola transacción Postgres (`usersTable` +
   `clientesTable`), sin tocar MySQL.** Alternativa descartada: mantener un
   shadow write a MySQL para no romper el trigger de clientes ni las FK de
   los módulos no migrados. Se descarta a pedido explícito del usuario del
   proyecto, a cambio de simplicidad real: el alta deja de depender de dos
   bases de datos, un rollback manual multi-paso y una sincronización de
   secuencias/ids entre Postgres y MySQL. El costo es la ruptura dura
   descripta en "Compatibilidad con módulos no migrados", aceptada
   explícitamente.

3. **Los clientes por defecto viven sólo en `clientesTable` (Postgres).**
   No hay duplicado ni sincronización con MySQL: es simplemente dónde vive
   ese dato para usuarios nuevos a partir de ahora. `cliente.controller.ts`
   (MySQL) no los va a ver hasta que `cliente` migre a Postgres y empiece a
   leer de ahí.

4. **No mirror de `PUT /user` / `PUT /user/afip` hacia MySQL.** No aplica
   más como decisión relevante (ya no hay ningún mirror a MySQL en ningún
   punto del alta ni de la actualización); `PUT /user` y `PUT /user/afip`
   actualizan únicamente Postgres, consistente con que MySQL directamente
   no se toca para usuarios nuevos.

5. **No se agrega FK `personas.user → usersTable.id`.** Aunque `usersTable`
   ya va a tener filas reales, agregar la FK ahora es riesgoso: `personas`
   fue migrada antes de que `users` existiera en Postgres, así que sus
   valores de `user` son ids legacy de MySQL, capturados en JWTs viejos, que
   no tienen por qué coincidir con ningún id de `usersTable` en Postgres
   (que arranca vacía y genera ids propios desde 1, sin relación con los ids
   legacy de MySQL). Agregar la FK ahora haría que cualquier
   `INSERT`/`UPDATE` de `personas` con un `user` legacy falle con violación
   de FK, rompiendo `persona` — un módulo que sí está migrado y funcionando
   hoy. Se prioriza no romper `persona` por sobre ganar integridad
   referencial inmediata; se puede revisar cuando se decida si los usuarios
   legacy se migran a Postgres o no.

## Riesgos

- **Cualquier operación de `cliente`/`libro`/`transaccion`/`venta` con un
  usuario nuevo falla con error duro (violación de FK o "usuario no
  encontrado" en MySQL).** No es un riesgo silencioso: es una ruptura
  esperada y aceptada de este plan para todo usuario registrado después de
  desplegarlo, hasta que esos módulos migren a Postgres. Ver
  "Compatibilidad con módulos no migrados".
- **Validación de duplicados incompleta hoy.** El código actual sólo valida
  `username` (`User.exists(body.username)`); el spec exige rechazar también
  cuit duplicado. Hay que agregar `existsByCuit` en `user.service.ts` y
  usarlo en el `create` del controller.
- **Rollback del alta.** El alta ahora es más simple que con shadow write,
  pero sigue teniendo pasos no transaccionales después de la transacción
  Postgres: `createUserFolder` + `createKey` + `createCSR` (filesystem y
  procesos `openssl`). Si alguno de esos pasos falla después de que la
  transacción Postgres ya confirmó (usuario + 2 clientes creados), hay que
  revertir manualmente esa transacción (borrar el usuario y sus clientes en
  Postgres) para no dejar datos parciales, tal como pide el caso borde del
  spec. Es un solo punto de compensación (no una cadena de rollbacks entre
  dos bases como en la alternativa descartada), pero sigue siendo necesario
  documentarlo e implementarlo.
- **Tests concurrentes / reintentos de test suite.** `test/user.test.ts` hoy
  limpia contra MySQL antes de cada corrida; ese cleanup tiene que apuntar a
  Postgres (`usersTable`, `clientesTable`) o los tests van a chocar con
  "usuario ya existe" aunque MySQL esté limpio (que ya no importa, porque
  MySQL no se toca más).
- **`password` nunca expuesto.** Si algún día se agrega un campo a
  `usersTable` sin pasar por `userValidator.select` (que omite `password`
  explícitamente), hay riesgo de reintroducir el leak. Mitigado con que
  todas las respuestas del controller pasan por ese `select`, nunca por el
  objeto crudo de Drizzle.

## Fuera de alcance / deuda aceptada

- **Mantener `venta`, `transaccion`, `libro`, `cliente`, `libro_persona`,
  `liquidacion` funcionando para usuarios nuevos: no se cumple.** Van a
  fallar con error duro (FK o "usuario no encontrado") apenas se intente
  usarlos con un usuario registrado después de este cambio, hasta que esos
  módulos migren a Postgres. Aceptado explícitamente por el usuario del
  proyecto.
- **Migrar los datos de usuarios existentes de MySQL a Postgres: no se
  hace.** Usuarios preexistentes deben volver a registrarse para poder
  loguearse; mientras tanto, siguen operando con normalidad en los módulos
  no migrados porque para ellos no cambia nada en MySQL.
- **Agregar FK real `personas.user → usersTable.id`: queda pendiente** de
  una decisión futura sobre si se migran o no los usuarios legacy.
- `User.getAll` (listado de usuarios): confirmado código muerto en el spec,
  no se migra.
