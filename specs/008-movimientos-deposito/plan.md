# Plan: Mover libros entre depósitos

## Historia

Poder administrar depósitos y mover cantidades de libros mediante
movimientos. El stock de un libro existe sólo como cantidad por depósito (el
stock total es la suma) y **sólo se crea o modifica con un movimiento**: no
hay edición directa de stock. Cada usuario tiene un depósito principal creado
solo y un movimiento es atómico.

## Diseño de API

### Modelo de stock

- El libro **no** tiene stock propio. La única fuente de stock es la cantidad
  de cada libro en cada depósito.
- **Ningún endpoint permite setear stock directamente.** Todo cambio de stock
  pasa por un movimiento (ingreso, baja o transferencia). La única excepción
  son las cuatro operaciones existentes (venta, consignación,
  venta-consignación, devolución), que se detallan más abajo.
- `stock` sigue apareciendo en las respuestas de libro (`GET /libro`,
  `GET /libro/:isbn`, `GET /libro/lista_libros`) como **total calculado**:
  la suma de las cantidades del libro en los depósitos del usuario. Es sólo
  lectura y vale 0 si el libro no tiene stock en ningún depósito.
- `POST /libro/` y `PUT /libro/:isbn` **rechazan** (400) un body con un campo
  de stock: el stock ya no es un dato editable del libro.

### Depósito principal

- Cada usuario tiene exactamente un depósito principal, creado automáticamente
  al registrarse. Existe para todo usuario, incluidos los que ya existían antes
  de esta historia.
- No se puede eliminar ni convertir a/desde depósito común.
- Todo el stock existente del usuario pasa a vivir en su depósito principal
  (ver migración en las tareas).
- Su nombre es el que exponen las ayudas de los formularios de venta,
  consignación y devolución; se obtiene del listado de depósitos (la entrada
  con `principal` en `true`).

### Depósitos

Cada depósito se representa como
`{ id, nombre, descripcion, principal, titulos, ejemplares }`, donde
`titulos` es la cantidad de libros distintos con cantidad mayor a 0 y
`ejemplares` es la suma de sus cantidades.

- `POST /deposito/` — body `{ "nombre": string, "descripcion": string|null }`.
  `nombre` obligatorio. Crea un depósito **no** principal. 201 con el depósito.
  400 si falta `nombre`.
- `GET /deposito/` — 200 → lista de depósitos del usuario, incluido el
  principal, cada uno con su resumen de `titulos` y `ejemplares`.
- `GET /deposito/:id` — 200 → depósito con su resumen. 404 si no existe o no es
  del usuario.
- `PUT /deposito/:id` — body `{ "nombre", "descripcion" }`. 200 → actualizado.
  400 si falta `nombre`. 404.
- `DELETE /deposito/:id` —
  - 204 si se elimina (depósito común sin stock).
  - 409 con un error propio e identificable si todavía tiene stock, incluyendo
    `ejemplares` y `titulos` que lo bloquean (para que la pantalla pueda
    mostrar "N ejemplares en M títulos").
  - 403 con un error propio **distinto** del 409 si es el principal, aunque
    además tenga stock.
  - 404 si no existe o no es del usuario.

El flag `principal` no es editable por API: ni `POST /deposito/` ni
`PUT /deposito/:id` permiten marcarlo o desmarcarlo.

### Consulta de stock por depósito

- `GET /deposito/:id/libros` — 200 → `{ deposito, libros: [ { isbn, titulo,
  cantidad } ] }`, sólo libros con cantidad mayor a 0.
- `GET /libro/:isbn/depositos` — 200 → `{ isbn, total, depositos: [ { id,
  nombre, cantidad } ] }`. 404 si el libro no existe.

### Movimientos

Un movimiento tiene un **origen y un destino tipados**. Cada extremo es
`{ "tipo": "deposito" | "exterior", "id": <id> }`:

- `tipo: "deposito"` → `id` obligatorio, identifica el depósito concreto.
- `tipo: "exterior"` → sin `id` (representa "afuera del sistema").
- El tipo `cliente` queda reservado para una historia futura: si llega, 400.

Casos que cubre:
- **Ingreso** (`exterior` → `deposito`): crea stock y suma la cantidad al
  depósito destino. No valida saldo en el origen.
- **Baja / ajuste negativo** (`deposito` → `exterior`): exige que el depósito
  origen tenga la cantidad suficiente y se la resta.
- **Transferencia** (`deposito` → `deposito`): resta del origen y suma al
  destino, exigiendo saldo suficiente en el origen.
- `exterior` → `exterior` es inválido (400): no tiene efecto.

Endpoints:
- `POST /movimiento/` — body
  `{ "origen": { "tipo", "id"? }, "destino": { "tipo", "id"? }, "libros":
  [ { "isbn", "cantidad" } ] }`.
  201 → `{ id, fecha, origen: { tipo, id?, nombre? }, destino: { tipo, id?,
  nombre? }, libros: [ { isbn, titulo, cantidad } ] }`.
- `GET /movimiento/?pagina=<n>&porPagina=<n>` — 200 → `{ movimientos: [...],
  total, pagina, porPagina, totalPaginas }`, del más reciente al más antiguo.
  Por defecto `pagina=1`; valores de página o tamaño inválidos (no enteros o
  menores a 1) devuelven 400. Cada movimiento del listado ya incluye sus
  libros.
- `GET /movimiento/:id` — 200 → detalle con sus libros. 404.

Códigos de `POST /movimiento/`:
- 400: falta `origen`, `destino` o `libros`; `libros` vacío; alguna `cantidad`
  <= 0 o no entera; algún tipo distinto de `deposito`/`exterior` (incluido
  `cliente`); `deposito` sin `id`; `exterior` con `id`; `exterior` → `exterior`;
  origen y destino iguales (mismo tipo y mismo identificador); mismo `isbn`
  repetido en la lista.
- 404: algún extremo `deposito` o algún libro inexistente o de otro usuario.
- 409 con un error propio e identificable de "stock insuficiente", **distinto**
  del resto de los errores de la operación, y con el detalle libro por libro:
  por cada libro que no alcanza, `isbn`, `titulo`, `pedido` y `disponible`
  (cuánto se pidió y cuánto había en el origen). No se persiste ningún cambio
  de stock ni el movimiento.

Reglas comunes:

- Todo scopeado al usuario autenticado.
- Un movimiento no altera el precio del libro.
- Un movimiento es atómico: se aplican todos los libros de la lista o ninguno.
- La validación de stock suficiente sólo aplica cuando el origen es un
  depósito; `exterior` no tiene saldo.

### Depósitos eliminados y movimientos históricos

Un movimiento histórico sigue siendo legible después de eliminar un depósito
que menciona: su extremo `deposito` sigue mostrando el **nombre** del depósito
(el historial nunca devuelve un identificador suelto sin nombre).

### Operaciones existentes (venta, consignación, venta-consignación, devolución)

Siguen funcionando exactamente como hoy (mismos endpoints, validaciones,
signos y comprobantes), pero su efecto de stock ahora se aplica sobre el
**depósito principal** en lugar de una columna de stock global del libro. La
consignación en poder de clientes sigue siendo un mundo aparte que no se toca.
Para que sus formularios no ofrezcan de más, cada libro expone además
`disponible_principal` (ver tareas).

## Ambigüedad

- **El ledger queda incompleto.** En esta historia sólo los movimientos
  (ingreso, baja y transferencia) quedan registrados en el historial. Las
  cuatro operaciones existentes ya afectan el depósito principal, pero todavía
  no registran su movimiento; una historia futura tiene que migrarlas para que
  el ledger unificado esté completo. Hasta entonces, `GET /movimiento/` no
  refleja ventas, consignaciones ni devoluciones.
- **Corrección de stock cargado mal.** Como no hay edición directa de stock, la
  única forma de corregir un saldo es un movimiento de ajuste: un ingreso
  (`exterior` → depósito) para sumar o una baja (depósito → `exterior`) para
  restar.
- **Depósito eliminado con historial.** El contrato nuevo exige que el nombre
  siga siendo legible en los movimientos históricos. Se puede resolver con baja
  lógica (o guardando el nombre en el movimiento); el plan no bloquea el
  borrado por tener historial. Si se prefiere, en cambio, bloquear el borrado
  cuando hay historial, avisar antes de implementar.
- **Front.** El front de esta historia ya está aprobado y diseñado
  (`design.md`); las pantallas de venta/consignación/devolución usan el
  `disponible_principal` de cada libro y el nombre del principal del listado de
  depósitos.
- **Consignación en clientes.** Decisión cerrada: el stock consignado en
  clientes es un mundo aparte y no forma parte del stock del libro ni de sus
  depósitos; esta historia no lo modifica ni lo agrega al total del libro.
- **Status del borrado del depósito principal.** Se eligió 403 con un error
  propio, distinguible del 409 de "tiene stock". Si se prefiere otro código o
  un error tipado en el body, ajustar antes de implementar.
- **Precio por depósito.** Se mantiene el precio global del libro; no se agrega
  precio por depósito.
- **Alta/edición de libro.** Al desaparecer el stock como dato del libro, el
  endpoint de libro rechaza ese campo (el front ya quitó el input).

## Tareas

### 1. Depósito principal automático al registrar usuarios nuevos
Al dar de alta un usuario, el sistema le crea su depósito principal.

Criterios de aceptación:
- [ ] Registrar un usuario nuevo deja creado su depósito principal sin ninguna acción extra del usuario.
- [ ] `GET /deposito/` de un usuario recién registrado incluye exactamente un depósito con `principal` en `true`.
- [ ] Un depósito principal no se puede convertir en común ni uno común en principal mediante `POST /deposito/` ni `PUT /deposito/:id`.
- [ ] El flag `principal` es de sólo lectura en las respuestas (no se puede marcar/desmarcar desde la API).

### 2. Migrar a usuarios y stock existentes
Los usuarios que ya existían reciben su depósito principal y el stock global
vigente de cada libro se traslada a ese depósito como un movimiento de ingreso
desde `exterior`, sin perderse ni duplicarse.

Criterios de aceptación:
- [ ] Tras la migración, cada usuario existente tiene exactamente un depósito principal.
- [ ] Por cada libro que tenía stock global mayor a 0, queda registrado un movimiento de ingreso (`exterior` → depósito principal) con esa cantidad.
- [ ] La cantidad de cada libro en el depósito principal de su usuario es igual al stock global que ese libro tenía antes de la migración.
- [ ] El `stock` total informado por los endpoints de libro no cambia respecto al valor previo a la migración.
- [ ] Un usuario existente sin libros obtiene su depósito principal vacío y sin movimientos de migración.
- [ ] Correr la migración dos veces no crea un segundo depósito principal, ni duplica movimientos, ni duplica cantidades.

### 3. Alta y listado de depósitos con resumen
`POST /deposito/` crea un depósito común del usuario y `GET /deposito/` lista
los suyos, incluido el principal, con cuántos títulos y ejemplares tiene cada
uno.

Criterios de aceptación:
- [ ] `POST /deposito/` con `nombre` y `descripcion` devuelve 201 con `id`, `nombre`, `descripcion` y `principal` en `false`.
- [ ] `POST /deposito/` con `descripcion` ausente o `null` no falla y devuelve `descripcion` en `null`.
- [ ] `POST /deposito/` sin `nombre` (o vacío) devuelve 400.
- [ ] `GET /deposito/` devuelve únicamente los depósitos del usuario autenticado: un segundo usuario no ve los del primero.
- [ ] `GET /deposito/` siempre incluye al menos el depósito principal del usuario.
- [ ] Cada depósito de `GET /deposito/` informa `titulos` (libros distintos con cantidad mayor a 0) y `ejemplares` (suma de sus cantidades).
- [ ] Un depósito sin stock informa `titulos` en 0 y `ejemplares` en 0.
- [ ] `GET /deposito/:id` informa esos mismos resúmenes del depósito.
- [ ] Los resúmenes reflejan el stock actual: cambian después de un movimiento que afecta al depósito.

### 4. Editar y eliminar depósitos
`PUT /deposito/:id` actualiza un depósito y `DELETE /deposito/:id` lo elimina
sólo si no es el principal y no tiene stock, con rechazos identificables y con
cifras.

Criterios de aceptación:
- [ ] `PUT /deposito/:id` cambia `nombre` y `descripcion` y devuelve 200 con los valores nuevos.
- [ ] `PUT /deposito/:id` sin `nombre` devuelve 400.
- [ ] `PUT /deposito/:id` con id inexistente o de otro usuario devuelve 404.
- [ ] `DELETE /deposito/:id` de un depósito común sin stock devuelve 204 y deja de aparecer en `GET /deposito/`.
- [ ] `DELETE /deposito/:id` de un depósito común con stock devuelve 409 con un error propio que incluye cuántos `ejemplares` y `titulos` lo bloquean, y el depósito sigue existiendo con su stock intacto.
- [ ] `DELETE /deposito/:id` del depósito principal devuelve 403 con un error propio distinguible del 409 de "tiene stock", aunque el principal tenga stock; el depósito sigue existiendo.
- [ ] Tras eliminar un depósito común, los movimientos históricos que lo mencionan siguen mostrando su nombre (no un identificador suelto).
- [ ] `DELETE /deposito/:id` con id inexistente o de otro usuario devuelve 404.

### 5. El stock del libro pasa a ser el total de sus depósitos
El stock de un libro se lee como la suma de sus cantidades en depósitos, deja
de ser un dato editable del libro y sólo cambia por movimientos (o por las
operaciones existentes de la tarea 11).

Criterios de aceptación:
- [ ] `GET /libro/:isbn` informa `stock` igual a la suma de las cantidades del libro en todos los depósitos del usuario.
- [ ] Un libro sin cantidad en ningún depósito informa `stock` en 0.
- [ ] `GET /libro` y `GET /libro/lista_libros` informan ese mismo total por libro.
- [ ] El `stock` de un libro sólo cambia por movimientos (ingreso, baja o transferencia sobre sus depósitos) o por las operaciones existentes; no existe ningún endpoint que lo modifique de forma directa.
- [ ] Una transferencia entre depósitos del mismo usuario no cambia el `stock` total del libro.
- [ ] `POST /libro/` con un campo de stock en el body devuelve 400.
- [ ] `PUT /libro/:isbn` con un campo de stock en el body devuelve 400.

### 6. Consultar el stock de los libros por depósito
`GET /deposito/:id/libros` lista los libros con stock en un depósito y
`GET /libro/:isbn/depositos` da el desglose de un libro entre depósitos.

Criterios de aceptación:
- [ ] `GET /deposito/:id/libros` devuelve cada libro con cantidad mayor a 0 en ese depósito, con su `isbn`, `titulo` y `cantidad` exacta, sin depender de traer el catálogo entero.
- [ ] Un libro sin registro en ese depósito no aparece en `GET /deposito/:id/libros`.
- [ ] `GET /libro/:isbn/depositos` devuelve, para cada depósito donde el libro tenga cantidad mayor a 0, su `id`, `nombre` y `cantidad`.
- [ ] `GET /libro/:isbn/depositos` de un libro sin stock en ningún depósito devuelve 200 con lista vacía y total 0.
- [ ] `GET /deposito/:id/libros` y `GET /libro/:isbn/depositos` con depósito o libro inexistente o de otro usuario devuelven 404.

### 7. Disponible del libro en el depósito principal
Cada libro expone cuánto tiene en el depósito principal, además del total, para
que los formularios de venta en firme, consignación y devolución no ofrezcan de
más.

Criterios de aceptación:
- [ ] `GET /libro/:isbn` informa `disponible_principal` igual a la cantidad del libro en el depósito principal del usuario.
- [ ] `GET /libro` y `GET /libro/lista_libros` informan ese mismo `disponible_principal` por libro.
- [ ] Un libro sin stock en el depósito principal informa `disponible_principal` en 0.
- [ ] `disponible_principal` es distinto del `stock` total cuando el libro tiene stock en más de un depósito.
- [ ] `disponible_principal` cambia cuando una operación existente (venta/consignación/devolución) o un movimiento afecta al depósito principal.
- [ ] El nombre del depósito principal está disponible en `GET /deposito/` (la entrada con `principal` en `true`).

### 8. Registrar un movimiento (ingreso, baja o transferencia)
`POST /movimiento/` aplica un movimiento con origen y destino tipados
(`deposito`/`exterior`) y devuelve el movimiento creado.

Criterios de aceptación:
- [ ] Un ingreso (`exterior` → `deposito`) con cantidad N sobre un depósito sin stock deja al libro con cantidad N en ese depósito, y devuelve 201 con `id`, `fecha`, `origen`, `destino` y la lista de libros movidos.
- [ ] Un ingreso sobre un depósito que ya tenía stock le suma N (no reemplaza).
- [ ] Un ingreso no falla por falta de saldo en el origen aunque el depósito destino esté vacío.
- [ ] Una baja (`deposito` → `exterior`) con cantidad N disponible resta N del depósito origen; si queda en 0, el libro ya no aparece con stock en ese depósito.
- [ ] Una transferencia (`deposito` → `deposito`) baja N del origen y sube N en el destino; si el destino no tenía registro, queda con N.
- [ ] Un ingreso o una baja cambian el `stock` total del libro; una transferencia no.
- [ ] El precio del libro no cambia por ningún movimiento.
- [ ] `exterior` → `exterior` devuelve 400.
- [ ] Origen y destino iguales (mismo tipo y mismo identificador) devuelven 400.
- [ ] Un extremo de tipo `cliente` devuelve 400.
- [ ] Un extremo `deposito` sin `id` devuelve 400; un extremo `exterior` con `id` devuelve 400.
- [ ] `libros` vacío o ausente devuelve 400.
- [ ] Alguna `cantidad` menor o igual a 0, o no entera, devuelve 400.
- [ ] El mismo `isbn` repetido dos veces en la lista devuelve 400.
- [ ] Un extremo `deposito` o algún libro inexistente o de otro usuario devuelve 404.
- [ ] Un usuario no puede mover stock usando depósitos o libros de otro usuario.

### 9. Garantizar atomicidad y rechazo con detalle por libro
Un movimiento con varios libros se aplica entero o no se aplica, y cuando falta
stock el rechazo es identificable y dice, libro por libro, cuánto se pidió y
cuánto había.

Criterios de aceptación:
- [ ] Si el origen es un depósito y algún libro de la lista no tiene cantidad suficiente, la respuesta es 409 con un error propio distinto de los 400 y 404 de la misma operación.
- [ ] El cuerpo de ese 409 incluye, por cada libro que no alcanza, `isbn`, `titulo`, `pedido` y `disponible`.
- [ ] Si el origen es `exterior`, no hay validación de saldo: un ingreso siempre se acepta (con cantidad válida).
- [ ] Ante un 409 por stock, ningún depósito cambia: origen y destino quedan igual que antes para todos los libros de la lista, incluidos los que sí tenían stock suficiente.
- [ ] Ante un 409 por stock, no queda ningún movimiento nuevo consultable en el historial.
- [ ] Un movimiento con varios libros donde todos tienen stock suficiente aplica todos en una sola operación y devuelve 201 una sola vez.
- [ ] Intentar una baja o transferencia mayor a la disponible sobre un origen ya vacío devuelve 409 con `pedido` y `disponible` del libro y el origen no queda con cantidad negativa.

### 10. Historial de movimientos paginable
`GET /movimiento/` y `GET /movimiento/:id` exponen los movimientos realizados
por el usuario (ingresos, bajas y transferencias), del más reciente al más
antiguo y paginados, con los libros incluidos en el listado.

Criterios de aceptación:
- [ ] `GET /movimiento/?pagina=N&porPagina=M` devuelve una página de movimientos del usuario autenticado, del más reciente al más antiguo, con `total`, `pagina`, `porPagina` y `totalPaginas`.
- [ ] Cada movimiento del listado ya incluye sus libros (con título y cantidad): el detalle de una fila no requiere una segunda consulta.
- [ ] Cada extremo `deposito` del listado incluye el `nombre` del depósito además de su identificador.
- [ ] Si el depósito de un movimiento fue eliminado, el movimiento sigue mostrando su nombre.
- [ ] Pedir una página más allá del total devuelve 200 con la lista vacía.
- [ ] `pagina` o `porPagina` no enteros o menores a 1 devuelven 400.
- [ ] Un usuario no ve movimientos de otro usuario.
- [ ] `GET /movimiento/:id` devuelve el detalle del movimiento con sus libros y cantidades.
- [ ] `GET /movimiento/:id` con id inexistente o de otro usuario devuelve 404.

### 11. Las operaciones existentes aplican su efecto al depósito principal
Venta, consignación, venta-consignación y devolución mantienen su lógica y
comprobantes, pero su efecto de stock se ve ahora en el depósito principal, y
sus formularios se apoyan en `disponible_principal`.

Criterios de aceptación:
- [ ] Una venta reduce la cantidad del libro vendido en el depósito principal en la cantidad vendida, y falla por stock insuficiente en los mismos casos que hoy.
- [ ] Una consignación reduce la cantidad del libro en el depósito principal en la cantidad consignada (por eso también baja el `stock` total del libro); el stock que queda en poder del cliente no se suma al total del libro, sigue siendo un mundo aparte.
- [ ] Una venta-consignación **no** modifica el depósito principal (igual que hoy no tocaba el stock general): sólo descuenta del stock consignado del cliente.
- [ ] Una devolución aumenta la cantidad del libro en el depósito principal (y por eso sube también el `stock` total del libro).
- [ ] El `stock` total informado por los endpoints de libro refleja el efecto de estas operaciones (baja en venta y consignación, sube en devolución, no cambia en venta-consignación).
- [ ] `disponible_principal` de cada libro refleja el efecto de estas operaciones sobre el principal.
- [ ] Los endpoints, las validaciones, los signos y los comprobantes de las cuatro operaciones no cambian, y ninguna de ellas depende de un endpoint de edición directa de stock.
