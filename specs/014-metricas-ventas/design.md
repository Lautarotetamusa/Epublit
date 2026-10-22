# Design: Panel de métricas de la editorial

Estado: aprobado por el usuario

## Historia

Ver la cantidad de ejemplares vendidos, cortada **por título**, **por cliente** y
**por depósito**. En la segunda pasada el usuario pidió convertir Inicio en un
**panel de métricas** que sirva para sacar conclusiones (ingreso generado,
gráficos del Top 10 por dimensión). En la tercera pidió que el panel trabaje
**por mes completo**, que arranque en el **mes actual**, y que cada cifra
principal traiga su **diferencia porcentual contra el mes anterior** con flecha y
color; ahí entró **ejemplares nuevos** en lugar del precio promedio. En la cuarta
pidió el alcance como desplegable y tooltips que expliquen el porcentaje, y en la
quinta que el **mes en curso se compare contra el mismo tramo** del mes anterior,
no contra un mes entero.

## Qué se construyó

### El período es un mes, no un rango

Se reemplazó el par Desde / Hasta por un **selector de mes** (los trece últimos
meses, del más nuevo al más viejo) que abre en el **mes en curso**. Toda la
pantalla —las cuatro cifras, los tres gráficos y el ranking— trabaja sobre ese
mes completo.

El alcance de ventas dejó de ser un `SegmentedControl`: con tres opciones y una
de ellas larga («Sobre consignación»), el control repartía el ancho en tercios y
el texto se partía en dos líneas. Ahora es un **`Select`**, igual que el mes, y
los dos quedan alineados en el header.

Se revierte así la decisión de la pasada anterior, donde el rango era libre.
Un mes es la unidad con la que se piensa la editorial (cierre, liquidación,
impresión) y la que hace comparables dos períodos.

### El card «Overview»: una sola tarjeta para el alcance y las cifras

Los dos bloques de arriba (la tarjeta de período y la fila de cifras) se
unificaron en **una sola card**, siguiendo la referencia que pasó el usuario:

- **Header**: `Overview` a la izquierda, con el subtítulo que nombra la
  comparación (`octubre de 2026 (en curso: 1–16) contra el 1–16 de septiembre`).
  A la derecha, las dos perillas de **todo** el panel: **Ventas incluidas**
  (`Todas` / `En firme` / `Sobre consignación`) y el **mes**, **cada una como
  desplegable** (`Select`) con su etiqueta al lado.
- **Cuerpo**: las **cuatro cifras en una fila**, separadas por divisores
  verticales, cada una con su valor y su **badge de comparación** (flecha +
  porcentaje, verde si sube, rojo si baja, neutro cuando no hay con qué comparar).
  Al pasar el mouse por el badge, un **tooltip** explica qué es ese porcentaje
  **nombrando el período comparado**: *«un 36,5% más que el 1–16 de septiembre»*
  con el mes en curso, *«un 30,4% más que en agosto»* con un mes cerrado, *«igual
  que en agosto»*, y *«sin ejemplares nuevos el 1–16 de septiembre»* cuando la base
  no tenía con qué comparar. El texto sale del período realmente comparado y
  agrega el año cuando cambia (*«…que en diciembre de 2025»*), así que no puede
  quedar desincronizado con el mes elegido.

Las cuatro cifras del mes:

| Cifra | Qué dice | Compara contra |
| --- | --- | --- |
| **Ingreso generado** | La plata del mes | el período anterior comparable |
| **Ejemplares vendidos** | Los ejemplares que salieron | el período anterior comparable |
| **Ventas** | Cuántas operaciones | el período anterior comparable |
| **Ejemplares nuevos** | Los ejemplares que **entraron al stock** | el período anterior comparable |

El precio promedio por ejemplar se sacó, como pidió el usuario.

### La comparación: mes completo, o mismo tramo si el mes está en curso

Un mes en curso está a medias, así que medirlo contra un mes entero da siempre una
caída que no existe. La regla implementada:

- **Mes ya cerrado** → **mes completo contra mes completo**. `septiembre de 2026
  contra agosto de 2026`.
- **Mes en curso** → **mismo tramo de días**. Se corta el mes anterior en el día
  de hoy, así que el 16/10 se compara **1–16 de octubre contra 1–16 de
  septiembre**. El subtítulo lo dice con los días —`octubre de 2026 (en curso:
  1–16) contra el 1–16 de septiembre`— y los tooltips también (`un 36,5% más que
  el 1–16 de septiembre`), porque un porcentaje sin la base a la vista se lee mal.

El efecto es grande y por eso vale dejarlo escrito: el mismo día, con la
comparación vieja (mes contra mes) el panel abría en **-45% / -44,1% / -50%**, y
con la comparación por tramos abre en **+36,5% / +48,1% / +40%** — que es la
verdad: octubre va mejor que la primera mitad de septiembre.

Un mes cerrado no se recorta nunca. Y el gráfico **Ingreso por mes** avisa cuando
su último punto está en curso («*Los 12 meses hasta octubre de 2026; el último
está en curso*»), porque ese punto también es un mes a medias.

### «Ejemplares nuevos»: confirmado

**Es la interpretación aprobada por el usuario:** «ejemplares nuevos» son los
ejemplares **incorporados al stock** en el mes — los movimientos de tipo
`ingreso`, es decir el **lanzamiento de un título y sus reimpresiones** (ver
`specs/008-movimientos-deposito` y `specs/012-liquidaciones-pagos`, y el
vocabulario de `movimientoFormato.ts`: *«Ingreso: entra stock desde el exterior a
un depósito»*). Es una métrica de **producción**, que se lee al lado de lo
vendido: dice cuánto se imprimió contra cuánto se colocó.

Consecuencia de esa lectura, que está implementada a propósito: **la cifra NO
responde al filtro «Ventas incluidas»**. Ese filtro separa ventas en firme de
ventas sobre consignación, y una impresión no es ni una cosa ni la otra.

### Lo que se mantiene

- Los **gráficos del Top 10** por título, depósito y cliente (pestañas), con
  **cantidad y porcentaje** en la etiqueta y cantidad + ingreso + las dos
  porciones en el tooltip.
- El **toggle `Por ejemplares` / `Por ingreso`**, que ordena el ranking y cambia
  lo que mide la barra.
- El **ranking completo** con `Ventas`, `Ejemplares`, `% ejemplares`, `Ingreso` y
  `% ingreso`, paginado, con `Exportar CSV` y clic en la fila para abrir la ficha.
- Los dos gráficos de resumen: **Ingreso por mes** (ahora los doce meses que
  **terminan** en el mes elegido, con ese mes marcado en el gráfico) e **Ingreso
  por medio de pago** (del mes elegido).

### Toques al sistema de diseño

Dos, ambos mínimos y hacia adentro del sistema (no hay estilos ajenos):

- **`StatCard` acepta `variant="bare"`** y su `delta` acepta un nodo además de un
  texto. `bare` suelta el marco de tarjeta para que la cifra pueda ser una celda
  dentro de una `Card` —una tarjeta dentro de otra tarjeta está mal—, y es lo que
  permite la fila de cuatro cifras con divisores de la referencia. Se actualizó
  el `.d.ts` y el `.prompt.md`.
- **Ícono `arrow-down-right`** agregado a `assets/icons/`, copiado de Lucide con
  la misma convención que el resto del set (trazo, viewBox, atributos): era la
  mitad que faltaba del par que ya existía (`arrow-up-right`), y una flecha de
  suba sin su contraria no se puede dibujar con los 48 glifos previos.

### Archivos

En `front/src/features/dashboard/`:

- `DashboardPage.tsx` — el panel (Overview + gráficos de resumen + ranking).
- `useDashboard.ts` — mes, alcance y métrica; agregaciones del mes elegido y del
  anterior; serie mensual; medio de pago; los tres cortes. La carga entra por
  parámetro (DI, ver `front/CLAUDE.md`).
- `DeltaBadge.tsx` — la comparación contra el período anterior (valor + flecha +
  color) y el tooltip que la explica. La regla dirección → tono vive acá y no
  repetida en cada cifra, y el período comparado entra por parámetro —ya armado
  con la preposición adentro— para que el texto no se pueda desincronizar del mes
  elegido.
- `GraficoTopDimension.tsx`, `TablaDimension.tsx`,
  `GraficoIngresoMensual.tsx`, `GraficoMedioPago.tsx`.
- `panelStandIn.ts` — **stand-in temporal** (ver «Datos necesarios»).
- `tipos.ts`, `formato.ts`, `estiloTooltip.ts`.

Tocados: `front/src/lib/fecha.ts` (los helpers pasan a la aritmética de meses:
`mesActual`, `mesAnterior`, `ultimosMeses`, `formatMes`, `formatMesCorto` para
nombrar el período comparado sin el año cuando es el mismo año, y `diaDeHoy` para
el corte del mismo tramo), y en el sistema de diseño
`components/core/StatCard.{jsx,d.ts,prompt.md}` y
`assets/icons/arrow-down-right.svg`.

## Datos necesarios

**Nada de esto existe hoy en el backend.** En esta pasada **todo el panel** se
revisa contra datos de muestra generados en memoria (`panelStandIn.ts`,
determinístico, 420 días) y el front agrega del lado del cliente. Eso es **una
decisión temporal del mock, no una propuesta**: dónde y cómo se agrega lo decide
el planner. El único punto de recambio en el front es qué función recibe
`useDashboard`.

Ojo con un efecto de esto: Inicio **ya no usa `GET /venta`**. Antes traía las
ventas reales y agregaba montos en el cliente; mientras el agregado no exista, el
panel entero sale del stand-in para que los números cierren entre sí (si el monto
viniera del API y los cortes del mock, el ingreso total no sería la suma de las
filas).

Qué **cuenta** como venta (hoy derivado del ledger, ver `back/db/migrations/0004`
y `0005`): la `cantidad` y el `precio` de cada línea de un movimiento de tipo
`venta` o `ventaConsignacion`. El cliente, el medio de pago y el depósito de
origen son del movimiento; el importe de la línea es `cantidad × precio`. Y qué
cuenta como **ejemplar nuevo**: la `cantidad` de cada línea de un movimiento de
tipo `ingreso`.

Capacidades que el front necesita, sin describir rutas ni parámetros:

1. **Un período es un mes completo.** Todo lo que sigue se pide para un mes
   concreto, no para un par de fechas sueltas.
2. **Estar disponibles los meses con datos**, para poder armar el selector sin
   hardcodear la lista (hoy el front ofrece los trece últimos meses contra el
   calendario).
3. **Las cuatro cifras del mes**: ingreso total, ejemplares vendidos, cantidad de
   ventas y **ejemplares nuevos** (ejemplares que entraron al stock).
4. **La misma comparación período a período**: cada una de esas cuatro cifras
   tiene que poder leerse también para el **período con el que se compara**, para
   calcular la variación porcentual. Ese período es:
   - el **mes anterior completo**, cuando el mes elegido ya cerró; o
   - **el mismo tramo de días** del mes anterior (del día 1 al día de hoy del mes
     en curso, y del 1 al mismo día del mes anterior; si el anterior es más corto,
     hasta su último día), cuando el mes elegido es el **mes en curso**, que está a
     medias.

   En los dos casos la comparación tiene que venir **con el mismo alcance de
   ventas** que el mes elegido, si no mezcla dos universos.
5. **Ejemplares e ingreso por título** en el mes: **ISBN**, **título**,
   **cantidad de ejemplares**, **ingreso** y **cantidad de ventas** (movimientos
   de venta distintos que lo incluyen). Lectura.
6. **Ejemplares e ingreso por cliente** en el mes: **cliente** (nombre),
   ejemplares, **ingreso** y cantidad de ventas. Lectura.
7. **Ejemplares e ingreso por depósito** en el mes: **depósito** (nombre),
   ejemplares, **ingreso**, cantidad de ventas, y **si el depósito es de un
   cliente** (stock consignado) — la pantalla lo marca y cambia a dónde lleva el
   clic. Lectura.
8. **Poder acotar todo lo comercial a un alcance**: incluir o excluir por
   separado las ventas en firme y las ventas sobre consignación. Los **ejemplares
   nuevos no se acotan** (es producción, no venta).
9. **Poder ordenar cada corte por ejemplares o por ingreso**, y conocer la
   porción del total que representa cada fila — en ejemplares **y** en ingreso,
   por separado (los dos porcentajes no son el mismo número).
10. **La serie de los últimos doce meses de ingreso** que **termina en el mes
    elegido**, con los meses sin ventas incluidos en cero.
11. **El ingreso por medio de pago** del mes.
12. **Coherencia entre todo lo anterior**: el ingreso del mes tiene que ser la
    suma de los tres cortes, de la serie mensual y del desglose por medio de
    pago. Es la única forma de que el panel sirva para decidir.
13. **Reconciliación con las pantallas de Ventas y Liquidaciones**: el panel
    muestra importes de línea (`cantidad × precio`) mientras el resto del sistema
    trabaja con el total de la venta (con su descuento). El planner tiene que
    definir cuál de los dos es el «ingreso generado» y dejarlo consistente, no
    inventar un tercer número.

Fuera de alcance por ahora: comparación contra el mismo mes del año anterior,
cortes por colección o por persona, y exportar el panel completo (hoy se exporta
el ranking visible).
