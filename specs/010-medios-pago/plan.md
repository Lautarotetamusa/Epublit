# Plan: Medios de pago por cuenta

## Historia

Hoy el medio de pago es un valor fijo (efectivo, debito, credito, mercadopago,
transferencia) embebido en la venta y `GET /venta/medios_pago` devuelve esa
lista hardcodeada. Se quiere que cada cuenta tenga sus propios medios de pago
(nombre + comisión), con los 5 actuales como defaults, y poder agregar,
editar y dar de baja. La comisión se descuenta del total para mostrar el neto,
y queda congelada en la venta al momento de vender.

## Diseño de API

### Medios de pago de la cuenta

- `GET /medio_pago/` → `200` → `[ { id, nombre, comision } ]` — sólo los
  medios **activos** de la cuenta autenticada.
- `POST /medio_pago/` — body `{ nombre, comision? }` → `201` →
  `{ id, nombre, comision }`. Si `comision` se omite, vale `0`.
- `PUT /medio_pago/:id` — body `{ nombre?, comision? }` → `200` →
  `{ id, nombre, comision }`.
- `DELETE /medio_pago/:id` — **baja lógica** (no se borra) → `200`.
- `GET /venta/medios_pago` → `200` → el mismo listado de medios de la cuenta
  que `GET /medio_pago/` (los formularios de venta siguen consumiendo este
  endpoint, ahora con los medios reales de la cuenta).

Errores:

- `400` nombre vacío / sólo espacios, o comisión fuera de `[0, 100]`.
- `409` nombre ya usado por otro medio **activo** de la cuenta.
- `404` id inexistente, de otra cuenta, o ya dado de baja.

### Venta

- `POST /transaccion/venta` y `POST /transaccion/ventaConsignacion`: el campo
  `medio_pago` del request pasa a ser el **id** del medio de la cuenta (antes
  era el valor fijo). `400` si falta o es inválido; `404` si el medio es
  inexistente, de otra cuenta o está dado de baja.
- Al vender se guarda la **comisión vigente** del medio en ese momento
  (snapshot). El **neto no se persiste**: se calcula como
  `total − (comision / 100) · total` a partir de la comisión guardada.
- En las respuestas (listado, ficha, detalle de movimiento con venta), el
  objeto `venta` pasa a:
  `{ tipo_cbte, medio_pago: { id, nombre, comision }, descuento, total, neto }`.
  El `nombre` se lee del medio (renombrarlo cambia lo que muestran las ventas
  ya hechas, y sigue siendo legible aunque el medio esté dado de baja); lo
  único que queda congelado es la `comision` guardada al vender.
- `GET /venta?medioPago=<id>` filtra por el medio de la cuenta (incluye los
  dados de baja, para poder filtrar historial); `400` si el valor no es un
  medio de la cuenta.

## Tareas

### 1. Medios de pago por defecto al registrar una cuenta
Cada cuenta nueva arranca con los 5 medios actuales, todos con comisión 0.

Criterios de aceptación:
- [ ] Al registrar una cuenta nueva quedan exactamente 5 medios activos: efectivo, debito, credito, mercadopago y transferencia.
- [ ] Los 5 medios por defecto de una cuenta nueva tienen comisión 0.
- [ ] Los medios de una cuenta nunca aparecen al operar con otra cuenta.

### 2. Medios por defecto para las cuentas existentes (migración)
Las cuentas ya cargadas reciben los mismos 5 medios por defecto al aplicar la migración.

Criterios de aceptación:
- [ ] Tras aplicar la migración, cada cuenta existente tiene los 5 medios por defecto, todos con comisión 0.
- [ ] Ninguna cuenta existente queda sin medios.
- [ ] Correr la migración dos veces no duplica medios en ninguna cuenta.

### 3. Re-apuntar las ventas históricas al medio de la cuenta (migración)
Cada venta ya cargada pasa de referenciar el valor fijo a referenciar el medio de su cuenta, guardando la comisión vigente en ese momento.

Criterios de aceptación:
- [ ] Cada venta histórica con medio queda ligada al medio de su cuenta con el mismo nombre que tenía el valor fijo anterior.
- [ ] Cada venta histórica queda con una comisión guardada de 0% (los medios por defecto tienen esa comisión).
- [ ] El nombre del medio de una venta histórica sigue siendo legible después de migrar.
- [ ] Los datos de la venta (total, descuento, tipo de comprobante, cliente, líneas) no cambian con la migración.
- [ ] Una venta nueva ya no puede tomar un valor del conjunto fijo anterior: los medios sólo salen de los de la cuenta.
- [ ] Correr la migración dos veces no duplica ni pierde ventas ni referencias de medio.

### 4. Listar los medios de la cuenta
La cuenta puede ver sus medios activos, que es lo que consumen los formularios de venta.

Criterios de aceptación:
- [ ] `GET /medio_pago/` devuelve sólo los medios activos de la cuenta, cada uno con id, nombre y comisión.
- [ ] Un medio dado de baja no aparece en `GET /medio_pago/`.
- [ ] `GET /venta/medios_pago` devuelve el mismo listado de medios de la cuenta que `GET /medio_pago/`.
- [ ] `GET /medio_pago/` de un usuario nunca incluye medios de otra cuenta.
- [ ] Una cuenta recién creada lista sus 5 medios por defecto.

### 5. Crear un medio de pago
Agregar un medio nuevo con nombre y comisión, con las validaciones del contrato.

Criterios de aceptación:
- [ ] `POST /medio_pago/` con nombre y comisión válidos devuelve 201 con el medio creado (id, nombre y comisión).
- [ ] El medio creado queda disponible para vender y aparece en `GET /medio_pago/`.
- [ ] `POST /medio_pago/` sin nombre, o con nombre vacío o sólo espacios, devuelve 400.
- [ ] `POST /medio_pago/` con comisión menor a 0 o mayor a 100 devuelve 400.
- [ ] `POST /medio_pago/` sin comisión crea el medio con comisión 0.
- [ ] `POST /medio_pago/` con un nombre ya usado por un medio activo de la cuenta devuelve 409.
- [ ] `POST /medio_pago/` con un nombre igual al de un medio dado de baja de la misma cuenta devuelve 201.
- [ ] Un usuario no puede crear medios en la cuenta de otro.

### 6. Editar un medio de pago
Cambiar nombre y/o comisión de un medio activo de la cuenta.

Criterios de aceptación:
- [ ] `PUT /medio_pago/:id` con nombre y/o comisión válidos devuelve 200 con el medio actualizado.
- [ ] Editar el nombre a vacío o sólo espacios devuelve 400; a un nombre ya usado por otro medio activo devuelve 409.
- [ ] Editar la comisión a un valor fuera de `[0, 100]` devuelve 400.
- [ ] Editar la comisión de un medio no altera la comisión guardada ni el neto de las ventas ya hechas.
- [ ] `PUT /medio_pago/:id` con id inexistente, de otra cuenta o de un medio dado de baja devuelve 404.

### 7. Dar de baja un medio de pago (baja lógica)
El medio deja de estar disponible para vender pero no se pierde del historial.

Criterios de aceptación:
- [ ] `DELETE /medio_pago/:id` da de baja el medio y devuelve 200.
- [ ] Tras la baja, el medio no aparece en `GET /medio_pago/` ni en `GET /venta/medios_pago`.
- [ ] La baja no se bloquea aunque el medio esté usado por ventas existentes.
- [ ] Las ventas históricas que usan ese medio siguen mostrando su nombre.
- [ ] `DELETE /medio_pago/:id` con id inexistente, de otra cuenta o ya dado de baja devuelve 404.

### 8. Registrar una venta con el medio de la cuenta y guardar la comisión vigente
La venta apunta al medio de la cuenta y congela la comisión al momento de vender.

Criterios de aceptación:
- [ ] `POST /transaccion/venta` y `POST /transaccion/ventaConsignacion` reciben el id del medio de la cuenta y la venta queda ligada a ese medio.
- [ ] La venta guarda la comisión que el medio tenía al momento de vender.
- [ ] `POST /transaccion/venta` sin medio de pago devuelve 400.
- [ ] `POST /transaccion/venta` con un medio inexistente, de otra cuenta o dado de baja devuelve 404.
- [ ] Una venta con un medio por defecto (p.ej. efectivo) funciona igual que con cualquier otro medio.
- [ ] El resto del request, la response y los códigos de status de la venta no cambian (cliente, líneas, total, descuento, tipo de comprobante y archivo siguen igual).

### 9. El neto de la venta se calcula con la comisión guardada
El neto que le queda al usuario surge del total y de la comisión congelada en la venta, sin persistirse aparte.

Criterios de aceptación:
- [ ] El neto de una venta es igual a total − (comisión guardada / 100) · total.
- [ ] Con comisión 0 el neto es igual al total.
- [ ] Cambiar la comisión del medio después de vender no altera el neto de esa venta.
- [ ] El neto no se guarda como dato propio de la venta: siempre se deriva del total y de la comisión guardada.

### 10. Listado y filtro de ventas por medio
El listado expone el nombre del medio y el neto, y se puede filtrar por el medio de la cuenta.

Criterios de aceptación:
- [ ] El listado de ventas expone, por venta, el nombre del medio y el neto.
- [ ] `GET /venta?medioPago=<id>` devuelve sólo las ventas de ese medio de la cuenta.
- [ ] El filtro también encuentra ventas cuyo medio está dado de baja.
- [ ] `GET /venta?medioPago=<valor que no es un medio de la cuenta>` devuelve 400.
- [ ] Los demás filtros (cliente, tipo, fechas) y la paginación siguen funcionando igual.

### 11. Ficha de la venta y detalle del movimiento con venta
Las vistas de detalle siguen mostrando el medio y el neto.

Criterios de aceptación:
- [ ] La ficha de una venta (`GET /transaccion/venta/:id`) expone el nombre del medio y el neto.
- [ ] El detalle de un movimiento con venta (`GET /movimiento/:id`) expone el medio (nombre) y el neto dentro de los datos de la venta.
- [ ] La ficha de una venta histórica cuyo medio fue dado de baja sigue mostrando el nombre del medio.
- [ ] El resto de los campos de la ficha y del detalle no cambian.

### 12. Dashboard y comprobante
El agrupamiento del dashboard y el comprobante emitido siguen mostrando el medio por su nombre.

Criterios de aceptación:
- [ ] El dashboard sigue agrupando las ventas por medio, usando el nombre del medio de cada venta.
- [ ] El comprobante emitido sigue mostrando el medio de pago, con el nombre del medio.
- [ ] Ni el dashboard ni el comprobante se rompen con ventas cuyo medio fue dado de baja.
