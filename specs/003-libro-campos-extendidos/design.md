# Design: Campos extendidos de libro

Estado: aprobado por el usuario

## Historia

Cada libro debe tener, además de lo que ya existe (título, ISBN, fecha de
edición, precio y stock): dimensiones (alto, ancho, largo), brief, cantidad
de páginas, edad recomendada, una imagen de portada y un book trailer
opcional (link de YouTube).

## Qué se construyó

Los campos nuevos se agregaron al formulario compartido de libro
(`LibroFormFields`), así que aparecen tanto en el alta (`NuevoLibroPage`)
como en la ficha (`FichaLibroPage`). El catálogo (`CatalogoPage`) suma una
miniatura de portada como primera columna de la tabla.

Archivos principales:
- `front/src/features/libros/LibroFormFields.tsx` — campos nuevos (dimensiones,
  páginas, edad recomendada, brief, book trailer, portada) y su
  sanitización/validación.
- `front/src/features/libros/FichaLibroPage.tsx` y `NuevoLibroPage.tsx` — cablean
  los valores iniciales, el submit y (para la portada) el flujo de subida en
  dos pasos.
- `front/src/features/libros/useFichaLibro.ts` y `useNuevoLibro.ts` — orquestan
  guardar el libro y, si se eligió un archivo nuevo, subir la portada.
- `front/src/api/libro.ts` — tipos `Libro`/`CreateLibroInput`/`UpdateLibroInput`
  extendidos, y `uploadLibroPortada`.
- `front/src/api/client.ts` — `api.postFile`, nuevo método del cliente para
  multipart/form-data (no existía; el resto del cliente sólo mandaba JSON).
- `front/src/lib/validation.ts` — `isValidYoutubeUrl`.
- `front/src/design-system/components/forms/CoverUpload.jsx` (+ `.d.ts`,
  `.prompt.md`) — componente nuevo del sistema de diseño: selector de imagen
  con preview vertical (120×168, mismo tratamiento que "tapas de libro" en
  `design-system/readme.md`), click o drag&drop, botón "Quitar". Sumado al
  barrel (`design-system/index.ts`).

Rutas para ver la pantalla: `/libros/nuevo` (alta) y `/libros/:isbn` (ficha),
además de `/libros` (catálogo, con la miniatura nueva).

### Decisiones de formato

- **Dimensiones**: tres inputs decimales (alto, ancho, largo) en cm, mismo
  criterio de sanitización que precio (`sanitizeDecimal` de
  `front/src/lib/numericInput.ts`), con sufijo "cm".
- **Brief**: `Textarea` del sistema de diseño, 4 filas, sin límite de
  caracteres impuesto en el front.
- **Cantidad de páginas**: entero (`sanitizeInteger`), sin unidad.
- **Edad recomendada**: se pidió como número entero de años (`sanitizeInteger`),
  input con sufijo "años" y un hint que aclara que se muestra como
  "+10 años" en el resto de la app (ficha, catálogo si corresponde). El "+"
  es sólo de presentación — no se guarda ni se pide en el input.
- **Book trailer**: input de texto tipo URL, opcional. Se valida en el
  cliente con `isValidYoutubeUrl` (acepta `youtube.com/watch?v=`,
  `youtube.com/embed/` y `youtu.be/`); si no matchea, el campo se marca
  inválido con el mensaje "Tiene que ser un link de YouTube válido." No hay
  validación de que el video exista.
- **Portada**: ver "Datos necesarios" abajo — es la parte con más
  decisiones de contrato.

## Datos necesarios

Ningún campo de esta historia existe hoy en el tipo `Libro` del front ni en
la tabla real del backend. Cómo se exponen (rutas, forma del
request/response, mecanismo de storage) lo decide el planner; acá sólo la
capacidad que necesita la pantalla.

### 1. Cargar y mostrar campos simples nuevos por libro

Un libro tiene que poder cargar (al crear o editar) y devolver (en listado
y detalle) estos campos, todos opcionales:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `alto` | decimal, cm | opcional |
| `ancho` | decimal, cm | opcional |
| `largo` | decimal, cm | opcional |
| `brief` | texto largo | opcional, sin límite fijo por el front |
| `paginas` | entero | opcional |
| `edad_recomendada` | entero (años) | opcional; el front sólo manda el número, sin el "+" |
| `book_trailer_url` | texto (URL) | opcional; el front ya valida formato YouTube antes de mandar, pero no hay que confiar sólo en esa validación del cliente |

### 2. Poder asociar una imagen de portada a un libro (la parte ambigua)

- La pantalla necesita que el libro **ya exista** antes de poder asociarle
  la imagen — el flujo de alta es "primero se crea el libro con sus datos,
  después se le agrega la portada", no un único paso atómico. Esto es un
  hecho del flujo de UI, no una preferencia de implementación: el mock del
  front ya está armado así (crea el libro, después manda el archivo aparte).
- Tipo de archivo: el selector del front sólo deja elegir imágenes
  (`image/png`/`image/jpeg`) y muestra como hint al usuario "JPG o PNG,
  vertical. Máximo 5 MB" — pero el front no valida tamaño real antes de
  mandar el archivo, así que esa cota tiene que validarse en algún lado.
- Reemplazo: cargar una imagen nueva sobre un libro que ya tenía portada
  tiene que reemplazarla. El front no ofrece "sacar la portada sin
  reemplazarla" como acción — el botón "Quitar" del formulario sólo
  limpia la selección local antes de guardar, nunca borra una portada ya
  guardada. Si hace falta esa acción como algo separado, es una decisión
  pendiente, fuera del alcance de esta pasada.
- Mientras un libro no tiene portada cargada, el listado/detalle tiene que
  poder representar "sin portada" (el front ya maneja ese estado con un
  placeholder).

El proyecto ya tiene un patrón de subida de archivos (certificados AFIP) y
un mecanismo de servido de archivos estáticos que el planner puede evaluar
si le sirve de referencia — no es una propuesta cerrada de esta pasada.
