# demo-data — datos para la cuenta demo de producción

Carpeta de trabajo, fuera de `back/` y `front/`. Acá vive la demo completa: catálogo, clientes, ventas, movimientos, liquidaciones, pedidos de tienda y contenido del CMS. Todo se genera desde estos archivos y se carga con SQL.

## Qué hay

```
demo-data/
├── fuentes/                 # fuentes JSON editables
│   ├── personas.json        # 49 autores y colaboradores
│   ├── colecciones.json     # 7 colecciones
│   ├── libros.json          # 62 libros, todos en un solo archivo
│   ├── roles.json           # Autor / Ilustrador / Prólogo
│   ├── resenas.json         # enlaces de reseñas por libro
│   ├── stock_inicial.json   # overrides de stock inicial
│   ├── creditos_fotos.json  # créditos normalizados de Wikimedia
│   ├── parametros.json      # fechas, comisiones, medios, punto de venta y semilla
│   ├── cuenta.json          # identidad ficticia de la editorial
│   ├── clientes.json        # 10 librerías y clientes
│   └── contenido.json       # páginas y bloques del CMS
├── catalogo.json            # generado: catálogo completo
├── fotos.json               # generado: manifiesto de retratos
├── movimientos.json         # generado: reprints, consignaciones, bajas
├── ventas.json              # generado: 92 ventas
├── liquidaciones.json       # generado: 3 liquidaciones y 3 anticipos
├── tienda.json              # generado: integración, envíos y 8 pedidos
├── ATRIBUCIONES.md         # generado: dominio público y licencias
├── imagenes/
│   ├── portadas/            # 62 portadas 1200×1800, diseño propio
│   └── personas/            # 47 retratos de Wikimedia Commons
├── previews/                # hojas de contacto para revisar la serie completa
├── sql/                     # cargar_demo.sql, limpiar_demo.sql y el instructivo
├── files/demo/              # imágenes con las claves portada_key/foto_key
└── scripts/                 # generadores y cargador
    ├── generar_demo.sh      # orquestador: corre todo en orden
    ├── cargar_demo.sh
    ├── desplegar_demo.sh
    ├── generar_catalogo.py
    ├── descargar_fotos.py
    ├── generar_portadas.js
    ├── generar_operaciones.py
    ├── generar_atribuciones.py
    ├── generar_sql.py
    └── tipografias/         # Spectral, Manrope y JetBrains Mono (SIL OFL)
```

## Qué incluye

- **Catálogo:** 62 títulos, 49 personas, 7 colecciones, 71 participaciones y 10 reseñas.
- **Clientes:** 2 por defecto (consumidor final y mostrador) + 10 librerías con depósito propio.
- **Ventas:** 92 ventas en 5 meses (firmes y sobre consignación), con sus facturas A/B y remitos.
- **Stock:** ingresos iniciales, reprints, consignaciones, devoluciones y bajas; el stock final por depósito se recalcula desde los movimientos.
- **Derechos:** 3 anticipos y 3 liquidaciones con personas pagadas, parciales y pendientes.
- **Tienda:** 8 pedidos en todos los estados, con pagos, envíos, seguimiento e historial.
- **CMS:** 2 páginas publicadas con bloques de hero, texto, datos, cita y enlaces.

## Flujo completo (de cero a demo cargada)

La regla es simple: **primero se generan los JSON, después el SQL, y recién al final se carga**. `scripts/generar_demo.sh` hace todos los pasos en orden; no hace falta ejecutarlos a mano.

```bash
cd demo-data/scripts

# 1) Regenerar datos y SQL conservando fotos y portadas ya descargadas
./generar_demo.sh

# 2) Cargar en la base local (lee back/.env) y copiar las imágenes
./cargar_demo.sh --reset
```

Si además querés volver a descargar retratos o regenerar las portadas:

```bash
./generar_demo.sh --con-fotos      # baja retratos de Wikimedia Commons
./generar_demo.sh --con-portadas   # requiere chromium y magick
./generar_demo.sh --todo           # fotos + portadas
```

Si sólo cambiaste `generar_sql.py` y no los JSON:

```bash
./generar_demo.sh --solo-sql
./cargar_demo.sh --reset
```

### Qué se versiona y qué no

- **Se versionan:** `fuentes/*.json`, los scripts, `tipografias/`, `README.md`, `sql/README.md`, `fotos.json` y `ATRIBUCIONES.md`.
- **Se ignoran:** `imagenes/`, `previews/`, `files/`, `sql/*.sql` y los JSON generados (`catalogo.json`, `movimientos.json`, `ventas.json`, `liquidaciones.json`, `tienda.json`).

`fotos.json` y `ATRIBUCIONES.md` se conservan para no perder la trazabilidad de licencias, aunque los binarios de las imágenes no estén en el repo.

En un clon limpio no hay imágenes: el primer comando tiene que ser

```bash
./generar_demo.sh --todo   # fotos + portadas
```

Después, `./generar_demo.sh` solo regenera datos y SQL usando las imágenes existentes.

### Orden y dependencias

```
fuentes/personas.json + colecciones.json + libros.json
                    │
                    ▼
          generar_catalogo.py ──► catalogo.json
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
descargar_fotos.py          generar_portadas.js
(opcional: Wikimedia)       (opcional: Chromium + magick)
        │                        │
        ▼                        ▼
fotos.json + imagenes/personas   imagenes/portadas
        │
        ▼
generar_operaciones.py
(lee catalogo.json + fuentes/cuenta.json + fuentes/clientes.json + fuentes/parametros.json)
        │
        ▼
movimientos.json + ventas.json + liquidaciones.json + tienda.json
        │
        ▼
generar_atribuciones.py  (lee catalogo.json + fotos.json) ──► ATRIBUCIONES.md
        │
        ▼
generar_sql.py  (lee catalogo.json + generados + fuentes/*.json)
        └──► sql/cargar_demo.sql + sql/limpiar_demo.sql + files/demo/
        │
        ▼
cargar_demo.sh ──► PostgreSQL + FILES_PATH
```

### Qué es fuente y qué es generado

Todas las fuentes de datos son JSON y viven en `demo-data/fuentes/`. No hay CSV ni datos dentro de archivos `.py`: los scripts sólo contienen la lógica de generación.

| Archivo | Origen | ¿Se edita a mano? |
|---|---|---|
| `fuentes/personas.json`, `colecciones.json`, `libros.json`, `roles.json`, `resenas.json`, `stock_inicial.json`, `creditos_fotos.json` | fuente | sí |
| `fuentes/parametros.json` | fuente | sí |
| `fuentes/cuenta.json`, `clientes.json`, `contenido.json` | fuente | sí |
| `catalogo.json` | `generar_catalogo.py` | no |
| `fotos.json`, `imagenes/personas/` | `descargar_fotos.py` | no |
| `imagenes/portadas/` | `generar_portadas.js` | no |
| `movimientos.json`, `ventas.json`, `liquidaciones.json`, `tienda.json` | `generar_operaciones.py` | no: mejor ajustar el generador |
| `ATRIBUCIONES.md` | `generar_atribuciones.py` | no |
| `sql/cargar_demo.sql`, `sql/limpiar_demo.sql`, `files/demo/` | `generar_sql.py` | no |

`fuentes/` es la única carpeta que se edita a mano para cambiar datos. Si tocás `clientes.json`, `cuenta.json` o `parametros.json`, volvé a correr `generar_operaciones.py` y después `generar_sql.py`. Si sólo tocás `contenido.json` o `libros.json`, alcanza con regenerar desde el paso que corresponda (`--solo-sql` no sirve para `libros.json`: primero hay que pasar por `generar_catalogo.py`).

## Cómo cargarlo en la base

Todo va por SQL. No hace falta la API ni crear la cuenta a mano.

```bash
cd demo-data/scripts
./cargar_demo.sh
```

El script lee la conexión de `back/.env`, corre `sql/cargar_demo.sql` y copia `files/demo/` al `FILES_PATH` del back (`back/files` por defecto).

- **Usuario:** `demo`
- **Email:** `demo@epublit.test`
- **Password:** `demo12345`

Si la cuenta demo ya existe y querés recargarla desde cero:

```bash
./cargar_demo.sh --reset
```

El `--reset` corre primero `sql/limpiar_demo.sql`, que borra sólo el catálogo de la cuenta demo. El SQL usa IDs fijos desde `9.000.001` y ajusta las secuencias al final para que la app siga insertando por encima.

Para cargarlo en un servidor sin el wrapper:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/cargar_demo.sql
# y copiar files/demo/ dentro del FILES_PATH del servidor
```

Las instrucciones completas están en `sql/README.md`.

## Desplegar en un servidor con Docker

El script `scripts/desplegar_demo.sh` empaqueta el SQL y las imágenes, las sube por `scp` (SFTP) y ejecuta la carga por SSH dentro de Docker. No necesita Docker local.

```bash
cd demo-data/scripts
SSH_HOST=epublit.com.ar SSH_USER=ubuntu ./desplegar_demo.sh
```

Por defecto asume el deploy de `infra/`:

- proyecto en `/home/Epublit`
- compose `docker-compose.yml`
- servicios `db` y `back`
- archivos en `./files` (bind mount del back)

Si tu servidor usa otras rutas o nombres:

```bash
SSH_HOST=... SSH_USER=... \
REMOTE_PROJECT_DIR=/srv/epublit \
COMPOSE_FILE=docker-compose.prod.yml \
DB_SERVICE=db BACK_SERVICE=back \
./desplegar_demo.sh
```

Otras opciones útiles:

```bash
# Recargar desde cero (borra toda la operación demo)
SSH_HOST=... SSH_USER=ubuntu ./desplegar_demo.sh --reset

# Regenerar catálogo/operación/SQL y después subir
SSH_HOST=... SSH_USER=ubuntu ./desplegar_demo.sh --reset --regenerar

# Si docker requiere sudo
DOCKER_PREFIX="sudo " SSH_HOST=... ./desplegar_demo.sh

# Si los archivos están en un volumen nombrado en vez de un bind mount
FILES_MODE=container CONTAINER_FILES_PATH=/app/files SSH_HOST=... ./desplegar_demo.sh

# Ver los comandos sin ejecutarlos
SSH_HOST=... ./desplegar_demo.sh --dry-run
```

El script usa `docker compose exec -T db psql` con las variables `POSTGRES_USER/PASSWORD/DB` del contenedor, así que no necesita las credenciales de la base en tu máquina. Para los archivos, copia `files/demo` al `FILES_PATH` del host (o al contenedor con `FILES_MODE=container`).

## Cómo regenerar

La forma recomendada es el orquestador, que respeta las dependencias:

```bash
cd demo-data/scripts
./generar_demo.sh
```

Flags:

- `--con-fotos`: vuelve a descargar los retratos y actualiza `fotos.json`.
- `--con-portadas`: vuelve a generar las portadas (requiere `chromium` y `magick`).
- `--todo`: fotos + portadas.
- `--solo-sql`: no toca los JSON; sólo regenera `sql/` y `files/demo/`.

Si preferís hacerlo a mano, el orden exacto es éste:

```bash
python3 generar_catalogo.py     # 1. catalogo.json desde fuentes/*.json
python3 descargar_fotos.py      # 2. opcional: fotos.json + imagenes/personas
node generar_portadas.js        # 3. opcional: imagenes/portadas (chromium + magick)
python3 generar_operaciones.py  # 4. movimientos, ventas, liquidaciones y tienda
python3 generar_atribuciones.py      # 5. ATRIBUCIONES.md (necesita catalogo.json + fotos.json)
python3 generar_sql.py          # 6. sql/ y files/demo/
```

`generar_catalogo.py` conserva las fotos ya descargadas (las lee de `fotos.json`), así que se puede correr de nuevo sin perder los retratos. `generar_operaciones.py` **no genera clientes**: lee `fuentes/clientes.json`, que es una fuente editable, y usa una semilla fija para que el mismo catálogo produzca siempre las mismas ventas y movimientos.

## Convenciones

- **Los `slug` son estables** y se usan para referenciar personas y colecciones entre archivos. No cambiarlos sin migrar los datos que los usen.
- **`personas` de un libro** es la relación libro↔persona↔rol, con el porcentaje de derechos sugerido. Los roles son los de la cuenta demo: `Autor`, `Ilustrador`, `Prólogo`.
- **`stock_inicial`** es la cantidad con la que arranca el depósito principal antes de las ventas y consignaciones.
- **`numero_en_coleccion`** es sólo para ordenar la serie y numerar las portadas.
- **`obra`** es metadata de la obra original (año, país, muerte del autor). No es un campo del schema; sirve para auditar el dominio público.
- **`catalogo.json` es un archivo de trabajo, no el body de la API.** Tiene campos extra (`slug`, `obra`, `creditos`, `stock_inicial`, `numero_en_coleccion`) que usan los generadores para mapear; no son columnas del schema.
- **Fechas** en ISO (`YYYY-MM-DD`). **Precios** en pesos enteros.
- **ISBN** sintéticos, con dígito verificador válido y prefijo `978-987-9999`. No apuntan a ninguna edición comercial.

## Datos de la operación

- `fuentes/clientes.json` — **entrada editable**: 10 librerías y clientes con CUIT sintético, condición fiscal y depósito propio. No lo genera ningún script.
- `fuentes/cuenta.json` — **entrada editable**: identidad ficticia de la editorial demo.
- `fuentes/contenido.json` — **entrada editable**: páginas y bloques del CMS de la landing.
- `movimientos.json` — **generado**: ingresos por reprint, consignaciones, devoluciones y bajas.
- `ventas.json` — **generado**: ventas firmes y consignadas, con medio de pago, descuento, líneas y tipo de comprobante. Las ventas de tienda se marcan con `origen: "tienda"`.
- `liquidaciones.json` — **generado**: anticipos y liquidaciones por período, con líneas por autor/libro/rol y pagos.
- `tienda.json` — **generado**: integración, configuración de envíos y pedidos con items, pagos e historial.

Si editás a mano un archivo generado, después volvé a correr `generar_sql.py`; el próximo `generar_operaciones.py` lo va a pisar.

## Antes de publicar

- Revisar `ATRIBUCIONES.md` y, si la demo va a quedar pública mucho tiempo, que un abogado valide el criterio de dominio público.
- Reemplazar los enlaces de reseñas de Wikipedia por reseñas propias o del sello.
- Si la demo es pública, agregar una página de **Atribuciones** con la tabla de fotos de `ATRIBUCIONES.md`: la app no muestra el crédito de la foto por sí sola.
- Confirmar que las fotos de Wikimedia Commons sigan disponibles y con la misma licencia.
- Cambiar `razon_social`, CUIT y domicilio de `fuentes/cuenta.json` si no se quiere usar la identidad ficticia tal cual.
