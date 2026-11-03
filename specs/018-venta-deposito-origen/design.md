# Design: Elegir depósito de origen al generar una venta

Estado: aprobado

## Historia

Como usuario, necesito poder generar una venta desde otros depósitos que no sean el principal (hoy el depósito de origen está hardcodeado como el principal).

## Qué se construyó

Una modificación a la pantalla **Nueva venta** (`/ventas/nueva`) que agrega un selector de depósito para las ventas en firme. El stock que muestra el picker de libros se recalcula según el depósito elegido (en vez de siempre ser el del depósito principal). El depósito principal sigue siendo la selección por defecto para mantener el comportamiento actual si el usuario no toca el selector.

### Archivos modificados

| Archivo | Qué cambia |
| --- | --- |
| `front/src/features/ventas/useVentaForm.ts` | Nuevo estado `depositoId` (default: principal). Se recalculan las cantidades de `librosDisponibles` según el depósito elegido (mock temporal con stock simulado por depósito). Al cambiar de depósito, se resetea la selección de libros. |
| `front/src/features/ventas/NuevaVentaPage.tsx` | Columna **"Depósito de origen"** en la grilla de campos superiores (`Select`), visible solo cuando `tipoVenta === "firme"`. La ayuda bajo el picker cambia de *"El stock sale del depósito principal («Depósito central»)."* a *"El stock sale de «{nombre}»."* (refleja el depósito elegido). En consignación, no hay selector ni ayuda de depósito (el stock sale del depósito del cliente, que no es elegible). |

### Decisión de diseño: solo en "Venta en firme"

La funcionalidad **solo aparece en "Venta en firme"**, no en "Venta sobre consignación". En consignación, el depósito de origen fijo es el depósito propio del cliente (ver `operacion.config.ts` → `ventaConsignacion.obtenerExtremos`), no un depósito del usuario, y por lo tanto no hay nada que elegir.

### Comportamiento al cambiar depósito

Cuando el usuario cambia el depósito en el `Select`:
1. Se resetea la selección de libros (porque las cantidades disponibles pueden cambiar).
2. El picker muestra las nuevas cantidades en la etiqueta de cada libro (`"Título (N)"` con N = stock en el depósito elegido).
3. La ayuda cambia para reflejar el nuevo nombre de depósito.

### Comportamiento inicial

Al montar la pantalla, `depositoId` está vacío hasta que `listDepositos()` resuelve; el `Select` muestra su placeholder. El `useEffect` setea automáticamente el id del depósito principal en cuanto llega la respuesta. Durante ese breve instante, el picker opera contra `disponible_principal` (mismo comportamiento que hoy).

## Datos necesarios

### 1. Stock disponible por depósito para cada libro (lectura)

Hoy, la venta en firme opera contra `libro.disponible_principal`, que es el stock del depósito principal para ese libro. Con el selector de depósito, la pantalla necesita **la cantidad disponible de cada libro en el depósito elegido**, no siempre en el principal.

**Capacidad requerida**: dado un depósito (id) y el catálogo de libros, la pantalla puede obtener por cada libro la cantidad de ejemplares disponibles en ese depósito específico. Esto puede resolverse:

- Añadiendo un campo `disponible_en_deposito` (o similar) al `GET /libro` que responda al depósito indicado.
- O exponiendo un endpoint separado que devuelva stock libro por libro para un depósito dado.
- O devolviendo el campo adicional con `listLibros` como parámetro.

En esta pasada, `useVentaForm.ts` lleva un **mock temporal** (`stockSimuladoPorDeposito`) que distribuye el stock del libro proporcionalmente entre los depósitos del usuario. Este mock se elimina cuando el backend provee el dato real.

### 2. Indicar el depósito de origen al crear una venta (escritura)

Hoy, `obtenerExtremos()` de `operacion.config.ts` hardcodea `principa1(userId)` como origen para todas las ventas. La pantalla necesita poder indicar qué usar como depósito de origen al registrar una venta en firme.

**Capacidad requerida**: al crear una venta (`POST /venta`), el payload acepta un `deposito_id` (o equivalente) que indica desde qué depósito se descuenta el stock. El backend valida que el depósito exista, pertenezca al usuario, y tenga stock suficiente. Si falta `deposito_id`, se usa el principal (backward compatible).

### 3. No afecta a "Venta sobre consignación"

Esta operación ya tiene un depósito de origen fijo (el depósito propio del cliente). No requiere cambios de datos. El selector y la nueva capacidad solo aplican a "Venta en firme".

### 4. Datos de muestra en el mock temporal (no es contrato)

La función `stockSimuladoPorDeposito` en `useVentaForm.ts` calcula stock por depósito a partir de `libro.stock` (total) y `libro.disponible_principal` (stock en el principal). Es una distribución proporcional para que el picker muestre cantidades distintas según el depósito elegido. No hay persistencia ni efecto en el catalogo real: es exclusivo de esta pasada de diseño.

Agent: ses_e7c213420ffewN0Hwlr5nxp7tL
