# Plan: Liquidación de ventas

## Historia

Generar, entre dos fechas, un reporte con los libros vendidos (cantidad,
precio, importe) y cuánto le corresponde cobrar a cada autor/ilustrador
según su porcentaje sobre cada libro vendido.

## Diseño de API

`GET /liquidacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

- Reporte calculado al vuelo, no persiste nada. Alcance limitado a los datos
  del usuario autenticado (mismo criterio de aislamiento que `/libro`,
  `/persona`, `/venta`).
- Query params:
  - `desde`, `hasta`: fechas en formato `YYYY-MM-DD`, ambas inclusive.
- Reglas de negocio del cálculo:
  - Cuentan como venta las transacciones de tipo `venta` y
    `ventaConsignacion`. Las de tipo `devolucion` no se consideran en
    absoluto (no restan cantidad ni importe).
  - El precio usado para `precio_unitario`, `importe_total` y el `importe`
    por persona es el precio histórico registrado en cada venta (el que
    quedó guardado en la transacción al momento de venderse), nunca el
    precio actual del catálogo del libro.
  - El porcentaje usado para el `importe` por persona es el porcentaje
    vigente al momento de generar la liquidación (no hay historial de
    porcentaje en el sistema), aunque haya cambiado durante el rango
    elegido.
- Respuesta `200`:
  ```
  {
    "total_facturado": number,
    "ejemplares_vendidos": number,
    "libros": [
      {
        "id_libro": number,
        "isbn": string,
        "titulo": string,
        "cantidad_vendida": number,
        "precio_unitario": number,
        "importe_total": number
      }
    ],
    "personas": [
      {
        "id_persona": number,
        "nombre": string,
        "detalle": [
          {
            "id_libro": number,
            "titulo": string,
            "tipo": "autor" | "ilustrador",
            "porcentaje": number,
            "importe": number
          }
        ],
        "total_a_pagar": number
      }
    ]
  }
  ```
  `tipo` va en cada entrada de `detalle` (no a nivel persona), porque una
  misma persona puede ser `autor` de un libro e `ilustrador` de otro.
- Errores: `400` si falta `desde` o `hasta`, si alguna no cumple el formato
  `YYYY-MM-DD`, o si `desde` es posterior a `hasta`.
- La cantidad de personas a liquidar (métrica de la pantalla) surge de la
  cantidad de elementos de `personas`; no es un campo aparte.

## Tareas

### 1. Endpoint y validación de rango de fechas

Crear `GET /liquidacion` con los query params `desde` y `hasta`, devolviendo
únicamente datos del usuario autenticado.

Criterios de aceptación:
- [ ] `GET /liquidacion` sin `desde` o sin `hasta` devuelve `400`.
- [ ] `GET /liquidacion?desde=2026-13-01&hasta=2026-01-31` (fecha inválida)
      devuelve `400`.
- [ ] `GET /liquidacion?desde=2026-02-01&hasta=2026-01-01` (desde posterior a
      hasta) devuelve `400`.
- [ ] `GET /liquidacion?desde=2026-01-01&hasta=2026-01-31` con parámetros
      válidos devuelve `200`.
- [ ] Los datos devueltos sólo incluyen ventas, libros y personas del
      usuario autenticado, aunque existan datos de otros usuarios en el
      rango de fechas.

### 2. Selección de transacciones que cuentan como venta

Incluir en el cálculo únicamente las transacciones de tipo `venta` y
`ventaConsignacion` ocurridas dentro del rango; excluir por completo las de
tipo `devolucion` (y cualquier otro tipo que no sea esos dos).

Criterios de aceptación:
- [ ] Una transacción de tipo `venta` dentro del rango se incluye en el
      agregado de libros y personas.
- [ ] Una transacción de tipo `ventaConsignacion` dentro del rango se
      incluye en el agregado de libros y personas.
- [ ] Una transacción de tipo `devolucion` dentro del rango no modifica
      `cantidad_vendida`, `importe_total`, `total_facturado` ni
      `ejemplares_vendidos` de ningún libro: es como si no existiera para
      este reporte.
- [ ] Una transacción de tipo `consignacion` (sin venta asociada) dentro del
      rango no se incluye en ningún agregado.

### 3. Agregado de libros vendidos en el período

Calcular, por cada libro con al menos una venta computable (según tarea 2)
dentro del rango `[desde, hasta]`, la cantidad total vendida, el importe
total facturado y un precio unitario representativo, usando siempre el
precio histórico registrado en cada venta.

Criterios de aceptación:
- [ ] Un libro vendido en dos transacciones distintas dentro del rango
      aparece una sola vez en `libros`, con `cantidad_vendida` igual a la
      suma de ambas ventas.
- [ ] `importe_total` de un libro es igual a la suma de (precio histórico de
      cada venta × cantidad) de cada línea de venta de ese libro en el
      rango.
- [ ] Si el precio actual del libro en el catálogo es distinto del precio
      que tenía al momento de venderse dentro del rango, `importe_total` y
      `precio_unitario` usan el precio histórico de la venta, no el precio
      actual del libro.
- [ ] Si las ventas de un mismo libro dentro del rango tuvieron precios
      históricos distintos entre sí, `precio_unitario` es
      `importe_total / cantidad_vendida` (promedio ponderado), y
      `importe_total` sigue siendo exacto.
- [ ] Una venta con fecha anterior a `desde` o posterior a `hasta` no se
      incluye en ningún agregado.
- [ ] Un libro sin ventas computables en el rango no aparece en `libros`.

### 4. Resumen del período

Calcular `total_facturado` y `ejemplares_vendidos` sobre el conjunto de
ventas computables del rango.

Criterios de aceptación:
- [ ] `total_facturado` es igual a la suma de `importe_total` de todos los
      libros en `libros`.
- [ ] `ejemplares_vendidos` es igual a la suma de `cantidad_vendida` de
      todos los libros en `libros`.
- [ ] Con un rango sin ventas computables, la respuesta es `200` con
      `libros: []`, `personas: []`, `total_facturado: 0`,
      `ejemplares_vendidos: 0`.

### 5. Agregado de liquidación por persona

A partir de los libros vendidos en el período y las personas asociadas a
cada uno, calcular cuánto le corresponde cobrar a cada persona usando su
porcentaje vigente al momento de generar la liquidación, agregando su
participación en todos los libros vendidos del período.

Criterios de aceptación:
- [ ] Con un libro de precio unitario histórico 100 vendido 10 veces en el
      rango y una persona con 10% de porcentaje vigente sobre ese libro, el
      `detalle` de esa persona para ese libro tiene `importe: 100` y
      `porcentaje: 10`.
- [ ] Si el porcentaje vigente de una persona sobre un libro es distinto
      del que tenía en el momento de alguna venta dentro del rango, el
      `importe` se calcula con el porcentaje vigente al momento de generar
      la liquidación.
- [ ] Una persona que participa en dos libros vendidos en el período tiene
      una sola entrada en `personas`, con un `detalle` por libro (cada uno
      con su propio `tipo`) y `total_a_pagar` igual a la suma de los
      `importe` de su `detalle`.
- [ ] Una persona que es `autor` en un libro vendido e `ilustrador` en otro
      libro vendido dentro del mismo período tiene una sola entrada en
      `personas`, con dos elementos en `detalle`, cada uno con el `tipo`
      que corresponde a ese libro.
- [ ] Un libro vendido en el período sin ninguna persona asociada no genera
      entradas en `personas` para ese libro, y no afecta a otras personas.
- [ ] Una persona asociada a un libro con porcentaje 0 aparece en
      `personas` con `importe: 0` para ese libro (no se excluye por
      porcentaje nulo).
