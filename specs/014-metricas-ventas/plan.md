# Plan: Panel de métricas de ventas

## Historia

Ver la cantidad de ejemplares vendidos cortada por título, por cliente y por
depósito, dentro de un panel de métricas de la editorial que trabaja por mes
completo, compara contra el período anterior comparable y muestra ingreso
generado, ejemplares vendidos, cantidad de ventas y ejemplares nuevos — con los
tres cortes, la serie mensual y el desglose por medio de pago coherentes entre
sí.

## Diseño de API

Grupo nuevo de endpoints de sólo lectura, orientado a alimentar el panel. Todos
requieren sesión (sin credenciales, 401) y están acotados a la cuenta.

Conceptos transversales:

- **Período**: siempre un mes, `mes=YYYY-MM`. El mes en curso se corta hasta hoy
  (`1–hoy`); un mes cerrado va completo (`1–último día`).
- **Comparación**: si el mes elegido es el mes en curso, es el **mismo tramo de
  días** del mes anterior (`1–día de hoy`; si el anterior es más corto, hasta su
  último día). Si el mes ya cerró, es el **mes anterior completo**. El mismo
  `alcance` aplica a la comparación.
- **Alcance de ventas**: `alcance=todas|firme|consignacion` (default `todas`).
  `firme` cuenta sólo ventas en firme, `consignacion` sólo ventas sobre
  consignación. **No** afecta a los ejemplares nuevos.
- **Ingreso generado**: el **total de la venta con su descuento aplicado**
  (el mismo número de Ventas y Liquidaciones), no la suma de `cantidad × precio`
  de las líneas. Cuando una venta tiene varias líneas, el total se reparte entre
  los títulos **proporcionalmente al importe de cada línea**, para que la suma de
  los cortes siga dando el total del mes.
- **Ejemplares nuevos**: ejemplares que entraron al stock en el mes (ingresos de
  stock desde el exterior), sin responder al alcance de ventas.
- **Zona horaria**: los cortes de mes y el «hoy» se calculan en **hora local de
  Argentina** (`America/Argentina/Buenos_Aires`).
- **Devoluciones**: no descuentan nada. Una devolución es un movimiento de stock
  (depósito del cliente → depósito principal), no una venta: no afecta
  ejemplares ni ingreso.
- **Ingresos de stock de la migración**: el stock preexistente que se reconstruyó
  como ingreso de stock al migrar **no** cuenta como «ejemplares nuevos» (no fue
  un lanzamiento ni una reimpresión).

### `GET /metricas/meses`

- 200 `{ "meses": ["2026-10", "2026-09", ...] }`, descendente.

### `GET /metricas/resumen?mes=YYYY-MM&alcance=...`

- 200:
```
{
  "periodo":     { "mes": "2026-10", "desde": "2026-10-01", "hasta": "2026-10-16", "enCurso": true },
  "comparacion": { "mes": "2026-09", "desde": "2026-09-01", "hasta": "2026-09-16", "parcial": true },
  "cifras": {
    "ingreso":          { "actual": 0, "anterior": 0 },
    "ejemplares":       { "actual": 0, "anterior": 0 },
    "ventas":           { "actual": 0, "anterior": 0 },
    "ejemplaresNuevos": { "actual": 0, "anterior": 0 }
  }
}
```
- `mes` o `alcance` inválidos → 400.

### `GET /metricas/cortes?mes=YYYY-MM&alcance=...`

- 200:
```
{
  "titulo":   [ { "isbn", "titulo", "ejemplares", "ingreso", "ventas",
                  "porcionEjemplares", "porcionIngreso" } ],
  "cliente":  [ { "idCliente", "cliente", "ejemplares", "ingreso", "ventas",
                  "porcionEjemplares", "porcionIngreso" } ],
  "deposito": [ { "idDeposito", "deposito", "esDepositoCliente", "ejemplares",
                  "ingreso", "ventas", "porcionEjemplares", "porcionIngreso" } ]
}
```
- `ventas` es la cantidad de ventas distintas que incluyen esa fila.
- `porcionEjemplares` y `porcionIngreso` son fracciones entre 0 y 1 del total
  del mes; se devuelven completos y sin ordenar/paginar (el front ordena, pagina
  y exporta).
- Los identificadores de cliente y depósito son los que necesita el clic de la
  fila para abrir la ficha.

### `GET /metricas/serie?mes=YYYY-MM&alcance=...`

- 200 `{ "enCurso": true, "puntos": [ { "mes": "2025-11", "ingreso": 0 }, ... ] }`
- 12 puntos, del más viejo al más nuevo, el último es el mes elegido. `enCurso`
  indica que el último punto es el mes en curso.

### `GET /metricas/medios-pago?mes=YYYY-MM&alcance=...`

- 200 `{ "medios": [ { "medio": "efectivo", "ingreso": 0 } ] }`

## Tareas

### 1. Meses disponibles para el selector

Devolver los meses que el panel puede elegir, sin hardcodear la lista en el
front.

Criterios de aceptación:
- [ ] `GET /metricas/meses` devuelve 200 con una lista de meses en formato
      `YYYY-MM`, del más nuevo al más viejo.
- [ ] La lista incluye todo mes con al menos una venta (en firme o sobre
      consignación) o un ingreso de stock (sin contar los de la migración).
- [ ] El mes actual aparece siempre, aunque no tenga movimientos.
- [ ] Un mes anterior sin ventas ni ingresos no aparece.
- [ ] Sólo aparecen datos de la cuenta autenticada; sin sesión devuelve 401.

### 2. Cifras del mes y comparación

Devolver las cuatro cifras del mes elegido y las del período con el que se
compara, para calcular la variación.

Criterios de aceptación:
- [ ] `GET /metricas/resumen` devuelve, para `mes` y `alcance`, los cuatro
      valores `actual` y los cuatro `anterior`.
- [ ] `ingreso` es la suma del total con descuento de las ventas del período (no
      la suma de las líneas).
- [ ] `ejemplares` es la suma de ejemplares de las líneas de esas ventas.
- [ ] `ventas` es la cantidad de ventas distintas del período.
- [ ] `ejemplaresNuevos` es la suma de ejemplares ingresados al stock en el
      período (sin los ingresos de stock de la migración) y **no** cambia al
      variar `alcance`.
- [ ] `ingreso`, `ejemplares` y `ventas` sólo cuentan ventas en firme con
      `alcance=firme`, sólo sobre consignación con `alcance=consignacion`, y
      ambas con el default.
- [ ] Para el mes en curso, `comparacion` es el mismo tramo de días del mes
      anterior (p. ej. `mes=2026-10` con hoy 16/10 → comparación `2026-09-01` a
      `2026-09-16`, `parcial=true`), y `periodo` va de `2026-10-01` a
      `2026-10-16` con `enCurso=true`.
- [ ] Para un mes cerrado, `comparacion` es el mes anterior completo y
      `periodo` el mes completo con `enCurso=false`.
- [ ] Si el mes anterior es más corto, la comparación llega hasta su último día.
- [ ] Un mes válido sin datos devuelve 200 con todos los valores en cero.
- [ ] `mes` o `alcance` inválidos devuelven 400.

### 3. Cortes por título, cliente y depósito

Devolver los tres cortes de ejemplares e ingreso del mes, con la cantidad de
ventas y la porción del total de cada fila.

Criterios de aceptación:
- [ ] `GET /metricas/cortes` devuelve las tres listas: por título (con ISBN y
      título), por cliente (con nombre e identificador) y por depósito (con
      nombre, identificador y si el depósito es de un cliente).
- [ ] Cada fila trae `ejemplares`, `ingreso`, `ventas` (cantidad de ventas
      distintas que la incluyen), `porcionEjemplares` y `porcionIngreso`.
- [ ] El depósito de una fila es el depósito de origen del movimiento; para una
      venta sobre consignación es el depósito del cliente y
      `esDepositoCliente=true`.
- [ ] El ingreso de un título es la parte del total de cada venta que le
      corresponde según el importe de su línea, repartiendo el total cuando la
      venta tiene varias líneas.
- [ ] La suma de `ingreso` de todo el corte por cliente es igual a la suma del
      corte por depósito, y las tres sumas coinciden con el `ingreso` del mes
      (mismo `mes` y `alcance`).
- [ ] `porcionEjemplares` y `porcionIngreso` de cada fila suman 1 dentro de su
      corte (salvo corte vacío).
- [ ] Los tres cortes responden al `alcance`; un mes sin ventas devuelve las
      tres listas vacías.

### 4. Serie mensual de ingreso

Devolver el ingreso de los doce meses que terminan en el mes elegido.

Criterios de aceptación:
- [ ] `GET /metricas/serie` devuelve 12 puntos, del más viejo al más nuevo, y el
      último es el mes elegido.
- [ ] Los meses sin ventas se incluyen con `ingreso` en cero.
- [ ] El punto del mes elegido coincide con el `ingreso` del resumen para el
      mismo `mes` y `alcance`.
- [ ] `enCurso` es `true` sólo cuando el mes elegido es el mes en curso.
- [ ] La serie responde al `alcance` y sólo incluye datos de la cuenta.

### 5. Ingreso por medio de pago

Devolver el ingreso del mes desglosado por medio de pago.

Criterios de aceptación:
- [ ] `GET /metricas/medios-pago` devuelve las filas de medio de pago con su
      `ingreso` del mes.
- [ ] Sólo aparecen los medios con ventas en el período.
- [ ] La suma de `ingreso` de todos los medios coincide con el `ingreso` del mes
      (mismo `mes` y `alcance`).
- [ ] El desglose responde al `alcance` y sólo incluye datos de la cuenta.

### 6. Coherencia entre las vistas y alcance

Asegurar que las cinco vistas describen el mismo universo para un mismo `mes` y
`alcance`, que es la condición para que el panel sirva para decidir.

Criterios de aceptación:
- [ ] Para un mismo `mes` y `alcance`, el `ingreso` del resumen es igual a la
      suma del corte por título, a la suma del corte por cliente, a la suma del
      corte por depósito, al punto del mes en la serie y a la suma del desglose
      por medio de pago.
- [ ] Para un mismo `mes` y `alcance`, `ejemplares` del resumen es igual a la
      suma de ejemplares de cada uno de los tres cortes.
- [ ] `ventas` del resumen es igual a la cantidad de ventas del mes, y no cambia
      con el orden de los cortes.
- [ ] Con `alcance=firme` y con `alcance=consignacion`, los totales anteriores
      se recalculan excluyendo el otro tipo de venta en todas las vistas,
      mientras `ejemplaresNuevos` permanece igual en los tres alcances.
- [ ] Un mes cerrado y el mes en curso verifican la igualdad de la comparación
      (los cuatro `anterior` se calculan sobre el mismo `alcance` y el mismo
      período comparado).
