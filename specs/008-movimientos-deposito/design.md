# Design: Mover libros entre depósitos

Estado: aprobado por el usuario

## Historia

Como usuario quiero poder mover libros entre depósitos: cada libro puede tener
una cantidad en un depósito y otra en otro, y el stock de un libro es la suma de
sus depósitos. Administro depósitos (crear, editar, eliminar, ver su stock y ver
el desglose de un libro) y registro **movimientos** —ingreso desde el exterior,
baja hacia el exterior o transferencia entre depósitos— de varios libros a la
vez, atómicos, con un historial consultable. No existe la edición directa de
stock: la única forma de crear o modificar stock es un movimiento.

## Qué se construyó

El front de la historia completo, sobre `/front`, con los componentes del sistema
de diseño (`front/src/design-system/`, importados siempre por su barrel) y datos
de muestra en memoria (ver "Datos necesarios" #12). El backend de depósitos y
movimientos todavía no existe (ver `plan.md` de esta misma carpeta), así que la
persistencia está simulada; **el planner no necesita leer nada de acá más allá de
"Datos necesarios"**.

### Pantallas y rutas

| Ruta | Pantalla |
| --- | --- |
| `/depositos` | Listado de depósitos (nombre, `Principal`, descripción, títulos y ejemplares) + "Nuevo depósito" en un `Dialog`. El footer de la tarjeta resume el total. |
| `/depositos/:id` | Ficha del depósito: nombre y descripción editables; **Stock del depósito** (total + tabla de libros con su cantidad); **Eliminar depósito** con las dos reglas de bloqueo. |
| `/movimientos` | Pantalla central: alta de movimiento (tipo + origen/destino + libros con cantidad) e **historial** del más reciente al más antiguo, con detalle en un `Dialog` al hacer clic en una fila. |
| `/libros` | El stock pasa a ser un **total de sólo lectura** (columna "Stock total", "Sin stock" cuando es 0) y se suma la acción de bulk "Nuevo movimiento (N)" sobre los libros seleccionados. |
| `/libros/nuevo` | Se quita el campo Stock; una `Alert` explica, en el lugar donde estaba el campo, que el stock se carga con un movimiento. |
| `/libros/:isbn` | Se quita el campo Stock del formulario y se agrega la tarjeta **Stock** (total + desglose por depósito + "Registrar movimiento"). |
| `/ventas/nueva` | El picker de libros de una venta en firme muestra el disponible **del depósito principal** y lo dice ("El stock sale del depósito principal («Depósito central»)."). |
| `/consignaciones` | Igual criterio que la venta en firme. El stock en poder de clientes (que es contra lo que opera "Venta sobre consignación" y la devolución) **no se toca**: sigue siendo un mundo aparte. |

Se agregó una sección **DEPÓSITO** al sidebar (entre CATÁLOGO y COMERCIAL) con
Depósitos (`building-2`) y Movimientos (`package`).

### La pantalla de movimientos

El problema de diseño central era expresar origen y destino sin ambigüedad. En
vez de exponer dos pickers libres (que permiten combinaciones inválidas como
exterior → exterior y obligan a explicar la regla), la pantalla arranca por el
**caso**, con un `SegmentedControl`: Ingreso, Baja, Transferencia. Cada caso fija
un extremo en el exterior y deja el otro como depósito:

- **Ingreso**: Origen `Exterior` (rótulo, no control) → Destino (depósito, por
  defecto el principal).
- **Baja**: Origen (depósito) → Destino `Exterior`.
- **Transferencia**: Origen → Destino, con el depósito ya elegido excluido de la
  otra lista (los dos extremos nunca pueden coincidir).

La ayuda del tipo de movimiento explica el caso en una línea ("Pasa stock de un
depósito a otro"), y la **ruta** se dibuja como una franja enfrentada con la
flecha en el medio, con el mismo par de iconos en todas las pantallas
(`building-2` para un depósito, `arrow-up-right` para el exterior). Esa franja se
repite en el historial y en el detalle, así que la dirección de un movimiento se
lee de un vistazo.

Libros: misma pieza base que usan venta/consignación/devolución
(`SeleccionLibrosField`), pero en `SeleccionLibrosMovimiento` sin precio —un
movimiento no toca el precio— y con una columna que dice cuánto hay en el
depósito de origen. El picker ofrece `Título (N)` con N = disponible en el origen
y deshabilita los libros que no están en ese depósito.

**El error atómico, visible.** A propósito las cantidades **no se topean** contra
lo disponible: la pantalla deja pedir de más y avisa *antes* de registrar. Si
algún libro no alcanza, se marca la celda "Disponible en …" en rojo, aparece una
`Alert` de error que lista libro por libro ("«Breve historia del cine»: pedís 999
y hay 10"), dice explícitamente **"No se movió nada"** y el botón queda
deshabilitado. Si aun así se dispara (el stock cambió entre el render y el
submit), el rechazo no deja stock a medio mover ni un movimiento a medias en el
historial, el formulario queda intacto para corregir y se refresca lo disponible.
La decisión de topear o no fue deliberada: con el tope en el widget el estado de
error era inalcanzable y la regla de atomicidad no se veía en ningún lado.

**Historial**: tabla de Fecha, Movimiento (badge del tipo derivado de sus
extremos), Origen, Destino y Libros ("2 títulos · 17 ejemplares"), con paginación
del sistema. El detalle abre en un `Dialog` (mismo patrón que el detalle de una
consignación) desde la fila, porque el listado ya trae los libros.

### Reglas de negocio que la pantalla hace visibles

- **Un depósito con stock no se elimina.** En la ficha, `Alert` de advertencia
  con el número exacto ("«Depósito Norte» tiene 27 ejemplares en 3 títulos"),
  botón deshabilitado y atajo "Mover este stock" que abre el movimiento con ese
  depósito como origen.
- **El principal no se elimina.** Otro texto, distinto lugar y otro tono: `Alert`
  informativa ("Es el depósito con el que se creó tu cuenta y existe siempre"),
  y el botón deshabilitado. Los dos casos se ven juntos en la misma tarjeta
  "Eliminar depósito" para que la diferencia quede clara.
- **Nada edita stock directamente.** No hay ningún input de cantidad-de-stock en
  todo el front: el formulario de libro ya no tiene el campo, la ficha del libro
  muestra el total en sólo lectura, y la única entrada de cantidades es el alta de
  movimiento (o la edición de una línea antes de registrarlo).
- **Un libro nuevo no tiene stock.** Después de guardarlo, la tarjeta Stock de su
  ficha muestra el estado vacío con el atajo "Registrar ingreso", que abre el
  movimiento con el libro precargado (`?tipo=ingreso&isbns=…`).

### Decisiones de formato

- **Listado de depósitos en tabla, no en tarjetas**: un depósito no tiene un
  objeto visual que lo identifique (a diferencia de la portada de una colección) y
  lo que importa son sus cifras; tabla con columnas numéricas mono alineadas a la
  derecha, como el resto de los listados.
- **Alta en `Dialog`, edición en la ficha**: crear un depósito son dos campos, así
  que se resuelve sin salir del listado; editar y eliminar viven en la ficha
  (hace falta lugar para explicar el bloqueo, mismo criterio que en colecciones).
- **Cantidades en JetBrains Mono**, títulos de tarjeta y cifras destacadas en
  Spectral, un solo matiz de marca para los badges (`success` ingreso, `warning`
  baja, `brand` transferencia). Sin colores nuevos ni fuera de los tokens.
- **Sin cambios de responsive**: la app no es responsive hoy (sidebar fijo de 248
  px); esta historia sigue ese criterio.

### Archivos principales

- `front/src/api/deposito.ts` — tipos `Deposito`, `Extremo`, `Movimiento`,
  `RegistrarMovimientoInput`, `StockEnDeposito`, `DesgloseLibro`. A propósito **no**
  llama a la API: es la forma que necesita la pantalla mientras no exista el
  backend.
- `front/src/features/depositos/depositosMock.ts` — persistencia simulada de
  depósitos, cantidades por depósito y movimientos, con las reglas de negocio
  (mover es atómico, el principal no se borra, un depósito con stock tampoco) y la
  línea base del stock que todavía informa `/libro` (ver #12).
- `front/src/features/depositos/` — `DepositosPage`, `FichaDepositoPage`,
  `DepositoFormDialog`, `DepositoFormFields`, `useDepositos`, `useDeposito`,
  `useCatalogoParaStock`.
- `front/src/features/movimientos/` — `MovimientosPage`, `useMovimientoForm`,
  `SeleccionLibrosMovimiento`, `MovimientoDetalleDialog`, `ExtremoDisplay`,
  `movimientoFormato` (tipo derivado, badge, fecha, resumen), `precargaMovimiento`,
  `useMovimientos`.
- `front/src/features/libros/StockLibroCard.tsx` — tarjeta Stock de la ficha.
- Modificados: `features/libros/LibroFormFields.tsx` (sin campo Stock),
  `NuevoLibroPage`, `FichaLibroPage`, `useFichaLibro`, `useLibros` (total calculado),
  `CatalogoPage` (columna y bulk), `api/libro.ts` (sin `stock` en el payload),
  `features/ventas/useVentaForm.ts` + `NuevaVentaPage`,
  `features/consignaciones/useConsignacionForm.ts` + `ConsignacionesPage`,
  `features/operaciones/SeleccionLibrosField.tsx` (prop `hint` compartida),
  `App.tsx`, `layout/AppLayout.tsx`.

### Cómo probarlo

Con el backend y el front corriendo (`front`, login `libreria_sur` /
`seed12345`):

1. `/depositos`: hay 3 depósitos de muestra —Depósito central (principal, 454
   ejemplares), Norte (27) y Once (vacío)—. Crear uno nuevo lo agrega al listado;
   desde su ficha se borra (confirmación) y desaparece.
2. `/depositos/2`: tiene stock, así que el borrado está bloqueado y ofrece "Mover
   este stock". `/depositos/1`: el principal, con su propio mensaje.
3. `/libros/9781000000011`: la tarjeta Stock muestra 25 en total repartidos entre
   Depósito central (15) y Norte (10).
4. `/movimientos`: con Transferencia (Norte → Once, 5 de "Poemas del sur") el
   historial crece, aparece el toast y el detalle se abre solo. Volver a
   `/depositos/3` muestra los 5 ejemplares. Con 999 de "Breve historia del cine"
   desde Norte se ve el error atómico: la celda en rojo, el aviso con lo que falta
   y "No se movió nada", y el historial sin cambios.
5. `/libros`: la columna Stock total refleja los movimientos (El jardín de los
   senderos 49 = 19 + 30 de un ingreso; La casa vacía 35 = 43 − 8 de una baja).
6. `/libros/nuevo`: ya no hay campo Stock y se explica cómo se carga.
7. `/ventas/nueva` y `/consignaciones`: el picker dice de dónde sale el stock.

### Iteración 2 (verificación en navegador)

Verificado renderizando con Chromium sobre el dev server y el backend reales, sin
errores de consola:

- Transferencia Norte → Once de 5 ejemplares: el movimiento queda en el historial
  como "29/9/2026 · Transferencia · Depósito Norte → Depósito Once · 1 título · 5
  ejemplares" y el detalle coincide.
- Sobre-pedido (999 de un libro con 10 en el origen): `Alert` "No hay stock
  suficiente en «Depósito Norte»… pedís 999 y hay 10. No se movió nada", botón
  deshabilitado y **el historial no suma ningún movimiento** (atomicidad).
- Alta + borrado de un depósito: toast de confirmación en los dos pasos.
- Borrado bloqueado con stock: "«Depósito Norte» tiene 27 ejemplares en 3 títulos".
- Ficha de libro: 25 = 15 (principal) + 10 (Norte), coherente con el total de
  `/libro`.
- `tsc -b`, `oxlint` y `npm run build` sin errores nuevos (quedan sólo los avisos
  que ya tenía el proyecto).

Se corrigió un bug encontrado en esa pasada: en un ingreso, el selector de destino
excluía el depósito principal por creer que era el origen (el origen de un ingreso
es el exterior, no un depósito).

> Nota: el backend del working tree no compila hoy por un error ajeno a esta
> historia (`back/src/container.ts`, wiring del módulo colección) y el mock vive en
> memoria, así que **recargar la página reinicia los datos de muestra**.

## Datos necesarios

Nada de depósitos ni movimientos existe hoy en el backend. Acá va sólo la
**capacidad** que necesita cada pantalla; cómo se expone (rutas, forma del
request/response, paginación, bajas lógicas) lo decide el planner. El `plan.md` de
esta carpeta ya cubre la mayor parte; lo que sigue es el contrato leído desde la
pantalla, con lo que agrega respecto del plan.

### 1. Listar los depósitos del usuario (lectura)

Por cada depósito: identificador, nombre, descripción (puede no existir) y si es
el principal. Además, para el listado: **cuántos títulos y cuántos ejemplares
tiene**, para no tener que traer el stock de cada uno sólo para mostrar el
resumen. Nunca puede faltar el principal.

### 2. Crear un depósito (escritura)

Nombre (obligatorio) y descripción (opcional). El depósito creado nunca es el
principal.

### 3. Editar un depósito (escritura)

Nombre y descripción. El flag de principal no se puede cambiar.

### 4. Eliminar un depósito (escritura) — regla de negocio con dos rechazos distintos

Sólo si **no es el principal** y **no tiene stock**. La pantalla necesita poder
distinguir un rechazo del otro para mostrar mensajes distintos, y el mensaje del
rechazo por stock tiene que poder decir cuántos ejemplares y títulos lo bloquean.
Los movimientos históricos que mencionan un depósito eliminado tienen que seguir
siendo legibles (el historial muestra el nombre del depósito en su origen/destino,
no un identificador suelto).

### 5. Ver el stock de un depósito (lectura)

Los libros que tiene, con título, ISBN y cantidad, **acotado a ese depósito** (la
pantalla no puede depender de tener el catálogo entero para filtrarlo). Sólo
aparecen los que tienen cantidad mayor a 0.

### 6. Ver el desglose de un libro (lectura)

Para un libro: el total y, por cada depósito donde tenga stock, su nombre y la
cantidad. Es lo que muestra la tarjeta Stock de la ficha.

### 7. El total de stock del libro, en todos los listados (lectura)

El `stock` de un libro (en la ficha, el catálogo y la búsqueda del selector) tiene
que ser la suma de sus depósitos, y el libro **no** puede recibir stock en el alta
ni en la edición (el plan ya lo define). La pantalla usa ese total para mostrarlo
y para pedirle el desglose a #6.

### 8. Registrar un movimiento (escritura) — atómico, con rechazo identificable

Un movimiento tiene origen y destino, cada uno un depósito o el exterior, y una
lista de libros con su cantidad (varios a la vez). El único extremo que consume
saldo es un depósito en el origen.

La pantalla necesita, cuando algún libro no alcanza:

- que **no se aplique nada** (ni stock ni movimiento en el historial);
- que el rechazo sea **distinguible** de los demás errores de la operación;
- que se pueda decir, **libro por libro, cuánto se pidió y cuánto había** —hoy lo
  calcula y lo muestra el propio front contra el stock del origen, y el mensaje
  del rechazo tiene que ser compatible con eso—;
- que no modifique el precio del libro.

### 9. Historial de movimientos (lectura)

Del más reciente al más antiguo, y **paginable** (la pantalla ya tiene el
componente de paginación; hoy el mock pagina en el cliente). Por cada movimiento:
fecha, origen y destino —cada uno con su tipo y, si es un depósito, su nombre— y
los libros movidos con título y cantidad. El detalle de una fila no puede
depender de una segunda consulta por movimiento: el listado ya trae los libros.

### 10. Detalle de un movimiento (lectura)

Los mismos datos, por identificador, para poder abrir un movimiento puntual (hoy
se llega desde el historial, que ya tiene todo; si el listado dejara de traer los
libros, la pantalla necesita esta lectura).

### 11. Cuánto hay de un libro en el depósito principal (lectura)

Las operaciones que ya existían y descuentan stock (venta en firme, consignación)
y la que lo devuelve (devolución) operan sobre el **depósito principal**, no sobre
el total del libro. Para que sus formularios no ofrezcan de más, necesitan, por
libro, **la cantidad disponible en el principal** (y el nombre del principal, que
la pantalla ya muestra en la ayuda del picker). Hoy lo resuelve el mock; con el
total del libro la ayuda y el número del picker quedarían mintiendo.

### 12. Datos de muestra inventados en esta pasada (mock temporal, no es contrato)

Viven en `front/src/features/depositos/depositosMock.ts`, **se pierden al
recargar** y son sintéticos: no son datos de la editorial.

| Depósito | Nombre | Descripción | Contenido |
| --- | --- | --- | --- |
| 1 | Depósito central | "Planta baja del edificio, junto al área de expedición." | principal; todo lo que no se movió |
| 2 | Depósito Norte | "Galpón de Av. Cabildo, entrepiso. Acceso por portón lateral." | 3 títulos, 27 ejemplares (bloquea su borrado) |
| 3 | Depósito Once | — (sin descripción, para ver el caso) | vacío (se puede borrar) |

Movimientos de muestra (4, con los tres tipos) y las cantidades que dejan: "Breve
historia del cine" 15 + 10, "Poemas del sur" 33 + 5, "Relatos de invierno" 38 + 12,
más un ingreso de 30 de "El jardín de los senderos" y una baja de 8 de "La casa
vacía" (así el catálogo muestra un total distinto del que hoy devuelve `/libro`,
que es justamente el punto de la historia). Las cantidades se apoyan en una regla
del mock: **un libro sin movimiento vive entero en el depósito principal**, que es
el estado post-migración que describe el plan; cuando un movimiento lo toca, sus
cantidades pasan a vivir en el mock. Es una decisión temporal del mock, no una
propuesta de cómo se guarda el stock.

Agent: ses_f129c2c59ffeMACJMvviipfBF3
