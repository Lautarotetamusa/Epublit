# UI kit — Epublit (sistema de gestión)

Recreación navegable del sistema web de gestión editorial. Se compone únicamente de
primitivas de `components/` y de los tokens de `styles.css`.

## Pantallas

| Archivo | Pantalla |
| --- | --- |
| `LoginScreen.jsx` | Ingreso — panel de marca verde a la izquierda, formulario a la derecha |
| `AppShell.jsx` | Barra lateral fija (248 px, pino-900) + barra superior + área de contenido |
| `DashboardScreen.jsx` | Inicio — 4 métricas, aviso de stock, últimas liquidaciones, más vendidos |
| `CatalogScreen.jsx` | Catálogo — pestañas, filtros, tabla con selección, modal "Nuevo libro" |
| `BookScreen.jsx` | Ficha del libro — pestañas Ficha / Stock / Movimientos / Ecommerce |
| `SettlementsScreen.jsx` | Liquidaciones — métricas, tabla, estado vacío, modal "Nueva liquidación" |

`data.js` contiene los datos de muestra (libros, liquidaciones, movimientos) y el
formateador de moneda `es-AR`.

## Recorrido interactivo

1. **Entrar** desde el login.
2. **Inicio**: clic en un título de "Más vendidos" abre su ficha.
3. **Libros**: buscar, filtrar por pestaña, seleccionar filas, abrir "Nuevo libro".
4. Clic en una fila abre la **ficha del libro**; las pestañas cambian el contenido.
5. **Liquidaciones**: filtrar por punto de venta (dejalo vacío para ver el estado vacío) y crear una liquidación.

Las secciones no incluidas (Autores, Stock, Puntos de venta, Remitos, Informes,
Configuración) muestran un estado vacío explícito en lugar de pantallas inventadas.

## Nota de procedencia

No se recibió código fuente ni archivo de Figma del producto: el único material
provisto fue el logotipo. Estas pantallas son, por lo tanto, una **propuesta** construida
sobre el brief (blanco + verde oscuro + violeta, formal, referencia al mundo del libro),
no una réplica de una interfaz existente. Ajustar contra el producto real cuando esté disponible.
