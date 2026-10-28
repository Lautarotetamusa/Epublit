# Plan: Tienda online — API pública, pedidos y configuración

## Historia

El administrador de una editorial ve y opera los pedidos de su tienda online
(aceptar, rechazar, marcar enviado y entregado), configura integraciones,
MercadoPago, MiCorreo/retiro y el stock negativo permitido por libro. La tienda
del comprador es externa, usa checkout invitado y consume una API pública con
reserva de stock y pago con Checkout Pro.

## Diseño de API

### Convenciones generales

- **Panel admin**: usa la sesión existente. Sin sesión, `401`. Todas las
  consultas quedan acotadas a la cuenta autenticada.
- **API pública**: prefijo `/public/tienda/v1`. Se autentica con `X-API-Key`
  (una clave por integración) y valida el `Origin` contra el origen permitido
  de esa integración. El webhook de MercadoPago es la única excepción: no usa
  API key, usa firma.
- **Idempotencia**: `POST /public/tienda/v1/pedidos` exige
  `Idempotency-Key`. La clave se acota a la integración.
- **Errores públicos**: sobre estable
  `{ "error": { "codigo": "...", "mensaje": "...", "detalles": [...] } }`.
  Códigos principales: `no_autenticado` (401), `origen_no_permitido` (403),
  `integracion_inactiva` (403), `validacion` (400), `no_encontrado` (404),
  `idempotencia_conflicto` (409), `stock_insuficiente` (409),
  `transicion_invalida` (409), `pago_no_aprobado` (409),
  `entrega_no_disponible` (422), `peso_faltante` (422),
  `direccion_invalida` (422), `correo_no_configurado` (422),
  `etiqueta_duplicada` (409), `sin_envio` (409),
  `mercadopago_no_conectado` (409), `proveedor_no_disponible` (502).
- **Estados de pedido**: `pendiente_pago`, `pagado`, `aceptado`, `rechazado`,
  `enviado`, `entregado`, `cancelado`.
- **Estados de pago**: `pendiente`, `aprobado`, `rechazado`, `reembolsado`.
- **Comprador invitado**: nombre y email obligatorios; teléfono y documento
  opcionales. Si faltan datos, el pedido se crea igual y el admin puede
  rechazarlo con el motivo que corresponda. Para envío, la dirección completa
  con código postal es obligatoria.
- **Dinero**: pesos argentinos, dos decimales. Los importes se toman del
  catálogo al crear el pedido y quedan congelados en el pedido.
- **Fechas**: se devuelven en ISO 8601. Los filtros por día se interpretan en
  hora local de Argentina.
- **Aislamiento**: toda entidad nueva queda asociada a la cuenta. Una clave de
  una cuenta nunca ve ni opera datos de otra; el acceso cruzado responde `404`.

### API pública de la tienda

El carrito vive en el storefront. Nuestro backend recibe ítems ya elegidos y
valida precios, stock y entrega en la cotización y en la creación del pedido.

#### `GET /public/tienda/v1/config`

`200`:

```json
{
  "moneda": "ARS",
  "mercadopago": { "disponible": true },
  "envio": { "disponible": true },
  "retiro": {
    "disponible": true,
    "direccion": "Av. Siempre Viva 123",
    "horario": "Lunes a viernes de 9 a 18"
  }
}
```

Nunca devuelve credenciales, tokens ni datos internos de la cuenta.
`envio.disponible` es `true` sólo si MiCorreo y PAQ.AR están configurados.

#### `GET /public/tienda/v1/libros?buscar=&pagina=&porPagina=`

`200`:

```json
{
  "libros": [
    {
      "isbn": "978...",
      "titulo": "...",
      "precio": 12500,
      "portadaUrl": "...",
      "disponibleParaVenta": 3,
      "enStock": true,
      "personas": [
        { "nombre": "Ana Pérez", "rol": "autor", "fotoUrl": "..." },
        { "nombre": "Luis Gómez", "rol": "ilustrador" }
      ]
    }
  ],
  "total": 42,
  "pagina": 1,
  "porPagina": 20
}
```

`disponibleParaVenta` es la cantidad que la tienda puede vender sin superar el
límite negativo: stock físico del depósito principal menos reservas activas,
más el stock negativo permitido, nunca menor que cero. No cuenta stock
consignado en depósitos de clientes. Sólo aparecen libros activos de la cuenta
de la integración.

`personas` es un resumen público de las vinculaciones activas del libro: nombre,
rol configurado por la cuenta y foto si existe. No incluye bio en el listado.
Puede haber cero, una o varias personas y varios roles; no se limita a autor e
ilustrador. Se ordena de forma estable por rol y nombre.

#### `GET /public/tienda/v1/libros/:isbn`

`200`:

```json
{
  "isbn": "978...",
  "titulo": "...",
  "precio": 12500,
  "portadaUrl": "...",
  "disponibleParaVenta": 3,
  "enStock": true,
  "personas": [
    {
      "nombre": "Ana Pérez",
      "rol": "autor",
      "fotoUrl": "...",
      "bio": "..."
    },
    {
      "nombre": "Luis Gómez",
      "rol": "ilustrador"
    }
  ]
}
```

El detalle trae las personas completas: nombre, rol, foto si existe y bio
pública si existe. Un libro sin personas devuelve `personas: []`. Se excluyen
las personas dadas de baja, los roles dados de baja y las vinculaciones
inactivas. Nunca se exponen porcentajes, montos acordados, email, datos fiscales
ni información interna. `404` si el libro no existe, está dado de baja o
pertenece a otra cuenta.

#### `POST /public/tienda/v1/cotizar`

Body:

```json
{
  "items": [{ "isbn": "978...", "cantidad": 2 }],
  "entrega": {
    "tipo": "envio",
    "codigoPostal": "1425",
    "localidad": "CABA",
    "provincia": "Ciudad Autónoma de Buenos Aires"
  }
}
```

`200`:

```json
{
  "subtotal": 25000,
  "items": [
    { "isbn": "978...", "titulo": "...", "cantidad": 2,
      "precioUnitario": 12500, "subtotal": 25000 }
  ],
  "envio": { "disponible": true, "costo": 3200, "plazo": "3 a 5 días" },
  "retiro": { "disponible": true, "direccion": "...", "horario": "..." }
}
```

- El peso del envío se calcula sumando, por ítem, el `pesoKg` del libro por la
  cantidad; si un libro no tiene peso, se usa el `pesoPromedioKg` configurado
  por la cuenta. Si un libro no tiene peso y la cuenta tampoco tiene promedio,
  el envío no está disponible con motivo `peso_faltante`; el retiro sigue
  disponible.
- El precio y el plazo de domicilio salen de MiCorreo `/rates` con
  `deliveredType: "D"`; el peso va en gramos y las dimensiones de alto, ancho y
  largo salen de la caja default configurada por la cuenta.
- Cuando `envio.disponible=false`, la respuesta incluye un `motivo` estable
  (`peso_faltante`, `correo_no_configurado`, `proveedor_no_disponible`, etc.) y
  un mensaje entendible.
- Si falta la configuración de MiCorreo o de PAQ.AR, `envio.disponible=false`
  con motivo `correo_no_configurado`; si el proveedor falla, con motivo
  `proveedor_no_disponible`. En ambos casos el retiro sigue disponible si está
  habilitado.
- Si el retiro está deshabilitado, `retiro.disponible=false`.
- `409` con detalle por ítem si no alcanza el stock.
- No reserva stock ni crea pedido.
- `400` si faltan ítems, cantidades o el destino completo para envío.

#### `POST /public/tienda/v1/pedidos`

Requiere `Idempotency-Key`. Body:

```json
{
  "comprador": {
    "nombre": "...",
    "email": "...",
    "telefono": "...",
    "documento": "..."
  },
  "entrega": {
    "tipo": "envio",
    "direccion": {
      "calle": "...",
      "numero": "...",
      "piso": "...",
      "depto": "...",
      "localidad": "...",
      "provincia": "...",
      "codigoPostal": "..."
    }
  },
  "items": [{ "isbn": "978...", "cantidad": 2 }],
  "urlRetorno": "https://tienda.example.com/checkout/retorno"
}
```

Nombre y email son obligatorios; teléfono y documento son opcionales y se
conservan si vienen. Para envío, la dirección completa con código postal es
obligatoria.

`201`:

```json
{
  "pedido": {
    "codigo": "PED-2026-000001",
    "estado": "pendiente_pago",
    "estadoPago": "pendiente",
    "fecha": "2026-10-23T14:30:00-03:00",
    "items": [
      { "isbn": "978...", "titulo": "...", "cantidad": 2,
        "precioUnitario": 12500, "subtotal": 25000 }
    ],
    "subtotal": 25000,
    "costoEnvio": 3200,
    "total": 28200,
    "entrega": { "tipo": "envio", "direccion": { "...": "..." } },
    "pago": {
      "proveedor": "mercadopago",
      "estado": "pendiente",
      "preferenciaId": "...",
      "initPoint": "https://www.mercadopago.com.ar/..."
    }
  }
}
```

- `400` si falta la clave de idempotencia, el comprador, ítems, cantidades o la
  dirección completa para envío; si el email es inválido; o si `urlRetorno` no
  pertenece al origen permitido.
- `409` si no hay stock suficiente, si MercadoPago no está conectado o si la
  misma clave se repite con otro cuerpo.
- `422` si se eligió envío y la cotización no está disponible, si falta la
  configuración de correo (`correo_no_configurado`), si algún libro no tiene
  peso y no hay promedio configurado (`peso_faltante`) o si la dirección es
  inválida (`direccion_invalida`).
- `502` si MercadoPago no puede generar la preferencia.
- La creación es atómica desde el punto de vista del comprador: si falla la
  validación, la reserva, la cotización o la preferencia, no queda pedido ni
  stock reservado.
- Repetir la misma clave con el mismo cuerpo devuelve el mismo pedido sin
  duplicar reserva ni preferencia.
- `urlRetorno` sólo puede ser del mismo origen configurado en la integración.

#### `POST /public/tienda/v1/pedidos/:codigo/pago`

Genera una nueva preferencia de Checkout Pro para un pedido `pendiente_pago`
cuyo pago anterior fue rechazado o cuya preferencia venció.

`200`:

```json
{
  "pago": {
    "preferenciaId": "...",
    "initPoint": "https://www.mercadopago.com.ar/...",
    "estado": "pendiente"
  }
}
```

`409` si el pedido no está pendiente de pago, si ya expiró o si MercadoPago no
está conectado. Los intentos anteriores se conservan.

#### `GET /public/tienda/v1/pedidos/:codigo`

`200` con estado del pedido, estado del pago, totales, entrega, ítems y datos
públicos del envío (código, estado y URL de seguimiento si existen). No expone
identificadores internos de venta, factura ni credenciales. `404` si el pedido
no es de la cuenta de la integración.

#### `POST /public/tienda/v1/pedidos/:codigo/cancelar`

Cancela un pedido `pendiente_pago`, libera su reserva y devuelve `200` con el
pedido actualizado. `409` para cualquier otro estado.

#### `POST /public/tienda/v1/webhooks/mercadopago`

Recibe las notificaciones de pago. No usa API key: valida la firma de
MercadoPago, identifica la cuenta por el usuario cobrador, consulta el pago con
las credenciales de esa cuenta y lo asocia al pedido por la referencia externa.
Devuelve `200` cuando el evento es válido aunque no cambie nada; `401` si la
firma es inválida. Los eventos repetidos son idempotentes.

### API admin

#### `GET /pedidos`

Query: `estado`, `desde`, `hasta`, `entrega`, `buscar`, `pagina`, `porPagina`.

- `estado`: uno de los siete estados; ausente o `todos` = todos.
- `entrega`: `envio` o `retiro`.
- `desde` y `hasta`: fechas inclusivas sobre la fecha de creación del pedido.
- `buscar`: coincidencia parcial, sin distinguir mayúsculas, por código,
  nombre del comprador, email o teléfono.
- `pagina` desde 1; `porPagina` por defecto 20, máximo 100.

`200`:

```json
{
  "pedidos": [
    {
      "codigo": "PED-2026-000001",
      "fecha": "2026-10-23T14:30:00-03:00",
      "comprador": { "nombre": "...", "email": "...", "telefono": "..." },
      "total": 28200,
      "estadoPago": "aprobado",
      "entrega": "envio",
      "estado": "pagado",
      "cantidadItems": 2
    }
  ],
  "total": 120,
  "pagina": 1,
  "porPagina": 20,
  "conteos": {
    "todos": 120,
    "pendiente_pago": 10,
    "pagado": 15,
    "aceptado": 20,
    "enviado": 25,
    "entregado": 40,
    "rechazado": 7,
    "cancelado": 3
  }
}
```

Los `conteos` se calculan sobre el recorte de búsqueda, fechas y forma de
entrega, sin aplicar el filtro de estado. El listado va del más reciente al más
antiguo. `400` para estado, fecha, entrega o paginación inválidos.

#### `GET /pedidos/:codigo`

`200` con la ficha completa:

- Comprador invitado: nombre, email, teléfono, documento.
- Entrega: envío con dirección completa y código postal, o retiro con punto y
  horario; costo de envío.
- Ítems con ISBN, título, cantidad, precio unitario y subtotal.
- Subtotal, costo de envío, peso y caja usados para el envío y total.
- Pago: proveedor, estado, identificador de operación, importe y fecha.
- Envío: proveedor PAQ.AR, número de envío, tracking, estado, última
  actualización, URL pública, eventos y datos de la etiqueta (disponible, fecha
  de creación y URL de descarga autenticada).
- Venta generada y Factura B: tipo, número, fecha y acceso al archivo; si
  todavía no se emitió, estado pendiente.
- Motivo y detalle de rechazo, si corresponde.
- Historial de hitos con fecha y hora y última actualización.

`404` si el pedido no existe o es de otra cuenta.

#### `POST /pedidos/:codigo/facturar`

Reintenta la emisión de la Factura B de un pedido ya aceptado (`aceptado`,
`enviado` o `entregado`). Es idempotente: si el comprobante ya está emitido
devuelve la ficha actual sin generar otra factura ni otra venta. Si AFIP sigue
fallando devuelve `502` con `facturacion_fallida` y el comprobante queda
pendiente; la venta y la aceptación no se pierden. `409` si el pedido todavía
no fue aceptado o no tiene venta.

#### `GET /pedidos/:codigo/comprobante`

`200` con el archivo de la Factura B de la cuenta. `404` si todavía no se emitió
o si el pedido es de otra cuenta.

#### `POST /pedidos/:codigo/aceptar`

Sin body. Sólo para `pagado` con pago `aprobado`. Genera la venta real, convierte
la reserva y dispara la Factura B automática. Devuelve `200` con la ficha
actualizada y los identificadores de venta y comprobante (o comprobante
pendiente). `409` si el estado o el pago no lo permiten; `502` si falla la
generación de la venta.

#### `POST /pedidos/:codigo/rechazar`

Body: `{ "motivo": "...", "detalle": "..." }`. `motivo` obligatorio. Sólo para
`pendiente_pago` o `pagado`. Si el pago estaba aprobado, ejecuta y registra el
reembolso antes de dejar el pedido `rechazado`; el pago queda `reembolsado`.
Libera la reserva. `400` sin motivo; `409` si el estado no lo permite; `502` si
MercadoPago no confirma el reembolso (el pedido no cambia y se puede reintentar).

#### `POST /pedidos/:codigo/etiqueta`

Genera o reutiliza la etiqueta de PAQ.AR para un pedido `aceptado` con entrega a
domicilio. No cambia el estado del pedido. Body opcional:
`{ "direccion": { "calle": "...", "numero": "...", "piso": "...",
"depto": "...", "localidad": "...", "provincia": "...",
"codigoPostal": "..." } }` para corregir la dirección de entrega antes de
generar la etiqueta, sólo mientras el pedido esté aceptado y no tenga etiqueta.

`200`:

```json
{
  "envio": {
    "proveedorEnvioId": "...",
    "codigoSeguimiento": "...",
    "etiquetaDisponible": true,
    "etiquetaUrl": "/pedidos/PED-2026-000001/etiqueta",
    "etiquetaCreadaEl": "2026-10-24T10:00:00-03:00"
  }
}
```

`proveedorEnvioId` es el número de envío que asigna PAQ.AR; `codigoSeguimiento`
es el tracking number que se usa para `/tracking` y para la URL pública.

- Es idempotente por pedido: repetir la acción devuelve la misma etiqueta y no
  crea otra orden en PAQ.AR. Si PAQ.AR ya creó la orden, se adopta y no se
  duplica.
- `409` si el pedido no está `aceptado`, si es retiro o si ya fue enviado. Si
  PAQ.AR informa una etiqueta duplicada que no se puede reconciliar con este
  pedido, devuelve `409` con `etiqueta_duplicada`.
- `422` si falta la configuración de PAQ.AR (`correo_no_configurado`), si la
  dirección es inválida (`direccion_invalida`) o si el pedido no tiene peso
  consolidado y la cuenta no tiene peso promedio configurado (`peso_faltante`).
- `502` si PAQ.AR no responde o no devuelve número de envío, código de
  seguimiento y etiqueta; el pedido sigue `aceptado` y se puede reintentar.

#### `GET /pedidos/:codigo/etiqueta`

`200` con el PDF de la etiqueta. `404` si todavía no se generó o si el pedido
es de otra cuenta. `409` si es retiro. La descarga sólo es posible para la
cuenta dueña del pedido.

#### `POST /pedidos/:codigo/enviar`

Sin body. Sólo para `aceptado` con entrega a domicilio. Si todavía no existe
etiqueta, la genera con la misma operación idempotente; si ya existe, la
reutiliza. Luego registra la fecha de despacho y deja el pedido `enviado`. El
código de seguimiento lo asigna PAQ.AR; no se carga manualmente. `409` para
retiro, para un pedido ya enviado o para cualquier otro estado. Si la etiqueta
no se puede generar por configuración o datos, devuelve `422` con el código
correspondiente; si falla PAQ.AR, `502`. En todos los casos el pedido permanece
`aceptado` y no registra despacho.

#### `POST /pedidos/:codigo/entregar`

Sin body. Sólo para `enviado`, o para `aceptado` con retiro en local. Registra
la fecha de entrega/retiro y deja el pedido `entregado`. `409` para `aceptado`
con envío a domicilio o cualquier estado terminal.

#### `GET /pedidos/:codigo/envio`

`200` con proveedor, número de envío de PAQ.AR, tracking, estado actual, última
actualización, URL pública, datos de la etiqueta y eventos ordenados del más
reciente al más antiguo. Si no hay código, devuelve el bloque
sin código y sin URL. Si el pedido es retiro, `409` con código `sin_envio`. Un
error de PAQ.AR devuelve `200` con el último estado conocido y un error
entendible, sin perder la ficha.

#### `POST /pedidos/:codigo/envio/refrescar`

Vuelve a consultar PAQ.AR `/tracking` y persiste estado y eventos. `200` con el bloque
actualizado. Si el proveedor falla, `200` con el último estado conocido y el
error; nunca borra lo ya guardado. `409` si no hay código o si es retiro.

#### Integraciones

`GET /integraciones` → `200`:

```json
{
  "integraciones": [
    {
      "id": 1,
      "nombre": "Tienda web",
      "prefijo": "epb_ab12",
      "origen": "https://tienda.example.com",
      "activa": true,
      "revocada": false,
      "ultimoUso": "2026-10-23T14:00:00-03:00",
      "creadaEn": "2026-10-01T09:00:00-03:00"
    }
  ]
}
```

`POST /integraciones` body `{ "nombre": "...", "origen": "https://..." }` →
`201` con la integración y `apiKey` completa. Es la única vez que se devuelve
la clave completa.

`PATCH /integraciones/:id` body `{ "activa": false }` → `200` con la integración
actualizada. Una integración revocada no se puede reactivar.

`DELETE /integraciones/:id` → `200` con la integración revocada. Desde ese
momento la clave deja de autenticar. Los pedidos ya creados no cambian.

Validaciones: nombre no vacío; origen absoluto `http/https`, sin credenciales,
sin path, query ni fragmento. `400` si no cumple. `404` para integraciones de
otra cuenta.

#### MercadoPago

`GET /tienda/mercadopago` → `200`:

```json
{
  "conectado": true,
  "alias": "...",
  "email": "...",
  "aplicacionId": "...",
  "conectadoEl": "2026-10-01T09:00:00-03:00"
}
```

Nunca devuelve access token ni refresh token.

`GET /tienda/mercadopago/conectar` → `200` con `{ "url": "..." }` para iniciar
OAuth. `409` si ya hay una conexión activa.

`GET /tienda/mercadopago/callback?code=&state=` valida el estado, intercambia el
código, guarda tokens cifrados y redirige al panel con el resultado. `400` si el
estado o el código son inválidos; no crea conexión.

`DELETE /tienda/mercadopago` → `200` con `{ "conectado": false }`. Borra los
tokens. Los pedidos existentes conservan su estado.

#### Correo Argentino: MiCorreo y PAQ.AR

Se integran las dos APIs oficiales:

- **MiCorreo API v1 (cotización)**: producción
  `https://api.correoargentino.com.ar/micorreo/v1` y QA
  `https://apitest.correoargentino.com.ar/micorreo/v1`. Autentica con
  `POST /token` y HTTP Basic `usuario:password`; devuelve `{ token, expires }`.
  Cotiza con `POST /rates` (`customerId`, `postalCodeOrigin`,
  `postalCodeDestination`, `deliveredType` `D`/`S` y `dimensions` con
  `weight` en gramos, `height`, `width` y `length` en cm). También ofrece
  `GET /agencies`.
- **PAQ.AR API 2.0 (alta, etiqueta y seguimiento)**: producción
  `https://api.correoargentino.com.ar/paqar/v1` y QA
  `https://apitest.correoargentino.com.ar/paqar/v1`. Autentica con
  `Authorization: Apikey <API_KEY>` y `agreement: <AGREEMENT>`; se valida con
  `GET /auth` (204). Crea la orden con `POST /orders`, la etiqueta con
  `POST /labels` (`labelFormat: "10x15"`), consulta `GET /tracking`, puede
  cancelar con `POST /orders/{trackingNumber}/cancel` y lista sucursales con
  `GET /agencies`.

El token de MiCorreo se obtiene con `POST /token` y se reutiliza hasta su
`expires`; al vencer se renueva. El alcance actual usa `deliveredType: "D"` para
envío a domicilio y retiro en local. No se expone selección de sucursal de
Correo Argentino; `GET /agencies` queda disponible para una etapa futura.

`GET /tienda/envios` → `200`:

```json
{
  "micorreo": {
    "usuario": "...",
    "customerId": "...",
    "configurado": true
  },
  "paqar": {
    "agreement": "...",
    "sellerId": "...",
    "configurado": true
  },
  "origen": {
    "calle": "...", "numero": "...", "piso": "...", "depto": "...",
    "localidad": "...", "provincia": "C",
    "codigoPostal": "..."
  },
  "cajaDefault": { "altoCm": 10, "anchoCm": 10, "largoCm": 10 },
  "pesoPromedioKg": 0.5,
  "formatoEtiqueta": "10x15",
  "retiro": {
    "activo": true,
    "direccion": "...",
    "horario": "..."
  }
}
```

Nunca devuelve la password de MiCorreo ni la API key de PAQ.AR; sólo indica si
cada integración está configurada. `pesoPromedioKg` es `null` si no se
configuró.

`PUT /tienda/envios` guarda:

- MiCorreo: usuario, password (cifrada) y `customerId`.
- PAQ.AR: `agreement`, API key (cifrada) y `sellerId`.
- Origen: calle, número, piso, depto, localidad, provincia (código) y CP.
- Caja default: alto, ancho y largo en cm.
- Peso promedio en kg, formato de etiqueta (`10x15` por defecto) y retiro en
  local.

Si se omiten password o API key, conserva las existentes. Valida que la caja
tenga dimensiones positivas, que el peso promedio sea `> 0` si viene, que el
retiro activo tenga dirección y horario y que `formatoEtiqueta` sea `10x15` en
este alcance. `200` con la configuración actualizada; nunca devuelve secretos.

`POST /tienda/envios/probar` body `{ "api": "micorreo" | "paqar" }` prueba cada
API por separado con la configuración guardada: MiCorreo con `POST /token` y
PAQ.AR con `GET /auth`. Devuelve `200` con `{ "api", "ok": true, "mensaje" }` o
`422` con `{ "api", "ok": false, "mensaje" }`; un `api` desconocido devuelve
`400`. Nunca devuelve credenciales.

#### Libro

Los endpoints existentes de alta, edición y ficha de libro suman:

- `stockNegativoPermitido`: entero no negativo, `0` por defecto.
- `pesoKg`: peso del libro en kilogramos, decimal con hasta tres decimales
  (resolución de gramos). Es opcional; si viene, debe ser mayor que `0`. Si no
  viene o es nulo, la cotización usa el peso promedio de la cuenta.

No se crea un endpoint nuevo. El campo no lleva texto de ayuda en este
contrato; cualquier hint visual es un detalle de UI.

### Modelo de datos y migraciones

Las migraciones nuevas continúan la numeración existente: `0012` a `0017`.
Todas las entidades nuevas se acotan por cuenta y usan referencias compuestas
para que una cuenta no pueda asociar datos de otra.

| Migración | Entidad / cambio | Datos y restricciones |
| --- | --- | --- |
| `0012` | Límite de stock negativo y peso del libro | Stock negativo permitido: entero no negativo, `0` por defecto. Peso: decimal en kg con hasta tres decimales, nulo por defecto, mayor que `0` cuando viene. Backfill de libros existentes en `0` para el límite y en nulo para el peso. No modifica stock. |
| `0013` | Integraciones de tienda | Cuenta, nombre, origen permitido, prefijo visible, hash de la clave, activa, revocada, último uso y fechas. Hash único; índice por cuenta y prefijo. |
| `0014` | Conexión de MercadoPago | Cuenta, usuario de MercadoPago, alias, email, identificador de aplicación, access token y refresh token cifrados, vencimiento, estado y fechas. Un usuario de MercadoPago no puede quedar conectado a dos cuentas. |
| `0015` | Configuración de envíos y retiro | Cuenta; MiCorreo (usuario, password cifrada, customerId); PAQ.AR (agreement, API key cifrada, sellerId); origen con calle, número, piso, depto, localidad, provincia y CP; caja default en cm; peso promedio en kg; formato de etiqueta; y retiro en local. Una configuración por cuenta. |
| `0016` | Pedidos, ítems, reservas, historial e idempotencia | Pedido con cuenta, integración, código único por cuenta, referencia externa única, clave de idempotencia única por integración, snapshot de comprador y entrega, peso y caja usados para el envío, estados, importes, motivo de rechazo, fechas, venta y comprobante. Ítems con ISBN, título, precio, cantidad y subtotal congelados. Reservas por pedido, libro, depósito principal, cantidad, estado y expiración. Historial de hitos. Restricciones: cantidades positivas, importes no negativos, estados válidos. Índices por fecha, estado, comprador y reservas por vencer. |
| `0017` | Pagos, webhooks y envíos | Intentos de pago con proveedor, identificador de pago único, preferencia, estado, importe, moneda, fechas y datos de reembolso. Eventos de webhook deduplicados. Envío por pedido con proveedor PAQ.AR, número de envío (único), tracking, estado, última actualización, URL, archivo/URL del PDF de etiqueta, fecha de creación de etiqueta y fecha de despacho. Eventos de envío deduplicados por identificador del proveedor. |

No hay pedidos históricos que migrar: la tienda es nueva. Las migraciones no
deben tocar ventas, movimientos, clientes ni stock existentes, salvo el backfill
del límite negativo en libros y el peso nulo en los libros existentes.

### Arquitectura de servicios compartidos

Las rutas pública y admin son adapters distintos: la pública autentica con API
key/CORS y el admin con sesión. Ninguna de las dos contiene consultas de
catálogo ni reglas de negocio; sólo parsean, autorizan y serializan.

- El catálogo (libro + personas + roles), la disponibilidad de stock, las
  reservas, los pedidos y las transiciones de estado viven en
  servicios/repositorios compartidos.
- Se reutilizan los servicios/repositorios existentes de libro y de personas
  vinculadas donde alcance; el módulo de tienda no copia esas consultas.
- La disponibilidad se calcula en un solo lugar y la usan el catálogo público,
  el panel, el checkout, las reservas y las ventas internas.
- El catálogo público y el admin leen la misma base; el serializer público es
  separado del admin y filtra todo lo interno.
- Un cambio de regla de catálogo, stock o transición impacta a ambos adapters
  sin editar dos implementaciones.

No se crean tablas nuevas para personas o roles: el catálogo público lee las
vinculaciones activas existentes entre libro, persona y rol.

### Reglas de negocio y máquina de estados

#### Estados

| Desde | Acción | Hacia | Condición |
| --- | --- | --- | --- |
| `pendiente_pago` | Pago aprobado (webhook) | `pagado` | Pago aprobado, importe y moneda coinciden |
| `pendiente_pago` | Rechazo del admin | `rechazado` | Motivo obligatorio |
| `pendiente_pago` | Expiración o cancelación | `cancelado` | Libera reserva |
| `pagado` | Aceptación del admin | `aceptado` | Pago aprobado y reserva activa |
| `pagado` | Rechazo del admin | `rechazado` | Motivo y reembolso confirmado |
| `pagado` | Reembolso confirmado por webhook | `cancelado` | Pago reembolsado y reserva liberada |
| `aceptado` + envío | Generar etiqueta y despachar | `enviado` | Etiqueta creada o reutilizada; fecha de despacho |
| `aceptado` + retiro | Marcar entregado | `entregado` | — |
| `enviado` | Marcar entregado | `entregado` | — |

`entregado`, `rechazado` y `cancelado` son terminales. Las transiciones
inválidas responden `409` con un mensaje entendible y no producen efectos
laterales. Generar la etiqueta es una preparación y no cambia el estado; recién
el despacho pasa el pedido a `enviado`. Las acciones son idempotentes en el
sentido de que repetirlas nunca duplica venta, factura, reembolso, etiqueta ni
movimiento; la segunda intentona recibe `409` con el estado actual.

#### Stock y reservas

- La disponibilidad del depósito principal es el stock físico menos las
  reservas activas. La consulta de stock del depósito principal y las
  validaciones de ventas internas usan esa disponibilidad.
- El stock nunca se lee ni se escribe desde la columna vieja del libro; la
  fuente es siempre el depósito principal.
- Al crear un pedido se reservan todos los ítems en una sola operación. Si un
  ítem no alcanza, no se crea el pedido ni se reserva ninguno.
- El límite negativo permitido es un piso sobre el depósito principal: una
  operación puede dejar el stock en `-límite`, nunca por debajo. Con límite `0`
  no se vende de más.
- El límite aplica tanto a las reservas del ecommerce como a las ventas
  internas de mostrador. Esta es la decisión del usuario y prevalece sobre el
  texto del design, que lo limitaba a la tienda online.
- El stock consignado en depósitos de clientes no cuenta para cubrir el
  faltante, no se vuelve negativo por esta regla y no habilita vender de más
  desde el depósito principal.
- Al aceptar un pedido, la reserva se convierte en venta: el stock físico baja
  una sola vez y la reserva deja de restarse. La aceptación no vuelve a validar
  la cantidad contra la propia reserva.
- Al rechazar o cancelar, la reserva se libera: la disponibilidad vuelve a
  subir y no se crea movimiento de venta.
- Las operaciones concurrentes bloquean las filas de stock del depósito
  principal en orden determinista. Dos pedidos o una venta interna y un pedido
  que compiten por el último ejemplar no pueden superar el piso: una operación
  gana y la otra recibe `409`.
- Las reservas de pedidos `pendiente_pago` vencen a los 30 minutos fijos, no
  configurables por cuenta. La expiración es idempotente y no afecta pedidos
  pagados o aceptados.

#### Pago

- El pago es sólo con MercadoPago Checkout Pro. La cuenta debe estar conectada
  por OAuth para crear pedidos y preferencias.
- El webhook valida firma, identifica la cuenta, consulta el pago con las
  credenciales de esa cuenta y verifica que la referencia externa, el importe y
  la moneda correspondan al pedido.
- Pago aprobado sobre un pedido `pendiente_pago` lo pasa a `pagado`. Pago
  rechazado se registra como intento rechazado y el pedido sigue
  `pendiente_pago` para reintentar.
- Pago aprobado sobre un pedido ya `cancelado` o `rechazado` no reabre el
  pedido: se registra el intento y se inicia el reembolso.
- Un pedido rechazado con pago aprobado termina con pago `reembolsado`. Si
  MercadoPago no confirma el reembolso, el rechazo no se completa y se puede
  reintentar.
- El panel nunca muestra ni pide credenciales de MercadoPago.

#### Aceptación, venta y factura

- Sólo se acepta un pedido `pagado` con pago `aprobado`.
- La aceptación reutiliza el flujo de venta existente. Genera exactamente un
  movimiento de venta desde el depósito principal hacia el exterior, con las
  cantidades y precios congelados del pedido, y una venta por el total del
  pedido (productos más envío).
- La venta se asocia al cliente por defecto CONSUMIDOR FINAL de tipo
  `particular` de la cuenta, nunca a MOSTRADOR de tipo `negro`, porque la
  facturación automática se saltea para este último. El medio de pago es el
  medio MercadoPago existente de la cuenta.
- Si falta el cliente CONSUMIDOR FINAL o el medio MercadoPago, la aceptación
  devuelve `409` con un mensaje accionable y no genera venta.
- La Factura B se emite automáticamente. Si AFIP falla, la venta y la
  aceptación se conservan, el comprobante queda pendiente y se reintenta sin
  duplicar la venta. Cuando sale bien, se guardan tipo, número, fecha y archivo.
- La venta impacta stock, métricas y liquidaciones como cualquier venta del
  sistema. Las liquidaciones de autores usan las líneas de libro; el envío no
  se atribuye a autores.
- Aceptar dos veces o en paralelo produce una sola venta y una sola factura.
  La segunda operación recibe `409`.

#### Rechazo, cancelación y expiración

- El rechazo exige motivo y sólo aplica antes de aceptar. Si el pago estaba
  aprobado, primero se reembolsa y luego se registra el rechazo.
- Rechazar un pedido no borra datos del comprador, ítems ni historial.
- La cancelación pública sólo aplica a `pendiente_pago`. La expiración automática
  hace lo mismo a los 30 minutos.
- Si un pago se aprueba justo cuando el pedido expira, se bloquea el pedido: o
  gana la expiración (y el pago se reembolsa) o gana el pago (y el pedido sigue
  `pagado`). Nunca queda un pedido cancelado con reserva activa ni un pedido
  pagado sin reserva.

#### Cotización, envío, etiqueta y seguimiento

- La cotización de domicilio usa MiCorreo `/rates` con `deliveredType: "D"`, el
  peso total en gramos y las dimensiones de la caja default de la cuenta. No se
  expone selección de sucursal de Correo Argentino en este alcance.
- El peso total es la suma de `pesoKg × cantidad` de cada libro; para libros sin
  peso se usa el `pesoPromedioKg` de la cuenta. Si falta peso y no hay promedio,
  la cotización informa `peso_faltante`; si falta configuración de MiCorreo o de
  PAQ.AR, `correo_no_configurado`; si el proveedor falla,
  `proveedor_no_disponible`. El retiro sigue disponible.
- La etiqueta de PAQ.AR sólo se genera para un pedido `aceptado` con entrega a
  domicilio. Generarla no cambia el estado del pedido: queda `aceptado` hasta
  que el admin despacha.
- PAQ.AR crea la orden con `POST /orders` usando el origen, los datos de envío,
  los bultos con peso/dimensiones de la caja default, `deliveryType`
  `homeDelivery`, la fecha de venta y el código del pedido como referencia
  estable. Luego genera el PDF con `POST /labels` y `labelFormat: "10x15"`.
- Se guardan número de envío de PAQ.AR, tracking, archivo/URL del PDF, estado y
  eventos. El código de seguimiento ya no se carga a mano.
- La generación es idempotente por pedido: si PAQ.AR ya creó la orden o la
  etiqueta, el reintento la adopta y no duplica. Si PAQ.AR creó la etiqueta pero
  falló la persistencia local, se busca por la referencia estable y se guarda la
  existente.
- Marcar enviado exige `aceptado` con entrega a domicilio. Si no hay etiqueta,
  la genera; luego registra la fecha de despacho y deja el pedido `enviado`.
- Si PAQ.AR falla, el pedido sigue `aceptado`, no se marca enviado y el error
  queda disponible para reintentar.
- Si falta la configuración de PAQ.AR, la generación devuelve
  `correo_no_configurado`; si la dirección es inválida, `direccion_invalida`; si
  falta peso, `peso_faltante`. En todos los casos el pedido sigue `aceptado` y
  el retiro no se ve afectado.
- Mientras no haya etiqueta, el admin puede corregir la dirección y reintentar.
  Una vez creada la etiqueta, la dirección no se puede cambiar.
- Un pedido de retiro no genera etiqueta ni seguimiento de correo. Se marca
  entregado directamente desde `aceptado`.
- Sólo se marca entregado un pedido `enviado`, o uno `aceptado` con retiro en
  local.
- La descarga de la etiqueta sólo es posible para la cuenta dueña del pedido.
- El estado del envío es independiente del estado del pedido: un pedido
  `enviado` puede estar en tránsito, en sucursal o demorado.
- El seguimiento se consulta con PAQ.AR `/tracking`; los eventos se guardan
  deduplicados y se conserva la última actualización. Si el proveedor falla, se
  mantiene el último estado conocido y se puede reintentar.
- La URL pública de seguimiento es el link que devuelva PAQ.AR si existe; si no,
  `https://www.correoargentino.com.ar/formularios/e-commerce`. Nunca se
  devuelve una URL si no hay código.
- No se expone cancelación de etiqueta: los pedidos aceptados no se cancelan.
  El endpoint de cancelación de PAQ.AR queda disponible para una operación
  futura, no para este alcance.
- Deshabilitar el retiro no invalida pedidos de retiro ya creados; se pueden
  entregar normalmente.

#### Listado admin

- Los filtros se combinan. Los conteos por estado se calculan sobre búsqueda,
  fechas y forma de entrega, sin el filtro de estado.
- La búsqueda es parcial y no distingue mayúsculas por código, nombre, email o
  teléfono.
- Las fechas son inclusivas y se interpretan en hora local de Argentina.
- La paginación devuelve total, página y tamaño; el orden es del más reciente
  al más antiguo.

#### Seguridad y multi-tenant

- Las claves de API se guardan hasheadas; sólo se conserva el prefijo visible.
  La clave completa se muestra una sola vez y no se puede recuperar.
- Los tokens de MercadoPago, la password de MiCorreo y la API key de PAQ.AR se
  guardan cifrados y nunca se devuelven por API ni se escriben en logs.
- Una integración inactiva o revocada no autentica ninguna llamada pública.
- Una integración de una cuenta puede ver todo el catálogo y todos los pedidos
  de esa cuenta, aunque el pedido lo haya creado otra integración.
- El acceso cruzado entre cuentas responde `404`, tanto en el panel como en la
  API pública.

## Decisiones cerradas

Estas decisiones quedan cerradas para la implementación:

- **Stock negativo**: aplica tanto a las reservas del ecommerce como a las
  ventas internas de mostrador. Es un piso sobre el depósito principal y no
  afecta el stock consignado en clientes. Prevalece sobre el texto anterior del
  design, que lo limitaba a la tienda online.
- **Peso**: cada libro tiene un `pesoKg` opcional, en kilogramos, decimal con
  hasta tres decimales (resolución de gramos) y mayor que `0` cuando viene. La
  cuenta tiene además un `pesoPromedioKg` configurable en la configuración de
  envíos, usado como fallback para los libros sin peso. La cotización, el pedido
  y la etiqueta usan la suma de `pesoKg × cantidad` de cada libro; por cada libro
  sin peso usan el promedio de la cuenta. Si un libro no tiene peso y la cuenta
  tampoco tiene promedio, el envío falla con `peso_faltante`; el retiro sigue
  disponible. El peso del pedido queda congelado al crearse.
- **Factura B**: incluye el costo de envío. La venta y la factura reflejan el
  total del pedido; las liquidaciones de autores siguen usando sólo las líneas
  de libro.
- **Fallo de AFIP**: la aceptación se completa igual. La venta queda hecha, el
  comprobante queda pendiente y se reintenta sin duplicar la venta.
- **Correo Argentino**: MiCorreo API v1 cotiza con `/rates`; PAQ.AR API 2.0
  crea la orden y la etiqueta con `/orders` + `/labels`, y consulta el
  seguimiento con `/tracking`. Se guardan número de envío, tracking, PDF,
  estado y eventos. La generación es idempotente por pedido y no duplica
  órdenes ni etiquetas. La etiqueta sola no cambia el estado; marcar enviado la
  genera si falta y recién ahí pasa a `enviado`. Si PAQ.AR falla, el pedido
  queda `aceptado` y se reintenta. La descarga de la etiqueta es sólo para la
  cuenta dueña. Un pedido de retiro no genera etiqueta. Una dirección inválida
  devuelve `direccion_invalida`, la falta de peso de un libro sin promedio
  configurado devuelve `peso_faltante` y la falta de configuración de correo
  devuelve `correo_no_configurado`, sin sacar el pedido de `aceptado`.
- **Catálogo público**: el storefront consume nuestro catálogo, precios,
  portadas, stock y las personas/roles públicos de cada libro a través de la
  API pública.
- **Cancelar pedidos aceptados**: no se permite. Sólo se rechaza antes de
  aceptar; después se sigue con enviar/entregar.
- **Reembolso**: si MercadoPago no confirma el reembolso, el rechazo no se
  completa y se puede reintentar. No se agrega un estado nuevo.
- **Vencimiento de reserva**: 30 minutos fijo, no configurable por cuenta.

No quedan ambigüedades abiertas para implementar.

## Deuda técnica: normalización de comprobantes (planificada en 017)

Estado: **planificada** en `specs/017-comprobantes-afip/plan.md`. Todavía no
implementada.

- Hoy `pedidos` guarda `venta_id` y un snapshot de `comprobante_tipo`,
  `comprobante_numero`, `comprobante_fecha`, `comprobante_file_path` y
  `comprobante_estado`.
- El flujo AFIP actual sólo persiste el PDF (en `movimientos.file_path` /
  `comprobante_file_path`); los datos fiscales de la factura (tipo, punto de
  venta, número, CAE, vencimiento del CAE, resultado, observaciones, importe,
  moneda y respuesta cruda de AFIP) no quedan en una tabla consultable.
- Riesgo: si se pierde el PDF se pierde el dato fiscal; no hay auditoría ni
  reconciliación posible; el snapshot del pedido duplica información y puede
  quedar desincronizado con la venta o el comprobante real.
- Diseño ideal futuro: tabla `comprobantes`/`facturas` por cuenta, vinculada a
  `ventas`/`movimientos`, con los datos fiscales, la respuesta cruda de AFIP y
  la versión de plantilla. `pedidos` pasaría a referenciar el comprobante en
  vez de duplicarlo; habría que evaluar un backfill de lo existente en la
  medida en que los datos estén disponibles.
- Render en el navegador: en lugar de generar PDFs con Puppeteer/Chromium y
  guardarlos en disco, el comprobante se renderiza en el navegador del usuario
  a partir de los datos fiscales estructurados (HTML/CSS imprimible,
  `window.print()` y, si hace falta, PDF generado en el cliente). Eso elimina
  la dependencia de Chromium y el almacenamiento de comprobantes en disco.
- La propuesta completa (modelo, backend, front, migración, beneficios,
  trade-offs y pasos) está en
  **`specs/016-tienda-ecommerce/comprobantes.md`**.
- Esta normalización se planifica en **`specs/017-comprobantes-afip/plan.md`**:
  requiere su propia migración y spec. Por ahora **no migra comprobantes
  históricos** ni conserva sus PDFs como funcionalidad.

## Fases de implementación

El orden de las fases manda sobre la numeración de las tareas. Cada fase se
puede revisar por separado antes de avanzar a la siguiente.

- **Fase 1 — Base y catálogo público**: tareas 1, 2, 3, 4, 5 y 8. Migraciones
  base, stock negativo + reservas, integraciones/API keys, autenticación/CORS
  público y catálogo público con personas.
- **Fase 2 — Checkout y pagos**: tareas 6, 7, 9, 10, 11, 12 y 13. Configuración
  de envíos, OAuth de MercadoPago, cotización, creación de pedidos, preferencia
  Checkout Pro, webhooks y expiración.
- **Fase 3 — Panel, venta y logística**: tareas 14 a 21. Listado/ficha/acciones
  del panel, venta + Factura B, rechazo/reembolso, etiqueta de PAQ.AR,
  despacho/entrega y seguimiento.
- **Fase 4 — Datos y regresión**: tareas 22 y 23. Seed, concurrencia,
  aislamiento multi-tenant y regresión.

## Tareas

Las tareas mantienen una numeración estable; el orden de ejecución es el de las
fases indicadas arriba.

### 1. Persistir el stock negativo y el peso del libro

Guardar en el libro el entero no negativo de stock negativo permitido y el peso
opcional en kilogramos, y exponerlos en alta, edición y ficha sin afectar el
stock existente.

Criterios de aceptación:
- [ ] Un libro creado sin el límite queda con `0`.
- [ ] Un libro creado o editado con `5` persiste y la ficha devuelve `5`.
- [ ] Editar otros campos sin enviar el límite conserva el valor anterior.
- [ ] Un valor negativo, decimal, texto o fuera del rango entero devuelve `400`
      para el límite.
- [ ] Un libro creado sin peso queda sin peso (`null`) y la ficha lo devuelve
      así.
- [ ] Un peso `0.450` se guarda en kg con tres decimales y la ficha devuelve
      `0.450`; un peso con más de tres decimales se redondea a gramos.
- [ ] Un peso `0`, negativo, texto o inválido devuelve `400`.
- [ ] Editar otros campos sin enviar el peso conserva el valor anterior.
- [ ] La migración deja en `0` el límite y en nulo el peso de todos los libros
      existentes, sin modificar cantidades de stock.
- [ ] El valor del límite no se mezcla ni se aplica al stock consignado en
      clientes.

### 2. Crear integraciones de tienda con claves de API

Persistir varias integraciones por cuenta, cada una con nombre, origen
permitido, clave hasheada, prefijo visible, estado y último uso, y exponer su
gestión en el panel.

Criterios de aceptación:
- [ ] `POST /integraciones` con nombre y origen válido devuelve `201` con la
      clave completa una sola vez y la integración sin la clave.
- [ ] `GET /integraciones` devuelve nombre, prefijo, origen, activa, revocada y
      último uso; nunca la clave completa.
- [ ] La clave completa no se puede recuperar por ningún endpoint; si se pierde,
      hay que revocar y crear otra.
- [ ] Desactivar una integración impide crear pedidos nuevos; reactivarla vuelve
      a habilitarlos; revocarla es irreversible y su clave deja de servir.
- [ ] Varias integraciones de la misma cuenta comparten catálogo y pedidos.
- [ ] Un nombre vacío o un origen vacío, relativo o con path/query/fragmento
      devuelve `400`.
- [ ] Una integración de otra cuenta devuelve `404` al intentar verla u
      operarla.
- [ ] El panel nunca devuelve la clave completa después de la creación.

### 3. Autenticar la API pública, aplicar CORS y unificar errores

Resolver la integración a partir de la API key, validar el origen permitido y
devolver errores estables sin filtrar datos internos.

Criterios de aceptación:
- [ ] Sin `X-API-Key` o con una clave inexistente devuelve `401`.
- [ ] Con una integración inactiva o revocada devuelve `403` (o `401` uniforme)
      y no ejecuta la operación.
- [ ] Con un `Origin` distinto al configurado devuelve `403`.
- [ ] El origen permitido recibe los encabezados CORS; el preflight responde
      `204`; otro origen no recibe CORS.
- [ ] Cada request autenticado actualiza el último uso de la integración.
- [ ] Todos los errores públicos usan el sobre `error.codigo/mensaje/detalles`
      y no incluyen stack, claves ni tokens.
- [ ] La API pública vive bajo `/public/tienda/v1`; el webhook no exige API key.
- [ ] Una clave de una cuenta no puede leer ni operar datos de otra.

### 4. Persistir pedidos, ítems, reservas, pagos, envíos, historial e idempotencia

Crear el modelo persistente que sostiene el checkout, las reservas, los pagos,
el seguimiento y el panel, con aislamiento por cuenta y restricciones de
integridad.

Criterios de aceptación:
- [ ] Un pedido guarda cuenta, integración, código único por cuenta, referencia
      externa única, clave de idempotencia única por integración, snapshot de
      comprador y entrega, peso y caja usados para el envío, estados, importes,
      moneda, motivo de rechazo, fechas, venta y comprobante.
- [ ] Cada ítem guarda ISBN, título, precio unitario, cantidad y subtotal del
      momento de la compra.
- [ ] Cada reserva guarda pedido, libro, depósito principal, cantidad, estado y
      expiración.
- [ ] Cada intento de pago guarda proveedor, identificador de pago único,
      preferencia, estado, importe, moneda y fechas.
- [ ] Cada envío guarda proveedor PAQ.AR, número de envío (único), tracking,
      estado, última actualización, URL, archivo/URL del PDF de etiqueta, fecha
      de creación de etiqueta y fecha de despacho; sus eventos se deduplican por
      identificador del proveedor.
- [ ] El historial guarda cada hito con tipo, descripción y fecha.
- [ ] Las restricciones rechazan cantidades no positivas, importes negativos y
      estados fuera del enum.
- [ ] Las referencias compuestas impiden asociar un pedido, ítem, reserva o pago
      a datos de otra cuenta.
- [ ] Correr las migraciones dos veces no duplica datos ni pierde información.

### 5. Calcular disponibilidad con reservas y aplicar el límite negativo

Hacer que la disponibilidad del depósito principal descuente las reservas
activas y que las reservas y las ventas internas respeten el mismo piso de
stock negativo.

Criterios de aceptación:
- [ ] El stock del depósito principal visible para las operaciones es el stock
      físico menos las reservas activas, sin leer la columna vieja del libro.
- [ ] Una reserva activa reduce la disponibilidad; una reserva liberada la
      restaura; una reserva convertida no se descuenta dos veces.
- [ ] Con límite `0` y disponibilidad `0`, una reserva o una venta interna de
      una unidad devuelve `409` y no modifica stock.
- [ ] Con límite `2` y disponibilidad `0`, una reserva o venta interna de `2`
      deja el stock en `-2`; una de `3` devuelve `409`.
- [ ] Las ventas internas de mostrador usan la misma disponibilidad y el mismo
      límite que el ecommerce.
- [ ] El stock consignado en clientes no se cuenta para cubrir el faltante ni
      se vuelve negativo por esta regla.
- [ ] Dos operaciones concurrentes por el último ejemplar no superan el piso:
      una gana y la otra recibe `409`.
- [ ] Aceptar un pedido con reserva activa convierte la reserva sin volver a
      validar la cantidad contra sí misma y deja el stock físico descontado una
      sola vez.
- [ ] La disponibilidad se calcula en un único servicio compartido; admin,
      catálogo público, checkout y ventas internas obtienen el mismo valor para
      el mismo libro y momento.

### 6. Configurar MiCorreo, PAQ.AR, caja, peso promedio y retiro

Guardar y leer la configuración de las dos APIs de Correo Argentino, la caja
default, el peso promedio de fallback, el origen y el retiro, con prueba de
conexión independiente para cada API.

Criterios de aceptación:
- [ ] `GET /tienda/envios` devuelve MiCorreo (usuario, `customerId`,
      `configurado`), PAQ.AR (`agreement`, `sellerId`, `configurado`), origen
      con piso/depto/provincia (código)/CP, caja default, peso promedio, formato
      de etiqueta y retiro; nunca password ni API key.
- [ ] `PUT /tienda/envios` guarda la configuración; si se omiten password o API
      key, conserva las existentes.
- [ ] La password de MiCorreo y la API key de PAQ.AR se guardan cifradas y no se
      devuelven por API ni aparecen en logs.
- [ ] La caja default exige alto, ancho y largo positivos en cm; el formato de
      etiqueta acepta `10x15` y es el default.
- [ ] El peso promedio se guarda en kg, con hasta tres decimales y mayor que
      `0` cuando viene; un valor inválido devuelve `400`.
- [ ] Si el peso promedio no está configurado, la configuración lo devuelve
      como `null`; el envío sólo falla con `peso_faltante` si algún libro del
      carrito tampoco tiene peso.
- [ ] `POST /tienda/envios/probar` con `{ "api": "micorreo" }` valida MiCorreo
      con `POST /token`; con `{ "api": "paqar" }` valida PAQ.AR con `GET /auth`.
      Devuelve `200` con éxito o `422` con mensaje accionable; nunca devuelve
      credenciales. Un `api` distinto de `micorreo`/`paqar` devuelve `400`.
- [ ] Si falta o es inválida la configuración de una API, su prueba falla y el
      envío queda indisponible con `correo_no_configurado`, pero el retiro sigue
      disponible si está activo.
- [ ] Si el retiro está activo, exige dirección y horario; si está inactivo,
      permite vaciarlos.
- [ ] Deshabilitar el retiro no invalida pedidos de retiro ya creados.
- [ ] Una configuración de otra cuenta devuelve `404`.

### 7. Conectar y desconectar MercadoPago por OAuth

Iniciar el flujo OAuth, guardar tokens cifrados y renovarlos, sin exponer
credenciales al panel.

Criterios de aceptación:
- [ ] `GET /tienda/mercadopago` devuelve estado, alias, email, aplicación y
      fecha de conexión; nunca tokens.
- [ ] `GET /tienda/mercadopago/conectar` devuelve una URL de autorización con
      estado anti-CSRF.
- [ ] El callback con estado válido intercambia el código, guarda tokens
      cifrados y datos de la cuenta, y redirige al panel.
- [ ] Un callback con estado o código inválido devuelve `400` y no crea
      conexión.
- [ ] Un mismo usuario de MercadoPago no puede quedar conectado a dos cuentas
      de Epublit; el segundo intento devuelve `409`.
- [ ] Desconectar borra los tokens, el panel muestra “no conectado” y los
      pedidos existentes conservan su estado.
- [ ] Un access token vencido se renueva automáticamente antes de llamar a
      MercadoPago.
- [ ] Si el refresh falla, la conexión queda desconectada y el checkout devuelve
      `409` con un mensaje accionable.

### 8. Exponer catálogo público con personas y configuración

Dar al storefront el catálogo, las personas/roles públicos y la disponibilidad
de pago, envío y retiro que necesita para armar el carrito y el checkout.

Criterios de aceptación:
- [ ] `GET /public/tienda/v1/config` devuelve moneda, disponibilidad de
      MercadoPago, disponibilidad de envío y datos públicos de retiro; nunca
      credenciales. `envio.disponible` es `true` sólo si MiCorreo y PAQ.AR están
      configurados.
- [ ] `GET /public/tienda/v1/libros` lista sólo libros activos de la cuenta,
      con paginación y búsqueda, precio, portada, disponibilidad, si hay stock y
      un resumen de personas (`nombre`, `rol`, `fotoUrl` si existe).
- [ ] `GET /public/tienda/v1/libros/:isbn` devuelve el detalle con las personas
      completas: `nombre`, `rol`, `fotoUrl` y `bio` cuando existen; un ISBN de
      otra cuenta o inexistente devuelve `404`.
- [ ] Se devuelven todos los roles configurados por la cuenta, no sólo autor e
      ilustrador; un libro puede tener varias personas y varios roles, y una
      misma persona puede aparecer con más de un rol.
- [ ] Un libro sin personas devuelve `personas: []`.
- [ ] Las personas se devuelven en orden estable por rol y nombre.
- [ ] Se excluyen personas dadas de baja, roles dados de baja y vinculaciones
      inactivas.
- [ ] El catálogo no expone porcentajes, montos acordados, email, datos fiscales,
      costo, stock por depósito ni otros datos internos.
- [ ] `disponibleParaVenta` descuenta reservas activas y suma el límite negativo
      permitido, sin contar stock consignado, y nunca es menor que cero.
- [ ] Un libro sin stock aparece con `enStock=false` y disponibilidad `0`, no
      como `404`.
- [ ] El catálogo público y el admin leen la misma base y devuelven los mismos
      valores para los campos comunes del libro.
- [ ] Las rutas públicas sólo autorizan, parsean y serializan con un serializer
      público separado; no contienen consultas de catálogo ni reglas de negocio.
- [ ] La disponibilidad se obtiene del mismo servicio compartido que usa el
      admin, sin una segunda implementación en el módulo de tienda.

### 9. Cotizar envío con MiCorreo `/rates` y retiro en local

Calcular el costo y el plazo de envío con MiCorreo y las opciones de retiro para
un carrito, sin reservar stock.

Criterios de aceptación:
- [ ] `POST /public/tienda/v1/cotizar` valida ítems y cantidades, usa precios
      del catálogo y devuelve subtotal, costo/plazo de envío y datos de retiro.
- [ ] El peso se calcula sumando el `pesoKg` de cada libro por su cantidad; si
      un libro no tiene peso, se usa el `pesoPromedioKg` de la cuenta. El total
      se envía a MiCorreo en gramos.
- [ ] Si un libro no tiene peso y la cuenta tampoco tiene promedio configurado,
      el envío no está disponible con motivo `peso_faltante`; el retiro sigue
      disponible.
- [ ] La cotización de domicilio llama a MiCorreo `/rates` con
      `deliveredType: "D"`, el CP de origen, el CP de destino y las dimensiones
      de la caja default; usa el precio y el plazo devueltos por el proveedor.
- [ ] Si falta la configuración de MiCorreo o de PAQ.AR, `envio.disponible=false`
      con motivo `correo_no_configurado`; si el proveedor falla, con motivo
      `proveedor_no_disponible`. El retiro sigue disponible.
- [ ] Para envío exige código postal, localidad y provincia; si faltan, `400`.
- [ ] Si el retiro está deshabilitado, `retiro.disponible=false`.
- [ ] Si no alcanza el stock, devuelve `409` con el detalle por ítem.
- [ ] La cotización no crea pedido, no reserva stock y no modifica
      disponibilidad.
- [ ] Un ISBN de otra cuenta no se cotiza y no revela datos de esa cuenta.

### 10. Crear pedidos públicos con snapshot, reserva e idempotencia

Recibir el checkout invitado, congelar precios y datos, reservar stock de forma
atómica y crear la preferencia de pago en la misma operación de negocio.

Criterios de aceptación:
- [ ] Exige una integración activa, origen válido y `Idempotency-Key`; sin la
      clave devuelve `400`.
- [ ] Exige nombre y email del comprador; teléfono y documento son opcionales
      y se conservan si vienen; para envío exige dirección completa con código
      postal; para retiro no exige dirección de envío.
- [ ] Un pedido con teléfono o documento faltante se crea igual y el admin
      puede verlo incompleto y rechazarlo con el motivo correspondiente.
- [ ] Fusiona ISBN repetidos, exige cantidades positivas y al menos un ítem.
- [ ] Toma los precios del catálogo, no del request, y calcula
      `total = subtotal + costoEnvio` en ARS.
- [ ] Reserva todos los ítems en una sola operación; si uno no alcanza, devuelve
      `409` con detalle y no deja pedido ni reserva.
- [ ] Para retiro guarda snapshot de dirección y horario; para envío guarda el
      costo cotizado, el peso usado, la caja usada y la dirección de entrega.
- [ ] Para envío recalcula la cotización con MiCorreo `/rates` al crear el
      pedido; no confía en el costo ni en el plazo enviados por el storefront.
- [ ] Si se elige envío y falta configuración de correo, devuelve `422` con
      `correo_no_configurado`; si algún libro no tiene peso y la cuenta no tiene
      promedio configurado, devuelve `422` con `peso_faltante`. En ambos casos
      no deja pedido ni reserva.
- [ ] Si MiCorreo falla al cotizar, devuelve `422`/`502` con
      `proveedor_no_disponible` y no deja pedido ni reserva.
- [ ] Si MercadoPago no está conectado devuelve `409`; si la preferencia no se
      puede generar devuelve `502` y no deja pedido ni reserva.
- [ ] Crea un código único por cuenta, estado `pendiente_pago`, pago
      `pendiente`, historial inicial y vencimiento de reserva.
- [ ] La misma clave con el mismo cuerpo devuelve el mismo pedido sin duplicar
      reserva ni preferencia; con otro cuerpo devuelve `409`.
- [ ] Dos requests concurrentes con la misma clave producen un solo pedido.
- [ ] La misma clave usada en otra integración produce un pedido distinto.
- [ ] `urlRetorno` fuera del origen permitido devuelve `400`.
- [ ] Un fallo de stock permite reintentar con la misma clave una vez que el
      stock esté disponible.

### 11. Generar y regenerar la preferencia de Checkout Pro

Crear la preferencia de pago con el total del pedido y permitir reintentar el
pago cuando el intento anterior fue rechazado o la preferencia venció.

Criterios de aceptación:
- [ ] La preferencia usa el total del pedido, moneda ARS, referencia externa
      única, URL de notificación y URL de retorno del origen permitido.
- [ ] La respuesta devuelve identificador de preferencia e `initPoint`; nunca
      credenciales.
- [ ] Un pago rechazado permite generar una nueva preferencia para el mismo
      pedido sin duplicar el pedido ni la reserva.
- [ ] Los intentos anteriores se conservan y se pueden auditar.
- [ ] No se genera preferencia para un pedido que no esté `pendiente_pago`, que
      haya expirado o cuya cuenta no tenga MercadoPago conectado; devuelve
      `409`.
- [ ] La preferencia no vence después que la reserva del pedido.
- [ ] Repetir la generación no duplica pedido, reserva ni preferencia.

### 12. Procesar webhooks de MercadoPago verificados e idempotentes

Recibir la confirmación del pago, validar su origen y reflejarla en el pedido y
su historial sin duplicar efectos.

Criterios de aceptación:
- [ ] Una firma inválida o vencida devuelve `401` y no modifica nada.
- [ ] Un pago aprobado válido deja el pago `aprobado` y el pedido `pagado` si
      estaba `pendiente_pago`, y registra el hito una sola vez.
- [ ] Un evento repetido devuelve `200` y no duplica hitos, estados ni ventas.
- [ ] Un pago rechazado deja el intento `rechazado` y el pedido sigue
      `pendiente_pago`, habilitando el reintento.
- [ ] Un reembolso confirmado deja el pago `reembolsado` y, si el pedido no
      estaba aceptado, lo cancela y libera la reserva.
- [ ] Un pago con importe, moneda o referencia externa que no coincide con el
      pedido no modifica el pedido; se registra y se ignora con `200`.
- [ ] Un pago de otra cuenta no modifica datos; el pedido se busca sólo dentro
      de la cuenta del cobrador.
- [ ] Un pago aprobado que llega después de una cancelación o rechazo no reabre
      el pedido: registra el reembolso y deja el pedido terminal.
- [ ] El webhook no expone tokens ni datos internos en la respuesta.

### 13. Expirar y cancelar pedidos pendientes de pago

Liberar automáticamente las reservas de pedidos que no se pagan y permitir que
el storefront cancele un checkout pendiente.

Criterios de aceptación:
- [ ] Un pedido `pendiente_pago` sin pago aprobado pasa a `cancelado` a los 30
      minutos fijos, con pago `pendiente`, reserva liberada e hito registrado.
- [ ] `POST /public/tienda/v1/pedidos/:codigo/cancelar` cancela un pedido
      `pendiente_pago`, libera la reserva y devuelve `200`.
- [ ] Cancelar un pedido en cualquier otro estado devuelve `409` y no modifica
      nada.
- [ ] La expiración es idempotente: repetirla no duplica hitos ni libera stock
      dos veces.
- [ ] Un pedido pagado o aceptado nunca expira.
- [ ] Si la expiración y el webhook de pago compiten, gana uno solo: no queda un
      pedido cancelado con pago aprobado ni un pedido pagado sin reserva.
- [ ] La disponibilidad del depósito principal vuelve exactamente al valor
      anterior a la reserva.

### 14. Listar pedidos en el panel con filtros, conteos y paginación

Alimentar la tabla de pedidos con el recorte pedido y los conteos de las
pestañas.

Criterios de aceptación:
- [ ] `GET /pedidos` devuelve la página, el total del recorte y los conteos por
      estado, del más reciente al más antiguo.
- [ ] Los filtros de estado, rango de fechas, forma de entrega y búsqueda se
      combinan.
- [ ] La búsqueda encuentra por código, nombre, email o teléfono, de forma
      parcial y sin distinguir mayúsculas.
- [ ] Los conteos se calculan sobre búsqueda, fechas y entrega, sin aplicar el
      estado seleccionado; `todos` es la suma de los estados.
- [ ] El rango de fechas es inclusivo y usa la fecha de creación en hora local
      de Argentina.
- [ ] `porPagina` por defecto es 20 y el máximo es 100; valores inválidos
      devuelven `400`.
- [ ] Un estado, una fecha o una forma de entrega inválidos devuelven `400`.
- [ ] El listado sólo incluye pedidos de la cuenta y un recorte vacío devuelve
      `200` con lista vacía y conteos en cero.

### 15. Ver el detalle del pedido, su historial y su comprobante

Mostrar en la ficha todo lo que el admin necesita para despachar y operar el
pedido.

Criterios de aceptación:
- [ ] `GET /pedidos/:codigo` devuelve comprador, entrega, ítems, totales, peso
      y caja de envío, pago, envío PAQ.AR, venta, comprobante, motivo de rechazo
      e historial.
- [ ] La entrega muestra dirección completa con código postal o punto y horario
      de retiro, según corresponda.
- [ ] El pago muestra proveedor, estado, operación, importe y fecha; nunca
      credenciales.
- [ ] El comprobante muestra tipo, número, fecha y archivo, o estado pendiente.
- [ ] `GET /pedidos/:codigo/comprobante` devuelve el archivo de la cuenta; si
      no existe o es de otra cuenta, `404`.
- [ ] El seguimiento sólo se muestra con código; en retiro no hay bloque de
      correo.
- [ ] El historial muestra los hitos con fecha y hora y la última actualización.
- [ ] Un pedido de otra cuenta devuelve `404`.

### 16. Aceptar un pedido pagado y generar la venta real

Convertir la reserva en una venta del sistema existente, con impacto en stock,
métricas y liquidaciones, sin duplicar la venta.

Criterios de aceptación:
- [ ] Sólo se acepta un pedido `pagado` con pago `aprobado`; cualquier otro
      estado o pago devuelve `409`.
- [ ] La aceptación crea exactamente un movimiento de venta desde el depósito
      principal hacia el exterior, con las cantidades y precios congelados.
- [ ] La venta queda asociada al cliente CONSUMIDOR FINAL de tipo `particular`
      y al medio de pago MercadoPago de la cuenta; nunca a MOSTRADOR.
- [ ] La venta se registra por el total del pedido (productos más envío), con
      las líneas de libro por el subtotal de productos.
- [ ] La reserva se convierte; el stock físico baja una sola vez y la reserva
      deja de restarse.
- [ ] El pedido pasa a `aceptado`, guarda los identificadores de venta y
      movimiento y registra el hito.
- [ ] La venta aparece en las consultas de ventas, métricas y liquidaciones como
      una venta normal.
- [ ] Las liquidaciones de autores usan las líneas de libro; el envío no se
      atribuye a autores.
- [ ] Aceptar dos veces o en paralelo produce una sola venta; la segunda
      operación devuelve `409`.
- [ ] Si falta el cliente CONSUMIDOR FINAL o el medio MercadoPago, devuelve
      `409` con un mensaje accionable y no genera venta.
- [ ] Un pedido de otra cuenta devuelve `404`.

### 17. Emitir la Factura B automática y reintentar sin duplicar la venta

Disparar la facturación automática de la venta aceptada, guardar el comprobante
y tolerar fallos de AFIP sin perder la venta.

Criterios de aceptación:
- [ ] La aceptación dispara la emisión automática de Factura B usando el cliente
      CONSUMIDOR FINAL; nunca usa MOSTRADOR.
- [ ] Si la emisión sale bien, se guardan tipo B, número, fecha y archivo, y la
      ficha los devuelve.
- [ ] Si AFIP falla o no está configurado, el pedido queda `aceptado`, la venta
      existe y el comprobante queda pendiente; no se duplica la venta.
- [ ] El reintento de facturación (`POST /pedidos/:codigo/facturar`) genera como
      máximo una factura y actualiza la ficha cuando sale bien.
- [ ] El total de la Factura B coincide con el total del pedido.
- [ ] El archivo del comprobante sólo es accesible para la cuenta dueña del
      pedido.
- [ ] Un pedido rechazado o cancelado nunca genera Factura B.

### 18. Rechazar pedidos con motivo y reembolsar pagos aprobados

Permitir el rechazo antes de aceptar, liberar stock y registrar el reembolso
cuando corresponda.

Criterios de aceptación:
- [ ] Se puede rechazar un pedido `pendiente_pago` o `pagado`; el motivo es
      obligatorio y el detalle es opcional.
- [ ] Rechazar un pedido `pendiente_pago` lo deja `rechazado`, libera la reserva
      y conserva el pago `pendiente`; registra el hito con el motivo.
- [ ] Rechazar un pedido `pagado` ejecuta el reembolso en MercadoPago; al
      confirmarse, el pedido queda `rechazado`, el pago `reembolsado` y la
      reserva liberada.
- [ ] El historial registra tanto el rechazo como el reembolso.
- [ ] Si MercadoPago no confirma el reembolso, devuelve `502`, el pedido sigue
      `pagado` y la reserva se mantiene; se puede reintentar.
- [ ] Rechazar un pedido `aceptado`, `enviado`, `entregado` o ya `rechazado`
      devuelve `409` y no produce efectos.
- [ ] Rechazar dos veces no duplica el reembolso ni los hitos.
- [ ] Un pedido de otra cuenta devuelve `404`.

### 19. Generar, reutilizar y descargar la etiqueta de PAQ.AR

Crear la orden y la etiqueta en PAQ.AR para un pedido aceptado con entrega a
domicilio, guardar número de envío, tracking y PDF, y permitir reintentos sin
duplicar etiquetas.

Criterios de aceptación:
- [ ] `POST /pedidos/:codigo/etiqueta` sólo funciona con `aceptado` y entrega a
      domicilio; no cambia el estado del pedido y devuelve número de envío,
      tracking, disponibilidad/URL de etiqueta y fecha de creación.
- [ ] Crea la orden con PAQ.AR `POST /orders` usando `sellerId`, `senderData`
      con el origen, `shippingData` con los datos del comprador, `parcels` con
      peso en gramos, alto/ancho/largo de la caja como height/width/depth,
      `productCategory` y `declaredValue` según los datos del pedido,
      `deliveryType: "homeDelivery"`, `saleDate`, `serviceType` y
      `shipmentClientId` con el código del pedido como referencia estable; si ya
      conoce el tracking, lo envía.
- [ ] Genera el PDF con PAQ.AR `POST /labels` y `labelFormat: "10x15"`.
- [ ] Repetir la generación devuelve la misma etiqueta y no crea una segunda
      orden ni etiqueta en PAQ.AR.
- [ ] Si PAQ.AR ya creó la orden o la etiqueta pero falló la persistencia local,
      el reintento la adopta por la referencia estable del pedido y la guarda
      sin duplicarla.
- [ ] La etiqueta se guarda con número de envío de PAQ.AR, tracking, archivo/URL
      del PDF, estado, eventos y fecha de creación.
- [ ] La etiqueta usa el peso y la caja congelados en el pedido, no los valores
      actuales de los libros, de la caja ni del promedio de la cuenta.
- [ ] `GET /pedidos/:codigo/etiqueta` devuelve el PDF sólo para la cuenta dueña;
      `404` si no existe o es de otra cuenta y `409` si es retiro.
- [ ] Si PAQ.AR falla, devuelve `502` con `proveedor_no_disponible`, el pedido
      sigue `aceptado`, no hay etiqueta y se puede reintentar.
- [ ] Si falta la configuración de PAQ.AR, devuelve `422` con
      `correo_no_configurado`; si la dirección es inválida, `422` con
      `direccion_invalida`; si falta peso, `422` con `peso_faltante`. En todos
      los casos el pedido sigue `aceptado`.
- [ ] Si PAQ.AR informa una etiqueta duplicada que no se puede reconciliar con
      este pedido, devuelve `409` con `etiqueta_duplicada`.
- [ ] Un pedido de retiro devuelve `409` con `sin_envio` y no genera etiqueta.
- [ ] Generar la etiqueta no registra fecha de despacho ni cambia el estado a
      `enviado`.

### 20. Marcar pedidos como enviados y entregados

Registrar el despacho, generando la etiqueta si falta, y la entrega respetando
la forma de entrega y la máquina de estados.

Criterios de aceptación:
- [ ] `POST /pedidos/:codigo/enviar` sólo funciona con `aceptado` y entrega a
      domicilio; si no hay etiqueta, la genera; si ya existe, la reutiliza; luego
      registra la fecha de despacho y deja el pedido `enviado`.
- [ ] Si la etiqueta no se puede generar por configuración o datos, devuelve
      `422` con el código correspondiente (`correo_no_configurado`,
      `direccion_invalida`, `peso_faltante`); si falla PAQ.AR, devuelve `502`
      con `proveedor_no_disponible`. En todos los casos el pedido sigue
      `aceptado`, no registra despacho y se puede reintentar.
- [ ] Si la etiqueta se creó pero falla el registro del despacho, el reintento
      reutiliza la etiqueta y no crea otra.
- [ ] El código de seguimiento lo asigna PAQ.AR; no se acepta un código
      manual en el despacho.
- [ ] Marcar enviado un pedido con retiro o en otro estado devuelve `409`.
- [ ] `POST /pedidos/:codigo/entregar` funciona con `enviado`, o con `aceptado`
      y retiro en local; registra la fecha y deja `entregado`.
- [ ] Marcar entregado un `aceptado` con envío a domicilio devuelve `409`.
- [ ] Repetir una acción ya aplicada devuelve `409` y no duplica hitos ni
      etiquetas.
- [ ] Un pedido de retiro no genera etiqueta ni seguimiento de correo.
- [ ] Un pedido de otra cuenta devuelve `404`.

### 21. Consultar y persistir el seguimiento de PAQ.AR

Mantener el estado y los eventos del envío a partir del tracking, con URL
pública y tolerancia a errores del proveedor.

Criterios de aceptación:
- [ ] `GET /pedidos/:codigo/envio` devuelve proveedor PAQ.AR, número de envío,
      tracking, estado actual, última actualización, URL pública, datos de
      etiqueta y eventos del más reciente al más antiguo.
- [ ] Si no hay código, devuelve el bloque sin código y sin URL; en retiro
      devuelve `409` con código `sin_envio` y no hay bloque de correo.
- [ ] La URL es el link público que devuelva PAQ.AR si existe; si no, la página
      general `https://www.correoargentino.com.ar/formularios/e-commerce`.
- [ ] `POST /pedidos/:codigo/envio/refrescar` consulta PAQ.AR `/tracking`,
      guarda estado y eventos (`status`, `statusId`, `facility`, `date`, `sign`
      cuando vienen) y deduplica eventos repetidos.
- [ ] Si PAQ.AR no responde o el código no existe, devuelve `200` con el último
      estado conocido y un error entendible; no pierde datos.
- [ ] El estado del envío puede cambiar sin cambiar el estado del pedido.
- [ ] Un pedido de otra cuenta devuelve `404`.

### 22. Dejar datos de ejemplo para verificar el panel

Cargar un escenario de tienda que permita recorrer el listado, la ficha y las
acciones sin depender de MercadoPago, MiCorreo ni PAQ.AR reales.

Criterios de aceptación:
- [ ] El seed deja al menos un pedido en cada estado y ambos tipos de entrega.
- [ ] Incluye pagos aprobados, pendientes, rechazados y reembolsados.
- [ ] Incluye un pedido rechazado por falta de stock, un envío en tránsito con
      eventos y un envío con error de PAQ.AR.
- [ ] Incluye un pedido aceptado con etiqueta generada y otro con error de
      generación de etiqueta; ambos con su PDF o error visible.
- [ ] Incluye dos integraciones, una activa y una inactiva, MercadoPago
      conectado, MiCorreo configurado, PAQ.AR configurado, retiro en local, caja
      default y peso promedio.
- [ ] El seed es idempotente: correrlo dos veces no duplica pedidos, eventos ni
      integraciones.
- [ ] El listado y la ficha muestran los datos del seed con los mismos filtros y
      conteos que espera el front.

### 23. Cubrir integración, concurrencia, aislamiento y regresión

Verificar el flujo completo y los casos borde que pueden romper stock, pagos o
datos entre cuentas.

Criterios de aceptación:
- [ ] El flujo completo crear → pagar → aceptar → enviar → entregar deja stock,
      venta, Factura B, métricas y liquidaciones coherentes.
- [ ] El rechazo, la cancelación y la expiración liberan la reserva y restauran
      la disponibilidad exacta.
- [ ] Dos pedidos concurrentes por el último ejemplar no superan el límite
      negativo; uno recibe `409`.
- [ ] Dos aceptaciones concurrentes generan una sola venta y una sola factura.
- [ ] Dos webhooks iguales no duplican pagos, hitos ni ventas.
- [ ] La cotización usa el `pesoKg` de cada libro y el `pesoPromedioKg` como
      fallback; si un libro no tiene peso y no hay promedio, el envío falla con
      `peso_faltante` y el retiro sigue disponible.
- [ ] Generar la etiqueta dos veces no duplica la orden ni la etiqueta en
      PAQ.AR; si el proveedor ya la creó, el reintento la adopta y la persiste
      una sola vez.
- [ ] Una falla de PAQ.AR al generar etiqueta deja el pedido `aceptado`, sin
      despacho y con reintento posible.
- [ ] PAQ.AR `/tracking` persiste eventos deduplicados; una falla conserva el
      último estado conocido y permite reintentar.
- [ ] Los errores de MiCorreo y PAQ.AR se mapean a `correo_no_configurado`,
      `peso_faltante`, `direccion_invalida`, `proveedor_no_disponible` o
      `etiqueta_duplicada`, según corresponda.
- [ ] Las pruebas de token/auth, cotización, alta/etiqueta, tracking, errores y
      reintentos usan HTTP mockeado, sin credenciales reales.
- [ ] Una dirección inválida al generar etiqueta deja el pedido `aceptado` y
      permite reintentar con una dirección corregida; una vez creada la
      etiqueta, la dirección no se puede cambiar.
- [ ] Un pedido de retiro no genera etiqueta ni seguimiento.
- [ ] Una integración inactiva o revocada no crea pedidos, pero los pedidos ya
      creados siguen visibles y operables.
- [ ] El panel y la API pública nunca devuelven claves completas, tokens ni
      credenciales.
- [ ] Un pedido, una integración, un comprobante o un envío de otra cuenta no se
      puede leer ni operar.
- [ ] El catálogo público y el admin devuelven los mismos valores de base para
      los campos comunes: libro, precio, portada, disponibilidad y
      personas/roles activos.
- [ ] La disponibilidad coincide entre catálogo público, admin y checkout para
      el mismo libro y momento.
- [ ] Las rutas no contienen consultas de catálogo ni reglas de stock/pedidos;
      usan los mismos servicios/repositorios compartidos.
- [ ] El serializer público no expone porcentajes, montos, email, datos fiscales
      ni información interna.
- [ ] Las migraciones aplican sobre una base con datos existentes sin modificar
      ventas, movimientos, clientes ni stock, salvo el backfill del límite
      negativo y el peso nulo de los libros existentes.
