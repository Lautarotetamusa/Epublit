# Plan: cantidades, PDF por autor y filtro de libros en la liquidación

## Historia

Como admin:

1. Quiero ver en el reporte, en el **detalle de cada persona**, la cantidad de
   ejemplares vendidos de cada título.
2. Quiero **imprimir el reporte de un autor en PDF** para poder enviárselo.
3. Quiero **filtrar los libros vendidos** en el período.

## 1. Cantidad vendida en el detalle por persona

- Cada línea de `detalle` (previsualización `GET /liquidacion` y ficha
  `GET /liquidaciones/:id`) agrega `cantidad`: los ejemplares del libro vendidos en el
  período que liquida esa línea.
- En las liquidaciones generadas, la cantidad queda congelada en una columna nueva,
  `liquidacion_lineas.cantidad` (integer NOT NULL, default 0).
- Backfill en la migración: las líneas ya generadas toman la suma de
  `movimientos_libros.cantidad` de las ventas cubiertas por su liquidación
  (`liquidacion_ventas`) para ese libro.
- El diálogo de detalle de la persona muestra la columna «Ejemplares».

## 2. Reporte por autor en PDF

Decisión: el PDF se genera en el navegador (`window.print()` → «Guardar como PDF»),
sin dependencias nuevas ni endpoint, y sin generar nada en el back: la ficha ya trae
todos los datos.

- Se imprime desde el diálogo de detalle de la persona, en la ficha de una liquidación
  generada (botón «Descargar PDF»), sin abrir otra pestaña. El documento queda
  montado pero oculto en pantalla; la hoja de estilos de impresión esconde la app y
  deja sólo el documento.
  - Primera versión (descartada): una ruta aparte `/liquidaciones/:id/personas/:idPersona/imprimir`
    abierta en una pestaña nueva. En la prueba manual el botón no funcionaba, y no se
    llegó a reproducir la causa.
- El título del documento (nombre de archivo que propone el navegador) es
  `<código> - <persona>`.
- El documento tiene:
  - encabezado con la razón social de la cuenta, el código de la liquidación, el
    período y la fecha de generación;
  - el nombre y los roles de la persona;
  - una tabla por libro con título, rol, ejemplares, porcentaje, importe y anticipo;
  - los totales: regalías, anticipo recuperado, total a pagar, pagado y saldo;
  - los pagos registrados.
- Queda fuera la previsualización: lo que se le envía a un autor es una liquidación ya
  generada, con código.

## 3. Filtro de libros vendidos

- La tabla «Libros vendidos en el período» de la nueva liquidación tiene un buscador
  por título o ISBN, sin distinguir acentos ni mayúsculas. Es un filtro del front,
  sin endpoint nuevo, con el mismo patrón que el buscador de personas (specs/019).
- La paginación vuelve a la primera página al cambiar la búsqueda.

## Criterios de aceptación

- [x] Vender 3 ejemplares del libro X en el período: el detalle de su autor muestra
      `cantidad: 3` en la línea de X, tanto en la previsualización como en la ficha
      generada.
- [x] Las liquidaciones generadas antes de este cambio muestran la cantidad calculada
      por el backfill.
- [ ] El PDF del autor muestra sólo sus líneas y sus totales, y coincide con la ficha.
- [ ] Buscar «978-1» o una parte del título filtra la tabla de libros.

Estado (2026-11-16): cantidades cubiertas por `test/liquidaciones.test.ts`. El backfill se verificó corriendo el UPDATE sobre la base de test: 36/36 líneas coinciden con lo que guarda el código. El PDF y el filtro de libros son de UI: falta verificarlos en el navegador.
