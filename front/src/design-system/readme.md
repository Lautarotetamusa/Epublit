# Epublit — sistema de diseño

Epublit es un **sistema de gestión web para editoriales chicas y medianas**: catálogo,
stock por depósito, consignaciones en librerías, remitos, liquidaciones por punto de venta
y regalías de autor. La promesa del producto es simple: cargar una vez cada título y usarlo
en todo el circuito, sin planillas paralelas. En el roadmap está ofrecer, además, un
**ecommerce a medida de cada editorial**, alimentado por el mismo catálogo.

El sistema es de uso diario y administrativo: mucha tabla, mucha cifra, poca decoración.
La estética que buscamos es **simple pero formal**, con una referencia clara al oficio del
libro: papel cálido, tinta oscura, serif editorial para los títulos.

## Fuentes de este sistema de diseño

| Material | Estado |
| --- | --- |
| `uploads/epublit_logo.png` | Provisto. Lockup con isotipo (E-libro) verde y wordmark blanco. Único activo de marca recibido. |
| Brief del cliente | Provisto en el chat: mantener blanco y verde oscuro, agregar violeta; estética simple pero formal, con referencia al negocio del libro. |
| Código del producto | **No provisto.** No hubo repositorio, Figma ni capturas. |
| Tipografías de marca | **No provistas.** Sustituidas por Google Fonts (ver Fundamentos visuales). |

Todo lo que no venía en esos materiales — escalas, componentes, pantallas — es una
**propuesta** construida sobre el brief, no una réplica. Es el punto que más conviene
revisar contra el producto real.

---

## Fundamentos de contenido

Epublit le habla a quien administra una editorial: editores, administrativos, encargados
de depósito. La copia es **castellano rioplatense con voseo**, en segunda persona
("cargá", "revisá", "tu editorial"). El sistema habla de sí mismo en plural discreto
("migramos tu planilla") y sólo cuando hace falta.

- **Registro**: formal pero llano. Se explica lo que pasa, no se celebra.
- **Casing**: sentencia en títulos y botones ("Nuevo libro", "Nueva liquidación"). Nunca
  Title Case. Las micro-etiquetas de sección van en MAYÚSCULAS con tracking amplio
  (`.eyebrow`): CATÁLOGO, COMERCIAL, ANÁLISIS.
- **Vocabulario del oficio, no de software**: título, sello, ISBN, PVP, ejemplar, consignación,
  liquidación, remito, regalía, punto de venta. Nunca "ítem", "SKU", "entidad", "registro fallido".
- **Errores**: qué pasó y qué hacer, en una línea. "Revisá el CUIT y volvé a guardar",
  no "Error 422: validación de CUIT fallida".
- **Estados vacíos**: describen el futuro, no la ausencia. "Todavía no hay liquidaciones.
  Cuando registres ventas en consignación, aparecen acá."
- **Botones**: verbo + objeto ("Guardar libro", "Crear liquidación", "Pedir una demo").
  Nunca "Aceptar" / "OK" sueltos.
- **Números**: formato es-AR — `$ 1.842.500`, `412 ej.`, `37%`, fechas `12/08/2026`.
- **Sin emoji. Sin signos de exclamación.** Sin lenguaje de startup ("potenciá",
  "all-in-one", "revolucioná"). Sin metadiscurso ("acá te explicamos por qué esto importa").

Ejemplos canónicos: `guidelines/voice.html` (así sí / así no).

---

## Fundamentos visuales

### Color
Tres familias y nada más. **Pino** (el verde del logo, `--pino-600 #22605D`) es el color del
producto: navegación, acciones primarias, estados positivos. **Violeta**
(`--violeta-600 #5B4BA8`) es el acento: foco de teclado, informativos, todo lo relacionado
con el ecommerce y con la conversión comercial en el sitio. **Papel** son los neutros
cálidos, desde `--papel-50 #F9F8F4` (fondo de página, muestreado del propio logo) hasta
`--papel-900 #1A1D1C` (tinta).

Máximo dos fondos por pantalla: papel-50 para la página, blanco para las tarjetas. El verde
oscuro aparece a pleno sólo en la barra lateral, el hero del sitio y el pie. Sin gradientes,
en ningún lugar. Los semánticos usan fondo tintado suave + texto fuerte del mismo tono, nunca
color pleno sobre texto blanco salvo en el botón de peligro.

### Tipografía
- **Spectral** (serif) para títulos, cifras destacadas y nombres de registro: es el guiño
  editorial del sistema. Pesos 400/500/600, tracking `-0.02em` en tamaños grandes.
- **Manrope** (sans) para toda la interfaz: etiquetas, celdas, párrafos, botones.
- **JetBrains Mono** para datos: ISBN, cantidades, importes, códigos de liquidación,
  siempre con `tabular-nums` y alineados a la derecha en tablas.
- Escala 1.25 sobre base 15 px. Párrafos con máximo `66ch` y `text-wrap: pretty`.

**Sustitución de tipografías**: no se recibieron archivos de fuente. Spectral, Manrope y
JetBrains Mono se cargan desde Google Fonts (`tokens/fonts.css`) como la aproximación más
cercana a la estética pedida. Si Epublit tiene tipografías propias, hay que reemplazarlas ahí.

### Superficies, bordes y sombra
La metáfora es papel sobre escritorio, no vidrio flotando. Toda superficie elevada lleva
**borde de 1 px** (`--border-subtle`) *y* sombra corta con tinte verde
(`rgba(12,33,32,.06)`): nunca sombra sin borde. Las sombras son cortas y de baja opacidad
(`--shadow-xs` a `--shadow-md`); `--shadow-overlay` sólo para modales y toasts. Los campos
de formulario llevan sombra interior de 1 px (`--shadow-inset`), que desaparece al enfocar.

### Radios
5 px en controles, 8 px en tarjetas y avisos, 12 px en modales, 3 px en badges y checkboxes.
Pill (`999px`) exclusivamente en avatares, switches y puntos de estado. Nada más redondeado
que 16 px.

### Layout
Barra lateral fija de 248 px sobre `--pino-900`, siempre visible en escritorio; barra
superior blanca de 60 px con breadcrumb + título a la izquierda y buscador + acciones a la
derecha. Margen de página 32 px, contenido máximo 1160 px en el sitio público. Alturas de
control 30 / 38 / 46 px. Grillas de métricas de 3 o 4 columnas; tablas a ancho completo
dentro de una tarjeta con `padded={false}`.

### Movimiento
Corto y sin gracia innecesaria: 80 ms para hover de fila, 140 ms para controles, 220 ms para
paneles y modales, con `cubic-bezier(.2,0,.2,1)`. **Sin rebotes, sin escalados, sin
desplazamientos animados.** Lo único que gira es el spinner del botón en estado `loading`.

### Interacción
- **Hover**: un paso más oscuro en superficies sólidas (pino-600 → pino-700); en superficies
  claras, fondo `--papel-100`; en filas de tabla, `--papel-50`. Nunca cambio de opacidad.
- **Press**: dos pasos más oscuro (pino-800). Sin escalado ni desplazamiento.
- **Foco**: borde `--pino-500` + anillo violeta de 3 px (`--ring-focus`). El violeta es la
  señal de "acá está el teclado".
- **Deshabilitado**: fondo `--papel-100`, borde suave, 65% de opacidad, cursor `not-allowed`.
- **Selección de texto**: fondo `--violeta-100`.

### Transparencia y blur
Casi nunca. Sólo el fondo del modal (`rgba(12,33,32,.42)` con `blur(2px)`) y las
transparencias sobre blanco de la barra lateral (`rgba(255,255,255,.10)` para el ítem
activo). Ninguna tarjeta ni panel es semitransparente.

### Imágenes
El sistema no usa fotografía: los datos son el contenido. Las tapas de libro, cuando existan,
son el único material fotográfico previsto — verticales, sobre fondo papel o verde oscuro,
con sombra corta. **No hay imágenes provistas**; en el kit del sitio las tapas están
representadas con el isotipo sobre `--pino-800` y marcadas como marcador de posición.
No se usan ilustraciones, texturas ni patrones repetidos.

---

## Iconografía

- Set único: **Lucide**, trazo 1.5 px, esquinas redondeadas, sin relleno. 48 glifos copiados
  a `assets/icons/` (desde `lucide-icons/lucide@main`), elegidos por el dominio: `book-open`,
  `library`, `boxes`, `package`, `receipt-text`, `truck`, `store`, `barcode`, `banknote`,
  `percent`, `printer`, `building-2`, más los utilitarios de interfaz.
- **Sustitución declarada**: el proyecto no traía set de iconos propio ni icon font. Lucide es
  la elección más cercana al tono formal y liviano del sistema. Si Epublit ya usa otro set
  (Feather, Material Symbols, iconos propios), hay que reemplazar `assets/icons/`.
- Se consumen siempre con el componente `Icon`, que aplica el SVG como máscara CSS para que
  tome `currentColor`. **Nunca** SVG dibujado a mano, ni PNG de icono, ni emoji, ni caracteres
  Unicode como iconos (✓, →, •).
- Tamaños: 14 px en tablas densas, 16–18 px en controles, 17 px en navegación, 20 px en
  estados vacíos. El icono nunca va solo si el control no tiene `label`.
- El isotipo (`assets/mark-epublit.png`) no es un icono: no se mezcla en filas de iconos ni se
  usa como viñeta.

### Faltantes de marca
- Sólo existe el lockup **blanco** (para fondo oscuro). **Falta una versión para fondo claro**
  y un isotipo monocromo en verde: el isotipo actual pierde contraste sobre `--pino-600`.
- No hay favicon, ni versión horizontal reducida, ni reglas de área de protección.
- No se dibujó ningún logotipo nuevo: donde falta una variante, se declara la falta.

---

## Índice

### Raíz
- `styles.css` — punto de entrada único (sólo `@import`). Es lo que enlazan los consumidores.
- `readme.md` — este documento.
- `SKILL.md` — envoltorio para usar este sistema como Agent Skill.
- `thumbnail.html` — mosaico de marca del sistema.

### `tokens/`
`fonts.css` · `colors.css` · `typography.css` · `spacing.css` · `radius.css` ·
`elevation.css` · `motion.css` · `base.css` (reset + `.eyebrow` + `@keyframes`).

### `assets/`
- `logo-epublit-lockup-light.png` — lockup provisto (wordmark blanco).
- `mark-epublit.png` — isotipo recortado del lockup.
- `icons/` — 48 SVG de Lucide.

### `components/`
| Grupo | Componentes |
| --- | --- |
| `core/` | `Icon`, `Button`, `IconButton`, `Badge`, `Card`, `StatCard`, `Avatar` |
| `forms/` | `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch` |
| `data/` | `Table`, `Pagination`, `EmptyState` |
| `feedback/` | `Alert`, `Toast`, `Tooltip`, `Dialog` |
| `navigation/` | `SidebarNav`, `Topbar`, `Tabs`, `Breadcrumb` |

Cada componente tiene `.jsx`, `.d.ts` (contrato de props) y `.prompt.md` (cuándo usarlo).
Cada carpeta tiene una tarjeta `*.card.html` con sus variantes y estados.

**Adiciones intencionales**: como no había inventario de componentes de origen, este es un
conjunto estándar dimensionado al producto. Dos piezas son específicas de Epublit y merecen
mención: `StatCard` (métrica de tablero) y `Table` con columnas `mono` para ISBN e importes.
`Icon` existe para envolver el set de Lucide.

### `ui_kits/`
- `app/` — sistema de gestión: login, inicio, catálogo, ficha del libro, liquidaciones.
  Ver `ui_kits/app/README.md`.
- `site/` — sitio público: home, ecommerce, precios, ayuda, demo. Ver `ui_kits/site/README.md`.

### `guidelines/`
20 tarjetas de especímenes que alimentan la pestaña Design System: escalas de color
(pino, violeta, papel, semánticos, superficies), tipografía (display, body, mono, micro-caps,
escala), espaciado (escala, en uso, alturas de control), radios, elevación, movimiento, y
marca (lockup, isotipo, iconografía, tono de voz).

---

## Qué falta confirmar

1. Tipografías reales de Epublit (hoy: sustitución de Google Fonts).
2. Variante de logo para fondo claro e isotipo monocromo.
3. Nomenclatura real del dominio: ¿"punto de venta" o "librería"? ¿"liquidación" o "rendición"?
4. Estructura real de la navegación del sistema (los 10 ítems de la barra lateral son una hipótesis).
5. Imágenes de tapa y cualquier material fotográfico.
