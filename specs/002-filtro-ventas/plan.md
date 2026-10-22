# Plan: Filtro de ventas

## Historia
Como usuario necesito poder filtrar las ventas por cliente, tipo de venta,
fecha desde/hasta y medio de pago.

## Diseño de API

Se extiende el endpoint existente de listado (`GET /venta`, instancia del
genérico `GET /:tipo` documentado en `back/docs/api.md`) con query params
opcionales y combinables entre sí (AND), más paginación server-side.

**Request**

`GET /venta?cliente=<id>&tipo=<venta|ventaConsignacion>&medioPago=<medio>&desde=<yyyy-mm-dd>&hasta=<yyyy-mm-dd>&page=<n>&pageSize=<n>`

- `cliente`: id de cliente, opcional.
- `tipo`: uno de los dos valores que ya distingue la columna "Tipo" del
  listado actual (venta en firme / venta sobre consignado), opcional.
- `medioPago`: uno de los medios de pago ya soportados (los mismos que
  devuelve `GET /venta/medios_pago`), opcional.
- `desde` / `hasta`: fecha límite inferior/superior (inclusive) sobre la
  fecha de la venta, opcionales, combinables entre sí para formar un rango.
- `page` / `pageSize`: opcionales, con default si no se envían.

Todos los filtros son opcionales de forma independiente y se combinan entre
sí cuando se envía más de uno.

**Response 200**

```
{
  "data": [ ...misma forma de venta que ya devuelve hoy GET /venta... ],
  "page": <n>,
  "pageSize": <n>,
  "total": <cantidad de ventas que matchean los filtros, sin paginar>
}
```

**Errores**

- `400` si `tipo` no es uno de los dos valores válidos.
- `400` si `medioPago` no es uno de los medios de pago válidos.
- `400` si `desde` o `hasta` no son fechas válidas, o si `desde` es
  posterior a `hasta`.
- `400` si `page` o `pageSize` no son enteros positivos.

## Ambigüedad

- `specs/002-filtro-ventas/design.md` sigue con `Estado: en revisión`: el
  contrato de datos ("Datos necesarios") que usé como base todavía no fue
  aprobado por el usuario. Si cambia, este plan puede quedar obsoleto.
- `GET /venta` es una instancia del endpoint genérico `GET /:tipo` que
  también sirve otros tipos de transacción (consignación, devolución). Este
  plan asume que los nuevos query params sólo aplican cuando `tipo` de ruta
  es `venta`/`ventaConsignacion` y no afectan el comportamiento de los otros
  usos de esa ruta genérica; si eso no es así, hay que revisar el alcance.

## Tareas

### 1. Filtrar el listado de ventas por cliente
Agregar la capacidad de acotar el listado a un cliente puntual.

Criterios de aceptación:
- [ ] `GET /venta?cliente=<id>` devuelve sólo ventas de ese cliente.
- [ ] `GET /venta?cliente=<id de cliente de otro usuario>` devuelve `200` con
      lista vacía, no expone datos de otro usuario.
- [ ] `GET /venta?cliente=<id inexistente>` devuelve `200` con lista vacía.
- [ ] `GET /venta` sin el param sigue devolviendo ventas de todos los
      clientes del usuario autenticado.

### 2. Filtrar el listado de ventas por tipo de venta
Agregar la capacidad de acotar el listado a "en firme" o "sobre
consignado".

Criterios de aceptación:
- [ ] `GET /venta?tipo=venta` devuelve sólo ventas en firme.
- [ ] `GET /venta?tipo=ventaConsignacion` devuelve sólo ventas sobre
      consignado.
- [ ] `GET /venta?tipo=<valor no soportado>` devuelve `400`.

### 3. Filtrar el listado de ventas por medio de pago
Agregar la capacidad de acotar el listado a un medio de pago puntual.

Criterios de aceptación:
- [ ] `GET /venta?medioPago=<medio válido>` devuelve sólo ventas con ese
      medio de pago.
- [ ] `GET /venta?medioPago=<valor no soportado>` devuelve `400`.

### 4. Filtrar el listado de ventas por rango de fechas
Agregar la capacidad de acotar el listado a un rango de fechas, con los dos
extremos opcionales e independientes entre sí.

Criterios de aceptación:
- [ ] `GET /venta?desde=<fecha>` devuelve sólo ventas con fecha mayor o
      igual a la indicada.
- [ ] `GET /venta?hasta=<fecha>` devuelve sólo ventas con fecha menor o
      igual a la indicada.
- [ ] `GET /venta?desde=<fecha1>&hasta=<fecha2>` devuelve sólo ventas
      dentro del rango, extremos inclusive.
- [ ] `GET /venta?desde=<fecha posterior a hasta>&hasta=<fecha>` devuelve
      `400`.
- [ ] `GET /venta?desde=<fecha inválida>` devuelve `400`.

### 5. Combinar filtros
Verificar que los filtros de cliente, tipo, medio de pago y rango de fechas
se combinan con lógica AND cuando se envían juntos.

Criterios de aceptación:
- [ ] `GET /venta` con dos o más filtros a la vez devuelve sólo las ventas
      que matchean todos los filtros enviados.
- [ ] Un combo de filtros que no matchea ninguna venta devuelve `200` con
      lista vacía, no error.

### 6. Paginar el listado server-side
Devolver el listado de ventas paginado desde el backend en vez del listado
completo, aplicando la paginación después de los filtros.

Criterios de aceptación:
- [ ] `GET /venta` sin `page`/`pageSize` devuelve la primera página con un
      tamaño de página por default.
- [ ] `GET /venta?page=2&pageSize=<n>` devuelve el segundo bloque de `n`
      resultados, sin solapar con la página 1.
- [ ] La respuesta incluye el total de ventas que matchean los filtros
      aplicados (no el total sin filtrar).
- [ ] `GET /venta?page=<página fuera de rango>` devuelve `200` con `data`
      vacío, no error.
- [ ] `GET /venta?page=0` y `GET /venta?pageSize=0` devuelven `400`.
- [ ] `GET /venta?page=<no numérico>` devuelve `400`.
- [ ] Paginación y filtros combinados: el total y las páginas reflejan el
      subconjunto ya filtrado.
