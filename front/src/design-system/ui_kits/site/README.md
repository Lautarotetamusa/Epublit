# UI kit — sitio público de Epublit

Sitio de marketing navegable, construido con las mismas primitivas que el sistema.

| Archivo | Contenido |
| --- | --- |
| `SiteHeader.jsx` | Barra fija verde pino-900 con navegación y CTA violeta |
| `HomeSections.jsx` | `Hero` (con `AppPreview`, una miniatura real del sistema), `Features`, `Ecommerce` |
| `PricingSections.jsx` | `Pricing`, `DemoForm`, `Help` (FAQ), `SiteFooter` |

Navegación: Producto (home completa) · Ecommerce · Precios · Ayuda · Pedir una demo
(el formulario muestra la confirmación al enviarlo).

## Decisiones y faltantes

- El violeta funciona como color de acción comercial del sitio (CTA, bloque de ecommerce);
  el verde sigue siendo el color del producto.
- **No hay fotografía ni tapas reales**: las tarjetas de la tienda usan el isotipo sobre
  verde como marcador de posición. Reemplazar por imágenes de tapa cuando estén disponibles.
- Precios y textos de planes son de muestra, no comerciales.
