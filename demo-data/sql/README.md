# SQL de la demo

Estos archivos se generan desde los JSON de `demo-data`: las fuentes editables están en `demo-data/fuentes/` y los JSON de operación en la raíz de `demo-data/`.

```bash
cd demo-data/scripts
./generar_demo.sh          # regenera todo en orden
# o, si los JSON ya están al día:
./generar_demo.sh --solo-sql
```

No editar `cargar_demo.sql` a mano: se pisa al regenerar.

## Carga rápida (local)

Con PostgreSQL levantado y el `.env` del back configurado:

```bash
cd demo-data/scripts
./cargar_demo.sh
```

El script:

1. Lee `DB_*` y `FILES_PATH` de `back/.env`.
2. Corre `cargar_demo.sql` con `psql`.
3. Copia `demo-data/files/demo/` a `FILES_PATH/demo/`.

Si la demo ya existía y querés recargarla desde cero:

```bash
./cargar_demo.sh --reset
```

## Carga manual en un servidor

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f cargar_demo.sql

# En el servidor, dentro del FILES_PATH del back (por ejemplo /srv/epublit/files):
mkdir -p demo
cp -R /ruta/a/demo-data/files/demo/. demo/
```

El orden importa: el SQL inserta `portada_key` y `foto_key` con rutas `demo/...`; si las imágenes no están en el `FILES_PATH`, las fichas se ven sin imagen.

## Credenciales

- Usuario: `demo`
- Email: `demo@epublit.test`
- Password: `demo12345`

El hash de bcrypt está fijo en `cargar_demo.sql`. Para cambiarlo, generá uno nuevo:

```bash
cd back
node -e "require('bcrypt').hash('otra-password',10).then(console.log)"
```

y reemplazalo en `fuentes/cuenta.json` (`password_hash`).

## Qué inserta

- 1 cuenta, 3 roles, 2 clientes por defecto, 3 depósitos y 5 medios de pago.
- 7 colecciones, 49 personas y 62 libros.
- 71 participaciones autor/libro/rol, 10 reseñas.
- 10 clientes con depósito propio.
- 129 movimientos (ingresos, reprints, consignaciones, devoluciones, bajas y ventas).
- 92 ventas, 88 facturas A/B y 19 remitos.
- 3 anticipos y 3 liquidaciones con 85 personas, 106 líneas y 13 pagos.
- 8 pedidos de tienda con 19 items, pagos, envíos, seguimiento e historial.
- 2 páginas publicadas del CMS con 7 bloques.

## IDs y secuencias

Los IDs de la demo van de `9.000.001` en adelante. Al final del SQL se ajustan las secuencias de las tablas con identidad para que la app siga insertando por encima de ese rango.

El script aborta si ya existe un usuario `demo` o si el rango de IDs está ocupado. Para volver a cargar, corré `limpiar_demo.sql` (o `--reset`).

`limpiar_demo.sql` borra toda la operación de la cuenta demo (catálogo, ventas, comprobantes, liquidaciones y pedidos). No toca otras cuentas.

## Imágenes y licencias

Las portadas son de diseño propio y las fotos vienen de Wikimedia Commons. La trazabilidad completa está en `../ATRIBUCIONES.md`.
