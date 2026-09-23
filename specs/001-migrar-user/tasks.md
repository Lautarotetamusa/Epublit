# Tasks: Migrar el módulo `user` a la nueva arquitectura

Plan de referencia: specs/001-migrar-user/plan.md
Spec de referencia: specs/001-migrar-user/spec.md
Referencia de forma de archivos: módulo `persona` ya migrado
(`src/schemas/personas.schema.ts`, `src/validators/persona.validator.ts`,
`src/filters/persona.filter.ts`, `src/services/persona.service.ts`,
`src/controllers/persona.controller.ts`, `test/persona.test.ts`).

Cada tarea es chica, verificable de forma independiente, y en orden de dependencia.
Marcar `[x]` al completarla y agregar una línea con lo que efectivamente se hizo
si difiere del enunciado.

- [x] T1. Documentar en `src/schemas/users.schema.ts` (sin cambiar columnas)
  por qué no tiene `deletedAt` (no hay soft delete de usuarios hoy, ni lo
  pide el spec) y por qué la PK es simple `id` (a diferencia de `personas`,
  una fila de `users` no tiene dueño: es ella misma la entidad dueño, no hay
  "usuario de otro usuario" que aislar con una PK compuesta).

- [x] T2. En `src/validators/user.validator.ts`, agregar los validators
  nuevos (Postgres/Drizzle) sin tocar los exports viejos (`UserSchema`,
  `SaveUser`, `UpdateAfipUser`, `TokenUser`, `updateUser`, `loginUser`,
  `createUser`, `CreateUser`) que siguen usando `src/models/user.model.ts` y
  `src/middleware/auth.ts`:
  - `userValidator.select = createSelectSchema(usersTable).omit({ password: true })`
    — el `select` **excluye siempre `password`** para que sea
    estructuralmente imposible devolver el hash en una respuesta (criterio
    de aceptación del spec).
  - `userValidator.insert = createInsertSchema(usersTable)` (base para
    `createUser` en el service; no se expone tal cual como body de entrada
    HTTP, ver `createUserValidator` abajo).
  - `userValidator.update = createInsertSchema(usersTable).pick({ email: true, punto_venta: true }).partial()`
    (mismos dos campos editables que hoy: `email`, `punto_venta`; `email`
    vacío rechazado con `.min(1)` o `.email()`, `punto_venta` negativo
    rechazado con `.gte(0)`, igual que el `updateUser` viejo).
  - `userValidator.pk = createPkSchema(usersTable)` (PK simple `id`).
  - `loginUserValidator = z.object({ username: z.string(), password: z.string() })`
    (equivalente nuevo de `loginUser`, mismo shape).
  - `createUserValidator = userValidator.insert.pick({ username: true, password: true, cuit: true, email: true })`
    (body de entrada de `POST /user/register`: sólo esos 4 campos, igual que
    el `createUser` viejo).
  - Exportar tipos `UserInsert`, `UserUpdate`, `User` (`z.infer` de cada
    schema nuevo) para usar en `user.service.ts`.
  Nota: `userValidator.update` no se derivó de
  `createInsertSchema(usersTable).pick(...)` porque las columnas `email`
  (`varchar(...).default("")`, nullable) y `punto_venta`
  (`integer`, nullable) de `usersTable` no traen ninguna restricción que
  drizzle-zod pueda heredar para rechazar vacío/negativo. Se declaró
  explícito como `z.object({ email: z.string().min(1), punto_venta:
  z.number().gte(0) }).partial()` para cumplir los criterios de aceptación
  del spec.

- [x] T3. Crear `src/filters/user.filter.ts` con un `FilterMap` vacío
  (`{}` tipado como `FilterMap<...>`), igual patrón que
  `src/filters/persona.filter.ts` pero sin ninguna key: `ServiceBuilder`
  exige un `FilterMap` en el constructor aunque no haya `findAll` (no hay
  endpoint de listado, `User.getAll` es código muerto y no se migra).

- [x] T4. Crear `src/services/user.service.ts` con el `ServiceBuilder` de
  bradb sobre `usersTable` (`new ServiceBuilder(db, usersTable, userFilterMap)`)
  y exportar `findOne` y `update`:
  - `findOne` construido con un `select` custom
    (`() => db.select({...todas las columnas de usersTable menos password}).from(usersTable).$dynamic()`)
    para que **nunca** devuelva `password`, ni siquiera por accidente si en
    el futuro se agrega un campo nuevo a mano.
  - `update` sin `select` custom (bradb no permite pasarlo junto con hooks
    fácilmente): en el controller, cualquier respuesta de `update` debe
    pasar por `userValidator.select.parse(...)` antes de devolverse (dejar
    esto documentado en un comentario en el service, ya que es el
    controller quien lo aplica).
  - No agregar `create`/`delete` de `ServiceBuilder` acá todavía: `create`
    se define a medida en T6 porque necesita ser transaccional con
    `clientesTable`.

- [x] T5. En `src/services/user.service.ts`, agregar:
  - `existsByUsername(username: string): Promise<boolean>` — `select id`
    de `usersTable` filtrando por `username`, `limit(1)`.
  - `existsByCuit(cuit: string): Promise<boolean>` — mismo patrón filtrando
    por `cuit`. Nuevo respecto del código actual: el spec exige rechazar
    también cuit duplicado (`User.exists` viejo sólo validaba `username`).
  - `getPasswordHash(id: number): Promise<string>` — `select password` de
    `usersTable` filtrando por `id`, para usar en el login sin que
    `findOne` (que omite `password`) lo exponga.

- [x] T6. En `src/services/user.service.ts`, agregar `createUser(data: UserInsert): Promise<User>`
  que hace, dentro de una única `db.transaction`:
  1. `insert` en `usersTable` con `data` (incluye ya el hash de password y
     los datos fiscales de AFIP, que arma el controller antes de llamar a
     esta función — ver T9).
  2. `insert` en `clientesTable` de los dos clientes por defecto para el
     `user.id` recién creado:
     - `{ nombre: "CONSUMIDOR FINAL", tipo: "particular", cond_fiscal: "CONSUMIDOR FINAL", razon_social: "CONSUMIDOR FINAL", domicilio: "", user: user.id }`
     - `{ nombre: "MOSTRADOR", tipo: "negro", cond_fiscal: "", razon_social: "", domicilio: "", user: user.id }`
     (copiar exactamente los valores que hoy arma el trigger MySQL
     `crear_clientes_por_usuario`, verificables contra
     `test/user.test.ts` → `'se deben crear clientes mostrador y consumidor final'`).
  3. Devolver el usuario creado (sin `password`, aplicando
     `userValidator.select.parse` antes de retornar, o seleccionando
     explícitamente las columnas sin `password` dentro de la transacción).
  No incluir acá los pasos de filesystem/AFIP (`createUserFolder`,
  `createKey`, `createCSR`): quedan en el controller (T9), que debe revertir
  esta transacción (borrar el usuario recién creado, lo que además borra en
  cascada los dos clientes si la FK lo permite, o borrarlos explícitamente
  si no) si alguno de esos pasos post-transacción falla — documentar esto
  como comentario en el controller, no en el service.

- [x] T7. En `src/services/user.service.ts`, agregar
  `updateAfipData(id: number, afipData: AfipData): Promise<User>` que
  actualiza `cond_fiscal`, `razon_social`, `domicilio`, `fecha_inicio`,
  `ingresos_brutos` para ese `id` usando el `update` de T4, y devuelve el
  usuario actualizado ya sin `password`.

- [x] T8. En `src/afip/Afip.ts`, relajar el tipo del parámetro de
  `createCSR(user: User)` a
  `createCSR(user: Pick<User, 'cuit' | 'razon_social'>)` (mantener el
  import de `User` sólo si sigue haciendo falta en otras firmas del
  archivo; si no, ajustar el import). No cambiar el cuerpo de la función.

- [x] T9. Reescribir `create` en `src/controllers/user.controller.ts` para
  usar `userService`/`userValidator`/`createUserValidator` en vez de
  `User` (modelo MySQL):
  1. `const body = createUserValidator.parse(req.body)`.
  2. Si `await userService.existsByUsername(body.username)` → lanzar
     `ValidationError` "Ya existe un usuario con este username" (400).
  3. Si `await userService.existsByCuit(body.cuit)` → lanzar
     `ValidationError` "Ya existe un usuario con este cuit" (400) — chequeo
     nuevo pedido por el spec.
  4. `body.password = await bcrypt.hash(body.password, 10)`.
  5. `const afipData = await getAfipData(body.cuit)` (sin cambios; sigue
     tirando `NotFound` → 404 si el cuit no existe en AFIP).
  6. `const user = await userService.createUser({ ...body, ...afipData, production: false })`.
  7. `await createUserFolder(user.cuit); await createKey(user.cuit); await createCSR(user)`.
     Si cualquiera de estos tres pasos falla, revertir el alta borrando el
     usuario (y sus clientes por defecto) creados en el paso 6 antes de
     relanzar el error, para cumplir el caso borde del spec ("no debe dejar
     datos parciales"). Envolver estos tres pasos en un `try/catch` que
     haga ese borrado de compensación y luego relance.
  8. Responder 201 con `{ success: true, message: "Usuario creado correctamente", data: user }`.
  Nota: el borrado de compensación se implementó como `userService.remove({id})`
  (nueva función en el service, no sólo un comentario en el controller):
  borra `clientesTable` por `user` y después `usersTable` por `id`, dentro de
  una transacción, porque `clientes.user` referencia `users.id` sin
  `onDelete: cascade` y el borrado directo del usuario fallaría por FK.

- [x] T10. Reescribir `login` en `src/controllers/user.controller.ts`:
  1. `const body = loginUserValidator.parse(req.body)`.
  2. Buscar el usuario por username: agregar (si no existe ya)
     `findByUsername` en `user.service.ts` — reusar el `select` sin
     password de T4 filtrando por `username`, lanzando `NotFound`/`Unauthorized`
     si no hay filas (mantener el comportamiento actual: sin usuario válido
     no se puede loguear).
  3. `const hash = await userService.getPasswordHash(user.id)`.
  4. `bcrypt.compare(body.password, hash)`; si no matchea, `Unauthorized("Contraseña incorrecta")` (401).
  5. Firmar el JWT exactamente igual que hoy (`token_data = { id: user.id, cuit: user.cuit }`,
     mismo `JWT_SECRET`/`JWT_EXPIRES_IN`), sin cambios de formato.
  6. Responder 200 con `{ success: true, message: "login exitoso", token }`.

- [x] T11. Reescribir `update` (`PUT /user`) en
  `src/controllers/user.controller.ts`:
  1. `const body = userValidator.update.parse(req.body)`.
  2. Si `Object.keys(body).length === 0` → responder 200 sin llamar al
     service (mismo comportamiento que hoy: "El usuario esta igual que antes").
  3. Si no, `const user = await userService.update({ id: res.locals.user.id }, body)`,
     parsear el resultado con `userValidator.select.parse(user)` antes de
     devolverlo (para que nunca se filtre `password`), y responder 200 con
     `{ success: true, message: "Usuario actualizado correctamente", data: user }`.

- [x] T12. Reescribir `updateAfipData` (`PUT /user/afip`) en
  `src/controllers/user.controller.ts`:
  1. Leer el usuario actual con `userService.findOne({ id: res.locals.user.id })`
     para obtener su `cuit`.
  2. `const afipData = await getAfipData(user.cuit)`.
  3. `const updated = await userService.updateAfipData(user.id, afipData)`.
  4. Responder 200 con `{ success: true, message: "Usuario actualizado correctamente", data: updated }`.

- [x] T13. Reescribir `getOne` (`GET /user`) en
  `src/controllers/user.controller.ts`:
  `const user = await userService.findOne({ id: res.locals.user.id })`,
  responder 200 con `{ success: true, data: user }`. Verificar que
  `uploadCert` (no depende de `User`/MySQL, sólo de
  `res.locals.user.cuit` puesto por el middleware `auth`) sigue compilando
  sin cambios; no tocarlo.

- [x] T14. `npx tsc --noEmit` y limpiar cualquier import muerto que haya
  quedado en `src/controllers/user.controller.ts` (por ejemplo el import de
  `User` de `src/models/user.model.ts`, que ya no debería usarse en ningún
  método de este controller tras T9-T13).

- [x] T15. Actualizar el cleanup de `test/user.test.ts`: reemplazar el
  `it('Hard delete', ...)` que borra contra MySQL
  (`conn.query('delete from users where cuit=... or username = ...')`) por
  un borrado contra Postgres usando `db`/`usersTable`/`clientesTable`
  (`src/pgDb.ts`, `src/schemas`): borrar primero los `clientesTable` cuyo
  `user` sea el id del usuario de test (por `cuit`/`username`) y después el
  `usersTable`, para no violar la FK `clientes.user -> users.id`. Mantener
  el resto del archivo de test igual (ya ejercita los criterios de
  aceptación del spec: 400 sin cuit, 404 con cuit inexistente en AFIP, 400
  con cuit/username duplicado, 401 con password incorrecta, 200 con token,
  clientes MOSTRADOR/CONSUMIDOR FINAL creados, `GET`/`PUT /user`,
  `uploadCert`).

- [ ] T16. Correr `npx vitest run test/user.test.ts` y confirmar que pasa
  completo contra Postgres. Después correr la suite completa
  (`npm test` o `npx vitest run`) y documentar en este archivo (como nota
  debajo de esta tarea, no arreglarlos) cuáles tests de otros módulos
  (`test/venta.test.ts`, `test/cliente.test.ts`, `test/consignacion.test.ts`,
  `test/venta_consignacion.test.ts`, `test/persona.test.ts` en la parte que
  dependa de un usuario registrado vía el nuevo `POST /user/register`)
  empiezan a fallar por la ruptura de FK MySQL descripta en el plan
  ("Compatibilidad con módulos no migrados") — es la consecuencia esperada
  y aceptada de migrar `user` antes que esos módulos, no un bug de esta
  tarea.
  Nota: NO ejecutado en este entorno. `.env`/`src/env.ts` apuntan
  `PG_HOST=localhost, PG_PORT=5432` — ese puerto en esta máquina sandbox
  corresponde a un Postgres de otro proyecto, no al de este repo, así que no
  se puede correr ningún test contra la base real (ni siquiera para
  confirmar que compila el flujo) sin arriesgar tocar datos ajenos.
  `npx tsc --noEmit` sí corre limpio (ver checkpoint final) y valida T1-T15 a
  nivel de tipos; falta la verificación funcional contra una instancia de
  Postgres real de este proyecto, incluyendo confirmar T15 (que el nuevo
  cleanup borra bien contra `usersTable`/`clientesTable`) y relevar qué
  tests de `venta`/`cliente`/`consignación`/`venta_consignación` rompen por
  la FK de MySQL.

## Checkpoint final
- [x] `npx tsc --noEmit` sin errores
- [ ] Tests relevantes corridos (o motivo documentado de por qué no) — no
  corridos en este entorno, ver nota en T16: no hay Postgres del proyecto
  alcanzable (el puerto 5432 local es de otro proyecto).
- [x] Revisado contra CLAUDE.md (DI, DRY, comentarios, responsabilidad única)
