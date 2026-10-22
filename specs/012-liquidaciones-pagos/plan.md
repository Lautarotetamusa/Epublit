# Plan: Liquidaciones con pagos, anticipos y reimpresiones

## Historia

La liquidación deja de ser un reporte calculado al vuelo y pasa a ser una entidad
persistida con estado (pendiente / parcial / pagada), que se genera, se paga en
partes (monto + fecha + nota, sin medio de pago) y se puede anular. Un
autor/ilustrador/rol cobra un anticipo al lanzarse un libro; una **reimpresión** (una
nueva incorporación de stock, exterior → depósito principal) **no** genera otro
anticipo. El anticipo está **separado** de las regalías: no se descuenta ni se
recupera. La misma venta no se puede liquidar dos veces.

## Diseño de API

Todas las respuestas son por cuenta: nunca se ven ni se tocan datos de otra cuenta.
Las escrituras usan el sobre estándar del proyecto. La ruta del reporte actual
(`GET /liquidacion`, la única que el front llama hoy) **se conserva**; la nueva
entidad persistida vive bajo `/liquidaciones`.

El lanzamiento y las reimpresiones **no** agregan endpoints: son movimientos de
stock ya existentes en el sistema (ver `specs/008-movimientos-deposito` y
`specs/009-ledger-unificado`). Un **lanzamiento** es la primera incorporación de
stock del libro (movimiento con origen exterior y destino el depósito principal de
la cuenta); una **reimpresión** es cada incorporación de stock posterior del mismo
libro. Se registran con el endpoint de movimientos que ya existe; este plan no los
cambia.

### Previsualización del período (extiende el reporte actual)

`GET /liquidacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` → `200`. Mantiene la forma
actual (resumen, libros vendidos, total a pagar por persona, con el mismo cálculo)
pero calculada **sólo sobre las ventas del período todavía no liquidadas**, y
agrega la información de lo excluido:

```
{
  ...reporte actual (resumen / libros / personas)...,
  excluidas: [ { liquidacion_id, codigo, ventas } ]   // ventas del período cubiertas por liquidaciones anteriores
}
```

- `excluidas` vacío = no hay ventas cubiertas. Reporte vacío **y** `excluidas`
  no vacío = el período ya está liquidado entero (la pantalla muestra el estado
  vacío con el/los `codigo`). Reporte vacío y `excluidas` vacío = período sin ventas.
- `400` fechas faltantes, inválidas o `desde > hasta`.

### Generar una liquidación

`POST /liquidaciones/` — body `{ desde, hasta }` → `201` → **ficha** (ver abajo) de
la liquidación creada. Sólo entran las ventas del período pendientes de liquidar.

- `400` fechas faltantes, inválidas o `desde > hasta`.
- `409` el período no tiene ventas pendientes (no hay ventas, o todas ya están
  cubiertas por una liquidación anterior). No crea nada.

### Listar liquidaciones

`GET /liquidaciones/` → `200` → `[ { id, codigo, desde, hasta, fecha_generacion,
personas, total, pagado, saldo, estado } ]` para toda la cuenta (sin paginar: el
front filtra por estado y pagina en el cliente). `estado ∈ pendiente | parcial | pagada`.

### Ficha de una liquidación

`GET /liquidaciones/:id` → `200` → `[ listado ] + { personas: [ ... ] }`, donde
cada persona trae:

```
{ id_persona, nombre, roles: [ { id, nombre } ],
  total, pagado, saldo, estado,
  detalle: [ { id_libro, titulo, id_rol, rol, porcentaje, importe } ],
  pagos:   [ { id, monto, fecha, nota } ] }
```

- `404` id inexistente o de otra cuenta.

### Registrar y anular pagos (por persona de una liquidación)

- `POST /liquidaciones/:id/personas/:idPersona/pagos` — body `{ monto, fecha, nota? }`
  (sin medio de pago) → `201` → **ficha actualizada** (con totales y estados ya
  recalculados).
  - `400` monto ≤ 0, o monto mayor al saldo de esa persona en esa liquidación.
  - `404` liquidación o persona inexistente, de otra cuenta, o persona que no
    pertenece a esa liquidación.
  - Es **parcial** por diseño: monto menor al saldo queda registrado.
- `DELETE /liquidaciones/:id/pagos/:idPago` → `200` → **ficha actualizada** (el
  saldo de esa persona vuelve a como estaba).
  - `404` pago inexistente, de otra liquidación/cuenta, o ya anulado.

### Anticipos

- `GET /anticipos/` → `200` → `[ { id, id_libro, isbn, titulo, id_persona, nombre,
  id_rol, rol, monto, fecha_lanzamiento, reimpresiones, pagado, fecha_pago } ]`
  (pendientes e históricos de la cuenta, sin paginar).
  - `fecha_lanzamiento` es la fecha de la primera incorporación de stock del libro.
  - `reimpresiones` se **deriva** de los movimientos: incorporaciones de stock del
    libro al depósito principal posteriores al lanzamiento (no hay tabla propia).
- `POST /anticipos/:id/pagar` — sin body de monto (pago único del anticipo entero;
  `fecha` opcional, por defecto hoy) → `200` → el anticipo actualizado.
  - `404` anticipo inexistente o de otra cuenta.
  - `409` anticipo ya pagado.

## Tareas

### 1. Persistir las liquidaciones, sus líneas y las ventas que cubren

Una liquidación guarda su período, su código legible (`LQ-<año>-<número>`) y su
fecha de generación; por persona, sus líneas (libro + rol + porcentaje + importe) y
su total; y el conjunto de ventas del período que cubre, para que no se vuelvan a
liquidar.

Criterios de aceptación:
- [ ] Una liquidación persistida guarda período, código legible y fecha de generación.
- [ ] Cada liquidación guarda, por persona, sus líneas de libro + rol + porcentaje + importe y su total.
- [ ] Cada liquidación guarda el conjunto de ventas del período que cubre.
- [ ] El código es único por cuenta y correlativo por año.
- [ ] Una liquidación nunca queda guardada sin líneas.
- [ ] No hay liquidaciones preexistentes que migrar; correr la migración dos veces no duplica nada.

### 2. Persistir los pagos de una liquidación

Un pago pertenece a una liquidación y a una persona de esa liquidación, con monto,
fecha y nota opcional, sin medio de pago, y puede anularse.

Criterios de aceptación:
- [ ] Un pago persistido queda ligado a una liquidación y a una persona de esa liquidación.
- [ ] El pago guarda monto, fecha y nota opcional; no guarda ni exige medio de pago.
- [ ] Un pago anulado deja de contar y de listarse.
- [ ] Correr la migración dos veces no duplica pagos.

### 3. Persistir los anticipos y su monto acordado por persona + rol

Existe a lo sumo un anticipo por libro + persona + rol de la cuenta, con el monto
acordado (copiado al generarse), la fecha de lanzamiento y su estado de pago. El
monto acordado vive como dato opcional de la relación libro↔persona, junto al
porcentaje.

Criterios de aceptación:
- [ ] Existe a lo sumo un anticipo por libro + persona + rol de la cuenta.
- [ ] El anticipo guarda el monto acordado al momento de generarse y la fecha de lanzamiento.
- [ ] Editar el monto acordado en la relación libro↔persona no cambia anticipos ya generados.
- [ ] Un anticipo sólo puede estar pendiente o pagado: no hay montos parciales ni saldo.
- [ ] Correr la migración dos veces no duplica anticipos.

### 4. Generar una liquidación persistida

Con el período se calcula el mismo importe que el reporte (precio histórico ×
cantidad × porcentaje), se excluyen las ventas ya cubiertas, se persiste la
liquidación y se marcan esas ventas como cubiertas.

Criterios de aceptación:
- [ ] `POST /liquidaciones/` con un período válido crea una liquidación con código, período, fecha y detalle por persona, y devuelve 201 con su ficha.
- [ ] El importe por línea es precio histórico × cantidad × porcentaje, igual al del reporte del período.
- [ ] La liquidación incluye únicamente ventas del período que no estén cubiertas por otra liquidación.
- [ ] Tras generar, esas ventas quedan cubiertas: generar el mismo período de nuevo no las vuelve a incluir.
- [ ] `POST /liquidaciones/` sin ventas pendientes en el período (sin ventas o todas ya liquidadas) devuelve 409 y no crea nada.
- [ ] `POST /liquidaciones/` con fechas faltantes, inválidas o `desde > hasta` devuelve 400.
- [ ] Un usuario no liquida ventas de otra cuenta.

### 5. Previsualizar el período excluyendo lo ya liquidado

El reporte del período informa lo que quedaría adentro (ventas no liquidadas) y
qué quedó excluido y en qué liquidación, para el aviso y el estado vacío del front.

Criterios de aceptación:
- [ ] `GET /liquidacion?desde&hasta` devuelve el reporte sin las ventas ya cubiertas por liquidaciones anteriores.
- [ ] La respuesta identifica las ventas excluidas y la liquidación (código) que las cubrió.
- [ ] Si todo el período ya está liquidado, el reporte queda sin líneas y la respuesta igual indica la(s) liquidación(es) que lo cubren.
- [ ] Si el período no tiene ventas, el reporte queda vacío y no indica ninguna liquidación.
- [ ] El resumen, las líneas por libro y el total a pagar por persona mantienen su forma actual, calculados sólo sobre las ventas pendientes.

### 6. Listar las liquidaciones con su estado

La cuenta ve todas sus liquidaciones con el estado derivado de los pagos vigentes.

Criterios de aceptación:
- [ ] `GET /liquidaciones/` devuelve todas las liquidaciones de la cuenta con código, período, fecha, cantidad de personas, total, pagado, saldo y estado.
- [ ] El estado es pendiente (pagado = 0), parcial (0 < pagado < total) o pagada (pagado = total).
- [ ] El pagado y el saldo se derivan de los pagos vigentes: un pago anulado no cuenta.
- [ ] Una liquidación recién generada aparece como pendiente, con saldo igual al total.
- [ ] `GET /liquidaciones/` de un usuario nunca incluye liquidaciones de otra cuenta.

### 7. Ver la ficha de una liquidación

La ficha muestra las personas con su desglose por libro y su progreso de pago.

Criterios de aceptación:
- [ ] `GET /liquidaciones/:id` devuelve la cabecera (código, período, fecha) y el detalle por persona (persona, roles, líneas por libro con rol y porcentaje, total).
- [ ] Por cada persona devuelve pagado, saldo, estado y sus pagos (fecha, monto, nota).
- [ ] El estado por persona y el estado de la liquidación salen de los pagos vigentes.
- [ ] `GET /liquidaciones/:id` con id inexistente o de otra cuenta devuelve 404.

### 8. Registrar un pago parcial a una persona de una liquidación

Registrar un pago de monto + fecha + nota contra una persona de la liquidación, que
puede ser parcial, devolviendo la liquidación con totales y estados actualizados.

Criterios de aceptación:
- [ ] `POST /liquidaciones/:id/personas/:idPersona/pagos` con monto, fecha y nota opcional registra el pago y devuelve la liquidación actualizada.
- [ ] Un pago menor al saldo de esa persona queda registrado y la persona (y la liquidación) pasan a parcial.
- [ ] Un pago igual al saldo deja a la persona pagada; la liquidación pasa a pagada sólo si no le queda saldo a ninguna persona.
- [ ] Un pago con monto ≤ 0 devuelve 400.
- [ ] Un pago con monto mayor al saldo de esa persona devuelve 400.
- [ ] Un pago a una persona que no pertenece a esa liquidación devuelve 404.
- [ ] Una liquidación inexistente o de otra cuenta devuelve 404.
- [ ] Sin medio de pago en el request ni en el pago guardado.

### 9. Anular un pago registrado

Anular un pago deja el saldo de esa persona como estaba antes.

Criterios de aceptación:
- [ ] `DELETE /liquidaciones/:id/pagos/:idPago` anula el pago y devuelve la liquidación con el saldo de esa persona restituido.
- [ ] Tras anular, el pago no aparece en la ficha ni cuenta en el pagado de la persona ni de la liquidación.
- [ ] Anular el único pago de una persona la devuelve a pendiente.
- [ ] `DELETE` con pago inexistente, de otra liquidación/cuenta, o ya anulado devuelve 404.

### 10. Generar el anticipo al lanzar el libro

El lanzamiento de un libro es su **primera incorporación de stock** (movimiento de
origen exterior al depósito principal de la cuenta). Ahí se genera, por cada
persona + rol con monto acordado, un anticipo con su monto y la fecha de esa
incorporación. Las incorporaciones posteriores son reimpresiones y no generan otro
anticipo: el anticipo sigue siendo único por libro + persona + rol.

Criterios de aceptación:
- [ ] Al registrarse la primera incorporación de stock de un libro (origen exterior, destino el depósito principal), queda un anticipo por cada persona + rol de ese libro con monto acordado, con ese monto y la fecha de la incorporación.
- [ ] Una incorporación de stock posterior del mismo libro (reimpresión) no crea un anticipo nuevo ni modifica el existente.
- [ ] Un libro + persona + rol nunca termina con más de un anticipo.
- [ ] Una relación libro↔persona↔rol sin monto acordado no genera anticipo.
- [ ] Si se define un monto acordado sobre un libro ya lanzado, su anticipo queda generado una sola vez (y no se duplica en intentos posteriores).
- [ ] El anticipo no se genera por ventas, liquidaciones ni por el alta del libro sin una incorporación de stock.

### 11. Listar los anticipos

La cuenta ve sus anticipos con libro, persona, rol, monto, lanzamiento,
reimpresiones y estado. La cantidad de reimpresiones se deriva de los movimientos
de incorporación de stock del libro, sin tabla propia.

Criterios de aceptación:
- [ ] `GET /anticipos/` devuelve, por anticipo, libro (título e ISBN), persona, rol, monto, fecha de lanzamiento, cantidad de reimpresiones y estado de pago.
- [ ] La fecha de lanzamiento es la de la primera incorporación de stock del libro al depósito principal.
- [ ] La cantidad de reimpresiones es la cantidad de incorporaciones de stock del libro al depósito principal posteriores al lanzamiento.
- [ ] Un libro sin incorporaciones posteriores al lanzamiento muestra 0 reimpresiones.
- [ ] El listado incluye pendientes e históricos (pagados) de la cuenta, sin anticipos de otras cuentas.
- [ ] No hay montos parciales ni saldo: cada anticipo está pendiente o pagado.
- [ ] Un libro reimpreso muestra su cantidad de reimpresiones y sigue teniendo un solo anticipo.

### 12. Marcar un anticipo como pagado

El anticipo se paga entero, de una sola vez, sin monto ni parciales.

Criterios de aceptación:
- [ ] `POST /anticipos/:id/pagar` marca el anticipo entero como pagado y devuelve el anticipo actualizado con su fecha de pago.
- [ ] No se envía monto: el anticipo se paga entero.
- [ ] Un anticipo ya pagado no se puede volver a pagar (409).
- [ ] `POST /anticipos/:id/pagar` con id inexistente o de otra cuenta devuelve 404.
- [ ] Marcar un anticipo como pagado no altera ninguna liquidación.

### 13. El anticipo está separado de las regalías

El anticipo no se descuenta ni se recupera: liquidaciones y anticipos no se cruzan.

Criterios de aceptación:
- [ ] La liquidación de un período nunca incluye ni descuenta anticipos.
- [ ] Un anticipo pagado no cambia el total a pagar por ventas ni el saldo de ninguna persona en una liquidación.
- [ ] Generar una liquidación después de pagar un anticipo no deja saldo a recuperar por ese anticipo.
- [ ] El listado de anticipos y las liquidaciones no comparten montos: ninguno modifica al otro.

### 14. Datos de ejemplo

El seed del backend refleja el escenario que el front usa para verificarse.

Criterios de aceptación:
- [ ] El seed deja 3 liquidaciones (una pagada, una parcial y una pendiente) con sus personas y pagos.
- [ ] El seed deja 4 anticipos, uno de ellos de un libro con dos incorporaciones de stock posteriores al lanzamiento (reimpresión ×2) y un único anticipo.
- [ ] Se puede generar la liquidación del mes en curso y queda como `LQ-<año>-0004` (siguiente correlativo del año).
- [ ] Con el seed cargado, la previsualización del mes en curso muestra datos reales y excluye lo ya liquidado.
