# Plan: Elegir depósito de origen al generar una venta

## Historia

Como usuario, necesito poder generar una venta en firme desde otro depósito que no sea el principal (hoy el depósito de origen está hardcodeado como el principal).

**Estado**: implementado y con el front integrado (design.md aprobado).

## Diseño de API

### `POST /:tipo/venta` — nuevo parámetro opcional `deposito_id`

El endpoint de creación de venta en firme (`POST /:tipo` con `tipo=venta`) acepta un campo nuevo y opcional en el body:

```
{
  "...": "... Campos existentes sin cambio",
  "deposito_id": number  // opcional
}
```

- Si `deposito_id` está presente: valida que el depósito exista, pertenezca al usuario autenticado, no sea el depósito propio de un cliente, y tenga stock suficiente para los libros y cantidades de la venta. Si pasa la validación, el descuento de stock se aplica sobre ese depósito.
- Si `deposito_id` está ausente: se usa el depósito principal del usuario, manteniendo el comportamiento actual (backward compatible).
- Si `deposito_id` inválido (no existe, es de otro usuario, es depósito de cliente): `404`.
- Si el depósito elegido no tiene stock suficiente para uno o más libros: `409` con el mismo contrato de error propio de "stock insuficiente" que ya existe, detallando por libro el `isbn`, `titulo`, `pedido` y `disponible` en ese depósito. El efecto es atómico: ningún libro se descuenta.
- Este cambio **no afecta** a `consignacion`, `ventaConsignacion` ni `devolucion`: siguen operando con sus depósitos de origen fijos (principal para consignación y devolución, depósito del cliente para venta sobre consignación).

### Stock disponible por depósito al listar libros

Hoy, `GET /libro` y `GET /libro/lista_libros` devuelven por libro un campo `disponible_principal` (el stock en el depósito principal). Con el selector de depósito, se agrega un campo adicional:

- `GET /libro?deposito_id=N`: opcionalmente, acepta un query param `deposito_id`. Si está presente, la respuesta incluye además `disponible_en_deposito` con la cantidad disponible de ese libro en el depósito indicado.
- `GET /libro/lista_libros?deposito_id=N`: mismo comportamiento.
- Si el parámetro no se pasa, la respuesta es idéntica a la actual (sin `disponible_en_deposito`).
- Si el `deposito_id` no existe o no pertenece al usuario: `404`.

### `GET /:tipo/:id` — detalle de venta refleja depósito de origen

El detalle de una venta en firme muestra, además de los datos actuales, el depósito de origen desde el que se descontó el stock (su `id` y `nombre`), para que el historial indique desde qué depósito salió el stock.

### `POST /:tipo/devolucion` — sin cambio

Una devolución siempre reintegra stock al depósito principal (igual que hoy). No se modifica.

## Tareas

### 1. Aceptar `deposito_id` opcional en creación de venta en firme

`POST /:tipo/venta` admite el parámetro `deposito_id` en el body. Si está presente, valida propiedad y existencia del depósito; si no, usa el principal.

Criterios de aceptación:
- [x] `POST /:tipo/venta` con `deposito_id` válido (existe, pertenece al usuario, tiene stock suficiente) crea la venta y descuenta el stock del depósito indicado, no del principal.
- [x] `POST /:tipo/venta` sin `deposito_id` crea la venta y descuenta del depósito principal (comportamiento actual preservado).
- [x] `POST /:tipo/venta` con `deposito_id` de un depósito que no existe o pertenece a otro usuario devuelve `404`.
- [x] `POST /:tipo/venta` con `deposito_id` de un depósito propio de cliente devuelve `404` (no es depósito elegible del usuario).
- [x] Enviar `deposito_id` en una consignación, venta sobre consignación o devolución no cambia su comportamiento: siguen usando sus depósitos de origen fijos.

### 2. Validación de stock suficiente en el depósito elegido con rechazo atómico

Si el depósito elegido no tiene stock suficiente para uno o más libros de la venta, la operación se rechaza sin persistir ningún cambio.

Criterios de aceptación:
- [x] Cuando el depósito elegido tiene stock suficiente para todos los libros, la venta se crea con `201` y el stock se descuenta del depósito elegido.
- [x] Cuando el depósito elegido no tiene stock suficiente para al menos un libro, la respuesta es `409` con un error propio de "stock insuficiente" (distinguible del resto de errores de la operación).
- [x] El cuerpo del `409` incluye, por cada libro que no alcanza, `isbn`, `titulo`, `pedido` y `disponible` (cuánto había en ese depósito).
- [x] Ante un `409`, ningún depósito cambia: ni el elegido ni el principal quedan con stock modificado.
- [x] Ante un `409`, no queda registrada una venta ni un movimiento nuevo consultable en el historial de movimientos del usuario.

### 3. Persistir el depósito de origen en la venta para el historial

Al crear una venta en firme, se registra desde qué depósito se operó, para que el detalle de la venta lo muestre.

Criterios de aceptación:
- [x] `GET /:tipo/:id` de una venta en firme creada con `deposito_id` personalizado incluye en su respuesta el `id` y el `nombre` del depósito de origen.
- [x] `GET /:tipo/:id` de una venta creada sin `deposito_id` muestra el depósito principal como depósito de origen.
- [x] Las ventas de tipo consignación, venta sobre consignación y devolución no se ven afectadas: muestran sus depósitos de origen habituales.

### 4. Stock disponible por depósito en listado de libros

`GET /libro` y `GET /libro/lista_libros` aceptan opcionalmente `?deposito_id=N` para incluir `disponible_en_deposito` en cada libro devuelto.

Criterios de aceptación:
- [x] `GET /libro?deposito_id=N` (N válido) incluye en cada libro un campo `disponible_en_deposito` igual a la cantidad de ese libro en el depósito N.
- [x] `GET /libro/lista_libros?deposito_id=N` tiene el mismo comportamiento.
- [x] `GET /libro` sin `deposito_id` no incluye `disponible_en_deposito` y la respuesta es idéntica a la actual (incluido `disponible_principal`).
- [x] Un libro sin stock en el depósito elegido informa `disponible_en_deposito` en `0`.
- [x] `disponible_en_deposito` es distinto de `disponible_principal` cuando el libro tiene diferente cantidad en ambos depósitos.
- [x] `GET /libro?deposito_id=N` con N inexistente o de otro usuario devuelve `404`.

### 5. El movimiento asociado a la venta refleja el depósito de origen correcto

El movimiento de tipo `venta` creado al registrar la venta tiene su extremo de origen apuntando al depósito elegido (o al principal si no se especificó).

Criterios de aceptación:
- [x] Al crear una venta con `deposito_id` personalizado, el movimiento resultante tiene `origen_deposito_id` igual al depósito elegido.
- [x] Al crear una venta sin `deposito_id`, el movimiento tiene `origen_deposito_id` igual al depósito principal.
- [x] El movimiento aparece en `GET /movimiento/` con el depósito de origen correcto, incluyendo su nombre.

## Correcciones post-implementación

Al probar la historia aparecieron tres bugs que los tests originales no cubrían:

1. **`GET /libro?deposito_id=N` devolvía `disponible_en_deposito: null`** cuando el libro no tenía fila en ese depósito. El `coalesce` estaba dentro del `select` de la subquery escalar; con cero filas el resultado es `NULL`. Se corrigió con `sum` + `coalesce`, igual que `stockDeLibro` (ver `libro.stock.ts`).
2. **El front caía al stock del principal** cuando `disponible_en_deposito` no venía (`?? disponible_principal`), mostrando stock que no existía en el depósito elegido. Ahora, con depósito elegido, un dato ausente vale 0.
3. **`POST /venta` devolvía `origen_deposito` sin `nombre`** (solo `{ id }`), a diferencia del detalle. Se releyó el depósito de origen para devolver `{ id, nombre }` en ambos casos.

Se agregaron tests reales para cubrir el campo por depósito (`test/deposito.test.ts`) y la venta con `deposito_id`: descuento del depósito elegido, origen informado, 409 atómico y 404 por depósito inválido/ajeno/de cliente (`test/venta.test.ts`).
