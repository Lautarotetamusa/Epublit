# Plan: Migración de datos de producción (MariaDB → Postgres)

## Objetivo

Llevar los datos reales de producción (app vieja, `main`, MariaDB 10.9) al
modelo del refactor (Postgres 16 + Drizzle, `refactor`), **sin perder el
histórico comercial** y con el **stock exacto** el día del corte.

Es una migración doble:

1. **Motor**: MariaDB → Postgres.
2. **Modelo**: 12 tablas viejas → 22 nuevas (multi-cuenta, ledger unificado,
   depósitos, roles, medios de pago, liquidaciones persistidas).

No incluye: diseño nuevo, cambios de funcionalidad, ni tocar el código de la
app. Es un proceso de datos (script + verificación + runbook).

## Diagnóstico

### Origen (`main`)

Base `librossilvestres`, MariaDB 10.9. Tablas relevantes:

| tabla | rol | volumen aprox. (AUTO_INCREMENT del dump 2024) |
|---|---|---|
| `users` | cuentas (multi-tenant) | ~40 |
| `libros` | catálogo (PK `id_libro`) | ~128 |
| `personas` | autores/ilustradores | ~1.109 |
| `clientes` | clientes (PK `id`) | ~181 |
| `libros_personas` | relación libro↔persona (`tipo` enum) | — |
| `precio_libros` | histórico de precios de catálogo | ~237 |
| `precio_libro_cliente` | histórico de precios por cliente | ~172 |
| `libro_cliente` | precio + **stock consignado** por cliente | — |
| `transacciones` | venta / consignación / ventaConsignacion / devolución | ~470 |
| `libros_transacciones` | líneas (cantidad, precio) | — |
| `ventas` | extensión de venta (total, descuento, medio, tipo_cbte) | — |

Tablas legacy de una versión anterior (`consignaciones`,
`libros_consignaciones`, `stock_cliente`) y una posible `liquidaciones` vieja:
**verificar en el dump si existen y tienen filas** antes de decidir.

### Destino (`refactor`)

Postgres + Drizzle, todo scopeado por `user`. Lo que importa:

- `movimientos` + `movimientos_libros`: el ledger. Cada movimiento tiene dos
  extremos (`deposito` / `exterior`) y un `tipo`
  (`ingreso`, `baja`, `transferencia`, `venta`, `consignacion`,
  `ventaConsignacion`, `devolucion`).
- `depositos` (uno `principal` por cuenta + uno por cliente con `id_cliente`)
  y `deposito_libros` (stock real, derivado).
- `ventas`: extensión del movimiento (`total`, `descuento`, `tipo_cbte`,
  `id_cliente`, `id_medio_pago`, `comision`), PK `id_movimiento`.
- `roles`, `medios_pago` (por cuenta), `liquidaciones` + líneas/personas/
  ventas/pagos, `anticipos`, `colecciones`.
- `libros.stock` quedó **vestigial**: el stock se calcula desde
  `deposito_libros` (`libro.stock.ts`).

## Estrategia

### 1. Preservar identificadores

Se conservan los ids de `users`, `libros` (`id_libro`), `personas`,
`clientes`, `precio_libros` y `precio_libro_cliente`. Evita remapear FKs y
mantiene coherencia con comprobantes/remitos ya emitidos. Al terminar se
avanzan las secuencias de Postgres (`setval`) para que los inserts nuevos no
colisionen.

`depositos`, `movimientos` y `liquidaciones` reciben ids nuevos (no existían).

### 2. Depósitos

- Un **depósito principal** por `user` (`principal=true`, nombre
  "Depósito principal").
- Un **depósito por cliente** (`id_cliente`, `principal=false`, nombre = nombre
  del cliente), para todo cliente que tenga stock consignado o lo haya tenido.

### 3. Transacciones → movimientos

Una fila de `transacciones` = un `movimiento`; sus líneas salen de
`libros_transacciones`; si es venta, se agrega la fila de `ventas`.

| `transacciones.type` | `movimientos.tipo` | origen | destino | `ventas` |
|---|---|---|---|---|
| `venta` | `venta` | depósito principal | exterior | sí |
| `consignacion` | `consignacion` | depósito principal | depósito del cliente | no |
| `devolucion` | `devolucion` | depósito del cliente | depósito principal | no |
| `ventaConsignacion` | `ventaConsignacion` | depósito del cliente | exterior | sí |

Se preservan `fecha` y `file_path`. En `ventas`: `total`, `descuento`,
`tipo_cbte`, `id_cliente`, `id_medio_pago` (resuelto por nombre) y
`comision = 0`. `movimientos_libros.precio` = el precio congelado de la línea.

`medios_pago`: se crean por cuenta los que aparezcan usados en el origen
(`efectivo`, `debito`, `credito`, `mercadopago`, `transferencia`), con
`comision = 0` (el origen no guarda comisión).

### 4. Saldos de apertura (stock exacto)

El origen guarda **contadores** (`libros.stock` = stock del principal,
`libro_cliente.stock` = stock consignado del cliente); el destino **deriva** el
stock de los movimientos. Para que ambos coincidan:

```
apertura = stock_origen − flujo_neto_de_los_movimientos_migrados
```

- Por **libro**: apertura del principal. Si `> 0`, se crea un movimiento
  `ingreso` (exterior → principal) con esa cantidad.
- Por **cliente + libro**: apertura del depósito del cliente. Si `> 0`,
  `ingreso` (exterior → depósito del cliente).
- Todos estos movimientos van con **`es_migracion = true`**, igual que la
  reconstrucción de la 0004, para que las métricas no los cuenten como
  "ejemplares nuevos".
- Si la apertura da **negativa**, es una inconsistencia del origen: se reporta
  (libro/cliente/cantidad) y el script **corta** salvo `--forzar`. Nunca se
  inventa stock negativo.
- Fecha de apertura: un día antes del primer movimiento del libro/cliente (o
  `2000-01-01` si no tiene movimientos).

### 5. Datos que arrancan vacíos o con decisión pendiente

- **Liquidaciones viejas**: el modelo viejo tiene una tabla `liquidaciones`
  (isbn, persona, período, total, file_path) sin vínculo a las ventas. El
  modelo nuevo necesita `liquidacion_ventas` para saber qué ventas ya están
  cubiertas. **Decisión pendiente** (ver abajo).
- **Anticipos**: no existen en el origen → vacío.
- **Colecciones**: no existen en el origen → vacío (los libros quedan sin
  colección).
- **Ejemplares nuevos históricos**: el origen no registra ingresos de stock
  (sólo el contador), así que las métricas de meses pasados mostrarán 0 en
  "ejemplares nuevos". Limitación conocida, no se puede reconstruir.
- **Archivos** (`files/facturas`, `files/remitos`): si el deploy nuevo apunta
  al mismo volumen, no hay que copiar nada; si no, es un paso aparte (copiar
  el volumen y mantener `file_path`).

### 6. Rehearsal y corte

1. Dump de producción (`mysqldump --single-transaction --routines --triggers
   --no-tablespaces`), restaurado en un MariaDB local.
2. Corrida **en seco** (`--dry-run`): lee el dump y emite el reporte de
   conteos e inconsistencias sin tocar Postgres.
3. Corrida completa contra un Postgres **fresco** (rehearsal) + `verificar`.
4. Corte: parar la app vieja, dump final, correr migración + verificación,
   levantar la nueva. El volumen es chico (cientos de transacciones), así que
   la ventana debería ser de minutos.

## Entregables

En `back/scripts/migracion-produccion/`:

- `extraer.ts`: MySQL → JSON intermedio (auditable, permite recargar sin
  volver a leer MySQL).
- `cargar.ts`: JSON → Postgres, en una transacción, con `--reset` para
  rehearsal.
- `verificar.ts`: compara origen y destino y falla si algo no cierra.
- `index.ts`: CLI (`--dry-run`, `--reset`, `--forzar`, `--json <ruta>`).
- `README.md`: runbook del corte.

Dependencia nueva: `mysql2` (dev) en `back`.

## Criterios de aceptación

- [ ] Los conteos por tabla coinciden con el origen (users, libros, personas,
      clientes, libros_personas, precios, transacciones/movimientos, ventas),
      salvo las tablas que se declaren fuera de alcance.
- [ ] Todo movimiento tiene al menos una línea; ninguna línea referencia un
      libro inexistente.
- [ ] Para **cada** libro: `sum(deposito_libros.cantidad)` en el principal es
      igual a `libros.stock` del origen. Cero diferencias.
- [ ] Para **cada** par cliente+libro con stock: el stock del depósito del
      cliente es igual a `libro_cliente.stock` del origen. Cero diferencias.
- [ ] `sum(ventas.total)` y `count(ventas)` coinciden con el origen.
- [ ] Ejemplares vendidos (suma de líneas de ventas y ventas consignadas)
      coincide con el origen.
- [ ] Ningún depósito queda con stock negativo.
- [ ] Las fechas de movimientos y precios se preservan exactamente (misma
      hora local).
- [ ] Los usuarios migrados pueden loguearse con su password actual (bcrypt).
- [ ] La migración es **repetible**: `--reset` + recarga da el mismo resultado.
- [ ] El reporte de verificación sale en cero diferencias.

## Decisiones tomadas (2026-10-22, sobre el dump real)

1. **Cuentas**: se migran las **8 con datos** — `caro` (1), `brumana` (3),
   `nidodevacas` (4), `feriaros` (5), `pezmenta` (6), `cgeditorial` (21),
   `Obsidiana` (22) y `Brad` (24). Queda afuera `test` (2), que concentraba
   todos los datos cruzados y las tablas legacy, y las 18 cuentas vacías.
2. **Liquidaciones históricas**: la tabla `liquidaciones` **no existe** en
   producción → no hay nada que migrar. Arrancan vacías.
3. **Tablas legacy**: `consignaciones` (29 filas, sólo de `test`, sin líneas);
   25/29 ya están duplicadas en `transacciones`. Se descartan.
4. **Archivos**: el deploy nuevo **reusa el volumen `files/`** actual; los
   `file_path` migrados apuntan a `facturas/…` y `remitos/…`, igual que la
   migración 0005.
5. **AFIP**: el layout de claves es idéntico (`afipkeys/<cuit>/` con
   `cert.crt`/`cert.pem`, `private_key.key` y `Tokens/`) → se copia la carpeta
   tal cual; no hay que re-registrar certificados. Se preservan
   `punto_venta`, `production` y `tipo_cbte`.

## Resultado del rehearsal (2026-10-22)

Contra el dump real restaurado, cargando en `epublit_migracion`:

| | origen | destino |
|---|---:|---:|
| users | 8 | 8 |
| libros | 299 | 299 |
| personas | 390 | 390 |
| clientes | 66 | 66 |
| precio_libros | 613 | 613 |
| precio_libro_cliente | 1.268 | 1.268 |
| libro_cliente | 553 | 553 |
| libros_personas | 368 | 368 |
| movimientos comerciales | 1.051 | 1.051 |
| movimientos de apertura | 315 | 315 |
| ventas | 931 | 931 |
| total facturado | $55.927.589,28 | $55.927.589,28 |

- 20 ventas sin líneas (`total = 0`) salteadas y reportadas.
- Stock principal por cuenta: coincide exacto en las 8 (5.469 / 2.780 / 1.410 /
  10.496 / 4.328 / 25 / 120 / 120).
- Stock de clientes: 2.785 ejemplares, coincide exacto.
- Aperturas: 296 ingresos al principal (33.516 ejemplares), 1 ingreso a
  depósito de cliente, 18 bajas de ajuste (46 ejemplares).
- Ningún depósito negativo; todo movimiento con al menos una línea.
- `verificar`: **0 diferencias**. Reejecutable con `--reset` sin cambios.

Cambio de esquema asociado: `movimientos.file_path` pasó de `varchar(80)` a
`varchar(255)` (migración `0011_redundant_kabuki`) porque hay rutas reales de
hasta 103 caracteres.

## Pendiente para el corte

- Provisionar Postgres en producción y correr `db:migrate`.
- Copiar `afipkeys/` y reusar el volumen `files/`.
- Definir cómo llega el código a producción: `.github/workflows/build.yml`
  sólo construye para `dev`, `staging` y `main`; `refactor` no está en la
  matriz.
- Ventana de corte (stop-the-world) y rollback (la vieja MariaDB queda
  intacta).
