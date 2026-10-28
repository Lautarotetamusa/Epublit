# Comprobantes: datos fiscales + render en el navegador

Estado: **planificado** en `specs/017-comprobantes-afip/plan.md`. Todavía no
implementado. El plan vigente **no migra comprobantes históricos** y usa una
tabla base `comprobantes` + una extensión 1:1 `facturas`; esta propuesta queda
como contexto de la deuda original.

Este documento describe cómo debería evolucionar la emisión de comprobantes
(facturas y remitos) para dejar de depender de Chromium/Puppeteer y de los PDFs
guardados en disco. La idea es guardar los **datos fiscales estructurados** y
renderizar el comprobante **en el navegador del usuario** cuando haga falta
verlo, imprimirlo o descargarlo.

## Situación actual

- `pedidos` guarda un snapshot de `comprobante_tipo`, `comprobante_numero`,
  `comprobante_fecha`, `comprobante_file_path` y `comprobante_estado`.
- El flujo AFIP actual genera el PDF con `ComprobanteService`, que usa
  **Puppeteer/Chromium** para renderizar plantillas HTML y escribe el archivo en
  `files/` (`movimientos.file_path` / `comprobante_file_path`).
- Los datos fiscales de la factura (tipo, punto de venta, número, CAE,
  vencimiento del CAE, resultado, observaciones, importe, moneda y respuesta
  cruda de AFIP) **no quedan en una tabla consultable**. La única fuente es el
  PDF.
- El front muestra/descarga el archivo por URL (`/files/...`).

## Problemas

- **Pérdida de información**: si se pierde el PDF, se pierde el dato fiscal.
  No se puede reconstruir ni auditar.
- **Desincronización**: el snapshot del pedido duplica datos que también viven
  en la venta/movimiento y en el PDF; puede quedar inconsistente.
- **Chromium en el backend**: imagen Docker más grande, más memoria, más
  superficie de vulnerabilidades, actualizaciones de Chrome, problemas de
  arranque en CI/servidor y dependencia de `google-chrome`/`puppeteer`.
- **PDFs en disco**: backups, permisos, limpieza, espacio y archivos huérfanos.
- **Plantillas acopladas al backend**: cambiar el diseño obliga a tocar el
  servicio y volver a renderizar archivos históricos.

## Objetivo

1. Persistir los **datos fiscales** de cada comprobante en una tabla propia.
2. Devolver esos datos por API.
3. Renderizar el comprobante en el **navegador del usuario** (panel admin y,
   si hace falta, tienda) con HTML/CSS imprimible.
4. Eliminar **Puppeteer/Chromium** del backend y dejar de guardar PDFs en disco.
5. Mantener la posibilidad de imprimir/guardar como PDF desde el navegador.

El comprobante deja de ser un archivo guardado y pasa a ser una **vista
reproducible** a partir de datos + versión de plantilla.

## Qué habría que hacer

### 1. Modelo de datos

Crear una tabla `comprobantes` (o `facturas`) por cuenta:

- `id`, `user`
- `venta_id` / `movimiento_id` (FK compuesta por cuenta)
- `tipo` (A/B/C/M), `punto_venta`, `numero`, `fecha`
- `cae`, `cae_vencimiento`, `resultado` (A/R), `observaciones`
- `importe`, `moneda`
- `datos_afip` (jsonb con la respuesta cruda de AFIP, para auditoría)
- `plantilla_version` (para reproducir el diseño histórico)
- `estado` (`pendiente` / `emitida` / `error`)
- `creado_en`, `actualizado_en`
- Único por `(user, tipo, punto_venta, numero)`.

Cambios en `pedidos`:

- Agregar `comprobante_id` (FK) y eliminar el snapshot `comprobante_*` una vez
  migrado.
- Mantener `venta_id` para llegar a la venta/movimiento.

Cambios en `movimientos` / storage:

- `movimientos.file_path` queda **sólo para comprobantes históricos** ya
  emitidos. Los comprobantes nuevos no generan archivo.
- `comprobante_file_path` deja de usarse.

### 2. Backend

- `ComprobanteService` deja de renderizar HTML/PDF y de escribir archivos.
- Después de AFIP, arma un **DTO estructurado** del comprobante y lo persiste
  en `comprobantes`.
- `facturarSiCorresponde` sigue haciendo la llamada a AFIP y vinculando la
  venta; si AFIP falla, el comprobante queda `pendiente`/`error` y se reintenta
  sin duplicar la venta.
- Endpoints:
  - `GET /pedidos/:codigo/comprobante` devuelve el DTO fiscal (JSON), no un
    PDF.
  - `GET /ventas/:id/comprobante` (o el endpoint equivalente del panel) hace lo
    mismo para ventas de mostrador.
  - Si se necesita un HTML imprimible, el front lo arma con el DTO; no hace
    falta un endpoint de archivo.
- Quitar `puppeteer` de `back/package.json`, la instalación de Chrome del
  `Dockerfile` y cualquier espera/arranque de Chromium en tests/CI.
- Mover las plantillas de factura/remito al front (o a un paquete compartido),
  no al backend.
- `FILES_PATH` sigue existiendo para portadas, fotos y otros archivos, pero no
  para comprobantes.

### 3. Front

- Crear un componente de comprobante imprimible (factura A/B/C y remito) que
  reciba el DTO fiscal:
  - datos del emisor y del comprador;
  - ítems, importes, IVA y total;
  - CAE, vencimiento, número, fecha y punto de venta;
  - QR/representación AFIP cuando corresponda.
- Usar CSS de impresión (`@page`, `@media print`) y `window.print()` para
  “Imprimir / Guardar como PDF”.
- Si se quiere un botón de descarga directa sin diálogo de impresión, evaluar
  una librería de PDF en el cliente (`pdf-lib`, `jsPDF`, etc.) a partir del
  mismo DTO. No es obligatorio para el MVP.
- El botón “Ver/Descargar comprobante” del pedido abre esta vista, no un
  `/files/...`.
- Para la tienda externa, exponer el DTO (o una vista imprimible hosteada) y
  que el storefront renderice con su propio diseño. No se sirve un PDF
  generado por el backend.

### 4. Reproducibilidad y legado

- Guardar `plantilla_version` en cada comprobante. Si el diseño cambia, el
  front debe poder renderizar versiones anteriores o mantener una plantilla
  genérica que incluya todos los campos obligatorios.
- Backfill: para comprobantes históricos, intentar reconstruir los datos
  fiscales desde la venta/AFIP/PDF. Si no es posible, conservar el PDF actual
  como legado y marcarlo como “histórico”.
- Migración en una spec propia, con feature flag o despliegue en dos pasos:
  1. crear tabla y empezar a guardar datos sin dejar de generar PDFs;
  2. cambiar el front a renderizar desde datos y dejar de generar PDFs;
  3. quitar Puppeteer/Chromium y limpiar archivos.

## Beneficios

- **Backend más liviano**: sin Chromium, menos memoria, imagen más chica, menos
  CVEs y actualizaciones.
- **Sin PDFs en disco**: menos backups, permisos, espacio y archivos huérfanos.
- **Dato fiscal como fuente de verdad**: auditable, consultable y
  reconciliable.
- **Render siempre actualizado**: el front puede mejorar la vista sin
  re-renderizar archivos históricos.
- **Más rápido**: no hay que esperar un navegador headless para aceptar un
  pedido o vender.

## Trade-offs y preguntas abiertas

- **Envío automático por email**: si el sistema tiene que mandar un PDF adjunto
  sin intervención del usuario, el render en navegador no alcanza. Opciones:
  que el usuario imprima/descargue, generar el PDF en el cliente y adjuntarlo
  manualmente, usar una librería de PDF sin Chromium en el backend, o un
  servicio externo. Definir si el email es un requisito.
- **Validez legal**: AFIP/ARCA exige los datos fiscales y una representación
  imprimible. Hay que asegurar que la vista incluya todos los campos, leyendas
  y QR obligatorios. Validar con el contador.
- **Comprobantes históricos**: decidir backfill vs. conservar PDFs legados.
- **Remitos**: el mismo cambio aplica a los remitos (hoy también pasan por
  Puppeteer). Si se quiere reducir alcance, se puede empezar por facturas y
  dejar remitos para después.
- **Storefront externo**: si el comprador necesita ver la factura, el
  storefront tiene que implementar la vista o consumir un HTML/DTO nuestro.
- **Impresión**: probar `@page`, márgenes, saltos de página y encabezados del
  navegador en Chrome/Firefox/Safari.

## Plan de implementación futuro

1. Spec y migración de `comprobantes` + backfill/legado.
2. Backend: persistir DTO, endpoints JSON, quitar render/PDF.
3. Front: vista imprimible y botón de impresión/descarga.
4. Quitar Puppeteer/Chromium del `package.json`, Dockerfile y CI.
5. Tests: mapeo AFIP, persistencia, reintento, aislamiento por cuenta,
   impresión (snapshot/DOM) y regresión de ventas/remitos.
6. Limpieza de PDFs históricos según la decisión de backfill.

La implementación se planifica en `specs/017-comprobantes-afip/plan.md` y
queda pendiente de aprobación antes de ejecutarse.
