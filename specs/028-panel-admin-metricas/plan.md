# Plan: Panel de administración de uso por cuenta

## Historia

El operador del SaaS necesita un panel cross-tenant para medir la campaña de captación: cuántas cuentas confirmadas hay, cuántas son nuevas y activas en 30 días, cuántas cargaron libros o vendieron, cuántas tienen ARCA conectado y cómo evoluciona la base por etapa alcanzada. El acceso queda restringido a cuentas con rol de administración.

## Diseño de API

### Acceso y errores

- Todas las rutas nuevas viven bajo `/admin` y requieren sesión.
- El rol de acceso se lee de la base en cada consulta; el token sólo identifica la cuenta. Así, quitar o dar el rol impacta en la siguiente petición, sin esperar a que venza la sesión.
- Sin sesión, token inválido o vencido → `401` con `{ code: "unauthorized", message }`.
- Sesión válida con rol `editorial` → `403` con `{ code: "admin_required", message: "Acceso restringido" }`.
  El front debe distinguir este `403` de una sesión vencida: muestra “Acceso restringido” sin borrar la sesión. El `401` sí es sesión inválida.
- Parámetros inválidos del listado → `400` con `{ code, message, field }`: `invalid_estado`, `invalid_arca` o `invalid_pagina`.
- Las respuestas exitosas devuelven el objeto/array directo, como los endpoints de lectura existentes; los errores usan el cuerpo `{ code, message, field? }`.
- El panel no filtra por la cuenta del administrador: agrega todas las cuentas confirmadas. Nunca expone cuentas no confirmadas ni datos de sesión/tokens.

### Universo, ventana y definiciones

- **Universo:** sólo cuentas con email confirmado. Las no confirmadas no se listan, no se cuentan, no se buscan y no aparecen en la serie.
- **Ventana de 30 días:** móvil, desde el momento de la consulta menos 30 días hasta ahora, en hora de Argentina. `nuevas30d` y `activas30d` usan esa ventana; el resumen devuelve sus fechas.
- **Serie:** últimos seis meses calendario, incluido el actual, de más viejo a más nuevo. Los meses cerrados se cortan al último instante del mes; el actual, a hoy. Todo en hora de Argentina.
- **Activa:** tuvo al menos una operación de negocio en la ventana. El login no define el estado; es sólo un dato secundario.
- **ARCA conectado:** cuenta con el certificado de producción cargado.

#### Operación de negocio

Una operación es una acción concreta con fecha registrada. Cuentan:

- **Movimientos de stock y ventas:** cada movimiento registrado cuenta 1, incluidas las ventas. Se excluyen los ingresos reconstruidos por la migración histórica de stock. Una venta con varias líneas sigue siendo 1.
- **Pedidos de tienda online:** cada pedido cuenta 1 en su fecha de creación, cualquiera sea su estado. Los cambios de estado no cuentan.
- **Reseñas:** cada reseña creada cuenta 1 en su fecha. Editar o borrar no cuenta.
- **Contenido:** cada página cuenta como máximo 1, fechada en su última creación/edición dentro de la ventana. Varias ediciones de la misma página no suman más de 1; los bloques no suman aparte; la baja de una página no suma.
- **Liquidaciones:** cada liquidación generada cuenta 1 en su fecha. Sus pagos no cuentan.
- **Altas de libros, personas y clientes:** cada alta explícita cuenta 1 en su fecha. Las ediciones no cuentan. Las bajas lógicas no borran la operación. Los registros semilla que crea el sistema al abrir la cuenta no cuentan.

No cuentan: login, navegación, configuración (tienda, ARCA, medios de pago, roles), comprobantes, ediciones de libros/personas/clientes, pagos, cambios de estado de pedidos ni las filas derivadas de una misma acción (precio del libro, depósito del cliente, ítems del pedido, líneas de liquidación, bloques de contenido). El último uso de una integración no es una operación de negocio: no suma operaciones, no hace activa a la cuenta y no define la última operación.

No se suma la venta dos veces: la venta ya es un movimiento. Un pedido de tienda y la venta que genera son dos acciones con fecha propia; se cuenta el pedido y, cuando queda registrada la venta, también el movimiento, pero nunca el comprobante.

- **operaciones30d:** suma de las operaciones con fecha dentro de la ventana. **Activo:** operaciones30d > 0.
- **última operación:** fecha máxima entre todas las operaciones contadas, dentro o fuera de la ventana; `null` si nunca operó. Las fechas futuras se ignoran.

#### Ventas, libros y fechas

- **Venta:** movimiento de venta en firme o venta sobre consignación. Una devolución o un movimiento de consignación de stock no es venta. Un pedido pendiente no es venta; la venta online cuenta cuando queda registrada.
- **ventas30d:** cantidad de ventas distintas con fecha en la ventana, no líneas. **venta histórica:** al menos una venta en cualquier momento.
- **libros:** títulos cargados alguna vez, incluidas las bajas lógicas. **con libro:** al menos uno.
- **primera fecha de libro:** mínima fecha de alta de libro; `null` si no hay o no se conoce.
- **primera fecha de movimiento:** mínima fecha de movimiento real, excluyendo los de migración; `null` si no hay.
- **último ingreso:** último login exitoso; `null` si nunca ingresó.
- **alta:** fecha de alta de la cuenta; `null` si no se conoce.

#### Composición mensual por etapa

Para cada mes, la base son las cuentas confirmadas con alta conocida hasta el cierre de ese mes, más las cuentas de alta desconocida (se consideran anteriores a la ventana). Cada cuenta aparece una sola vez, en su etapa máxima alcanzada hasta ese cierre:

1. **Solo registrado:** sin libros hasta el cierre.
2. **Cargó libros:** al menos un libro hasta el cierre y ningún movimiento hasta ese cierre.
3. **Cargó movimientos:** al menos un movimiento real hasta el cierre (las ventas son movimientos; los de migración no cuentan).

La etapa no puede ser anterior al alta de la cuenta: si una fecha de libro o movimiento es anterior, se toma la fecha de alta. Si un libro no tiene fecha conocida, se usa la fecha de alta de la cuenta (o el primer mes de la ventana si tampoco hay alta) como cota inferior. La serie es acumulada, no cohortes por mes de alta; no usa la ventana de 30 días.

#### Rendimiento

Las agregaciones por cuenta (conteos, máximos y primeras fechas) se resuelven en SQL sobre las fuentes, sin traer todo el historial a memoria. El listado calcula las métricas de la página, pero los filtros de estado/ARCA y el total se resuelven en la consulta sobre todas las cuentas. Resumen, embudo y serie usan agregados; ninguna vista ejecuta una consulta por cuenta.

### Endpoints

#### `GET /admin/resumen`

Devuelve las seis cifras de las tarjetas y la ventana usada.

```json
{
  "periodo": { "desde": "2026-10-28", "hasta": "2026-11-26" },
  "cuentas": 35,
  "nuevas30d": 8,
  "activas30d": 15,
  "conLibro": 29,
  "conVenta": 13,
  "arcaConectado": 9
}
```

`cuentas`, `conLibro`, `conVenta` y `arcaConectado` son de toda la vida; `nuevas30d` y `activas30d` usan la ventana. La pantalla deriva los porcentajes.

#### `GET /admin/embudo`

```json
{ "cuentas": 35, "conLibro": 29, "conVenta": 13 }
```

Son los mismos valores del resumen, acumulados de toda la vida.

#### `GET /admin/serie`

Seis puntos, del mes más viejo al actual. Cada punto trae el total y las tres etapas mutuamente excluyentes.

```json
{
  "puntos": [
    {
      "mes": "2026-06",
      "total": 18,
      "etapas": { "soloRegistrado": 11, "cargoLibros": 0, "cargoMovimientos": 7 }
    }
  ]
}
```

Sin cuentas, devuelve los seis meses con total y etapas en 0. La suma de etapas de cada punto es su total y el total del último punto coincide con `resumen.cuentas`.

#### `GET /admin/cuentas`

Parámetros opcionales:

- `q`: búsqueda parcial por razón social o email, sin distinguir mayúsculas ni acentos. Vacío o sólo espacios no filtra.
- `estado`: `activo` | `inactivo`.
- `arca`: `con` | `sin`.
- `pagina`: entero positivo, base 1, por defecto 1. El tamaño de página es fijo en 10.

Los filtros se combinan con AND. El orden es estable: razón social ascendente sin distinguir mayúsculas ni acentos, desempate por email y luego identificador.

```json
{
  "cuentas": [
    {
      "id": 12,
      "razonSocial": "Editorial Ejemplo",
      "email": "hola@editorial.com",
      "alta": "2025-03-14",
      "ultimaOperacion": "2026-11-25",
      "ultimoIngreso": "2026-11-26",
      "operaciones30d": 4,
      "libros": 7,
      "ventas30d": 2,
      "arcaConectado": true,
      "estado": "activo",
      "primeraFechaLibro": "2025-04-01",
      "primeraFechaMovimiento": "2025-05-10",
      "ventaHistorica": true
    }
  ],
  "total": 35,
  "pagina": 1,
  "porPagina": 10
}
```

Las fechas son `YYYY-MM-DD` en hora de Argentina o `null`. `total` es la cantidad de cuentas que coinciden con el recorte, no la de la página. Una página fuera de rango devuelve lista vacía y el total correcto; una búsqueda sin resultados devuelve `200` con lista vacía y total 0. No hay endpoint de exportación: el front recorre las páginas usando `total` y arma el CSV.

## Ambigüedad

- **Cuentas viejas sin evidencia de alta.** El plan les deja el alta desconocida: la tabla muestra “Sin fecha”, no cuentan como nuevas y, para que la serie siga representando la base completa, se incluyen desde el primer mes como “alta anterior a la ventana”. Si se prefiere asignarles la fecha de migración (las volvería “nuevas”) o excluirlas de la serie, cambia el contrato.
- **Fecha de confirmación del email.** El modelo sólo tiene el estado confirmado/no confirmado. La serie trata a todas las cuentas que hoy están confirmadas como parte de la base desde su alta; no puede reconstruir en qué mes confirmó cada una. Si se necesita “confirmadas al cierre de cada mes”, falta una fecha de confirmación.
- **Cliente genérico al registrar una cuenta.** El plan excluye el cliente por defecto (y cualquier registro semilla) de las altas de clientes, para que una cuenta recién registrada sin acciones de negocio quede inactiva. Si el producto quiere contarlo como alta, cambia la actividad mínima de toda cuenta nueva.
- **Pedido de tienda que se factura.** El plan cuenta el pedido en su creación y, si después se registra la venta, también el movimiento de venta; el comprobante no cuenta. Si se prefiere una sola operación por venta online, hay que excluir uno de los dos.

## Tareas

### 1. Rol de acceso de las cuentas

Agregar a las cuentas el rol de acceso con dos valores, `editorial` y `admin`, por defecto `editorial`. Ninguna cuenta existente queda como administradora automáticamente; el primer admin se asigna a mano.

Criterios de aceptación:
- [ ] Después de migrar, todas las cuentas existentes tienen rol `editorial`.
- [ ] Una cuenta nueva queda con rol `editorial` por defecto.
- [ ] Sólo se aceptan los valores `editorial` y `admin`; cualquier otro valor se rechaza.
- [ ] Ninguna cuenta queda `admin` por efecto de la migración.
- [ ] Correr la migración dos veces no falla ni cambia roles ya asignados.

### 2. Fecha de alta y último ingreso de las cuentas

Agregar la fecha de alta y la fecha del último ingreso exitoso. La fecha de alta se completa desde la evidencia más antigua disponible de cada cuenta, sin inventar la fecha de migración; el último ingreso queda desconocido hasta el próximo login.

Criterios de aceptación:
- [ ] Una cuenta existente con un movimiento real de 2024 queda con alta en la fecha de ese movimiento, no en la fecha de migración.
- [ ] Una cuenta existente sin movimientos usa la fecha más antigua entre sus libros (historial de precios), pedidos, reseñas, contenido, liquidaciones y la creación de integraciones.
- [ ] Una cuenta existente sin ninguna evidencia queda con alta desconocida, no con la fecha de migración.
- [ ] Una cuenta nueva queda con alta en el momento del registro; confirmar el email no la cambia.
- [ ] El último ingreso de todas las cuentas existentes queda desconocido hasta que vuelvan a ingresar.
- [ ] Los ingresos de stock reconstruidos por la migración no cuentan como evidencia de alta.
- [ ] Correr la migración dos veces no cambia altas ya asignadas ni datos de las cuentas.

### 3. Fecha de alta de los libros

Agregar la fecha de alta de los libros. Los libros existentes se completan con la fecha de su primer precio; los que no tienen historial quedan sin fecha. Las altas nuevas se fechan al crearse.

Criterios de aceptación:
- [ ] Un libro existente con historial de precios queda con alta en la fecha de su primer precio.
- [ ] Un libro existente sin historial de precios queda sin fecha, no con la fecha de migración.
- [ ] Un libro nuevo queda con alta en el momento de su creación.
- [ ] Editar el precio de un libro no cambia su fecha de alta.
- [ ] Dar de baja un libro no borra su fecha de alta.
- [ ] Correr la migración dos veces no cambia fechas ya asignadas.

### 4. Fecha de alta de personas y clientes

Agregar la fecha de alta de personas y clientes. Las filas existentes quedan sin fecha y no cuentan retroactivamente; las nuevas se fechan al crearse.

Criterios de aceptación:
- [ ] Toda persona y todo cliente existente queda sin fecha, no con la fecha de migración.
- [ ] Una persona o un cliente nuevo queda con alta en el momento de su creación.
- [ ] Editar una persona o un cliente no cambia su fecha de alta.
- [ ] Dar de baja una persona o un cliente no borra su fecha de alta.
- [ ] Correr la migración dos veces no asigna fecha a los registros viejos.

### 5. Índices para las consultas del panel

Agregar los índices que soportan los filtros y agregados del panel sin cambiar datos.

Criterios de aceptación:
- [ ] Cada fuente de operaciones tiene un índice por cuenta y fecha que evita recorrer todo el historial al calcular operaciones, ventas y primeras fechas.
- [ ] Las cuentas confirmadas tienen índices que soportan los filtros por alta, ARCA y la composición mensual.
- [ ] Correr la migración dos veces no duplica índices ni falla.
- [ ] La migración de índices no modifica ninguna fila existente.

### 6. Registrar el último ingreso en el login exitoso

Actualizar la fecha del último ingreso cuando el login termina bien; los intentos fallidos no la tocan.

Criterios de aceptación:
- [ ] Un login exitoso actualiza el último ingreso a la hora del login.
- [ ] Un login con contraseña incorrecta no actualiza el último ingreso.
- [ ] Un login de una cuenta sin confirmar no actualiza el último ingreso.
- [ ] Un login fallido posterior conserva el último ingreso exitoso anterior.
- [ ] La respuesta del login no cambia.
- [ ] Verificar el email o restablecer la contraseña no se registran como ingreso.

### 7. Acceso restringido a administración

Aplicar el control de rol a todas las rutas de administración, después de autenticar y leyendo el rol desde la base.

Criterios de aceptación:
- [ ] Una cuenta `admin` autenticada accede a cualquier ruta `/admin` y recibe `200`.
- [ ] Una cuenta `editorial` autenticada recibe `403` con código `admin_required` en cualquier ruta `/admin`.
- [ ] Sin sesión, con token inválido o vencido se recibe `401` con código `unauthorized`, distinguible del `403`.
- [ ] Cambiar el rol de `editorial` a `admin` en la base habilita el acceso en la siguiente consulta sin volver a iniciar sesión; el cambio inverso lo bloquea.
- [ ] Una cuenta `editorial` sigue usando el resto de la API sin cambios.
- [ ] Un administrador ve métricas de todas las cuentas confirmadas, no sólo de la suya.
- [ ] Las cuentas no confirmadas no aparecen en ninguna respuesta, ni siquiera buscándolas por nombre o email.

### 8. Operaciones: movimientos, pedidos, reseñas y liquidaciones

Contar estas fuentes para `operaciones30d` y `ultimaOperacion`, sin doble conteo.

Criterios de aceptación:
- [ ] Un movimiento de stock o una venta con fecha en la ventana suma 1 operación; una venta con varias líneas sigue sumando 1.
- [ ] Un movimiento generado por la migración de stock no suma operación ni define la última operación.
- [ ] Un pedido de tienda suma 1 operación en su fecha de creación, sin importar su estado; sus cambios de estado no suman.
- [ ] Una reseña suma 1 operación en su fecha de creación; editarla o borrarla no suma.
- [ ] Una liquidación generada suma 1 operación en su fecha; sus pagos no suman.
- [ ] Un comprobante no suma operación.
- [ ] La última operación es la fecha más reciente entre todas las operaciones contadas, aunque esté fuera de la ventana.
- [ ] Una cuenta con sólo un movimiento de migración tiene 0 operaciones y última operación desconocida.

### 9. Operaciones: contenido, altas y exclusiones

Contar el contenido y las altas explícitas, excluyendo registros semilla, ediciones y filas derivadas.

Criterios de aceptación:
- [ ] Crear una página de contenido suma 1 operación en su fecha; editarla después mueve la operación a la última edición sin sumar una segunda.
- [ ] Editar varias veces la misma página dentro de la ventana sigue sumando 1 operación.
- [ ] Los bloques de una página no suman operaciones propias.
- [ ] Dar de baja una página no suma una operación nueva.
- [ ] Cada libro, persona y cliente creado explícitamente suma 1 operación en su fecha de alta.
- [ ] Editar un libro, una persona o un cliente no suma operación.
- [ ] El cliente genérico que se crea automáticamente al registrar una cuenta no suma operación; una cuenta recién registrada sin acciones de negocio tiene 0 operaciones y está inactiva.
- [ ] Una persona o un cliente viejo sin fecha no suma operación retroactiva.
- [ ] Un alta que crea filas derivadas (precio del libro, depósito del cliente, líneas de liquidación) suma 1, no una por fila.
- [ ] La última operación incluye la fecha más reciente de contenido y altas, aunque esté fuera de la ventana.

### 10. Ventas, libros y primeras fechas por cuenta

Calcular las métricas de ventas, libros y fechas que alimentan el listado y la serie.

Criterios de aceptación:
- [ ] `ventas30d` cuenta ventas distintas con fecha en la ventana, no líneas; una venta de tres libros suma 1.
- [ ] Una devolución o un movimiento de consignación de stock no suma venta; una venta sobre consignación sí cuenta.
- [ ] Una venta de tienda online suma cuando queda registrada la venta, no cuando se crea el pedido pendiente.
- [ ] `ventaHistorica` es verdadero si la cuenta tuvo al menos una venta en cualquier momento.
- [ ] `libros` cuenta todos los títulos cargados alguna vez; una baja lógica no lo descuenta.
- [ ] `primeraFechaLibro` es la fecha del primer libro y `primeraFechaMovimiento` la del primer movimiento real, excluyendo los de migración.
- [ ] Una cuenta sin libros o sin movimientos devuelve `null` en la fecha correspondiente.
- [ ] Estas métricas no cambian por la búsqueda, los filtros ni la paginación del listado.

### 11. Resumen y embudo

Exponer las seis cifras del panel y los tres pasos del embudo sobre el universo confirmado.

Criterios de aceptación:
- [ ] `GET /admin/resumen` devuelve las seis cifras y el período de 30 días usado.
- [ ] `cuentas` cuenta sólo cuentas confirmadas.
- [ ] `nuevas30d` cuenta confirmadas con alta dentro de la ventana; las de alta desconocida no suman.
- [ ] `activas30d` cuenta confirmadas con al menos una operación de negocio en la ventana; un login solo no alcanza.
- [ ] `conLibro` y `conVenta` son de toda la vida, no de la ventana.
- [ ] `arcaConectado` cuenta confirmadas con certificado de producción.
- [ ] Sin cuentas, las seis cifras son 0 y el período viene igual.
- [ ] `GET /admin/embudo` devuelve `cuentas`, `conLibro` y `conVenta` con los mismos valores del resumen.
- [ ] `conVenta` nunca supera `conLibro`.
- [ ] Sin cuentas, el embudo devuelve 0, 0 y 0.
- [ ] Un `editorial` recibe `403` y sin sesión `401` en ambos endpoints.

### 12. Serie mensual de seis meses

Exponer la composición acumulada de la base confirmada por etapa máxima alcanzada.

Criterios de aceptación:
- [ ] `GET /admin/serie` devuelve seis puntos, del mes más viejo al actual, con formato `YYYY-MM`.
- [ ] Cada punto trae total y las tres etapas; la suma de etapas es igual al total.
- [ ] Cada cuenta aparece una sola vez por mes, en su etapa máxima alcanzada hasta el cierre de ese mes.
- [ ] Una cuenta sin libros ni movimientos al cierre está en “solo registrado”; con libro y sin movimiento en “cargó libros”; con movimiento, incluida una venta, en “cargó movimientos”.
- [ ] Un movimiento de migración no la hace pasar a “cargó movimientos”.
- [ ] El mes en curso se corta a hoy; los meses cerrados, a su último día.
- [ ] La composición es acumulada: una cuenta creada en el primer mes sigue apareciendo en los meses siguientes.
- [ ] El total del último punto coincide con `resumen.cuentas`.
- [ ] Sin cuentas, los seis puntos vienen con total y etapas en 0.
- [ ] Un `editorial` recibe `403` y sin sesión `401`.

### 13. Listado paginado de cuentas

Exponer el listado con métricas por cuenta, búsqueda, filtros, totales y paginación de 10.

Criterios de aceptación:
- [ ] `GET /admin/cuentas` devuelve razón social, email, alta, última operación, último ingreso, operaciones 30d, libros, ventas 30d, ARCA, estado, primera fecha de libro, primera fecha de movimiento y venta histórica.
- [ ] Alta, última operación, último ingreso y primeras fechas vienen como fecha o `null`, para que la pantalla muestre “Sin fecha”, “Nunca ingresó” o “Sin operaciones”.
- [ ] `estado` es `activo` si `operaciones30d` es mayor que 0; `inactivo` en caso contrario.
- [ ] `arcaConectado` refleja el certificado de producción.
- [ ] Sin filtros, `total` es la cantidad de cuentas confirmadas.
- [ ] `q` busca parcialmente por razón social o email, sin distinguir mayúsculas ni acentos.
- [ ] `estado=activo|inactivo` filtra por actividad de 30 días; `arca=con|sin` filtra por ARCA; los filtros se combinan con AND.
- [ ] Devuelve 10 cuentas por página con `total`, `pagina` y `porPagina`; una página fuera de rango devuelve lista vacía y el total correcto.
- [ ] Una búsqueda sin resultados devuelve `200` con lista vacía y total 0.
- [ ] `estado`, `arca` o `pagina` inválidos devuelven `400` con el código correspondiente.
- [ ] Las cuentas no confirmadas nunca aparecen, aun buscándolas por nombre o email.
- [ ] El orden es estable: razón social ascendente sin distinguir mayúsculas ni acentos, desempate por email y luego identificador.
- [ ] No existe endpoint de exportación; el front puede recorrer todas las páginas usando `total`.
- [ ] Un `editorial` recibe `403` y sin sesión `401`.

### 14. Coherencia y rendimiento entre las vistas

Asegurar que resumen, embudo, serie y listado describan el mismo universo y que las consultas no hagan N+1.

Criterios de aceptación:
- [ ] `resumen.cuentas` es igual a `embudo.cuentas`, al total del listado sin filtros y al total del último punto de la serie.
- [ ] `resumen.conLibro` es igual a `embudo.conLibro`; `resumen.conVenta` es igual a `embudo.conVenta`.
- [ ] `resumen.activas30d` es igual a la cantidad de cuentas del listado con `estado=activo` sin otros filtros y a la cantidad con `operaciones30d` mayor que 0.
- [ ] `resumen.arcaConectado` es igual a la cantidad de cuentas del listado con `arcaConectado=true`.
- [ ] `resumen.nuevas30d` es igual a la cantidad de cuentas del listado con alta dentro de la ventana.
- [ ] En cada punto de la serie, la suma de etapas es igual al total, y el total no baja de un mes al siguiente.
- [ ] El listado de una página de 10 cuentas resuelve todas sus métricas con un número fijo de consultas, independiente de la cantidad de cuentas y de operaciones.
- [ ] Resumen, embudo y serie no ejecutan una consulta por cuenta.
- [ ] Los filtros de estado y ARCA se resuelven antes de paginar; el total y las páginas son correctos.
- [ ] Ninguna vista carga todo el historial de operaciones en memoria para calcular una página.

### 15. Documentación de la API

Reflejar las rutas nuevas en la documentación generada del backend.

Criterios de aceptación:
- [ ] La documentación regenerada lista `GET /admin/resumen`, `GET /admin/embudo`, `GET /admin/serie` y `GET /admin/cuentas`.
- [ ] La documentación indica que las rutas requieren rol `admin` y que una cuenta `editorial` recibe `403`.
- [ ] La documentación no expone datos internos de las cuentas ni ejemplos con datos reales.
