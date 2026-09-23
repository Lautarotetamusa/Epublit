# Spec: Migrar los módulos `transaccion` y `venta`

## Estado
Aprobado

## Resumen
Migrar el registro y consulta de ventas, ventas en consignación,
consignaciones y devoluciones —hoy repartidos en `transaccion` y `venta`
porque comparten tabla base y router— de su implementación actual sobre
MySQL a la arquitectura Postgres que ya usan `user`, `libro`,
`libro_persona`, `persona` y `cliente`, incluyendo por primera vez el
movimiento real de stock de cliente (`addStock`/`reduceStock`) que hasta
ahora quedaba pendiente (`NotImplemented`) en la migración de `cliente`.

## Motivación / por qué
El orden de migración acordado es `user` -> `libro` -> `libro_persona` ->
`persona` -> `cliente` -> `transaccion`/`venta`; los cinco primeros ya están
migrados. `transaccion` y `venta` no son dos features separados: en el
modelo legado `Venta extends Transaccion` (y también `VentaFirme`,
`VentaConsignado`, `Consignacion`, `Devolucion` son subtipos concretos de
`Transaccion`), comparten la tabla base `transacciones` (schema Drizzle
`src/schemas/transacciones.schema.ts`) y un único router
(`src/routes/transaccion.routes.ts`) que registra los cinco subtipos desde
el mismo lugar. Migrarlos por separado obligaría a mantener la jerarquía
MySQL viva a medio camino.

Esta migración también resuelve un pendiente explícito de la migración de
`cliente` (spec 004): las operaciones de venta/transacción son las únicas
que mueven el stock de libros que un cliente tiene en consignación
(`libro_cliente`), y ese movimiento (`addStock`/`reduceStock`/`haveStock`)
hoy tira `NotImplemented` (501) en Postgres porque no había equivalente
todavía. Con esta migración, registrar o anular una venta/transacción de
consignación mueve stock real en `libro_cliente`.

`liquidacion` se salta por ahora: el módulo no está completo ni en el
código legado, no tiene sentido migrarlo todavía. Sigue en MySQL, fuera de
alcance, sin ser dependencia bloqueante de este feature (`venta`/
`transaccion` no invocan nada de `liquidacion` hoy).

## Alcance

### Incluye
- Registro de una venta firme (`POST /venta`): valida stock del libro
  disponible, descuenta stock del libro, calcula el total con descuento,
  emite el comprobante (remito o factura AFIP según tipo de cliente) y
  responde con la venta creada.
- Registro de una venta en consignación (`POST /ventaConsignacion`): usa el
  precio histórico que tenía cada libro para ese cliente a la fecha de
  venta indicada, valida y reduce el stock que el cliente tiene en
  consignación (no el stock general del libro), calcula el total, emite
  comprobante y responde con la venta creada.
- Registro de una consignación (`POST /consignacion`): entrega libros a un
  cliente inscripto, descuenta stock del libro y **aumenta** el stock de
  ese cliente en `libro_cliente`, emite el remito correspondiente.
- Registro de una devolución (`POST /devolucion`): un cliente devuelve
  libros que tenía en consignación, aumenta el stock del libro y
  **reduce** el stock de ese cliente en `libro_cliente`.
- Validación de tipo de cliente según el tipo de operación: sólo un cliente
  "inscripto" puede recibir una consignación, una devolución o una venta en
  consignación (igual que hoy).
- Validación de stock antes de confirmar cualquiera de las cuatro
  operaciones: si algún libro no tiene stock suficiente (stock del libro
  para venta/consignación, stock del cliente para venta en
  consignación/devolución), la operación no se registra y responde con un
  error de validación detallando qué libro no alcanza.
- Consulta de todas las transacciones propias de un tipo dado
  (`GET /venta`, `GET /ventaConsignacion`, `GET /consignacion`,
  `GET /devolucion`), con los datos del cliente asociado (nombre, cuit,
  condición fiscal, tipo), ordenadas de más reciente a más antigua.
- Consulta de una transacción propia por id
  (`GET /venta/:id`, `GET /ventaConsignacion/:id`, `GET /consignacion/:id`,
  `GET /devolucion/:id`), incluyendo el detalle de libros (isbn, título,
  cantidad, precio) que formaron parte de la operación.
- El movimiento de stock de cliente que dispara cada operación
  (consignación entrega stock, devolución/venta-en-consignación lo
  reduce), resolviendo en Postgres el pendiente dejado por `cliente`
  (spec 004, "No incluye").
- Aislamiento por usuario dueño: sólo se listan/consultan/crean
  transacciones y ventas del usuario autenticado, y sólo sobre clientes
  propios.
- Preservar la generación de comprobantes (remito para consignación,
  factura AFIP para venta y venta en consignación cuando el cliente no es
  tipo "negro") con los mismos datos que hoy consume
  `src/comprobantes/comprobante.ts` y `src/afip/Afip.ts` (`facturar`,
  `getAfipClient`) — no se migra esa lógica, sólo se le siguen pasando los
  datos que necesita desde el flujo migrado.

### No incluye
- Migrar `liquidacion`: sigue en MySQL, fuera de alcance, no es
  dependencia bloqueante de este feature.
- Migrar la generación de comprobantes fiscales en sí
  (`src/comprobantes/comprobante.ts`, `src/afip/Afip.ts`): siguen
  operando igual, sólo reciben los datos ya migrados.
- Cualquier funcionalidad de anulación/edición de una venta o transacción
  ya registrada: el código legado no la tiene (sólo alta y consulta), así
  que esta migración tampoco la agrega.
- Cambiar las reglas de negocio existentes (qué tipo de cliente puede
  recibir cada operación, cómo se calcula el total, cómo se valida stock)
  salvo que se documenten explícitamente como corrección en este spec.

## Comportamiento esperado

- Como usuario autenticado, quiero registrar una venta firme a un cliente,
  para descontar el libro de mi stock y facturarlo.
  - Criterio de aceptación: `POST /venta` con `{cliente, libros: [{isbn,
    cantidad}], descuento?, medio_pago, tipo_cbte}` válidos responde 201,
    descuenta la cantidad vendida del stock de cada libro, y devuelve la
    venta creada con su total calculado (`suma(cantidad*precio) - descuento%`).
  - Criterio de aceptación: si algún libro no tiene stock suficiente,
    responde con un error de validación indicando qué libro no alcanza y
    no descuenta stock de ningún libro (todo o nada).
  - Criterio de aceptación: si el usuario no tiene punto de venta
    configurado, responde con un error de validación y no registra nada.
  - Criterio de aceptación: si el cliente no es tipo "negro", se emite un
    comprobante fiscal (factura AFIP) para la venta; si es tipo "negro",
    no se factura.

- Como usuario autenticado, quiero registrar una venta en consignación a un
  cliente inscripto, para liquidar libros que ya tenía en stock por
  consignación.
  - Criterio de aceptación: `POST /ventaConsignacion` con `{cliente,
    libros, fecha_venta, descuento?, medio_pago, tipo_cbte}` válidos
    responde 201, usa el precio que tenía cada libro para ese cliente en
    `fecha_venta` (no el precio actual del libro), reduce el stock de esos
    libros en el stock del cliente (no el stock general del libro), y
    devuelve la venta creada.
  - Criterio de aceptación: registrar una venta en consignación sobre un
    cliente que no es "inscripto" responde con un error de validación y no
    registra nada.
  - Criterio de aceptación: si el cliente no tiene stock suficiente de
    algún libro, responde con un error de validación y no registra nada.

- Como usuario autenticado, quiero registrar una consignación de libros a
  un cliente inscripto, para dejarle stock en consignación.
  - Criterio de aceptación: `POST /consignacion` con `{cliente, libros}`
    válido responde 201, descuenta stock del libro (stock general),
    aumenta el stock de esos libros en el stock del cliente indicado, y
    genera un remito.
  - Criterio de aceptación: registrar una consignación sobre un cliente que
    no es "inscripto" responde con un error de validación y no registra
    nada.
  - Criterio de aceptación: si el stock general de algún libro no alcanza,
    responde con un error de validación y no registra nada.

- Como usuario autenticado, quiero registrar la devolución de libros que un
  cliente tenía en consignación, para recuperarlos en mi stock general.
  - Criterio de aceptación: `POST /devolucion` con `{cliente, libros}`
    válido responde 201, aumenta el stock general de esos libros, reduce
    el stock de esos libros en el stock del cliente, y usa el precio
    vigente que tenía cada libro para ese cliente al momento de la
    devolución.
  - Criterio de aceptación: registrar una devolución sobre un cliente que
    no es "inscripto" responde con un error de validación y no registra
    nada.
  - Criterio de aceptación: si el cliente no tiene stock suficiente de
    algún libro para devolver, responde con un error de validación y no
    registra nada.

- Como usuario autenticado, quiero consultar mis ventas, ventas en
  consignación, consignaciones o devoluciones, para ver el historial de
  cada tipo de operación.
  - Criterio de aceptación: `GET /venta` (o `/ventaConsignacion`,
    `/consignacion`, `/devolucion`) devuelve sólo las operaciones propias
    de ese tipo, con los datos del cliente asociado, ordenadas de más
    reciente a más antigua.
  - Criterio de aceptación: `GET /venta/:id` (o el equivalente de cada
    tipo) devuelve la operación propia con ese id, incluyendo el detalle
    de libros (isbn, título, cantidad, precio); si no existe o no es
    propia, responde con un error de "no encontrado".

## Casos borde
- Si un mismo isbn se repite en el body de `libros`, las cantidades se
  suman antes de validar stock y registrar (igual que hoy,
  `createTransaccion`).
- El descuento (`descuento`) es opcional y por defecto 0; nunca puede
  superar 100.
- Un cliente "negro" (ej. MOSTRADOR) puede recibir una venta firme, pero
  nunca una consignación, devolución o venta en consignación (esas
  requieren "inscripto").
- Cualquier fallo durante el registro (validación de stock, inserción,
  movimiento de stock del libro o del cliente, emisión de comprobante)
  deja el sistema sin cambios: no se registra la operación ni se mueve
  stock parcialmente.

## Datos existentes / integraciones a tener en cuenta
- Ya existen, de Fase 0, los schemas Drizzle
  `src/schemas/transacciones.schema.ts` (tabla base con `type`, FK a
  `clientesTable` y a `usersTable`), `src/schemas/ventas.schema.ts` (FK
  1:1 a `transacciones` por `id_transaccion`) y
  `src/schemas/librosTransacciones.schema.ts` (detalle de libros por
  transacción, FK a `transacciones` y a `librosTable`). Es probable que
  necesiten el mismo tipo de ajuste de ownership/PK que se le hizo a
  `clientesTable` en el plan de 004 (agregar columna de dueño explícita,
  soft delete si corresponde, etc.) — queda para `/plan`, no para este
  spec.
- `clientesTable` (feature 004) ya tiene PK compuesta `(id, user)`;
  `transaccionesTable` va a tener FK a esa tabla.
- `libroClienteTable`/`precioLibroClienteTable` y `clienteStockService`
  (`getStock`, `syncPrecios`) ya existen (feature 004). Los movimientos de
  stock que faltan (`addStock`/`reduceStock`, hoy `NotImplemented` vía
  `stockDeClienteNoMigrado()` en `src/models/transaccion.model.ts` y
  `src/models/venta.model.ts`) son parte central de este feature: cada
  consignación/devolución/venta-en-consignación tiene que mover
  `libroClienteTable.stock` de verdad.
- El movimiento del stock general del libro (`Libro.updateStock` en MySQL,
  `stock = stock + cantidad`) tampoco tiene hoy equivalente en
  `libroService` (Postgres): sólo existe alta/edición/baja de libro y su
  historial de precios (`src/services/libro.service.ts`). Este feature
  necesita agregar esa capacidad.
- `venta`/`transaccion` invocan `src/comprobantes/comprobante.ts`
  (`emitirComprobante`) y `src/afip/Afip.ts` (`facturar`, `getAfipClient`)
  para generar remitos y facturar. Esa lógica no se migra en este feature,
  pero sigue siendo invocada con los datos de la venta/transacción y
  cliente ya migrados a Postgres — verificar que las formas de esos datos
  (tipos, nombres de campo) sigan siendo compatibles con lo que esos
  módulos esperan hoy.
- **Herencia vs. composición**: el modelo legado usa herencia real
  (`Venta extends Transaccion`; `VentaFirme`, `VentaConsignado`,
  `Consignacion`, `Devolucion` extienden o comparten comportamiento con
  `Transaccion`/`Venta` mediante métodos estáticos sobreescritos como
  `stockMovement`, `setLibros`, `clientValidation`, `comprobante`).
  CLAUDE.md exige "Inyección de dependencias > herencia" para código
  nuevo: esta migración es la oportunidad de reemplazar esa jerarquía por
  funciones/objetos de configuración explícitos por tipo de operación
  (parámetros, no subclases). Queda para `/plan` decidir la forma
  concreta, pero el spec deja constancia de que la jerarquía de clases no
  debe reproducirse tal cual en el código nuevo.
- Router único: hoy `src/routes/transaccion.routes.ts` registra los cinco
  subtipos (`venta`, `ventaConsignacion`, `consignacion`, `devolucion`)
  desde una tabla de despacho (`transacciones` map). El plan debe decidir
  cómo se organiza esto en la nueva arquitectura (rutas/controllers/
  services), pero observablemente las cinco rutas HTTP actuales
  (`GET/POST` por tipo) tienen que seguir existiendo con el mismo path.
- Decisión de sesiones previas, aplicada por primera vez en `cliente`
  (spec 004): no se mantiene soporte dual (modelo MySQL viejo conviviendo
  con el nuevo) — se da de baja `transaccion.model.ts`/`venta.model.ts`
  del todo en esta etapa. Ver "Preguntas abiertas": se asume que este
  feature sigue el mismo enfoque salvo que el usuario indique lo
  contrario.

## Decisiones confirmadas
- Mismo enfoque "sin soporte dual" que en `cliente` (spec 004): se da de
  baja `src/models/transaccion.model.ts` y `src/models/venta.model.ts`
  por completo en esta etapa. No queda ningún módulo restante sin migrar
  que dependa de `transaccion`/`venta`, así que este es el último eslabón
  de código legado MySQL "core" (fuera de `liquidacion`, en pausa).
- El precio de una devolución (`POST /devolucion`) es el precio *actual*
  del stock del cliente (`libroClienteTable.precio`, el mismo que
  devuelve `clienteStockService.getStock` sin fecha).
- La eliminación/anulación de una venta o transacción queda fuera de
  alcance de este feature (el legado tampoco la tiene implementada).
- Se corrige el bug de `VentaController.vender`, que llama
  `connection.release()` tres veces antes del `finally`: no es
  comportamiento observable a preservar, es un bug de manejo de
  conexiones MySQL.
