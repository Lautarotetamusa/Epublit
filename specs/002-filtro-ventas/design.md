# Design: Filtro de ventas

Estado: en revisión

## Historia

Como usuario necesito poder filtrar las ventas por: cliente, tipo de venta,
fecha desde/hasta, medio de pago.

## Qué se construyó

Barra de filtros agregada arriba de la tabla existente en
`front/src/features/ventas/VentasPage.tsx` (misma Card, mismo patrón que ya
usa `CatalogoPage` con su buscador por título: un `div` con padding dentro
del `Card` `padded={false}`, justo antes del `Table`):

- `front/src/features/ventas/VentasFiltros.tsx` — componente de presentación
  puro con los 5 controles, en una grilla de 5 columnas:
  - **Cliente**: `Combobox` (buscable, porque puede haber muchos clientes —
    mismo componente que ya usa `NuevaVentaPage`/`ConsignacionesPage` para
    elegir cliente), con las opciones de `useClientes()` (listado real, ya
    existente).
  - **Tipo de venta**: `Select` con las dos opciones que ya distingue la
    columna "Tipo" de la tabla — "En firme" (`venta`) / "Sobre consignado"
    (`ventaConsignacion`) —, set cerrado de 2 valores.
  - **Medio de pago**: `Select` con las opciones de `getMediosPago()`
    (`front/src/api/operaciones.ts`, ya existente — mismo endpoint que usa
    `NuevaVentaPage`), set cerrado.
  - **Desde / Hasta**: dos `Input type="date"`.
  - Botón "Limpiar filtros" (`variant="ghost"`, ícono `x`) que sólo aparece
    cuando hay algún filtro activo.
- `front/src/features/ventas/useVentasFiltros.ts` — hook con el estado de
  los 5 filtros y la lista ya filtrada (`ventasFiltradas`), separado de
  `useVentas` (que sólo hace fetch) siguiendo el mismo criterio de
  responsabilidad única que el resto del front.
- `VentasPage.tsx` encadena `useVentas` → `useVentasFiltros` →
  `useClientPagination`: pagina (client-side, como ya hacía) sobre el
  resultado ya filtrado, no sobre el listado completo.
- Estado vacío diferenciado: si hay filtros activos y no matchea ninguna
  fila, la tabla muestra "Ninguna venta coincide con los filtros" (ícono
  `search`) en vez del "Todavía no hay ventas" original, que queda reservado
  para cuando el usuario no tiene ninguna venta cargada.

Ningún dato es inventado/mockeado: cliente sale de `useClientes()` (ya
pega contra `GET /cliente`) y medio de pago de `getMediosPago()` (ya pega
contra `GET /venta/medios_pago`) — ambos hooks/llamadas ya existían y se
reutilizan tal cual. El filtrado en sí (cliente, tipo, medio de pago, rango
de fechas) se resuelve enteramente en el cliente, sobre el array que ya
devuelve `listVentas()` (`GET /venta`, sin query params hoy).

Rutas/archivos tocados:
- `front/src/features/ventas/VentasPage.tsx` (modificado)
- `front/src/features/ventas/VentasFiltros.tsx` (nuevo)
- `front/src/features/ventas/useVentasFiltros.ts` (nuevo)

Se puede ver corriendo en `/ventas` (`npm run dev` en `/front`).

## Datos necesarios

No hace falta ningún dato de muestra nuevo: las opciones de cliente y medio
de pago salen de endpoints reales ya existentes. Lo que sí necesita esta
pantalla del backend:

1. **Poder filtrar el listado de ventas por cliente, tipo de venta, medio de
   pago y rango de fechas** (lectura — no persiste nada), combinables entre
   sí, todos opcionales.

Esta pasada del mock filtra en el cliente sobre el listado completo que ya
trae `GET /venta` hoy (mismo supuesto de partida que ya usa
`useClientPagination` en esta pantalla) — es sólo cómo se armó el mock para
poder mostrar la pantalla funcionando, no una propuesta de diseño de API:
cómo se termina resolviendo esto (query params, paginado server-side, etc.)
lo define el planner.

## Aprobación pendiente

Falta la revisión explícita del usuario sobre esta pantalla antes de pasar
a `planner`.
