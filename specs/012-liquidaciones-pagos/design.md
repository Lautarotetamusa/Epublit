# Design: Liquidaciones con pagos y anticipos

Estado: aprobado por el usuario

## Historia

La liquidación deja de ser un reporte que se mira: se genera, se guarda y se paga
en partes. Un autor/ilustrador/rol cobra un anticipo cuando se lanza un libro
nuevo (una reimpresión no genera otro anticipo), y las mismas ventas no se pueden
liquidar dos veces. Dentro de una liquidación se puede pagar una parte (le debo
$ 500 a Laura, le pago $ 200, queda anotado y se ve qué porcentaje va pagado y
cuánto falta), se ve la lista de liquidaciones con su estado (pagado / pendiente),
y se puede marcar un pago a un autor como realizado.

## Qué se construyó

La sección **Liquidaciones** pasó de ser una pantalla única (formulario de fechas
→ reporte) a cuatro superficies:

| Ruta | Pantalla |
| --- | --- |
| `/liquidaciones` | **Listado** de liquidaciones ya generadas, con su estado. |
| `/liquidaciones/anticipos` | **Anticipos**: lo que cobra cada rol al lanzar un libro. |
| `/liquidaciones/nueva` | **Generar**: período + previsualización de lo que va a entrar + generar. |
| `/liquidaciones/:id` | **Ficha**: totales, progreso de pago, por persona y pagos registrados. |

Las dos primeras son pestañas de la misma sección (`Tabs` en el encabezado, la
pestaña activa vive en la ruta para que cada una tenga enlace). El listado tiene
un `SegmentedControl` de estado (Todas / Pendientes / Parciales / Pagadas) y cada
fila muestra código, período, personas, total, una `ProgressBar` de lo pagado,
saldo y el badge de estado.

### Generar una liquidación (`/liquidaciones/nueva`)

Reemplaza al viejo formulario: el período ya no genera un reporte para mirar, sino
una **previsualización en vivo** de lo que va a quedar adentro (el reporte del
período menos lo que ya se liquidó antes) y recién después la acción "Generar
liquidación", que persiste y navega a la ficha.

- Se reusa el reporte real del backend (`GET /liquidacion`) para las líneas y los
  importes: la previsualización muestra datos reales del período.
- **Regla "no se liquidan dos veces las mismas ventas" hecha visible**: las ventas
  del período que ya están cubiertas por una liquidación anterior se sacan del
  preview y se avisan con un `Alert` ("N ventas del período ya se liquidaron en
  LQ-2026-0004 y no se vuelven a incluir"). Si todo el período ya está liquidado,
  la pantalla entera queda en un estado vacío que nombra la liquidación que lo
  cubrió, en vez de dejar generar algo duplicado.

### Ficha (`/liquidaciones/:id`)

- Encabezado con código, período y fecha de generación, badge de estado e
  "Imprimir".
- **`ProgressBar` de lo pagado** (porcentaje) + tres métricas: total, pagado,
  saldo. Es el "se ve qué porcentaje va pagado y cuánto falta" del pedido.
- Tabla **"A pagar por persona"**: persona, roles (badges), total, pagado, saldo y
  estado por persona, con dos acciones por fila (registrar pago / ver detalle) y
  un "Registrar pago" en el encabezado.
- Tabla **"Pagos registrados"**: fecha, persona, monto y nota, más la acción de
  anular un pago (con confirmación) y el total pagado en el pie de la tarjeta.

### Registrar un pago (sólo liquidaciones)

El `RegistrarPagoDialog` pide a quién, monto, fecha y una nota opcional; arranca
con el saldo completo cargado (el caso común es pagar todo) y tiene un "Pagar el
saldo completo" para volver a ese valor. Valida monto > 0 y monto ≤ saldo, y no
cierra si el pago falla. El pago puede ser **parcial** y se puede **anular** (con
confirmación). No lleva medio de pago: monto + fecha + nota.

El pago parcial vive **sólo acá**: los anticipos se pagan enteros y de una vez.

### Anticipos (`/liquidaciones/anticipos`)

Listado, no ABM: el anticipo se genera al lanzar el libro, no lo crea el usuario.
Columnas: libro (con ISBN y la marca de origen), persona, rol, lanzamiento, monto,
estado (pagado / pendiente) y la acción.

- **Pago único**: la acción es **"Marcar como pagado"** sobre el anticipo entero
  (con confirmación, sin diálogo de monto y sin parciales). El listado no reusa el
  `RegistrarPagoDialog` de las liquidaciones a propósito: acá no hay nada que
  decidir, sólo marcar el hecho.
- **Regla de la reimpresión hecha visible**: un `Alert` explica que el anticipo se
  cobra una sola vez al lanzar y que una reimpresión no genera otro; cada fila
  muestra `Reimpresión ×N · sin anticipo nuevo` (o `Lanzamiento`) para que se vea
  que el libro se reimprimió y el anticipo sigue siendo uno solo.
- **Separado de las regalías**: el anticipo no se descuenta ni se recupera de lo
  que la persona cobra por ventas. Anticipos y liquidaciones son dos cosas
  distintas y no se cruzan; el `Alert` lo dice explícitamente al pie de la regla.

### Archivos principales

- `front/src/features/liquidaciones/LiquidacionesPage.tsx` (listado + pestañas),
  `NuevaLiquidacionPage.tsx`, `FichaLiquidacionPage.tsx`,
  `TablaLiquidaciones.tsx`, `TablaAnticipos.tsx`, `RegistrarPagoDialog.tsx`.
- `DetallePersonaDialog.tsx`: se extendió con los pagos de la persona (progreso,
  pagado / falta y el historial), sin romper su uso desde la previsualización.
- Hooks: `useLiquidaciones`, `useFichaLiquidacion`, `useNuevaLiquidacion`,
  `usePrevisualizacionLiquidacion`, `useAnticipos`.
- `presentacionLiquidacion.ts` (etiqueta/tono del estado y porcentaje pagado,
  compartido entre listado, ficha y filas) y `money.ts` (ahora muestra centavos
  sólo cuando el importe los tiene: `$ 362,50`, no `$ 362,5`).
- `front/src/lib/fecha.ts` — `formatFecha` / `formatRango` (estaban duplicados en
  la pantalla vieja).
- `front/src/api/liquidaciones.ts` — contrato de datos de la liquidación
  persistida y los anticipos. `front/src/api/liquidacionesStandIn.ts` — **stand-in
  en memoria del backend que todavía no existe** (ver más abajo).
- `front/src/design-system/components/core/ProgressBar.{jsx,d.ts,prompt.md}` —
  componente nuevo del sistema de diseño (barra + cifra): no existía ninguna
  pieza de progreso y hacía falta para el porcentaje pagado. Sumado al barrel.
- Se borró `useLiquidacion.ts` (el viejo estado del reporte en pantalla quedó sin
  uso al convertirse en previsualización).

### Decisiones de formato

- **El pago es por persona dentro de la liquidación**, no un pago suelto: el
  ejemplo "le debo $ 500 a Laura, le pago $ 200" es el saldo de *una persona*
  dentro de una liquidación. El estado de la liquidación (pendiente / parcial /
  pagada) es el agregado de los estados por persona, y ninguno de los dos se
  guarda: se derivan de los pagos.
- **Los anticipos son un listado aparte y no una línea de la liquidación**: son
  otro hecho (lanzamiento, no ventas del período) y tienen su propia regla. **No
  se descuentan ni se recuperan de las regalías**: un anticipo no aparece en la
  liquidación, no baja el total a pagar por ventas y no deja saldo a recuperar. La
  sección los agrupa como dos pestañas porque son el mismo tema —lo que se le paga
  a los autores— sin agregar dos ítems más a la navegación.
- **Anticipo de pago único**, liquidación de pago parcial: son dos naturalezas
  distintas y la UI las trata distinto. El anticipo es un hecho que se marca
  ("Marcar como pagado"); la liquidación es un total que se salda de a poco
  (monto + fecha + nota, con progreso y anulación).
- **La baja de un pago existe** (con el `Dialog` de confirmación): registrar un
  pago equivocado es parte de "registrar pagos", y sin esto el único camino sería
  un pago falso en sentido contrario. Aplica **sólo a los pagos de una
  liquidación**, que es donde hay montos parciales y saldos que corregir.
- **El pago no lleva medio de pago**: monto, fecha y nota. El sistema tiene medios
  de pago, pero cruzarlos con el pago de una liquidación no está en el pedido.
- **Casing y voz**: sentencia ("Nueva liquidación", "Registrar pago"), cifras en
  mono y alineadas a la derecha, badges para el estado (nunca para acciones).
- **Sin comportamiento responsive nuevo**: la app no es responsive hoy (sidebar
  fijo de 248 px, ver specs/007-colecciones y 011-roles). Estas pantallas siguen
  ese criterio.

### Qué es mock y qué no

- **Real**: el reporte del período (`GET /liquidacion`) es el que alimenta la
  previsualización (y de ahí sale la liquidación que se genera). Los datos que se
  ven en las capturas son del seed del backend.
- **Stand-in temporal (falta el backend)**: la liquidación persistida, sus pagos,
  los anticipos y el registro de qué ventas ya están liquidadas viven en memoria
  en `api/liquidacionesStandIn.ts` (semilla de 3 liquidaciones y 4 anticipos).
  Como está en memoria, se resetea al recargar la página: generar una liquidación
  y volver a entrar al mismo período **en la misma sesión** es lo que muestra la
  regla de "no liquidar dos veces". Es la parte que falta del back, no
  comportamiento final.

## Datos necesarios

Lo de abajo es lo que cada pantalla **lee o escribe**; el cómo se expone (rutas,
parámetros, forma del request/response, dónde se guarda) lo decide el planner. No
hay ninguna propuesta de API acá.

### 1. Generar y persistir una liquidación (escritura)

Con el período (desde / hasta) se guarda una liquidación que queda con: un
identificador, un código legible (hoy `LQ-<año>-<número>`), el período, la fecha
de generación, y el detalle por persona (una por persona, con sus líneas de libro
+ rol + porcentaje + importe y su total). Hoy el importe por línea es el mismo
cálculo que ya hace el reporte (precio histórico de la venta × cantidad ×
porcentaje del rol). Después de generarla, esas ventas quedan cubiertas.

### 2. Listar las liquidaciones ya generadas (lectura)

Por cada liquidación: código, período, fecha de generación, cantidad de personas,
total, pagado, saldo y estado (pendiente / parcial / pagada). El listado se filtra
por estado. Es un set chico (una liquidación por período): la pantalla asume que
se devuelven todas y pagina en el cliente.

### 3. Ficha de una liquidación (lectura)

Todo lo del listado más el detalle por persona (persona, roles, líneas por libro
con rol y porcentaje, total) y, por persona, lo pagado, el saldo y sus pagos. Es
lo que alimenta el desglose por persona y el progreso de pago.

### 4. Registrar (y anular) un pago a una persona de una liquidación (escritura)

Contra **una persona** de una liquidación: monto, fecha y una nota opcional —
**sin medio de pago**. Tiene que poder ser **parcial** (monto menor al saldo) y
tiene que rechazar un monto mayor al saldo o menor o igual a cero. La pantalla
necesita que la liquidación vuelva con los totales y estados ya actualizados.

También hace falta **anular un pago** ya registrado, dejando el saldo de esa
persona como estaba. La anulación es de los pagos de una liquidación: es el único
lugar donde hay montos parciales y saldos que corregir.

### 5. Saber qué ventas del período ya están liquidadas (lectura)

Para la regla de no liquidar dos veces: dado un período, qué ventas (libro +
persona + rol) ya quedaron cubiertas por una liquidación anterior y en cuál. La
previsualización las excluye del total y avisa cuáles son; si el período ya está
cubierto entero, la pantalla no deja generar. Lo que hoy existe (`GET
/liquidacion`) **no** descuenta lo ya liquidado: la exclusión es parte de lo que
falta del backend, y es lo único que impide que la regla se cumpla de verdad.

### 6. Listar los anticipos vigentes (lectura)

Por cada anticipo: libro (título e ISBN), persona, rol, monto, fecha de
lanzamiento, cuántas reimpresiones tuvo el libro y si está pagado (y cuándo). No
hay montos parciales ni saldo: el anticipo está pendiente o pagado. Alcanza con
los anticipos vigentes/históricos de la cuenta; es un set chico y sin paginar.

### 7. Marcar un anticipo como pagado (escritura)

Sobre un anticipo entero, de una sola vez: **no hay monto ni pago parcial que
decidir**, y no lleva medio de pago. La pantalla sólo necesita el hecho (queda
registrado con su fecha) y el rechazo del caso "anticipo inexistente".

### 8. El anticipo se genera al lanzar el libro y la reimpresión no genera otro

La regla del negocio necesita que el sistema sepa, **por libro + persona + rol**,
cuál es el anticipo acordado y en qué momento se generó (el lanzamiento), y que
una **reimpresión** del mismo libro no cree un anticipo nuevo. Hoy el libro tiene
`fecha_edicion` pero no hay noción de reimpresión ni de anticipo: hacen falta las
dos cosas para que la pantalla de anticipos diga la verdad.

- **Monto del anticipo por persona y rol en un libro**: el listado lo muestra pero
  no lo edita; en la pantalla está como dato. Si el planner decide que se carga
  desde el sistema, el lugar natural es la ficha del libro (la relación
  libro↔persona ya tiene el porcentaje ahí) — eso queda fuera de lo construido en
  esta pasada y hay que decidirlo.
- **Reimpresiones del libro**: la pantalla sólo necesita mostrarlas (cuántas y que
  el anticipo no se multiplica). Si el producto las va a cargar como evento, hace
  falta poder registrarlas y listarlas; si son un número por libro, alcanza con
  ese número.

### 9. El anticipo está separado de las regalías (regla, no dato suelto)

El anticipo **no se descuenta ni se recupera** de las regalías: no entra en el
cálculo de una liquidación, no baja el total a pagar por ventas y no deja saldo a
recuperar en liquidaciones futuras. El backend no tiene que cruzar las dos cosas
en ningún punto (ni al generar la liquidación, ni al mostrar lo que le corresponde
a una persona). Es la contracara de la regla de negocio del pedido.

### 10. Estados que la API tiene que poder expresar

- pago de una liquidación: monto mayor al saldo, monto ≤ 0, liquidación o persona
  inexistente.
- marcar un anticipo como pagado: anticipo inexistente (o ya pagado).
- generar una liquidación de un período sin ventas pendientes (todo ya liquidado o
  sin ventas): la pantalla lo evita, pero el rechazo tiene que existir igual.

## Preguntas para el planner / a revisar

1. **Monto del anticipo**: ver el punto 8 de "Datos necesarios". El listado lo
   muestra como dato; si se carga desde el sistema, el lugar natural es la ficha
   del libro y eso quedó fuera de esta pasada.

Resueltas por el negocio (ya no son preguntas): el pago **no** lleva medio de
pago; el anticipo es de **pago único** (no parcial); y el anticipo está
**separado** de las regalías — no se descuenta ni se recupera.

## Cómo probarlo

Con el dev server del front (`npm run dev` en `/front`, hoy en
`http://localhost:3000`, usuario `libreria_sur` / `seed12345`):

- `/liquidaciones` — listado con las tres liquidaciones de la semilla (una pagada,
  una parcial, una pendiente) y el filtro por estado.
- `/liquidaciones/2` — la parcial: 23 % pago; "Registrar pago" en el encabezado o
  en la fila, pagar el saldo de Carla Gómez y ver cómo cambian el progreso, el
  estado por persona y el pie de "Pagos registrados".
- `/liquidaciones/1` — la pagada: 100 % y todos los badges en "Pagada".
- `/liquidaciones/anticipos` — los cuatro anticipos, con "Cartas desde el río"
  marcado como reimpresión ×2 y un solo anticipo; "Marcar como pagado" sobre el de
  "Breve historia del cine · Ana Gómez" (confirma y queda pagado con la fecha de
  hoy; no hay monto que elegir).
- `/liquidaciones/nueva` — el período por defecto (mes en curso) con datos reales
  del seed → "Generar liquidación" → queda `LQ-2026-0004`; volver a
  "Nueva liquidación" en la misma sesión y ver el estado "Las ventas de este
  período ya se liquidaron".
- Detalle por persona: el ícono de la fila abre el desglose por libro con el
  progreso de pago y el historial.

Las capturas de este recorrido (incluido el flujo completo de pago y la regla de
"no liquidar dos veces") se hicieron con Chromium 1440×900: la consola no arrojó
ningún error. El único ítem de red que sale de estas pantallas es el reporte real
del período (`GET /liquidacion`), que ya existe.

Agent: ses_ebaa0f1c5ffe7ZEoUwJ1M5Y5Q4
