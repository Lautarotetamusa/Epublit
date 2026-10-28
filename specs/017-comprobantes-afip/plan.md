# Plan: Comprobantes AFIP y remitos estructurados

Estado: aprobado por el usuario (2026-10-27). Backend y frontend
implementados; pendiente QA manual cross-browser y revisión/commit.

## Historia

Como administrador de una editorial quiero que las facturas AFIP (A/B/C/M) y
los remitos (consignación/devolución) se guarden como datos fiscales
estructurados y se rendericen en el panel, para poder consultarlos,
reimprimirlos y auditarlos sin depender de PDFs en disco ni de Chromium.

## Resumen de la propuesta

- Una tabla base `comprobantes` guarda lo común a factura y remito, con un
  enum `tipo`. Una tabla `facturas` 1:1 guarda sólo los datos fiscales de
  AFIP. Los remitos son filas de `comprobantes` con `tipo='remito'`, sin tabla
  extra: no tienen datos fiscales propios y el `motivo` se elimina.
- `pedidos.comprobante_id` reemplaza el snapshot duplicado
  `comprobante_tipo/numero/fecha/file_path/estado`.
- `movimientos.file_path` deja de usarse para comprobantes nuevos; queda sólo
  como dato histórico sin uso.
- **No se migran comprobantes históricos.** Los pedidos/ventas anteriores al
  deploy no tendrán comprobante estructurado y el panel los mostrará sin
  comprobante. Los PDFs viejos no se sirven, no se migran y no se conservan
  como funcionalidad.
- El front renderiza factura y remito desde un DTO JSON y usa
  `window.print()` para imprimir/guardar como PDF.
- Se elimina Puppeteer/Chromium y las plantillas HTML/CSS de factura/remito se
  mueven al front.
- Se bloquea el acceso público a `/files/facturas`, `/files/remitos` y
  `/files/etiquetas`.

### Qué significa `es_legado`

Era un flag para marcar comprobantes reconstruidos desde PDFs históricos. Como
esta iteración **no migra históricos**, `es_legado` desaparece del modelo y del
DTO. No hay endpoint `/comprobantes/:id/archivo` porque no hay PDFs de
comprobantes que servir: los nuevos se renderizan desde datos y los viejos no
se conservan como funcionalidad.

## Decisiones que necesito que confirmes

El plan asume estos defaults. Si alguno cambia, se ajustan las tareas
marcadas.

1. **Remitos incluidos en esta iteración.** Se estructuran facturas y remitos,
   porque el objetivo final es eliminar Chromium. Si preferís un primer PR
   sólo de facturas, los remitos siguen generando PDF y Puppeteer no se puede
   retirar todavía.
2. **Venta directa ante fallo de AFIP.** La venta y el movimiento se
   conservan; el comprobante queda `error` y se reintenta por
   `POST /comprobantes/:id/reintentar`. Hoy la venta se revierte si AFIP
   falla. Si preferís mantener el rollback, se simplifica este flujo pero se
   conserva el acoplamiento entre venta y AFIP.
3. **Históricos fuera de alcance.** No se migran comprobantes viejos, no se
   reconstruyen datos fiscales desde PDFs y no se sirven PDFs históricos. Los
   pedidos/ventas viejos aparecen sin comprobante en el panel.
4. **Ruta canónica.** `GET /comprobantes/:id` para el DTO.
   `GET /pedidos/:codigo/comprobante` deja de devolver PDF y se retira; el
   front usa el `id` del resumen.
5. **Impresión.** El MVP usa el diálogo del navegador (“Guardar como PDF”).
   No se agrega una librería de PDF en el cliente.
6. **Archivos públicos.** Se bloquean las carpetas sensibles; portadas,
   fotos y logos siguen públicos.

## Alcance

### Incluye

- Facturas AFIP A/B/C/M de ventas de mostrador y de pedidos de la tienda.
- Remitos de consignación y devolución.
- Persistencia de snapshots inmutables y respuesta cruda de AFIP.
- DTO JSON para renderizar en el panel.
- Vista imprimible A4 de factura y remito, inline en fichas y en ruta propia.
- Eliminación de Puppeteer/Chromium y de la generación de PDFs nuevos.
- Bloqueo de acceso público a PDFs viejos de factura/remito/etiqueta.

### No incluye

- Migración/backfill de comprobantes históricos.
- Conservación o visor de PDFs históricos de comprobantes.
- Tienda pública o storefront: si el comprador necesita ver la factura, se
  define en otra historia.
- Envío automático de facturas por email.
- Reconciliación masiva de históricos contra AFIP.
- Cambios en el cálculo fiscal de IVA, percepciones o bonificaciones.
- Migración global de importes `real` a `numeric` en todo el sistema.
- Numeración nueva de remitos: se conserva la regla actual `0003/<movimiento>`
  para no alterar comprobantes existentes.

## Modelo de datos

### Tabla base `comprobantes`

Contiene sólo lo común y la identidad del documento. Una fila por comprobante,
siempre scoped por `user`.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | integer identity | `unique()`, PK compuesta `(id, user)` |
| `user` | integer | not null, FK `users.id`; es el emisor |
| `tipo` | enum | `factura_a`, `factura_b`, `factura_c`, `factura_m`, `remito` |
| `movimiento_id` | integer | not null |
| `punto_venta` | integer | not null; factura usa el PV de la cuenta, remito usa 3 |
| `numero` | integer | nullable hasta emitir; > 0 cuando existe |
| `fecha` | date | nullable hasta emitir |
| `estado` | enum | `pendiente` / `emitida` / `error` |
| `moneda` | varchar(3) | not null default `ARS` |
| `importe_subtotal` | numeric(14,2) | not null default 0, ≥ 0 |
| `importe_total` | numeric(14,2) | not null default 0, ≥ 0 |
| `emisor` | jsonb | not null; snapshot al crear |
| `receptor` | jsonb | not null; snapshot al crear |
| `items` | jsonb | not null default `[]`; snapshot al crear |
| `plantilla_version` | integer | not null default 1 |
| `creado_en` | timestamp | not null default now() |
| `actualizado_en` | timestamp | not null default now() |

El `tipo` granular (`factura_a`, `factura_b`, etc.) evita columnas nullable
para la letra/código AFIP y permite que la numeración sea única por tipo, punto
de venta y número. El remito no tiene datos fiscales propios: es una fila de
`comprobantes` con `tipo='remito'`. La distinción consignación/devolución ya
vive en `movimientos.tipo`; no hace falta guardarla en el comprobante.

`user` se mantiene como FK porque es la clave de multi-tenant y el dueño del
comprobante, no un duplicado del emisor fiscal. **No se agregan `emisor_id` ni
`receptor_id`**: los datos fiscales de ambas partes viven únicamente en los
snapshots `emisor` y `receptor`. Si hace falta rastrear el cliente, se llega
por la venta/movimiento (`ventas.id_cliente`), sin una FK extra en el
comprobante.

### Tabla `facturas`

Extensión 1:1 de `comprobantes` para lo específico de AFIP.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `comprobante_id` | integer | PK, FK `comprobantes(id)` |
| `codigo_afip` | integer | not null; 1/6/11/51, coherente con `tipo` |
| `cae` | varchar(20) | nullable hasta emitir; obligatorio en emitida |
| `cae_vencimiento` | date | nullable |
| `resultado` | enum | nullable; `A` / `R` |
| `observaciones` | jsonb | not null default `[]` |
| `datos_afip` | jsonb | nullable; request/response crudo, uso interno |
| `qr_url` | text | nullable |
| `numero_esperado` | integer | nullable; número que se intentó emitir |
| `importe_envio` | numeric(14,2) | not null default 0, ≥ 0 |
| `importe_descuento` | numeric(14,2) | not null default 0, ≥ 0 |
| `importe_neto` | numeric(14,2) | not null default 0, ≥ 0 |
| `importe_iva` | numeric(14,2) | not null default 0, ≥ 0 |
| `importe_exento` | numeric(14,2) | not null default 0, ≥ 0 |
| `importe_no_gravado` | numeric(14,2) | not null default 0, ≥ 0 |
| `importe_tributos` | numeric(14,2) | not null default 0, ≥ 0 |
| `descuento_porcentaje` | numeric(5,2) | not null default 0, entre 0 y 100 |
| `error_codigo` | varchar(40) | nullable |
| `error_mensaje` | text | nullable |
| `intentos` | integer | not null default 0 |
| `procesando_desde` | timestamp | nullable; claim de emisión |
| `ultimo_intento_en` | timestamp | nullable |
| `emitido_en` | timestamp | nullable |

`importe_total`/`importe_subtotal`/`moneda` se comparten con el remito en la
tabla base. Las columnas fiscales que sólo existen en factura quedan acá. Los
remitos no tienen fila en `facturas`. Mapeo de `tipo` a `codigo_afip`:
`factura_a=1`, `factura_b=6`, `factura_c=11`, `factura_m=51`.

### Emisor, receptor e ítems: por qué se guardan snapshots

`comprobantes.user` identifica la cuenta/emisor para el aislamiento. No hay
FK al cliente ni al usuario emisor más allá de esa cuenta: `emisor`,
`receptor` e `items` se guardan como snapshots JSONB con los datos exactos del
momento de emisión. El cliente se puede rastrear por la venta/movimiento
(`ventas.id_cliente`) si hace falta, pero el comprobante no depende de esa fila
para renderizarse.

**Ventajas del snapshot:**

- El comprobante queda inmutable: cambiar después la razón social, el
  domicilio, la condición fiscal o el CUIT del emisor no altera una factura ya
  autorizada por AFIP.
- Lo mismo para el receptor: si el cliente se edita o se da de baja, la
  factura sigue mostrando los datos que se usaron al emitirla.
- No hay que hacer joins ni versionar las tablas maestras para reimprimir.
- Es la única forma de auditar exactamente qué datos respaldó el CAE.
- El snapshot de ítems también es necesario: el título, el ISBN y el precio
  pueden cambiar después de la venta.

**Desventajas:**

- Duplica datos que ya están en `users`/`clientes` (pocos campos, un JSONB por
  comprobante).
- Puede divergir de los datos maestros; eso es intencional, no un bug.
- Es menos consultable que columnas normalizadas. Si más adelante se necesitan
  reportes por condición fiscal al momento de emitir, se pueden agregar
  columnas generadas o una tabla de snapshots tipada.
- Hay que tratarlo como inmutable: el servicio no debe actualizar `emisor`,
  `receptor` ni `items` después de crear la fila.

La alternativa de guardar sólo las FKs es más "normalizada", pero hace que una
factura histórica cambie si se edita el cliente o el usuario. Eso no es
aceptable para un comprobante fiscal. La recomendación es: `user` como FK de
tenant + snapshots para renderizar y auditar, **sin** `receptor_id` ni
`emisor_id`. Si se quiere evitar JSONB, se puede hacer una tabla
`comprobantes_partes` con columnas tipadas, pero agrega tablas y joins sin
resolver el problema de fondo: el dato histórico tiene que quedar congelado.

### Reglas de integridad

- FK `(movimiento_id, user)` → `movimientos(id, user)` en `comprobantes`.
- `unique(user, movimiento_id)`: un movimiento tiene un único comprobante.
- `facturas` es 1:1 con `comprobantes` por `comprobante_id` PK/FK. Los remitos
  no tienen tabla de extensión.
- `unique(user, tipo, punto_venta, numero)` parcial en `comprobantes` con
  `numero is not null`: no se repite numeración por tipo, punto de venta y
  número. Como el `tipo` distingue Factura A/B/C/M y remito, dos tipos
  distintos pueden compartir número, que es lo correcto.
- `pedidos.comprobante_id` nullable, FK compuesta `(comprobante_id, user)` a
  `comprobantes(id, user)`, con índice único parcial para que un comprobante
  no esté en dos pedidos.
- Check de importes ≥ 0 y descuento entre 0 y 100.
- `facturas.codigo_afip` sólo acepta 1/6/11/51.
- Check de coherencia: si `tipo` es `factura_*` debe existir una fila en
  `facturas`; si `tipo='remito'` no debe existir. La DB puede reforzarlo con
  un trigger; el servicio lo garantiza.
- Check de emisión: factura `emitida` con `numero` y `cae`; remito `emitida`
  con `numero`.
- Índices: `(user, estado)`, `(user, fecha)`, `(user, tipo)`.

### Qué pasa con los datos viejos

- No se crea ninguna fila para comprobantes anteriores al deploy.
- `pedidos.comprobante_tipo`, `comprobante_numero`, `comprobante_fecha`,
  `comprobante_file_path` y `comprobante_estado` quedan en la tabla **sin uso**
  y sin migrar. Se pueden eliminar en una limpieza posterior.
- `movimientos.file_path` queda en la tabla **sin uso** para filas nuevas
  (siempre `null`) y con los valores viejos intactos. No se expone en la API y
  no se sirve por `/files`.
- Los PDFs viejos de `files/facturas` y `files/remitos` se dejan de servir y
  se pueden borrar en una limpieza posterior; no se migran ni se conservan
  como funcionalidad.
- Un pedido o venta viejo devuelve `comprobante: null`. El front muestra un
  estado vacío específico (“Comprobante no disponible para operaciones
  anteriores al refactor” o similar), no “pendiente” ni un botón de reintento.

## Diseño de API

### `GET /comprobantes/:id`

Sesión del panel. `401` sin sesión. `404` si el id no existe, es inválido o
pertenece a otra cuenta. `200` con `{ success: true, data: DTO }`:

```json
{
  "success": true,
  "data": {
    "id": 42,
    "clase": "factura",
    "estado": "emitida",
    "plantillaVersion": 1,
    "tipo": { "codigo": 6, "letra": "B", "nombre": "Factura B" },
    "puntoVenta": 1,
    "numero": 42,
    "numeroCompleto": "00001-00000042",
    "fecha": "2026-10-27",
    "cae": "75123456789012",
    "caeVencimiento": "2026-11-06",
    "resultado": "A",
    "observaciones": [],
    "moneda": "ARS",
    "importes": {
      "subtotal": 25000,
      "envio": 3200,
      "descuento": 0,
      "neto": 25000,
      "iva": 0,
      "exento": 0,
      "noGravado": 0,
      "tributos": 0,
      "total": 28200
    },
    "emisor": {
      "razonSocial": "Editorial Ejemplo",
      "cuit": "30-12345678-9",
      "condicionFiscal": "Responsable Inscripto",
      "domicilio": "Av. Siempre Viva 123",
      "ingresosBrutos": null,
      "inicioActividades": "01/02/2020",
      "email": "admin@editorial.com",
      "logoUrl": null
    },
    "receptor": {
      "razonSocial": "CONSUMIDOR FINAL",
      "cuit": null,
      "documento": null,
      "condicionFiscal": "Consumidor Final",
      "domicilio": null,
      "condicionVenta": "Contado"
    },
    "items": [
      {
        "isbn": "9780000000001",
        "titulo": "Título del libro",
        "autor": null,
        "cantidad": 2,
        "precioUnitario": 12500,
        "descuentoPorcentaje": 0,
        "importeDescuento": 0,
        "subtotal": 25000
      },
      {
        "isbn": null,
        "titulo": "Envío",
        "autor": null,
        "cantidad": 1,
        "precioUnitario": 3200,
        "descuentoPorcentaje": 0,
        "importeDescuento": 0,
        "subtotal": 3200
      }
    ],
    "qr": {
      "url": "https://www.afip.gob.ar/fe/qr/?p=...",
      "dataUrl": "data:image/png;base64,..."
    },
    "error": null,
    "creadoEn": "2026-10-27T13:45:00.000Z",
    "emitidoEn": "2026-10-27T13:45:02.000Z"
  }
}
```

Reglas del DTO:

- `estado`: `pendiente`, `emitida` o `error`.
- En remito: `clase: "remito"`, `tipo: null`, `qr: null`, `cae: null`,
  `estado: "emitida"`. No hay objeto `remito` ni `motivo`; el contexto
  consignación/devolución lo da el movimiento.
- `numero` es entero; `numeroCompleto` se deriva con ceros.
- `qr.dataUrl` se genera en el backend con `qrcode` a partir de `qr_url`; el
  front no agrega dependencias.
- `datos_afip` y las rutas físicas nunca se exponen.
- En pendiente/error: `numero`, `fecha`, `cae` y `qr` nulos; `error` con el
  mensaje de AFIP.
- No hay `legado`, `archivoDisponible` ni URL de PDF.

### `POST /comprobantes/:id/reintentar`

Reintenta la emisión de una factura en `pendiente`/`error`.

- `200` con el DTO actualizado si AFIP responde bien.
- `200` idempotente si ya estaba `emitida`.
- `409` si es remito o hay una emisión en curso.
- `502` si AFIP sigue fallando; el comprobante queda `error` y reintentable.
- `404` si no existe o es de otra cuenta.

### Resumen `comprobante` en detalles

`GET /pedidos/:codigo`, `GET /movimiento/:id`, `GET /venta/:id`,
`GET /consignacion/:id`, `GET /devolucion/:id` y
`GET /ventaConsignacion/:id` incluyen:

```json
{
  "comprobante": {
    "id": 42,
    "clase": "factura",
    "estado": "emitida",
    "tipo": { "codigo": 6, "letra": "B", "nombre": "Factura B" },
    "numero": 42,
    "numeroCompleto": "00001-00000042",
    "fecha": "2026-10-27"
  }
}
```

- `comprobante: null` si la operación no tiene comprobante (incluye
  operaciones anteriores al refactor).
- `numero`/`fecha` nulos mientras esté pendiente.
- Ningún detalle devuelve `file_path`, `comprobante_file_path`,
  `archivoUrl` ni una URL pública al PDF.

### Endpoints que cambian

- `POST /pedidos/:codigo/aceptar`: devuelve la ficha con el resumen y el
  `comprobante.id`; la factura se emite post-commit.
- `POST /pedidos/:codigo/facturar`: sigue idempotente, opera sobre el mismo
  comprobante y mantiene los códigos `409`/`502` actuales.
- `GET /pedidos/:codigo/comprobante`: deja de devolver PDF y se retira del
  contrato; el front usa `/comprobantes/:id`.
- `GET /pedidos/:codigo/etiqueta` no cambia; la etiqueta sigue siendo PDF
  autenticado.

### Seguridad

- Montar `/comprobantes` con `auth` y resolver siempre por `user`.
- Bloquear `/files/facturas`, `/files/remitos` y `/files/etiquetas` antes del
  `express.static`; mantener públicos portadas, fotos y logos.
- No loguear `datos_afip` ni tokens de AFIP.

## Flujo de emisión

### Factura de pedido

1. Aceptar un pedido crea la venta/movimiento y las filas `comprobantes` +
   `facturas` en estado `pendiente`, en la misma transacción, y setea
   `pedidos.comprobante_id`.
2. Post-commit, `invoice.service` toma un claim atómico y llama a AFIP.
3. Si AFIP responde bien, actualiza la misma fila a `emitida` con CAE,
   vencimiento, número, fecha, resultado, observaciones, importes y QR.
4. Si falla, la fila queda `error` y el pedido sigue `aceptado`; el reintento
   usa `POST /pedidos/:codigo/facturar`.
5. Dos reintentos concurrentes no llaman dos veces a AFIP: el que no obtiene
   el claim relee el estado; si ya está `emitida`, devuelve OK; si sigue en
   curso, `409`.

### Factura de venta directa

1. La venta y el movimiento se crean en una transacción con
   `movimientos.file_path = null` y las filas `comprobantes` + `facturas` en
   `pendiente`.
2. Post-commit se emite la factura, igual que en pedidos.
3. Si AFIP falla, la venta queda registrada y el comprobante queda `error`;
   se reintenta por `POST /comprobantes/:id/reintentar`.
4. No se duplica el movimiento ni el descuento de stock.

### Remito

1. La consignación/devolución crea el movimiento con `file_path = null` y una
   fila `comprobantes` con `tipo='remito'` en la misma transacción.
2. `numero` se conserva con la regla actual: `punto_venta = 3`,
   `numero = movimiento.id`; el DTO deriva `0003/00001`.
3. No hay `motivo`: la distinción consignación/devolución la da
   `movimientos.tipo`, no el comprobante.
4. No hay CAE, QR ni emisión AFIP.

### Estados e idempotencia

```text
crear pendiente ──▶ pendiente ──AFIP OK──▶ emitida
                         │
                         └──AFIP error──▶ error ──reintento──▶ emitida
```

- Remitos nacen `emitida`.
- `unique(user, movimiento_id)` y `pedidos.comprobante_id` único parcial
  evitan duplicados.
- `procesando_desde` vence a los 5 minutos para permitir reintentos tras un
  proceso muerto.
- Advisory lock por `(user, punto_venta, tipo)` alrededor de la emisión AFIP
  para no pedir el mismo número dos veces.
- `numero_esperado` queda registrado antes de llamar a AFIP. Si hay timeout o
  error 600, el reintento consulta `getVoucherInfo` y adopta el comprobante
  existente antes de emitir otro.

### QR y datos fiscales

- Corregir el QR: el campo `cuit` debe ser el CUIT del **emisor**, no el
  documento del receptor. Hoy `facturar` usa `payload.DocNro`.
- Persistir `qr_url` y generar `qr.dataUrl` en el serializer con `qrcode`.
- Persistir `datos_afip` crudo para auditoría, sin exponerlo en la API.
- No cambiar el cálculo de IVA/bonificaciones en esta historia; sólo se
  persiste y renderiza lo que ya calcula el backend.

## Tareas backend

### 1. Crear las tablas de comprobantes y vincularlas con pedidos

Crear el módulo de dominio, las dos tablas y las migraciones estructurales.

Criterios de aceptación:
- [ ] Existen `comprobantes` y `facturas` con las columnas, enums, FKs, checks
      e índices definidos, exportadas desde el schema de Drizzle.
- [ ] `comprobantes.tipo` distingue `factura_a/b/c/m` y `remito`; los remitos
      no tienen tabla de extensión.
- [ ] `pedidos.comprobante_id` existe, tiene FK compuesta por cuenta e índice
      único parcial.
- [ ] `facturas` es 1:1 con `comprobantes`; no se puede crear una factura sin
      su fila base.
- [ ] Un comprobante no puede apuntar a un movimiento de otra cuenta; un
      pedido no puede apuntar a un comprobante de otra cuenta.
- [ ] `unique(user, movimiento_id)` impide dos comprobantes para el mismo
      movimiento.
- [ ] `unique(user, tipo, punto_venta, numero)` impide repetir número dentro
      del mismo tipo y punto de venta.
- [ ] La migración no modifica datos existentes.

### 2. Extender el cliente AFIP y corregir el QR

Preparar el resultado fiscal para persistirlo y renderizarlo.

Criterios de aceptación:
- [ ] `facturar` devuelve tipo, punto de venta, número, fecha, CAE,
      vencimiento, resultado, observaciones, moneda, importe, `qrUrl` y la
      respuesta cruda de AFIP.
- [ ] El QR usa el CUIT del emisor y el documento del receptor en el campo
      correcto.
- [ ] Las fechas AFIP `yyyyMMdd` se normalizan a `YYYY-MM-DD`.
- [ ] Los errores AFIP conservan código y mensaje.
- [ ] Antes de emitir se registra `numero_esperado`; ante timeout o error 600
      se consulta `getVoucherInfo` y se adopta el comprobante existente si
      AFIP ya lo emitió.
- [ ] La emisión de la misma cuenta, punto de venta y tipo está serializada
      con un advisory lock para no pedir dos veces el mismo número.
- [ ] El mock de AFIP cubre el nuevo contrato y la reconciliación.
- [ ] Tests unitarios de mapeo, QR, errores y reconciliación pasan.

### 3. Implementar el servicio de comprobantes

Persistir facturas/remitos y exponer DTO/reintento.

Criterios de aceptación:
- [ ] `crearFactura` guarda la fila base y la fila `facturas` con snapshot de
      emisor, receptor, ítems e importes al crear la fila pendiente (no al
      emitir), más datos fiscales, `datos_afip`, `qr_url`, versión y vínculo
      al movimiento.
- [ ] `crearRemito` guarda una fila en `comprobantes` con `tipo='remito'`,
      snapshot, número, fecha y versión; no crea fila en `facturas` y no
      guarda CAE, QR ni resultado.
- [ ] `getById` devuelve el DTO sólo para la cuenta dueña; 404 cruzado.
- [ ] `reintentar` respeta estados, claims e idempotencia.
- [ ] El serializer no expone `datos_afip` ni rutas de storage.
- [ ] Cambiar después libros, clientes o datos de la cuenta no altera el
      snapshot.
- [ ] Tests de servicio, serializer, aislamiento y reintento pasan.

### 4. Integrar ventas y operaciones

Sacar la generación de archivos de `venta`, `ventaConsignacion`,
`consignacion` y `devolucion`.

Criterios de aceptación:
- [ ] Las ventas nuevas insertan `movimientos.file_path = null` y las filas
      `comprobantes` + `facturas` en `pendiente`.
- [ ] Tras el commit se emite la factura; si AFIP falla, la venta persiste y
      el comprobante queda `error`.
- [ ] La venta a cliente `negro` no crea comprobante.
- [ ] Consignación y devolución crean una fila `comprobantes` con
      `tipo='remito'` en la misma transacción, sin archivo ni fila en
      `facturas`.
- [ ] Los detalles de venta/operación devuelven `comprobante` y no
      `file_path`.
- [ ] No se duplica stock ni movimiento al reintentar.
- [ ] Tests de venta, consignación, devolución y venta-consignación pasan.

### 5. Integrar pedidos y facturación

Reemplazar el snapshot del pedido por la fila de comprobante.

Criterios de aceptación:
- [ ] Aceptar un pedido valida que la cuenta tenga punto de venta, crea una
      venta y las filas `comprobantes` + `facturas` en `pendiente`, y setea
      `pedidos.comprobante_id`.
- [ ] La factura exitosa actualiza esa fila a `emitida` y el pedido conserva
      `aceptado`.
- [ ] Si AFIP falla, el pedido sigue `aceptado`, la venta existe y el
      comprobante queda `error`.
- [ ] `POST /pedidos/:codigo/facturar` actualiza el mismo id, no crea otra
      venta ni otro comprobante.
- [ ] Dos reintentos concurrentes generan una sola emisión.
- [ ] El detalle del pedido devuelve el resumen nuevo y no
      `comprobante_file_path`.
- [ ] La factura del pedido incluye el envío y su total coincide con el total
      del pedido.
- [ ] Tests de pedidos, aceptación, reintento y aislamiento pasan.

### 6. Actualizar movimientos y serializers

Exponer el resumen en todos los detalles y retirar `file_path` público.

Criterios de aceptación:
- [ ] `GET /movimiento/:id` incluye `comprobante` con id, clase, estado,
      tipo, número y fecha.
- [ ] `GET /venta/:id`, `GET /consignacion/:id`, `GET /devolucion/:id` y
      `GET /ventaConsignacion/:id` incluyen el mismo resumen.
- [ ] Ningún detalle devuelve `file_path`, `comprobante_file_path` ni
      `archivoUrl`.
- [ ] Movimiento manual u operación vieja sin comprobante:
      `comprobante: null`.
- [ ] Operación de otra cuenta: 404.
- [ ] Tests de serializers y contratos pasan.

### 7. Bloquear archivos públicos y eliminar PDFs nuevos

Criterios de aceptación:
- [ ] `/files/facturas/...`, `/files/remitos/...` y `/files/etiquetas/...`
      devuelven 404.
- [ ] Portadas, fotos y logos siguen accesibles.
- [ ] No se genera ningún PDF para facturas o remitos nuevos.
- [ ] No existe endpoint `/comprobantes/:id/archivo` ni fallback de PDF.
- [ ] El front no usa `file_path` para comprobantes.
- [ ] Tests de seguridad y archivos pasan.

### 8. Retirar Puppeteer y las plantillas del backend

Criterios de aceptación:
- [ ] `puppeteer` desaparece de `package.json`, `package-lock.json` y
      `allowScripts`.
- [ ] El `Dockerfile` ya no instala Chrome ni define variables de Puppeteer.
- [ ] El build ya no copia las plantillas de factura/remito.
- [ ] Se eliminan `lib/comprobantes` y su mock; los tests usan el nuevo
      servicio.
- [ ] `npm run build`, `npm test` y `npm run lint` pasan sin Chrome.
- [ ] Las etiquetas de envío siguen funcionando con su PDF autenticado.

### 9. Documentación y verificación backend

Criterios de aceptación:
- [ ] `npm run docs:api` actualiza `back/docs/api.md`.
- [ ] La colección Bruno documenta `/comprobantes/:id` y el reintento.
- [ ] `GET /files/facturas` queda documentado como 404.
- [ ] `npm test`, `npm run lint`, `npm run lint:cycles` y
      `npm run lint:duplicates` pasan.

## Tareas frontend

### 1. Capa de API y tipos

Crear el contrato tipado y eliminar las rutas públicas de archivo.

Criterios de aceptación:
- [ ] `front/src/api/comprobantes.ts` expone `ComprobanteResumen`,
      `ComprobanteDTO` y `getComprobante(id)`.
- [ ] `Operacion`, `VentaDetalle`, `MovimientoDetalle` y `PedidoDetalle`
      incluyen `comprobante` y dejan de exponer `file_path`/`archivoUrl`.
- [ ] Los listados que no muestran comprobante no hacen fetch extra.
- [ ] `npm run build` pasa.

### 2. Documento A4 de factura y remito

Construir la vista imprimible desde el DTO.

Criterios de aceptación:
- [ ] `FacturaDocumento` renderiza emisor, tipo/letra/código, punto de venta,
      número, fecha, receptor, ítems, descuento, subtotal, otros tributos,
      total, CAE, vencimiento, QR y leyendas.
- [ ] `RemitoDocumento` renderiza emisor, número, fecha, cliente e ítems; no
      muestra CAE/QR ni un motivo. La página de consignación o devolución da
      el contexto.
- [ ] Los importes se muestran con formato es-AR y 2 decimales; las fechas
      `dd/mm/yyyy`; los números con ceros.
- [ ] No se usa `dangerouslySetInnerHTML`; todos los datos son texto.
- [ ] `plantillaVersion` desconocida no rompe: se usa el layout genérico.
- [ ] El QR se muestra como `<img>` con `src` data URL; si falta en una
      factura emitida, se muestra error y no se imprime.
- [ ] El CSS tiene `@page { size: A4; }`, oculta la toolbar al imprimir,
      repite cabecera de tabla y evita cortar filas/totales.
- [ ] `npm run build` y `npm run lint` pasan.

### 3. Ruta `/comprobantes/:id`

Crear la vista completa y el flujo de impresión.

Criterios de aceptación:
- [ ] La ruta queda fuera de `AppLayout`, dentro del bloque autenticado.
- [ ] Carga directa y en pestaña nueva funcionan con la sesión restaurada.
- [ ] Muestra loading, error 404/red, `pendiente`, `error` y `emitida`.
- [ ] Toolbar: Volver, título, badge de estado e Imprimir/Guardar PDF
      (sólo para `emitida`).
- [ ] `?print=1` imprime una sola vez después de cargar fuentes/imágenes y
      limpia el parámetro.
- [ ] Sin sesión redirige al login.
- [ ] La página es accesible: roles, `aria-label`, foco visible y
      `lang="es-AR"`.

### 4. Integrar en las fichas

Reemplazar los enlaces/iframes viejos por el resumen y el preview.

Criterios de aceptación:
- [ ] `FichaVentaPage` muestra el comprobante inline (preview abierto) y
      permite abrirlo en pestaña nueva; no usa `file_path`.
- [ ] `FichaPedidoPage` muestra número, fecha, estado, venta y
      “Ver comprobante”; el preview se expande a ancho completo; “Reintentar
      factura” sigue funcionando.
- [ ] Si la venta tiene comprobante `error`, muestra “Reintentar factura” y
      usa `POST /comprobantes/:id/reintentar`.
- [ ] Si no hay comprobante (operación vieja o manual), muestra “Comprobante
      no disponible” sin ofrecer reintento.
- [ ] `MovimientoDetalle` muestra “Ver comprobante” o “Ver remito” según el
      resumen; en movimientos manuales no muestra el bloque.
- [ ] `DetalleOperacion` muestra el remito o una advertencia si no existe.
- [ ] No se hace fetch de preview para `pendiente`/`error`.
- [ ] `npm run build` y `npm run lint` pasan.

### 5. Limpieza y QA

Criterios de aceptación:
- [ ] `rg "file_path|archivoUrl|comprobante_file_path|es_legado|archivoDisponible" front/src`
      no encuentra usos en componentes ni tipos de comprobante.
- [ ] No se agregan dependencias de QR/PDF (`qrcode`, `jspdf`, `pdf-lib`,
      `react-to-print`, etc.).
- [ ] Matriz manual: factura A/B/C/M, remito, pendiente, error, movimiento
      manual, operación vieja sin comprobante, otra cuenta, sin sesión.
- [ ] Impresión real a PDF en Chrome/Firefox/Safari; revisar A4, saltos de
      página, QR, logo, toolbar oculta y encabezados del navegador.
- [ ] Responsive 360/768/1280 sin overflow de página.
- [ ] Navegación por teclado y foco visible.
- [ ] Sin errores/warnings en consola.

## Pruebas y verificación

### Backend

```bash
cd back
npm test
npm run lint
npm run build
npm run lint:cycles
npm run lint:duplicates
npm run docs:api
```

Casos nuevos mínimos:

- Factura de pedido exitosa: filas base + factura `emitida`, sin archivo, con
  CAE, QR, snapshot y `pedidos.comprobante_id`.
- AFIP falla en pedido: pedido `aceptado`, venta única, comprobante `error`;
  reintento actualiza el mismo id.
- Dos reintentos concurrentes: una sola emisión y un solo CAE.
- Venta directa: un movimiento, un comprobante, sin archivo; fallo AFIP deja
  venta y comprobante `error`.
- Consignación/devolución: fila `comprobantes` con `tipo='remito'`,
  `emitida`, sin archivo y sin fila en `facturas`.
- `GET /comprobantes/:id`: owner 200; otra cuenta 404; sin sesión 401;
  pendiente/error 200.
- `GET /comprobantes/:id/archivo`: 404 (ruta eliminada).
- `/files/facturas|remitos|etiquetas` 404; portadas/fotos siguen 200.
- Operación vieja sin comprobante: `comprobante: null`, sin reintento.
- Cambiar datos maestros después de emitir no altera el DTO.

### Frontend

```bash
cd front
npm run build
npm run lint
```

No hay runner de tests en el front; la regresión visual/impresión se cubre con
la matriz manual anterior.

## Despliegue

### Release A — backend

- Migración estructural de `comprobantes`, `facturas` y
  `pedidos.comprobante_id`.
- Módulo de comprobantes, nuevos endpoints y persistencia.
- Los comprobantes nuevos se generan estructurados; no se migran históricos.
- Si el front viejo tiene que seguir funcionando entre A y B, esta release
  conserva temporalmente la generación de PDF; si back y front se despliegan
  juntos, no hace falta ese modo temporal.
- Verificar endpoints nuevos y flujos de pedido/venta.

### Release B — cutover de front y fin de PDFs nuevos

- El front consume el DTO y renderiza factura/remito.
- Se deja de generar PDF para comprobantes nuevos.
- Se bloquean `/files/facturas`, `/files/remitos` y `/files/etiquetas`.
- Se retira `GET /pedidos/:codigo/comprobante`.
- Verificar impresión, reintentos y operaciones viejas.

### Release C — limpieza

- Eliminar Puppeteer, plantillas, mock y dependencias de Chrome.
- Opcional: eliminar las columnas `pedidos.comprobante_*` y limpiar PDFs
  viejos de `files/facturas` y `files/remitos`.
- Actualizar documentación y borrar código muerto.

Si back y front se despliegan juntos, A y B se pueden fusionar en un solo PR
o release. Las releases son un runbook recomendado, no una obligación.

## Riesgos

1. **Duplicado fiscal por timeout de AFIP.** Mitigar con `numero_esperado`,
   `getVoucherInfo` y advisory lock por PV/tipo. Si no se implementa ahora,
   documentarlo y no reintentar a ciegas.
2. **Validez legal del render.** Validar campos, leyendas y QR con el contador
   antes de dejar de emitir PDFs. El layout debe incluir todo lo que exige
   AFIP.
3. **Operaciones viejas sin comprobante.** Es una consecuencia aceptada de no
   migrar históricos. El panel debe mostrar un estado vacío claro y no un
   error.
4. **Numeración de remitos.** Se conserva `0003/<movimiento>` para no cambiar
   la regla actual; si se quiere una secuencia propia, es otra historia.
5. **Enlaces viejos a `/files/...`.** Dejan de funcionar para comprobantes.
   Coordinar con el front y avisar si hay links externos.
6. **Precisión monetaria.** `numeric(14,2)` en las tablas nuevas evita errores
   fiscales; el serializer convierte a `number` para la API.
7. **Factura A / IVA.** No se cambia el cálculo actual; si se detecta que la
   discriminación de IVA es incorrecta, resolverlo en una historia fiscal
   aparte con el contador.
8. **Impresión cross-browser.** Probar Chrome, Firefox y Safari; validar A4,
   saltos de página y que la toolbar no salga impresa.

## Aprobación

Este plan queda pendiente de aprobación. Si aprobás los defaults de
“Decisiones que necesito que confirmes”, el siguiente paso es implementar por
fases, empezando por la migración y el módulo de comprobantes.
