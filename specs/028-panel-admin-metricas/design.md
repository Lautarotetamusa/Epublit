# Design: Panel de administración de uso por usuario

Estado: aprobado por el usuario

## Historia
El operador del SaaS necesita un panel chico, separado del panel de cada
editorial, para saber si la campaña está funcionando: cuántas cuentas hay,
cuántas están activas y cómo usan el producto. El universo son las cuentas
habilitadas que el backend entrega ya filtradas: las que no cumplen ese
requisito se tratan como inexistentes y la distinción no se muestra en la UI;
en toda la pantalla se habla simplemente de "cuentas". Activo significa que la
cuenta tuvo al menos una operación de negocio en los últimos 30 días; el
ingreso al sistema no alcanza.

## Qué se construyó

### Área y navegación
- Ruta `/admin` dentro de la sesión, con `AdminLayout` propio: franja superior
  verde pino, lockup de Epublit, rótulo "Administración", un único ítem de
  navegación ("Usuarios") y salida de sesión. No usa la barra lateral de
  Catálogo/Depósito/Comercial.
- `AdminLayout` es responsive: en pantallas chicas conserva el logo, el ítem
  de navegación, el avatar y la salida de sesión, y oculta los textos
  secundarios.
- La pantalla asume que quien entra tiene rol `admin` (lo garantiza el
  middleware del backend). Si la consulta devuelve falta de sesión o de
  permiso, muestra "Acceso restringido" con salida al inicio.

### Pantalla `Uso del producto` (`front/src/features/admin/`)
1. **Encabezado:** título y una sola línea de contexto: ventana de 30 días
   con fechas concretas (`dd/mm/aaaa`) y la definición breve de "activa"
   (operación de negocio en los últimos 30 días). El detalle de qué operaciones
   cuentan vive en "Datos necesarios", no en la pantalla. Badge
   "Datos de muestra" mientras el origen sea el mock.
2. **Pulso de la campaña:** seis cifras en una sola tarjeta con la misma línea
   de base: cuentas, nuevas en 30 días, cuentas activas, con libro, con venta y
   ARCA conectado. Cada cifra muestra el conteo en grande y, debajo, sólo el
   porcentaje sobre las cuentas; la primera cifra no lleva subtítulo. Sin
   frase de estado: las cifras y el embudo son el veredicto.
3. **Embudo de activación:** Cuentas → con libro → con venta. Cada paso muestra
   cantidad, barra contra las cuentas y porcentaje sobre las cuentas; el primer
   paso no dibuja barra porque es la base. El pie traduce la mayor fuga en
   cuentas con libro que todavía no vendieron.
4. **Etapas de adquisición:** gráfico de áreas apiladas al 100 % con seis
   meses. Cada cuenta se ubica una sola vez en su etapa máxima
   alcanzada hasta el cierre de cada mes: solo registrado → cargó libros →
   cargó movimientos. El tooltip muestra mes, cantidad de cuentas y
   cantidad/porcentaje por etapa; sin historial, estado vacío. Reemplaza el
   gráfico anterior de altas y actividad para no contar dos veces la misma
   evolución.
5. **Cuentas:** tabla con razón social y email, alta, ARCA conectado, última
   operación (relativa) con el último ingreso como dato secundario, operaciones
   en 30 días, libros, ventas en 30 días y estado. Búsqueda por razón
   social/email y filtros por estado y ARCA conectado. El conteo del recorte
   sólo aparece cuando hay filtros activos. Paginación de 10 cuentas y
   exportación CSV del recorte filtrado. En pantallas angostas la tabla
   conserva el scroll horizontal y lo advierte.
6. **Estados:** carga, acceso restringido, error reintentable, panel vacío
   (sin cuentas) y sin resultados de búsqueda con acción para
   limpiar filtros.

### Datos de muestra y revisión
- El panel no llama a ninguna API todavía. `usePanelAdmin` recibe el cargador
  por parámetro y hoy usa `cargarPanelDeMuestra`; cuando exista la consulta
  real se reemplaza el cargador sin tocar la pantalla.
- Para revisar estados sin editar código (sólo en desarrollo):
  `?demo=pocos` (4 cuentas), `?demo=vacio` (panel vacío),
  `?demo=error` (falla reintentable) y `?demo=sin-acceso` (acceso restringido).
  Sin parámetro se ven 35 cuentas.
- El mock usa editoriales ficticias, todas las cuentas del panel, y fechas
  relativas al día de hoy. La composición mensual de etapas es escenario de
  muestra: los datos por cuenta incluyen fechas de primer libro y primer
  movimiento inventadas para que el gráfico tenga seis meses de historia.

### Archivos principales
- `front/src/layout/AdminLayout.tsx`
- `front/src/features/admin/PanelAdminPage.tsx`
- `front/src/features/admin/ResumenCampana.tsx`
- `front/src/features/admin/EmbudoActivacion.tsx`
- `front/src/features/admin/EtapasAdquisicion.tsx`
- `front/src/features/admin/TablaCuentas.tsx`
- `front/src/features/admin/usePanelAdmin.ts`
- `front/src/features/admin/useTablaCuentas.ts`
- `front/src/features/admin/datosDeMuestra.ts`
- `front/src/features/admin/tipos.ts`, `fechas.ts`, `errores.ts`
- `front/src/App.tsx` (ruta `/admin`)
- Sistema de diseño: `Pagination` ahora acepta `itemLabel` para decir
  "cuentas" en lugar de "registros" (el valor por defecto no cambia para las
  pantallas existentes). Se sumaron helpers compartidos en
  `front/src/lib/numero.ts`, `front/src/lib/estiloTooltip.ts` y
  `formatFechaRelativa` en `front/src/lib/fecha.ts`; `formatFecha` ahora
  respeta `dd/mm/aaaa` con ceros.

## Datos necesarios
El backend todavía no provee nada de esto. La pantalla necesita:

- **Universo del panel:** el backend entrega únicamente cuentas habilitadas
  (email confirmado). Las cuentas no confirmadas se tratan como inexistentes:
  no se listan, no se cuentan y no se mencionan en la UI; en toda la pantalla
  se habla de "cuentas". Es un filtro interno del backend, no un estado visible.
- **Contadores agregados para las tarjetas (sobre cuentas):** cantidad de
  cuentas; altas de los últimos 30 días; cuentas activas en los últimos 30
  días; cuentas con al menos un libro; cuentas con al menos una venta (en toda
  la vida de la cuenta); cuentas con ARCA conectado. Con esos contadores la
  pantalla deriva los porcentajes sobre las cuentas (activos, libros, ventas y
  ARCA).
- **Contadores del embudo (sobre cuentas):** cuentas; cuentas con al menos un
  libro cargado; cuentas con al menos una venta. Son acumulados
  de toda la vida de la cuenta, no de la ventana de 30 días: el embudo cuenta
  la campaña completa y las tarjetas de actividad miran los últimos 30 días.
  - "Con al menos un libro" significa al menos un título cargado en el
    catálogo, no stock ni ejemplares.
  - "Con al menos una venta" significa al menos una venta registrada, de
    cualquier canal del sistema (mostrador, consignación o tienda online).
- **Listado de cuentas con métricas de uso por cuenta:** razón
  social, email, fecha de alta, fecha de la última operación de negocio, fecha
  del último ingreso, cantidad de operaciones de negocio en los últimos 30
  días, cantidad de libros cargados, cantidad de ventas en los últimos 30 días,
  si tiene ARCA conectado y el estado derivado (activo/inactivo). La pantalla
  necesita poder mostrar "Sin fecha" cuando la fecha de alta no se conoce y
  "Sin operaciones" cuando la cuenta nunca operó.
- **Búsqueda y filtros sobre el listado:** poder acotar por razón social o
  email, por estado (activo/inactivo) y por ARCA conectado. El listado tiene
  que poder recorrer todas las cuentas (para paginar de a 10) y devolver
  cuántas coinciden con el recorte.
- **Composición mensual de la base de cuentas por etapa máxima alcanzada:**
  para cada uno de los últimos seis meses calendario, cantidad de cuentas con
  alta hasta el cierre de ese mes, agrupadas en tres etapas
  mutuamente excluyentes:
  - **Solo registrado:** cuenta sin libros.
  - **Cargó libros:** tiene al menos un libro, sin movimientos.
  - **Cargó movimientos:** tiene al menos un movimiento (incluye ventas).
  Es composición acumulada de la base, no cohortes por mes de alta: cada cuenta
  aparece una sola vez en su etapa máxima alcanzada hasta el cierre de cada mes.
  Para calcularla hacen falta la primera fecha de libro y la primera fecha de
  movimiento de cada cuenta (ventas incluidas; una venta es un movimiento).
- **Definición de "operación" (contrato de producto):** operación = acción
  concreta de negocio con fecha registrada; no es login ni navegación. Cuentan:
  movimientos de stock y ventas (excluyendo `es_migracion`), pedidos de la
  tienda online, reseñas, contenido creado/editado, liquidaciones generadas,
  altas de libros, altas de personas y altas de clientes. No cuentan: login,
  navegación, cambios de configuración (tienda, ARCA, etc.), comprobantes
  (derivados de una venta) ni ediciones de libros/personas/clientes: sólo las
  altas.
- **Definición de "activo" (contrato de producto):** una cuenta está activa si
  tuvo al menos una operación de negocio en los últimos 30 días. El
  ingreso al sistema (login) no define el estado; se muestra sólo como dato
  secundario.
- **ARCA conectado:** capacidad de saber si la cuenta tiene el certificado de
  producción cargado (`production = true`); el planner decidirá la consulta
  exacta. Se necesita como cifra de resumen, columna de la tabla y filtro
  (todos / con ARCA / sin ARCA).
- **Fechas que hoy no existen en el modelo:** hacen falta `created_at` en
  `users`, `libros`, `personas` y `clientes`. En `users` sostiene la fecha de
  alta, "Nuevas en 30 días" y la composición mensual; el último ingreso sigue
  faltando para el dato secundario de la tabla. En `libros` sostiene el alta de
  libro como operación y la primera fecha de libro por cuenta; se puede
  backfillear desde el historial de precios. En `personas` y `clientes` sostiene
  el alta como operación; las cuentas viejas sin evidencia quedan sin fecha y
  no cuentan retroactivamente. El planner decide cómo resolverlas; la pantalla
  ya contempla el caso "Sin fecha" y "Nunca ingresó".
- **Acceso restringido a administración:** el área `/admin` y todos estos
  datos sólo deben poder consultarse con rol `admin` (columna `role` en
  `users`, enum `editorial | admin`, con `editorial` por defecto). Una cuenta
  `editorial` tiene que recibir una respuesta distinguible de falta de permiso
  para que la pantalla muestre "Acceso restringido"; una sesión vencida se
  muestra como acceso restringido con salida al inicio.
- **Datos de muestra usados en el mock (a reemplazar por datos reales):**
  35 cuentas ficticias del panel, con alta, última
  operación, último ingreso, operaciones 30d, libros, ventas 30d, primera fecha
  de libro, primera fecha de movimiento, venta histórica y ARCA conectado;
  15 activas, 29 con al menos un libro, 13 con al menos una venta, 9 con ARCA
  conectado y 8 nuevas en 30 días. El mock no incluye cuentas fuera del panel.
  La composición mensual de muestra va de 38,9 % de cuentas con movimientos en
  junio a 74,3 % en noviembre (7 de 18 cuentas a 26 de 35), con la base
  creciendo mes a mes. También se inventaron las fechas de alta, de primer
  libro, de primer movimiento y de último ingreso relativas al día de hoy, y
  los estados de ARCA.

Agent: ses_de7e820d7ffe6dfbQvHNZtS9ee
