# Design: Tienda online — pedidos y configuración

Estado: aprobado por el usuario

Resumen: panel de administración de la tienda online de cada cuenta. Cubre el
listado y el detalle de pedidos, las acciones del ciclo de vida (aceptar,
rechazar, generar la etiqueta en MiCorreo y despachar, marcar entregado), la
configuración de integraciones, la conexión OAuth de MercadoPago, MiCorreo con
retiro en local, el peso por libro con el peso promedio de la cuenta como
fallback y el stock negativo permitido por libro. La tienda del comprador es
externa y queda fuera de alcance: acá sólo se diseña lo que ve quien administra
la editorial.

## Historia

Como administrador de una editorial quiero ver los pedidos de mi tienda online
con los datos del comprador y la entrega, poder aceptarlos o rechazarlos,
generar la etiqueta y despacharlos, y marcarlos como entregados. También quiero
configurar las integraciones, el cobro con MercadoPago, los envíos con MiCorreo
y el retiro en local, configurar el peso promedio de la cuenta como respaldo, y
definir por libro cuánto stock negativo se permite vender y cuánto pesa para
cotizar el envío.

## Qué se construyó

### Rutas y navegación

Se agregó la sección **TIENDA ONLINE** al sidebar, después de Comercial, con dos
entradas: **Pedidos** (`package`) y **Configuración** (`settings`).

| Ruta | Pantalla |
| --- | --- |
| `/pedidos` | Listado de pedidos con pestañas por estado, búsqueda, rango de fechas, forma de entrega y paginación. |
| `/pedidos/:codigo` | Detalle del pedido: comprador, entrega, pago, artículos, totales, historial, comprobante y acciones. |
| `/tienda` | Configuración de la tienda en tres pestañas: Integraciones, MercadoPago y Envíos y retiro. |
| `/libros/nuevo` y `/libros/:isbn` | Formulario de libro con el campo **Stock negativo permitido**. |

### Listado de pedidos (`/pedidos`)

- **Pestañas por estado** con el conteo de cada una: Todos, Pendiente de pago,
  Pagado, Aceptado, Enviado, Entregado, Rechazado y Cancelado. Los conteos se
  recalculan sobre la búsqueda, el rango de fechas y la forma de entrega
  elegidos.
- **Filtros**: búsqueda por código, nombre del comprador, email o teléfono;
  desde/hasta; forma de entrega (envío o retiro). Botón para limpiar.
- **Columnas**: pedido (código + cantidad de artículos), fecha, comprador
  (nombre, email y teléfono), total, estado del pago, forma de entrega y estado
  del pedido.
- **Estados**: carga en la tabla, error con reintento, vacío por filtros y
  vacío inicial (con acceso a configurar la tienda), paginación al pie.

### Detalle del pedido (`/pedidos/:codigo`)

- **Cabecera**: código como título, badges de estado del pedido y del pago,
  fecha, cantidad de artículos y nombre del comprador; acciones en el mismo
  lugar.
- **Aviso contextual** según el estado: esperando pago, listo para aceptar,
  venta y factura generadas, en camino, entregado, rechazado (con motivo) o
  cancelado. Cuando el pedido está enviado y tiene código, el aviso “Pedido en
  camino” muestra el código como link y un botón al seguimiento; si no hay
  código o es retiro, no muestra ningún link. El aviso de entregado mantiene
  el acceso al seguimiento cuando hay tracking.
- **Comprador y entrega**: una tarjeta de ancho completo con dos columnas
  internas. Comprador (nombre, email, teléfono, documento y la aclaración de
  que compró como invitado) y entrega (envío con dirección completa, CP y
  costo, o retiro con punto y horario).
- **Seguimiento del envío**: cuando hay código, un bloque de ancho completo
  dentro de la tarjeta anterior, debajo de las dos columnas: el código como
  enlace visible a la página pública de Correo Argentino, estado actual de
  PAQ.AR, última actualización, botón “Descargar etiqueta” cuando el PDF ya
  existe, botón “Ver seguimiento en Correo Argentino” en pestaña nueva y “Ver
  movimientos (N)” para desplegar el historial compacto del correo. Sin código
  no se muestra ningún enlace; en retiro en local no aparece el bloque.
- **Artículos**: tabla de ancho completo con título, ISBN, cantidad, precio
  unitario y subtotal; resumen de subtotal, envío/retiro y total.
- **Pago y comprobante**: otra tarjeta de ancho completo con dos columnas.
  Pago con MercadoPago, estado, importe, operación y fecha; comprobante con
  Factura B, número, fecha, venta y acceso al archivo, o su estado pendiente.
  Si la Factura B quedó pendiente y el pedido está aceptado, enviado o
  entregado, aparece una acción secundaria **Reintentar factura** que vuelve a
  pedir la emisión y muestra el error de AFIP sin romper la ficha. El archivo se
  descarga con el token de la sesión, no con un `<a href>` directo.
- **Historial**: timeline de ancho completo con los hitos ya ocurridos, fecha y
  hora, y la última actualización en el encabezado de la tarjeta.

### Acciones y estados

| Estado del pedido | Aceptar | Rechazar | Generar etiqueta y despachar | Marcar entregado |
| --- | --- | --- | --- | --- |
| `pendiente_pago` | — | Sí | — | — |
| `pagado` | Sí | Sí | — | — |
| `aceptado` + envío | — | — | Sí | — |
| `aceptado` + retiro | — | — | — | Sí |
| `enviado` | — | — | — | Sí |
| `entregado` / `rechazado` / `cancelado` | — | — | — | — |

- **Aceptar** pide confirmación y avisa que genera la venta y la Factura B.
- **Rechazar** abre un diálogo con motivo obligatorio y detalle opcional; si el
  pago estaba aprobado, advierte que se registra el reembolso.
- **Generar etiqueta y despachar** pide confirmación, crea el envío en PAQ.AR,
  obtiene el seguimiento y el PDF, y recién entonces marca el pedido como
  enviado. No hay carga manual de tracking: el diálogo viejo de “Marcar como
  enviado” se reemplazó por este flujo. Si falla, el pedido sigue aceptado y se
  puede reintentar; el diálogo muestra el código y el mensaje del backend.
- **Marcar entregado** pide confirmación; para retiro en local el texto habla
  de retiro, no de entrega a domicilio.

### Configuración (`/tienda`)

- **Integraciones**: tabla con nombre, prefijo de API key, origen permitido,
  último uso, switch activa/inactiva y acción de revocar. “Nueva integración”
  pide nombre y origen; al crear, muestra la clave completa **una sola vez** en
  un diálogo con advertencia y botón para copiar. Revocar pide confirmación y la
  fila queda visible como revocada (una integración revocada no se reactiva).
- **MercadoPago**: estado real de la conexión, cuenta/alias, email, aplicación y
  fecha de conexión. “Conectar” pide al backend la URL de autorización OAuth y
  redirige; al volver con `?mercadopago=conectado` se muestra el aviso, se
  limpia el query param y se relee el estado. “Desconectar” pide confirmación.
  El panel nunca muestra credenciales.
- **Envíos y retiro**: usuario, contraseña y customer ID de MiCorreo con
  “Probar conexión”; **PAQ.AR** con agreement, API key y seller ID (necesarios
  para generar etiquetas; la API key sólo se envía si se escribe una nueva);
  **Peso promedio por libro (kg)** (obligatorio, mayor a 0, usado como respaldo
  para los libros sin peso cargado); **caja default** (alto, ancho y largo en
  cm) para la etiqueta; domicilio de origen completo y retiro en local con
  dirección y horario. “Probar conexión” prueba la configuración **guardada**,
  no los cambios sin guardar. Todo se guarda junto con “Guardar configuración”.

### Libro

El formulario compartido de alta y edición suma **Peso** (kg, con decimales)
junto a las dimensiones de alto/ancho/largo. Es opcional: si se completa tiene
que ser mayor a 0 y el campo muestra el error en el acto. **No lleva texto de
ayuda debajo**: el único texto que puede aparecer es el error de validación. Si
queda vacío, MiCorreo usa el peso promedio configurado en Envíos.

También suma **Stock negativo permitido** (entero, sufijo “ej.”), con la
explicación de que son los ejemplares que la tienda puede vender de más cuando
el stock del depósito principal llega a cero y que `0` significa no permitir.
El valor arranca en `0` en ambos formularios.

> El backend ya persiste y devuelve `peso_kg` y
> `stock_negativo_permitido`; el formulario de alta y la ficha los leen y los
> envían en el mismo payload del libro.

### Archivos principales

- `front/src/features/tienda/pedidos/`: `PedidosPage.tsx`, `FichaPedidoPage.tsx`,
  `PedidoAcciones.tsx`, `PedidoBadges.tsx`, `PedidosFiltros.tsx`,
  `usePedidos.ts`, `usePedido.ts`, `usePedidosFiltros.ts`,
  `useAccionesPedido.ts`, `tipos.ts`.
- `front/src/api/tienda.ts`: cliente tipado de pedidos, integraciones,
  MercadoPago y envíos.
- `front/src/features/tienda/configuracion/`: `ConfiguracionTiendaPage.tsx`,
  `IntegracionesSection.tsx`, `MercadoPagoSection.tsx`, `EnviosSection.tsx`,
  `useIntegraciones.ts`, `useMercadoPago.ts`, `useEnviosConfig.ts`,
  `provincias.ts`.
- `front/src/design-system/components/data/Timeline.jsx` (+ `.d.ts` y
  `.prompt.md`) y export en el barrel; `Input` suma la prop `mono`.
- `front/src/features/libros/LibroFormFields.tsx`, `NuevoLibroPage.tsx` y
  `FichaLibroPage.tsx`.
- `front/src/App.tsx` y `front/src/layout/AppLayout.tsx`.
- `front/src/lib/fecha.ts` (`formatFechaHora`).

### Datos y API real

El panel dejó de usar datos de muestra: el listado, la ficha, las acciones,
las integraciones, MercadoPago y los envíos consumen los endpoints reales del
backend de la tienda. Los estados vacíos (sin pedidos, sin integraciones, sin
conexión de MercadoPago o sin configuración de envíos) son los que se ven en
una cuenta nueva.

- Los conteos de las pestañas y la paginación son server-side; el backend
  devuelve el recorte y los conteos sin aplicar el estado.
- El seguimiento usa el bloque real de PAQ.AR: código, estado, eventos,
  etiqueta disponible y error de consulta. Sin código no se muestra el bloque.
- La caja default y el peso promedio configurados se usan al generar la
  etiqueta; el botón “Probar conexión” valida la configuración ya guardada.

## Decisiones de diseño

- **Dos niveles de filtro, no una fila de selects equivalentes.** Las pestañas
  responden “en qué etapa está cada pedido” y muestran el conteo; la barra de
  abajo recorta por texto, fecha y entrega. Así el estado no compite con los
  demás filtros.
- **La lista prioriza el contacto y deja la dirección para la ficha.** En la
  tabla se ven nombre, email, teléfono y forma de entrega; la dirección
  completa y el código postal viven en el detalle, donde el admin los necesita
  para despachar sin perder la densidad del listado.
- **El código del pedido es el título de la ficha.** Es el identificador que el
  admin usa con el comprador y en el correo; los estados van al lado como
  badges, no como un encabezado genérico “Detalle del pedido”.
- **El siguiente paso se explica en una Alert contextual.** El admin no tiene
  que deducir por qué “Aceptar” no aparece en un pedido pendiente de pago.
- **Las acciones viven en la cabecera y respetan una máquina de estados.**
  Aceptar sólo después del pago; generar la etiqueta sólo un envío aceptado;
  entregar un envío despachado o un retiro aceptado. Las acciones con
  consecuencia registral piden confirmación.
- **El despacho lo ejecuta PAQ.AR, no el admin.** En un envío aceptado la
  acción principal es “Generar etiqueta y despachar”: Epublit crea el envío,
  recibe el tracking y el PDF, y recién ahí el pedido pasa a `enviado`. No hay
  carga manual de tracking: el flujo viejo se reemplazó. Si la creación falla,
  el pedido queda `aceptado`, aparece un error con “Reintentar” y no se genera
  una etiqueta duplicada.
- **El peso del libro es opcional; el promedio de la cuenta es el fallback.**
  El campo Peso vive junto a las dimensiones, no lleva hint y sólo muestra el
  error si se completa con un valor menor o igual a 0. Si queda vacío, PAQ.AR
  usa el “Peso promedio por libro (kg)” configurado en Envíos, que es
  obligatorio y mayor a 0.
- **La ficha se lee en bloques horizontales, no en un rail lateral.** Comprador
  y entrega comparten una tarjeta de dos columnas; pago y comprobante comparten
  otra; artículos e historial ocupan todo el ancho. Así ninguna columna se
  estira hasta la altura de la otra: cada bloque termina donde termina su
  contenido. El comprador y la entrega van antes de los artículos porque son
  los datos que hacen falta para despachar; el historial cierra la página.
- **El historial del pedido es un timeline de hechos, no un stepper de pasos
  futuros.** Muestra lo que ya pasó, con el último hito marcado como actual; no
  inventa pasos que todavía no ocurrieron. Va full width y el encabezado de la
  tarjeta muestra la última actualización.
- **El seguimiento de PAQ.AR es un bloque del envío, no un segundo
  timeline.** Vive al pie de la tarjeta de comprador/entrega, ocupa el ancho
  completo y mantiene siempre visibles el código, el estado y el acceso al
  correo; los movimientos quedan plegados, se ordenan del más reciente al más
  antiguo y se leen como una lista compacta, distinta del historial del
  pedido. El estado del envío es independiente del estado del pedido: un
  pedido `enviado` puede estar en tránsito, en sucursal o demorado.
- **El código es el link principal.** Se muestra como un anchor real que abre
  la página pública de seguimiento e-commerce de Correo Argentino en una
  pestaña nueva; el botón “Ver seguimiento en Correo Argentino” lleva al mismo
  destino. La página general no acepta el código por query param: el usuario
  entra y pega el número. Si el backend consigue un deep link de MiCorreo con
  el código, se usa esa URL en lugar de la general. El aviso de estado
  `enviado` reutiliza el mismo componente y la misma URL para el código y el
  botón; el de `entregado` mantiene el botón de acceso.
- **Nunca se muestra un enlace de seguimiento sin código.** Si el pedido
  todavía no se despachó, el bloque no existe y el campo dice “Se asigna al
  despachar”; si ya se despachó pero PAQ.AR no informó el código, dice
  “PAQ.AR todavía no informó el código”. En retiro en local no hay
  seguimiento de correo, ni en la tarjeta ni en el aviso de estado.
- **Un error de PAQ.AR no rompe la ficha.** Si el servicio no responde o el
  código no existe, el bloque muestra un aviso entendible con “Reintentar” y
  “Ver en Correo Argentino”.
- **La clave de API se muestra una sola vez.** La tabla sólo conserva el
  prefijo; después de cerrar el diálogo no hay forma de recuperarla. La acción
  de revocar es la salida si se pierde.
- **El violeta se usa para lo que es ecommerce** (badge “Tienda online”,
  estados de pago que requieren atención, icono de MercadoPago), y el verde
  pino para las acciones del producto, como el resto de Epublit.
- **Se sumó `Timeline` al sistema de diseño** en vez de dibujar un historial
  ad-hoc en la ficha, y `Input` acepta `mono` para claves y códigos de
  seguimiento. No se creó ningún primitivo fuera de `design-system/`.

## Casos borde

- **Pedido pendiente de pago**: no se puede aceptar; sólo rechazar. Si
  MercadoPago confirma el pago, el pedido pasa a `pagado` y aparece la acción
  de aceptar.
- **Rechazo de un pedido ya pagado**: el diálogo advierte el reembolso y el
  pedido queda `rechazado` con pago `reembolsado`; el historial registra ambos
  hitos. La UI no promete plazos de acreditación.
- **Pedido aceptado con envío**: la acción es “Generar etiqueta y despachar”.
  No se puede marcar enviado a mano ni cargar un tracking manual. Si la
  creación falla, el pedido sigue `aceptado`, no aparece seguimiento y se
  muestra un error con “Reintentar”. Recién cuando PAQ.AR devuelve tracking y
  PDF el pedido pasa a `enviado`.
- **Etiqueta ya generada**: si el backend ya la creó, un reintento no debe
  duplicar el envío ni el PDF; la ficha muestra la etiqueta existente y el
  pedido no vuelve a aceptado.
- **Seguimiento disponible**: el bloque muestra el código, el estado actual de
  PAQ.AR y la última actualización; “Ver movimientos” despliega una lista
  compacta de eventos, del más reciente al más antiguo, separada del timeline
  del pedido. Si no hay eventos, el botón no aparece pero el acceso al correo
  sigue visible.
- **PAQ.AR no responde o el código no existe**: el bloque mantiene el código
  y muestra un aviso entendible con “Reintentar” y “Ver en Correo Argentino”.
  No se muestra un enlace roto ni se pierde el resto de la ficha.
- **Peso del libro**: si se completa, tiene que ser mayor a 0; el formulario
  marca el error y no muestra ningún hint debajo del campo. Si queda vacío, la
  cotización y la etiqueta usan el peso promedio de la cuenta.
- **Peso promedio de la cuenta**: es obligatorio y tiene que ser mayor a 0. Si
  falta o es inválido, el formulario de Envíos lo marca y no deja guardar; es
  el respaldo de los libros sin peso.
- **Pedido aceptado con retiro**: no hay “marcar enviado” ni etiqueta; la
  acción es “marcar entregado” y el texto habla de retiro en el local.
- **Retiro en local**: no aparece seguimiento de correo ni botón de etiqueta,
  aunque el comprador tenga dirección de facturación.
- **Pedidos terminales** (`entregado`, `rechazado`, `cancelado`): no muestran
  acciones; sólo lectura e historial.
- **Stock insuficiente al crear el pedido**: si el libro no permite stock
  negativo o se superó el límite configurado, el pedido no debe crearse y el
  comprador tiene que ver el motivo. La reserva se libera si el pedido se
  rechaza o cancela, y se convierte en venta al aceptarlo.
- **Integración revocada o inactiva**: los pedidos ya creados no cambian; la
  tienda deja de poder crear pedidos nuevos. Si se revoca la última, queda el
  estado vacío con acceso a crear otra.
- **API key perdida**: no se puede volver a ver; hay que revocar y crear otra.
  El origen permitido se valida como URL completa y no puede quedar vacío.
- **MercadoPago desconectado**: la tienda no puede cobrar con Checkout Pro; los
  pedidos existentes conservan su estado. Al reconectar, la cuenta se muestra
  de nuevo con sus datos.
- **PAQ.AR sin credenciales o con credenciales inválidas**: “Probar conexión”
  falla con un mensaje accionable; la cotización de envío no está disponible.
  Si el retiro en local está activo, el comprador todavía puede retirar.
- **Retiro desactivado**: el checkout deja de ofrecerlo; los pedidos de retiro
  ya creados siguen siendo válidos y se pueden entregar.
- **Comprador invitado con datos incompletos**: el pedido muestra exactamente
  lo que viajó en el checkout; si falta un dato, el admin puede rechazar con el
  motivo “Datos del comprador incompletos”.
- **Direcciones, emails o códigos largos**: los datos del comprador, la entrega
  y la tabla usan `word-break`/wrap para no romper la tarjeta.
- **Acciones simultáneas o repetidas**: la UI deshabilita mientras guarda y
  vuelve a leer el pedido; el backend debe validar igual la transición para no
  aceptar dos veces, generar dos etiquetas ni enviar un pedido ya entregado.
- **Paginación y conteos**: al cambiar un filtro se vuelve a la primera página;
  los conteos de las pestañas corresponden al recorte activo, no al total
  histórico.

## Datos necesarios

Todo lo de abajo es capacidad que el backend tiene que proveer; las rutas,
nombres de campos y mecanismos quedan a cargo del planner.

### 1. Pedidos de la tienda (lectura)

- El comprador es invitado: sus datos (nombre, email, teléfono, documento y
  dirección) viajan y se conservan en cada pedido; no hay una cuenta de
  cliente reutilizable que mantener.
- Poder listar los pedidos de la cuenta, del más reciente al más antiguo, con
  paginación y con el total de pedidos del recorte.
- Poder filtrar el listado por estado del pedido, rango de fechas y forma de
  entrega, y buscar por código, nombre del comprador, email o teléfono.
- Poder conocer la cantidad de pedidos por estado para el recorte de búsqueda,
  fechas y entrega (es lo que muestran las pestañas).
- Por cada pedido del listado: código, fecha y hora, nombre/email/teléfono del
  comprador, total, estado del pago, forma de entrega, estado del pedido y
  cantidad de artículos.
- Por el detalle: documento del comprador, dirección completa con código postal
  (o punto y horario de retiro), artículos con título/ISBN/cantidad/precio
  unitario/subtotal, subtotal, costo de envío y total; datos del pago
  (MercadoPago, estado, identificador de operación, importe y fecha); datos del
  envío (correo, seguimiento si existe, fecha de despacho y etiqueta con URL de
  descarga); Factura B con número, fecha y acceso al archivo; venta generada;
  motivo de rechazo; e historial de hitos con fecha y hora.
- Poder acceder al comprobante/factura emitida.

### 2. Acciones sobre pedidos (escritura)

- **Aceptar un pedido**: sólo si el pago está aprobado. Debe generar la venta y
  la Factura B automática, devolver los identificadores para mostrarlos en la
  ficha y convertir la reserva de stock en la operación definitiva. Si el
  pedido ya fue aceptado, la operación no debe duplicar la venta.
- **Rechazar un pedido**: sólo antes de aceptarlo (pendiente de pago o pagado).
  Requiere un motivo; si el pago estaba aprobado, debe quedar registrado el
  reembolso y su estado debe poder mostrarse como `reembolsado`. Debe liberar
  la reserva de stock.
- **Generar etiqueta y despachar**: sólo si está aceptado y la entrega es a
  domicilio. Debe crear el envío en PAQ.AR, obtener el código de seguimiento
  y el PDF de la etiqueta, guardar el archivo, devolver la URL de descarga y
  recién entonces dejar el pedido en `enviado` con la fecha de despacho. Si la
  creación falla, el pedido debe seguir `aceptado` y el error tiene que ser
  reintentable sin duplicar el envío ni la etiqueta. No hay carga manual de
  tracking.
- **Marcar un pedido como entregado**: sólo si está enviado, o si está aceptado
  con retiro en local. Registra la fecha de entrega/retiro.
- Las transiciones inválidas (por ejemplo, aceptar un pedido pendiente o
  entregar uno rechazado) tienen que rechazarse con un mensaje entendible, no
  con un error genérico.
- La reserva de stock al crear el pedido, su liberación al rechazar/cancelar y
  su conversión en venta al aceptar son parte de la misma operación de negocio.

### 3. Configuración de integraciones (lectura y escritura)

- Poder listar las integraciones de la cuenta con nombre, prefijo de API key,
  origen permitido, estado activa/inactiva y último uso.
- Poder crear una integración con un nombre y un origen permitido, y recibir la
  API key completa **una sola vez**, para mostrarla en el diálogo.
- Poder revocar una integración; desde ese momento su API key deja de servir.
- Poder activar y desactivar una integración sin revocarla; una integración
  inactiva no debe poder crear pedidos.
- Varias integraciones conviven sobre el mismo catálogo y los mismos pedidos.
- Poder conservar el prefijo visible de la clave, pero no volver a exponer la
  clave completa después de crearla.

### 4. MercadoPago (lectura y escritura)

- Poder iniciar la conexión de la cuenta con MercadoPago por autorización OAuth
  y poder desconectarla.
- Poder conocer el estado de la conexión y, cuando está conectada, el alias,
  email, identificador de aplicación y fecha de conexión.
- El panel nunca muestra ni pide credenciales de MercadoPago.
- Poder recibir la confirmación del pago de un pedido y reflejarla en su estado
  de pago y en el historial del pedido.

### 5. MiCorreo y retiro en local (lectura y escritura)

- Poder guardar y leer el usuario y la credencial de MiCorreo de la cuenta, y
  poder probar la conexión con un resultado visible.
- Poder guardar y leer el domicilio de origen de los envíos: calle, número,
  piso, localidad, provincia y código postal.
- Poder habilitar o deshabilitar el retiro en local, con su dirección y su
  horario, para que el checkout lo ofrezca.
- Poder guardar y leer un peso promedio por libro de la cuenta, en kg con
  decimales y mayor a 0, usado como respaldo para los libros sin peso cargado.
- Poder cotizar el envío con MiCorreo al crear un pedido y conservar en el
  pedido el costo y el seguimiento que devuelva el correo.
- Poder crear el envío y la etiqueta en MiCorreo para un pedido aceptado con
  entrega a domicilio, obtener el código de seguimiento y el PDF de la
  etiqueta, guardar el archivo, y devolver el código y la URL de descarga para
  mostrarlos en la ficha.
- Si la creación de la etiqueta falla, el pedido tiene que seguir aceptado y la
  operación tiene que poder reintentarse sin duplicar el envío ni el PDF. Si el
  envío ya existe, hay que devolver el código y la etiqueta existentes en vez
  de crear otro.
- El retiro en local no crea envío ni etiqueta.
- Poder consultar, a partir del código de seguimiento, el estado actual, la
  última actualización y los eventos del envío que devuelve MiCorreo, y
  conservar lo último conocido en el pedido para mostrarlo en el panel.
- Poder devolver la URL pública de seguimiento: si MiCorreo provee un deep link
  con el código, esa URL; si no, la página general de seguimiento e-commerce de
  Correo Argentino (`https://www.correoargentino.com.ar/formularios/e-commerce`).
  La ficha usa el código como link visible y ofrece un botón al mismo destino.
- Poder informar un error de consulta entendible cuando MiCorreo no responde o
  el código no existe, sin perder el pedido, y permitir reintentar la consulta.

### 6. Peso por libro (lectura y escritura)

- Poder guardar, leer y editar por libro un peso en kg con decimales, opcional.
  Si se completa tiene que ser mayor a 0; si falta, la cotización y la
  etiqueta usan el peso promedio configurado por cuenta.
- Poder devolver el peso en la ficha y en el alta/edición del libro. El campo
  del formulario no lleva texto de ayuda debajo: sólo muestra el error de
  validación cuando el valor es menor o igual a 0.
- Poder usar el peso del libro en la cotización y en la creación del envío.

### 7. Stock negativo permitido por libro (lectura y escritura)

- Poder guardar, leer y editar por libro un entero no negativo de stock negativo
  permitido, con `0` como valor por defecto y “no permitir”.
- El valor tiene que aparecer y poder editarse tanto en el alta como en la
  ficha del libro; hoy el formulario lo muestra pero no lo envía: el backend
  todavía no lo persiste.
- Al crear un pedido de la tienda, la reserva se hace contra el stock del
  depósito principal y puede pasar a negativo sólo hasta ese límite. Si el
  límite es `0`, no se permite vender de más.
- El valor no afecta las ventas de mostrador ni el stock consignado en
  clientes: es una regla de la tienda online sobre el depósito principal.

Agent: ses_e97280935ffeQ71KB9rnNZa7oX
