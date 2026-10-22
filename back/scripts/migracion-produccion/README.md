# Migración de producción (MariaDB → Postgres)

Proceso de datos para llevar las cuentas reales de la app vieja (`epublit_prod`,
MariaDB 10.9) al modelo nuevo (Postgres + Drizzle). **No es código de la app**:
vive fuera de `src/` y se corre a mano.

Cuentas migradas: `1, 3, 4, 5, 6, 21, 22, 24` (ver `config.ts`). Quedan afuera
`test` (id 2) y las cuentas vacías.

## Archivos

| archivo | responsabilidad |
|---|---|
| `config.ts` | cuentas, conexión MySQL/Postgres y validación de destino |
| `extraer.ts` | MySQL → JSON intermedio (auditable, no toca Postgres) |
| `analisis.ts` | transacciones migrables/salteadas, ventas y aperturas de stock |
| `cargar.ts` | JSON → Postgres en una sola transacción, con `--reset` |
| `verificar.ts` | compara el JSON de origen contra el Postgres destino |
| `index.ts` | CLI (`--dry-run`, `--reset`, `--json`, `--desde-json`, `--forzar`) |

## Variables de entorno

Origen (defaults entre paréntesis):

```
MYSQL_HOST=127.0.0.1        # 127.0.0.1
MYSQL_PORT=3307             # 3307
MYSQL_USER=root             # root
MYSQL_PASSWORD=root         # root
MYSQL_DATABASE=epublit_prod # epublit_prod
```

Destino: se reusan las variables de la app (`DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASS`, `DB_NAME`) o sus equivalentes `MIGRACION_DB_*`. **La base destino
tiene que terminar en `_migracion`**; si no, el script aborta salvo
`MIGRACION_ALLOW_TARGET=1`. Además, `--reset` nunca toca `epublit`,
`epublit_test`, `postgres`, `template0` ni `template1`, ni siquiera con el flag.

## Rehearsal desde cero

```bash
cd back

# 1. Base destino separada (no tocar epublit ni epublit_test)
PGPASSWORD='Lautaro123.' psql -h localhost -p 5432 -U postgres \
  -c "CREATE DATABASE epublit_migracion;"

# 2. Migraciones Drizzle
DB_NAME=epublit_migracion npm run db:migrate

# 3. Corrida en seco: extrae MySQL y reporta, sin escribir Postgres
DB_NAME=epublit_migracion npm run migracion:prod -- --dry-run

# 4. Carga completa + verificación (todo en una transacción)
DB_NAME=epublit_migracion npm run migracion:prod -- --reset
```

El JSON intermedio queda en `scripts/migracion-produccion/datos.json` (ignorado
por git). Se puede cambiar con `--json <ruta>`. Para recargar sin volver a leer
MySQL (por ejemplo, si el dump ya se auditó):

```bash
DB_NAME=epublit_migracion npm run migracion:prod -- --desde-json \
  --json scripts/migracion-produccion/datos.json --reset
```

`--reset` trunca las tablas de dominio (`users`, `clientes`, `libros`,
`movimientos`, `ventas`, etc.) con `RESTART IDENTITY`, siempre dentro de la base
destino validada. Es lo que hace repetible la migración:

```bash
DB_NAME=epublit_migracion npm run migracion:prod -- --reset
# tiene que volver a dar VERIFICACIÓN OK: 0 diferencias
```

## Corte en producción

1. Parar la app vieja (no debe haber escrituras).
2. Dump final de MariaDB:
   `mysqldump --single-transaction --routines --triggers --no-tablespaces ...`
3. Restaurarlo en el MariaDB local de corte y apuntar `MYSQL_*` ahí.
4. Crear el Postgres nuevo vacío y correr `npm run db:migrate`.
5. `npm run migracion:prod -- --reset` contra el destino de producción
   (`DB_NAME=epublit_migracion` o el nombre final; si no termina en
   `_migracion`, usar `MIGRACION_ALLOW_TARGET=1` de forma explícita).
6. Confirmar `VERIFICACIÓN OK: 0 diferencias` en el log.
7. Levantar la app nueva. El volumen `files/` se reusa; no se copian PDFs.

Los `file_path` se guardan con el prefijo que espera el storage nuevo
(`facturas/...` o `remitos/...`), preservando el nombre original. La columna
`movimientos.file_path` es `varchar(255)` desde la migración `0011`; si el
esquema del destino quedó viejo, `cargar.ts` aborta y pide aplicar las
migraciones Drizzle antes de cargar.

## Qué verifica `verificar.ts`

- Conteos: `users`, `clientes`, `personas`, `libros`, `precio_libros`,
  `precio_libro_cliente`, `libro_cliente`, `libros_personas`, movimientos
  comerciales, movimientos de apertura, líneas y ventas.
- Stock exacto por libro en el depósito principal y por par cliente+libro en el
  depósito del cliente.
- `count(ventas)`, `sum(ventas.total)` y ejemplares vendidos.
- Que no haya stock negativo.
- Que todo movimiento tenga al menos una línea.
- Que cada venta tenga un cliente existente y de la misma cuenta que el
  movimiento.
- Fechas de movimientos y `created_at` de precios.
- `file_path` de los movimientos.
- Hash de password y username de los usuarios.
- Conteos de soft delete de libros/personas.

Sale con exit code 1 si encuentra cualquier diferencia.

## Decisiones y límites conocidos

- **Transacciones sin líneas**: hay 20 ventas del origen con `total = 0` y sin
  `libros_transacciones`. No se convierten en movimientos (un movimiento no
  puede quedar sin líneas). La verificación de ventas compara contra las 931
  ventas migrables, no contra las 951 crudas; las 20 salteadas se listan en el
  reporte.
- **Aperturas negativas de clientes**: son el descuadre del origen (en los datos
  actuales: 18 pares por 46 ejemplares). Se corrigen con un movimiento `baja`
  desde el depósito del cliente hacia el exterior, con `es_migracion = true`,
  para que el stock final sea exactamente el del origen. No se toca el depósito
  principal.
- **Aperturas negativas del principal**: no hay en los datos actuales. Si
  aparecieran, el script aborta salvo `--forzar`.
- **`movimientos.file_path`**: el origen tiene paths de hasta 94 caracteres
  (103 con el prefijo). La migración `0011_redundant_kabuki` define la columna
  como `varchar(255)`; el script ya no altera el esquema en runtime y aborta si
  el destino no tiene esa migración aplicada.
- **`libro_cliente` con cliente no migrado**: se descartan los pares donde el
  cliente no pertenece a una cuenta migrada (3 pares en los datos actuales).
- **Liquidaciones históricas**: no se migran; la tabla vieja no existe en este
  dump.
- **Archivos**: no se copian. Se preserva el nombre y se agrega el prefijo de
  carpeta del storage nuevo.
- **Fechas**: se leen con `time_zone = '+00:00'` y `dateStrings`, y se insertan
  sin conversión en columnas `timestamp without time zone`.
- **IDs**: `users`, `clientes`, `personas`, `libros`, `precio_libros` y
  `precio_libro_cliente` conservan su id (`OVERRIDING SYSTEM VALUE`); al final
  se avanzan todas las secuencias con `setval`.
