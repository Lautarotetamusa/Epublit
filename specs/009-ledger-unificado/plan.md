# Plan: Ledger unificado (el movimiento es la transacción)

## Historia

Unificar en un solo ledger **todos** los movimientos de stock: el movimiento ES
la transacción. Las operaciones comerciales (venta, consignación, venta sobre
consignación y devolución) dejan de ser una entidad aparte y pasan a registrarse
como movimientos, con el archivo (comprobante/remito) como campo opcional y los
datos propios de la venta como extensión del movimiento. El stock consignado en
clientes vive en un depósito real propio de cada cliente. Se migra el historial
comercial ya cargado.

## Diseño de API

### El movimiento unificado

No existe una transacción separada de un movimiento: toda operación de stock
—manual o comercial— es **un** movimiento, y el historial es la única fuente de
verdad. Un movimiento tiene:

- `tipo`: uno de `ingreso`, `baja`, `transferencia`, `venta`, `consignacion`,
  `ventaConsignacion`, `devolucion`. Es explícito, no se deduce del par de
  extremos.
- `fecha`.
- `origen` y `destino`, cada uno `{ tipo: "deposito", id, nombre }` o
  `{ tipo: "exterior" }`.
- `libros`: `[ { isbn, titulo, cantidad, precio } ]`. `precio` es el unitario y
  sólo aparece en movimientos comerciales.
- `cliente`: `{ id, nombre }` cuando la operación involucra un cliente; `null`
  en los movimientos manuales.
- `file_path`: URL descargable del archivo emitido (factura, remito o
  comprobante), o `null`.
- `venta`: `{ tipo_cbte, medio_pago, descuento, total }`, o `null`. Es un objeto
  derivado de la extensión de venta (que referencia al movimiento), no un campo
  del movimiento.

Correspondencia tipo ↔ extremos:

| tipo | origen → destino |
| --- | --- |
| ingreso | exterior → depósito |
| baja | depósito → exterior |
| transferencia | depósito → depósito |
| venta | depósito principal → exterior |
| consignacion | depósito principal → depósito del cliente |
| ventaConsignacion | depósito del cliente → exterior |
| devolucion | depósito del cliente → depósito principal |

### Tipos como conjunto cerrado (enum)

El `tipo` de un movimiento y el `tipo` de cada extremo se persisten como
**enumeraciones de Postgres**, nunca como texto libre. El conjunto de valores es
exactamente el definido en este plan: los siete tipos de movimiento para `tipo`
y `deposito`/`exterior` para un extremo. Ningún valor fuera de esos conjuntos
puede llegar a la base. Los movimientos preexistentes migran sus tipos al
conjunto cerrado.

### Cómo se distingue un movimiento de otro

El `tipo` viaja explícito en cada movimiento. Un `depósito → exterior` puede ser
una `baja` manual o una `venta` comercial: se distinguen por `tipo` (la venta
además trae `cliente`, `venta` y `file_path`). El historial no vuelve a deducir
el tipo del par de extremos.

### Extensión de venta

Los datos propios de una venta (`tipo_cbte`, `medio_pago`, `descuento`, `total`)
viven en una tabla de ventas 1:1 que **referencia al movimiento** (guarda el id
del movimiento); la tabla de movimientos **no** tiene ningún campo de venta. En
la respuesta, `venta` es un objeto derivado de esa extensión: presente en `venta`
y `ventaConsignacion`, y `null` en el resto (incluidos los manuales).

El **cliente** de una operación comercial vive, cuando hay venta, junto a la
venta (en su extensión). En `venta`/`ventaConsignacion` el cliente sale de la
extensión de venta; en `consignacion`/`devolucion` (que no tienen venta) se
deriva del extremo que es el depósito del cliente. La tabla de movimientos no
lleva el cliente.

### Archivo opcional (`file_path`)

`file_path` es una URL descargable o `null`. Las **cuatro** operaciones
comerciales (`venta`, `consignacion`, `ventaConsignacion`, `devolucion`) emiten
su archivo (factura / remito / comprobante) y lo adjuntan al movimiento. Los
movimientos manuales (`ingreso`, `baja`, `transferencia`) nunca generan archivo.
Un movimiento sin archivo sigue siendo válido.

### Historial

- `GET /movimiento/?pagina=<n>&porPagina=<n>` — 200 →
  `{ movimientos, total, pagina, porPagina, totalPaginas }`, del más reciente al
  más antiguo, con los movimientos de los siete tipos. Cada movimiento trae sus
  campos completos (extremos con nombre, líneas, cliente, `file_path`, venta).
  `pagina` o `porPagina` no enteros o menores a 1 → 400. Página más allá del
  total → 200 con lista vacía.
- `GET /movimiento/:id` — 200 → el mismo detalle. 404 si no existe o no es del
  usuario.

### Operaciones comerciales

`POST /transaccion/venta|consignacion|ventaConsignacion|devolucion` conservan su
request, response y códigos de status actuales; internamente crean **un**
movimiento unificado (con su tipo, extremos, cliente, líneas con precio,
`file_path` y, cuando aplica, la extensión de venta), no una transacción
separada. `GET /transaccion/:tipo` y `GET /transaccion/:tipo/:id` siguen
respondiendo con la misma forma que hoy (incluido `file_path`), ahora derivados
de los movimientos de ese tipo. El front no cambia.

- **venta**: depósito principal → exterior; deja `venta` y archivo.
- **consignacion**: depósito principal → depósito del cliente; deja archivo
  (remito), congela el precio por libro y no deja `venta`.
- **ventaConsignacion**: depósito del cliente → exterior; vende al precio
  congelado; deja `venta` y archivo.
- **devolucion**: depósito del cliente → depósito principal; deja archivo y
  no deja `venta`.

### Movimientos manuales

`POST /movimiento/` sigue cubriendo sólo ingreso, baja y transferencia, con el
body de 008 (`origen`, `destino`, `libros`) y sus 201/400/404/409. El `tipo` del
movimiento manual se deriva del par de extremos al registrarlo y se persiste
explícito. Nunca trae `cliente`, `file_path` ni `venta`, y no puede usar el
depósito de un cliente (404).

### Depósito de cada cliente

- Cada cliente tiene exactamente un depósito real propio, creado al darlo de
  alta (y por migración para los existentes). Maneja cantidades por libro como
  cualquier otro depósito, pero pertenece al cliente. Su stock **sólo cambia por
  movimientos**.
- No aparece en `GET /deposito/`, no es accesible, editable ni eliminable por
  `/deposito/:id` (404) y no puede ser extremo de un movimiento manual. Se lee a
  través del cliente.
- `GET /cliente/:id/stock` — 200 → el mismo array por libro que consume el front
  hoy (`id_libro`, `isbn`, `titulo`, `precio`, y la cantidad), leído del depósito
  del cliente. 404 si el cliente no existe o no es del usuario. El resumen del
  depósito (títulos/ejemplares) queda derivable del propio array: no se agrega un
  envoltorio que rompa el contrato.
- `PUT /cliente/:id/stock` mantiene su comportamiento actual (re-sincronizar
  precios): nunca edita cantidades ni genera movimientos.

### Stock total y depósitos

- El `stock` total del libro es la suma de sus cantidades en **todos** los
  depósitos, incluidos los de clientes: el stock consignado **sí** cuenta en el
  total. El desglose por depósito incluye los depósitos de clientes, para que el
  total siga siendo la suma del desglose.
- Consignar **no** cambia el total (el stock pasa del depósito principal al
  depósito del cliente) y devolver tampoco; vender en firme y vender sobre
  consignación lo bajan (el stock sale al exterior).

### Atomicidad y rechazos

- Toda operación (manual o comercial) es atómica: se aplica entera o no se
  aplica, y con varios libros queda como un único registro.
- Cuando falta stock en un origen que es depósito, el rechazo es un 409
  identificable, distinto de los 400/404 de la misma operación, con el detalle
  libro por libro: `isbn`, `titulo`, `pedido` y `disponible`.
- Venta y consignación exigen saldo en el depósito principal; venta sobre
  consignación y devolución lo exigen en el depósito del cliente. `exterior` no
  valida saldo.
- Ante un rechazo no cambia ningún stock, no queda el movimiento ni su
  `file_path`, y no se persiste nada parcial.

### Migración del historial

Las transacciones comerciales ya cargadas se reconstruyen como movimientos del
tipo que representan (venta = principal → exterior; consignación = principal →
depósito del cliente; venta sobre consignación = depósito del cliente →
exterior; devolución = depósito del cliente → principal), preservando fecha,
cliente, libros con cantidad y precio, `file_path` y —si la tenían— su extensión
de venta. Los movimientos ya existentes (manuales y los creados por la migración
de 008) se completan con su `tipo` y quedan legibles. La migración del historial
no aplica efecto de stock: sólo reconstruye registros.

Las cantidades consignadas vigentes se trasladan al depósito del cliente
**sin** un movimiento sintético propio: las consignaciones históricas
reconstruidas ya representan ese camino, así que un movimiento de traslado
duplicaría el efecto. Tras migrar, la tabla de transacciones y la de líneas de
transacción **se eliminan**: el ledger unificado es la única fuente.

Correr la migración dos veces no duplica movimientos, líneas, archivos ni
extensiones de venta.

## Tareas

### 1. Depósito propio de cada cliente (nuevos)
Al dar de alta un cliente, el sistema le crea su depósito real propio,
distinguible de los depósitos del usuario.

Criterios de aceptación:
- [ ] `POST /cliente/` deja creado un depósito real propio del cliente sin ninguna acción extra del usuario.
- [ ] Ese depósito no aparece en `GET /deposito/` del usuario.
- [ ] `GET /deposito/:id` con el id de ese depósito devuelve 404.
- [ ] Un cliente recién creado tiene su depósito vacío (sin libros con cantidad mayor a 0).
- [ ] Dar de alta dos clientes crea dos depósitos distintos, uno por cliente.

### 2. Migración de clientes existentes y del stock consignado
Los clientes que ya existían reciben su depósito propio y el stock consignado
vigente se traslada al depósito de cada uno, preservando cantidades y precios
congelados.

Criterios de aceptación:
- [ ] Tras la migración, cada cliente existente tiene exactamente un depósito propio.
- [ ] Por cada libro consignado con cantidad mayor a 0, esa cantidad queda en el depósito de su cliente y deja de leerse del registro de consignación antiguo.
- [ ] La cantidad consignada por cliente y libro no cambia respecto de la previa a la migración (no se pierde ni se duplica).
- [ ] El precio congelado de cada libro consignado por cliente se preserva.
- [ ] El traslado del stock consignado no genera ningún movimiento nuevo en el historial.
- [ ] Correr la migración dos veces no crea un segundo depósito por cliente ni duplica cantidades.

### 3. Separar los depósitos propios de los de clientes
El listado y la administración de depósitos siguen siendo sólo sobre los del
usuario; los depósitos de clientes quedan fuera.

Criterios de aceptación:
- [ ] `GET /deposito/` devuelve únicamente los depósitos propios del usuario, incluido el principal, y nunca un depósito de cliente.
- [ ] `GET /deposito/:id`, `PUT /deposito/:id` y `DELETE /deposito/:id` con el id de un depósito de cliente devuelven 404.
- [ ] `GET /deposito/:id/libros` con el id de un depósito de cliente devuelve 404.
- [ ] El listado y la administración de los depósitos propios no cambian respecto de 008 (resúmenes, principal, reglas de borrado).
- [ ] Un usuario no puede ver ni administrar el depósito de un cliente aunque conozca su id.

### 4. Leer el stock consignado de un cliente sin editar cantidades
`GET /cliente/:id/stock` se lee del depósito del cliente con el shape que ya
consume el front, y las cantidades sólo cambian por movimientos.

Criterios de aceptación:
- [ ] `GET /cliente/:id/stock` devuelve el mismo array por libro que hoy (`id_libro`, `isbn`, `titulo`, `precio` y la cantidad), leído del depósito del cliente.
- [ ] La cantidad devuelta coincide con la del depósito del cliente y cambia tras una consignación, una venta sobre consignación o una devolución.
- [ ] `GET /cliente/:id/stock` con cliente inexistente o de otro usuario devuelve 404.
- [ ] `PUT /cliente/:id/stock` actualiza precios sin cambiar ninguna cantidad ni crear movimientos.
- [ ] No existe ninguna forma de editar directamente una cantidad del depósito de un cliente.

### 5. El movimiento unificado: tipo, cliente, archivo y extensión de venta
El movimiento es la única entidad de historial y expone explícitamente su tipo y
sus datos opcionales.

Criterios de aceptación:
- [ ] Cada movimiento del historial expone `tipo` con uno de los siete valores.
- [ ] Un movimiento comercial expone `cliente` con id y nombre; un movimiento manual lo expone en `null`.
- [ ] Un movimiento comercial expone `file_path` con una URL descargable; un movimiento manual lo expone en `null`.
- [ ] `venta` está presente con `tipo_cbte`, `medio_pago`, `descuento` y `total` sólo en venta y venta sobre consignación; en el resto es `null`.
- [ ] Las líneas de un movimiento comercial exponen su `precio` unitario; las de un manual no lo exponen.
- [ ] Una baja (depósito → exterior) y una venta (depósito principal → exterior) se distinguen por `tipo` en las respuestas.
- [ ] El `tipo` de un movimiento y el `tipo` de cada extremo se almacenan como un conjunto cerrado de valores definido en la base (enum), no como texto libre: no puede existir una fila con un valor fuera de ese conjunto.

### 6. Movimientos manuales con el contrato unificado
`POST /movimiento/` sigue creando ingreso, baja y transferencia, ahora con su
tipo explícito y sin datos comerciales.

Criterios de aceptación:
- [ ] `POST /movimiento/` con origen exterior y destino depósito crea un movimiento de `tipo` `ingreso`.
- [ ] `POST /movimiento/` con origen depósito y destino exterior crea un movimiento de `tipo` `baja`.
- [ ] `POST /movimiento/` entre dos depósitos del usuario crea un movimiento de `tipo` `transferencia`.
- [ ] Los movimientos manuales no exponen `cliente`, `file_path` ni `venta`.
- [ ] Ingreso, baja y transferencia siguen aplicando stock igual que en 008, y `exterior → exterior` u origen igual al destino siguen devolviendo 400.

### 7. La venta es un movimiento unificado
`POST /transaccion/venta` registra un único movimiento de tipo `venta` con los
datos de la venta y su archivo.

Criterios de aceptación:
- [ ] `POST /transaccion/venta` crea un movimiento de `tipo` `venta` con origen el depósito principal y destino exterior.
- [ ] Ese movimiento expone `cliente` (el comprador), `file_path` descargable y datos de `venta`.
- [ ] La cantidad del libro baja en el depósito principal y en el `stock` total del libro.
- [ ] El request, la response y los códigos de status del endpoint no cambian respecto de hoy.
- [ ] Ante stock insuficiente en el principal responde 409 identificable con detalle libro por libro y no queda movimiento ni cambio de stock.

### 8. La consignación es un movimiento unificado con remito
`POST /transaccion/consignacion` registra un único movimiento de tipo
`consignacion` hacia el depósito del cliente.

Criterios de aceptación:
- [ ] `POST /transaccion/consignacion` crea un movimiento de `tipo` `consignacion` con origen el depósito principal y destino el depósito del cliente.
- [ ] Ese movimiento expone el `cliente`, un `file_path` (remito) descargable y `venta` en `null`.
- [ ] La cantidad baja en el principal y sube en el depósito del cliente; el `stock` total del libro no cambia.
- [ ] Queda congelado el precio por libro, y una venta sobre consignación posterior lo usa.
- [ ] El request, la response y los códigos de status del endpoint no cambian respecto de hoy.
- [ ] Ante stock insuficiente en el principal responde 409 identificable y no queda movimiento.

### 9. La venta sobre consignación es un movimiento unificado
`POST /transaccion/ventaConsignacion` registra un único movimiento de tipo
`ventaConsignacion` desde el depósito del cliente al exterior.

Criterios de aceptación:
- [ ] `POST /transaccion/ventaConsignacion` crea un movimiento de `tipo` `ventaConsignacion` con origen el depósito del cliente y destino exterior.
- [ ] Ese movimiento expone `cliente`, `file_path` descargable y datos de `venta`.
- [ ] La cantidad baja en el depósito del cliente y en el `stock` total del libro.
- [ ] Vende al precio congelado en la consignación.
- [ ] El request, la response y los códigos de status del endpoint no cambian respecto de hoy.
- [ ] Ante stock insuficiente en el depósito del cliente responde 409 identificable y no queda movimiento.

### 10. La devolución es un movimiento unificado con archivo
`POST /transaccion/devolucion` registra un único movimiento de tipo
`devolucion` desde el depósito del cliente al principal.

Criterios de aceptación:
- [ ] `POST /transaccion/devolucion` crea un movimiento de `tipo` `devolucion` con origen el depósito del cliente y destino el depósito principal.
- [ ] Ese movimiento expone `cliente` y `file_path` descargable, y `venta` en `null`.
- [ ] La cantidad baja en el depósito del cliente y sube en el principal; el `stock` total del libro no cambia.
- [ ] El request, la response y los códigos de status del endpoint no cambian respecto de hoy.
- [ ] Ante stock insuficiente en el depósito del cliente responde 409 identificable y no queda movimiento.

### 11. Los endpoints comerciales conservan su contrato observable
Los endpoints de las cuatro operaciones siguen iguales para el front, ahora
respaldados por el ledger unificado.

Criterios de aceptación:
- [ ] Los cuatro `POST /transaccion/:tipo` mantienen el mismo request, response y status que hoy.
- [ ] `GET /transaccion/:tipo` sigue listando las operaciones de ese tipo con la forma que consume el front, incluido `file_path`.
- [ ] `GET /transaccion/:tipo/:id` sigue devolviendo el detalle de la operación.
- [ ] Un `:tipo` inválido se rechaza igual que hoy.
- [ ] Cada operación comercial deja un único registro: no conviven una transacción separada y un movimiento para la misma operación.

### 12. Migración del historial comercial existente y baja de las tablas viejas
Las transacciones comerciales ya cargadas se reconstruyen como movimientos
unificados, preservando fecha, libros, cantidades, precios, `file_path` y datos
de venta; después se eliminan las tablas de transacción.

Criterios de aceptación:
- [ ] Cada transacción comercial existente queda como exactamente un movimiento del tipo que representa, con fecha, cliente, libros con cantidad y precio, extremos y `file_path` preservados.
- [ ] Las ventas y ventas sobre consignación existentes quedan con su extensión de venta (`tipo_cbte`, `medio_pago`, `descuento`, `total`) preservada.
- [ ] Las consignaciones y devoluciones existentes quedan sin extensión de venta.
- [ ] Los movimientos ya existentes (manuales y los de la migración de 008) quedan con su `tipo`, sin perder ni duplicar líneas.
- [ ] Los tipos de los movimientos y de sus extremos quedan como un conjunto cerrado (enum) en la base, migrando los valores preexistentes (que hoy son texto libre) sin perderlos.
- [ ] La tabla de transacciones y la de líneas de transacción ya no existen una vez aplicada la migración.
- [ ] Correr la migración dos veces no duplica movimientos, líneas, archivos ni extensiones de venta.
- [ ] La migración no altera cantidades de stock.

### 13. Historial unificado `GET /movimiento/` y `GET /movimiento/:id`
Ambos endpoints exponen todos los movimientos, comerciales y manuales, con sus
extremos, libros y datos opcionales.

Criterios de aceptación:
- [ ] `GET /movimiento/` incluye los siete tipos de movimiento.
- [ ] Cada movimiento del listado trae extremos con nombre, libros con cantidad y, según corresponda, `cliente`, `file_path` y `venta`.
- [ ] Un extremo que es el depósito de un cliente aparece como `deposito` con el nombre del depósito del cliente.
- [ ] El listado sigue paginado como hoy (`pagina`, `porPagina`, `total`, `totalPaginas`), del más reciente al más antiguo.
- [ ] `GET /movimiento/:id` devuelve el mismo detalle; con id inexistente o de otro usuario devuelve 404.
- [ ] `pagina` o `porPagina` no enteros o menores a 1 devuelven 400, y un usuario no ve movimientos de otro.

### 14. Atomicidad y rechazo identificable por stock insuficiente
Operaciones manuales y comerciales siguen siendo atómicas y rechazan el stock
insuficiente con detalle libro por libro.

Criterios de aceptación:
- [ ] Un movimiento con varios libros se aplica entero o no se aplica.
- [ ] Ante stock insuficiente en un origen que es depósito, la respuesta es 409 con un error propio distinto de los 400 y 404, e incluye `isbn`, `titulo`, `pedido` y `disponible` por cada libro que no alcanza.
- [ ] Venta y consignación rechazan por stock insuficiente en el principal; venta sobre consignación y devolución, en el depósito del cliente.
- [ ] Ante un rechazo no cambia ningún stock y no queda el movimiento ni su `file_path`.
- [ ] Un origen `exterior` no valida saldo.
- [ ] Toda operación válida con varios libros queda como un único registro y devuelve 201 una sola vez.

### 15. Legibilidad con cliente o depósito dado de baja
Dar de baja un cliente o un depósito propio no rompe el historial que los
menciona.

Criterios de aceptación:
- [ ] Dar de baja un cliente no elimina ni altera su depósito ni las cantidades que quedaron en él.
- [ ] Los movimientos históricos que mencionan el depósito de un cliente dado de baja siguen mostrando el nombre del depósito (no un identificador suelto).
- [ ] Dar de baja un depósito propio no rompe los movimientos históricos que lo mencionan: siguen mostrando su nombre.
- [ ] El depósito de un cliente dado de baja sigue sin aparecer en `GET /deposito/`.

### 16. El stock total del libro cuenta el consignado en clientes
El `stock` total de un libro es la suma de sus cantidades en todos sus
depósitos, incluidos los de clientes, y el desglose por depósito los incluye.

Criterios de aceptación:
- [ ] `GET /libro/:isbn` informa `stock` igual a la suma de las cantidades del libro en todos sus depósitos, incluidos los de clientes.
- [ ] `GET /libro` y `GET /libro/lista_libros` informan ese mismo total.
- [ ] El desglose de un libro incluye, por cada depósito de cliente con cantidad mayor a 0, su nombre y cantidad, de modo que `stock` siga siendo la suma del desglose.
- [ ] Una consignación no cambia el `stock` total; una devolución tampoco; una venta en firme y una venta sobre consignación lo bajan.
- [ ] El depósito de un cliente no aparece en `GET /deposito/`, pero su stock sí cuenta en el total del libro.
