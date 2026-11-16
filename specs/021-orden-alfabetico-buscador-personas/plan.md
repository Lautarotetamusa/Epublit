# Plan: orden alfabético en listados y buscador de personas en el libro

## Historia

Como admin:

1. Quiero ver **en orden alfabético** las opciones de todos los selectores y los
   listados de colecciones y personas.
2. Quiero **buscar por nombre** a la persona que agrego a un libro, en vez de
   recorrer un desplegable largo.

## 1. Orden alfabético

Decisión: el orden lo da el backend (un solo lugar, sirve igual para la tabla
y para el selector). La comparación no distingue mayúsculas ni acentos: «Álvarez»
va con las A y «de la Fuente» con las D.

- Helper compartido `ordenAlfabetico(columna)` en `back/src/lib/sql/search.ts`
  (`lower(unaccent(columna))`, misma extensión que ya usa `ilikeSinAcentos`).
- Se ordena con ese helper:

| Listado | Columna |
|---|---|
| `GET /persona` (con y sin `rol`) | `nombre` |
| `GET /coleccion` | `titulo` |
| `GET /libro` y `GET /libro/lista_libros` | `titulo` (ya ordenaba, ahora sin acentos) |
| `GET /cliente` | `nombre` (ya ordenaba, ahora sin acentos) |
| `GET /rol` | `nombre` |
| `GET /medio-pago` | `nombre` |
| Depósitos propios | el principal primero, después por `nombre` |

- Las listas fijas del front (condición fiscal, motivos, rangos de fecha, tipo de
  edición) **no** se reordenan: su orden tiene sentido propio.
- Quedan fuera los listados que tienen otro orden a propósito: movimientos, ventas,
  liquidaciones y pedidos van del más nuevo al más viejo.

Criterios de aceptación:

- [x] `GET /persona` devuelve «Ana», «Álvaro», «beatriz», «Carlos» en ese orden.
- [x] `GET /persona?rol=N` también sale ordenado, sin repetir personas y con la
      paginación correcta.
- [x] `GET /coleccion` sale ordenado por título.
- [ ] Los selectores de rol y de medio de pago muestran las opciones en orden
      alfabético.

## 2. Buscador en el selector de persona del libro

- En el diálogo «Persona existente» de la ficha del libro (y del alta), el
  `Select` de persona pasa a ser un `Combobox` del sistema de diseño: se puede
  escribir para filtrar y sigue mostrando sólo las personas que todavía no tienen
  ese rol en el libro.
- Sin cambios en el backend: el picker ya trae todas las personas.

Criterios de aceptación:

- [ ] Escribir «per» filtra a «Pérez» (sin distinguir acentos ni mayúsculas).
- [ ] Sin coincidencias se muestra «Ninguna persona coincide».
- [ ] Si no queda nadie con ese rol, el combobox avisa que no hay personas.

Estado (2026-11-16): back cubierto por `test/persona.test.ts` y `test/coleccion.test.ts`. Los criterios sin marcar son de UI y quedan para verificar en el navegador.
