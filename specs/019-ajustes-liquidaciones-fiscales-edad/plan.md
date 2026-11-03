# Plan: ajustes de liquidaciones, datos fiscales y edad recomendada

## Historia

Cuatro ajustes que salieron de usar el sistema en producción:

1. Al generar una liquidación **no se descuenta el anticipo** pagado a una persona.
2. Buscar personas **por nombre** dentro de una liquidación.
3. Poder cargar la **edad recomendada como rango** (`0 a 3 años`), no sólo un mínimo.
4. Poder **corregir la condición frente al IVA** de la cuenta (y los demás datos del
   emisor), y que la **letra del comprobante** se derive de esa condición en vez de
   estar fija (la tienda emitía siempre B y las ventas manuales siempre C).

## 1. Anticipos en la liquidación

Decisión: se descuenta el anticipo **ya pagado y no recuperado**, una sola vez, contra
las regalías de la misma persona + libro + rol. Si el anticipo supera las regalías del
período, se descuenta sólo lo que entra y el saldo queda para la próxima liquidación.

- `anticipos.recuperado` acumula lo ya descontado (default 0). El disponible es
  `monto - recuperado`.
- Se calcula en la previsualización y se persiste al generar, dentro de la misma
  transacción: si la generación falla, el anticipo no queda marcado como recuperado.
- `liquidacion_personas.anticipo` y `liquidacion_lineas.anticipo` guardan el descuento
  congelado. `total` sigue siendo el neto a pagar.
- La respuesta de la ficha y del reporte expone `total_bruto`, `anticipo` y (en el
  reporte) `total_anticipos`.

Criterios de aceptación:

- [x] Un anticipo pagado de 150 contra regalías de 100 descuenta 100; la liquidación
      siguiente descuenta los 50 restantes.
- [x] Un anticipo sin pagar no se descuenta.
- [x] La ficha muestra el detalle por libro con lo descontado.
- [x] Generar una liquidación no altera anticipos fuera de la transacción.

## 2. Búsqueda de personas en la liquidación

Input de búsqueda por nombre en la previsualización y en la ficha de una liquidación
generada. Filtra en el cliente, sin endpoint nuevo.

## 3. Edad recomendada por rango

- `libros.edad_recomendada` pasa a `libros.edad_min` (rename, conserva los datos) y se
  agrega `libros.edad_max`.
- Ambos extremos son opcionales: `0..3` = "0 a 3 años"; sólo `8` = "+8 años".
- Checks en la DB (`edad_max >= edad_min`, no negativos) y validación en el service
  para updates parciales.
- La API pública de la tienda expone `edadMin` / `edadMax` (reemplaza
  `edadRecomendada`); la tienda de Feria usa `edadMin`.

## 4. Datos fiscales y letra del comprobante

- `PUT /user` acepta `cond_fiscal`, `razon_social`, `domicilio`, `ingresos_brutos` y
  `fecha_inicio`; el perfil los edita en el mismo diálogo que email y punto de venta.
- Regla de letra (`back/src/lib/afip/fiscal.ts`):
  - emisor Monotributo o IVA Exento (o condición desconocida) → **C**;
  - emisor Responsable Inscripto + receptor Responsable Inscripto → **A**;
  - emisor Responsable Inscripto + cualquier otro receptor → **B**.
- La letra se calcula en el backend tanto para ventas manuales como para pedidos de la
  tienda; el front ya no manda `tipo_cbte`.
- A y B discriminan IVA incluido en el precio (`neto = total / 1,21`, `iva = total -
  neto`); C no discrimina. El `importe_neto` que se persiste sale de esa
  discriminación (antes se guardaba el subtotal bruto y no cerraba con el total).

Criterios de aceptación:

- [x] Cambiar la condición fiscal de la cuenta se refleja en la próxima factura.
- [x] Cuenta monotributista: todas las facturas (tienda y ventas manuales) son C.
- [x] Cuenta RI: consumidor final → B; responsable inscripto → A.
- [x] Neto + IVA = total en A/B; IVA 0 en C.
