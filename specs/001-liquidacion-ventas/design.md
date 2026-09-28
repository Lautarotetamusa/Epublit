# Design: Liquidación de ventas

Estado: aprobado por el usuario

## Historia

Como usuario necesito generar una liquidación de ventas entre dos fechas, que
muestre los libros vendidos en ese rango (con precio y cantidad) y cuánto le
corresponde cobrar a cada autor/ilustrador según su porcentaje sobre cada
libro. El monto por persona y libro es `precio_unitario × cantidad_vendida ×
(porcentaje / 100)`, sumado a través de todas las ventas del libro en el
rango y agregado por persona (una persona puede trabajar en varios libros).

## Qué se construyó

Pantalla nueva en `/liquidaciones` (ítem de navegación "Liquidaciones" en la
sección Comercial de la barra lateral, entre Ventas y Consignaciones):

- `front/src/features/liquidaciones/LiquidacionesPage.tsx` — pantalla única
  con dos estados:
  1. **Formulario**: elegir fecha "Desde" y "Hasta" (por defecto, del primer
     día del mes actual a hoy) y botón "Generar liquidación". Valida que
     "Desde" no sea posterior a "Hasta".
  2. **Resultado**: tres métricas (`StatCard`: total facturado, ejemplares
     vendidos, personas a liquidar), una tabla "Libros vendidos en el
     período" (título, ISBN, cantidad, precio unitario, importe) y una tabla
     "Total a pagar por persona" (persona, rol, cantidad de libros, total a
     pagar). Cada fila de persona abre un detalle. La card "Libros vendidos
     en el período" tiene un botón "Descargar CSV" que exporta esa misma
     tabla (título, ISBN, cantidad, precio unitario, importe), generado
     enteramente en el cliente a partir de los datos ya cargados en
     pantalla — no pega contra ningún endpoint nuevo. Ambas tablas paginan
     del lado del cliente con `useClientPagination` (mismo patrón que
     `VentasPage`/`ConsignacionesPage`): asume que el futuro endpoint
     devuelve la liquidación completa en una sola respuesta (no paginada
     server-side), igual que hoy hace `GET /venta`.
- `front/src/features/liquidaciones/DetallePersonaDialog.tsx` — modal con el
  desglose por libro (libro, porcentaje aplicado, importe) y el total de esa
  persona.
- `front/src/features/liquidaciones/useLiquidacion.ts` — hook que llama a
  `generarLiquidacion` y expone `liquidacion`, `loading`, `generar`,
  `limpiar`.
- `front/src/features/liquidaciones/money.ts` — formateo de moneda es-AR
  compartido entre la página y el modal.
- `front/src/api/liquidacion.ts` — cliente de datos con la firma que va a
  tener el futuro endpoint real (`generarLiquidacion(input): Promise<Liquidacion>`).
  Hoy devuelve datos de muestra (ver "Datos necesarios"); reemplazar el
  cuerpo por una llamada a `api.get(...)` no debería obligar a tocar
  ningún componente.
- Ruteo: `/liquidaciones` agregado en `front/src/App.tsx`; ítem de nav
  agregado en `front/src/layout/AppLayout.tsx`.
- `front/src/lib/csv.ts` — helper genérico `downloadCsv(filename, headers,
  rows)` (escape + blob + descarga), pensado para reutilizarse en cualquier
  otra tabla del front que necesite exportar CSV, no sólo ésta.

Sin estado vacío separado por falta de ventas dentro del período: la tabla de
libros y la de personas ya manejan `EmptyState` si el rango no tuvo ventas o
si ningún libro vendido tiene autores/ilustradores cargados.

**Corrección de bug compartido**: al usar el modal de detalle de persona en
una pantalla con contenido más alto que el viewport, apareció un bug
preexistente en `design-system/components/feedback/Dialog.jsx`: el overlay
usaba `position:absolute` (documentado en `Dialog.prompt.md` como "dar al
padre `position:relative`"), así que en cualquier página real y scrolleable
del front —no sólo ésta— el modal terminaba anclado al alto del documento en
vez de al viewport, y se veía cortado apenas se scrolleaba antes de abrirlo.
Se corrigió cambiando el overlay a `position:fixed` (comportamiento estándar
de modal: siempre centrado en el viewport visible, sin depender de un
ancestro posicionado ni del scroll), y se actualizó su `.d.ts` y
`.prompt.md`. El fix beneficia a todos los `Dialog` del sistema (los que ya
usaban `PersonasLibroSection`, `ConsignacionesPage`, `PerfilPage`, etc.), no
sólo a esta pantalla.

## Datos necesarios

Implementado: `front/src/api/liquidacion.ts` llama al endpoint real (ya no
genera un catálogo de muestra). Ver `back/src/modules/liquidacion/` (service,
controller, validator, tests) y `back/docs/api.md`.

1. **Generar liquidación de ventas** (lectura, no persiste nada — es un
   reporte calculado al vuelo, no una entidad que se guarda).
   - Endpoint: `GET /liquidacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`.
   - Input: `desde` y `hasta` (fechas, inclusive). El front los guarda en su
     propio estado local (no vienen en la respuesta) para el subtítulo y el
     nombre del CSV exportado.
   - El cálculo por persona/libro es:
     `importe = precio_unitario × cantidad_vendida × (porcentaje / 100)`,
     sumado por libro cuando hay varias ventas del mismo libro en el rango,
     y agregado por persona cuando participa en más de un libro.
     `precio_unitario`, `cantidad_vendida` y `porcentaje` salen de datos que
     ya existen en el sistema (ventas — `back/src/modules/transaccion` — y
     la relación libro-persona con su porcentaje —
     `back/src/modules/libro/libroPersona.*`).
   - Respuesta real, por sección de la pantalla:
     - Resumen: `total_facturado` (suma de precio × cantidad de todas las
       ventas del período), `ejemplares_vendidos` (suma de cantidades).
     - Por libro vendido en el período (para la tabla "Libros vendidos"):
       `id_libro`, `isbn`, `titulo`, `cantidad_vendida` (suma de todas las
       ventas de ese libro en el rango), `precio_unitario` (promedio
       ponderado del importe histórico de esas ventas), `importe_total`.
     - Por persona (para la tabla "Total a pagar por persona" y el modal de
       detalle): `id_persona`, `nombre`, detalle por libro (`id_libro`,
       `titulo`, `tipo` — `autor` | `ilustrador` —, `porcentaje`, `importe`)
       y `total_a_pagar` (suma del importe en todos sus libros). El `tipo`
       vive dentro de cada línea de `detalle`, no a nivel de la persona: una
       misma persona puede ser autora de un libro e ilustradora de otro en
       el mismo período, así que la UI calcula los roles distintos
       presentes en su `detalle` (uno o los dos) en vez de asumir un único
       rol por persona.
   - El precio/porcentaje usado es el histórico de cada venta (precio al
     momento de la transacción), no el valor vigente actual del libro o la
     relación libro-persona.

## Aprobación pendiente

Falta la revisión explícita del usuario sobre esta pantalla antes de pasar a
`planner`.
