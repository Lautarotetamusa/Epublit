# Design: CMS de contenido de la landing (Fase 1)

Estado: aprobado por el usuario

Agent: ses_e3e553e04ffed96YA7buhoQTf5

> Diseño aprobado por el usuario. Habilita el paso al `planner` para el plan
> de backend de la Fase 1.

## Historia

Como editora y dueña de Libros Silvestres quiero administrar desde Epublit el contenido de las páginas institucionales de la landing (Editorial, Rizoma, Responsabilidad, Premios, En el mundo), creando y editando páginas con bloques de texto, imágenes, galerías, citas, datos y enlaces, pudiendo guardar borradores, previsualizar y publicar sin depender de un desarrollador.

## Qué se construyó

### Flujo y rutas

- `/contenido` — listado de páginas institucionales. Filtro Todas / Publicadas / Borradores con conteos, búsqueda por título o slug, estado, visibilidad y orden en el menú, cantidad de bloques, última edición y acciones de previsualizar/editar. En teléfono la tabla se convierte en un listado de filas de dos niveles.
- `/contenido/nueva` y `/contenido/:id` — mismo editor en flujo vertical: lista de requisitos arriba, Datos de la página (título, slug, descripción, visibilidad y orden), Portada y Bloques. Sin columna lateral.
- `Previsualización` — diálogo con la página armada como en la landing, selector Escritorio/Móvil (en teléfono se fuerza la vista móvil) y menú del sitio. Usa los cambios sin guardar y aclara que la landing se conecta en la próxima fase.
- Se agregó la sección **Sitio web → Contenido** en la navegación del panel (`file-text`).

### Editor de bloques

- Siete tipos de Fase 1: Hero, Texto, Imagen y texto, Galería, Cita, Datos y Enlaces.
- Paleta de bloques siempre visible al final del editor, con una línea que explica cada tipo.
- Edición en línea dentro de cada bloque (sin modal por bloque), con encabezado colapsable, resumen del contenido, arrastre y botones Subir/Bajar para teclado.
- Eliminación con confirmación del sistema (`ConfirmProvider`).
- Texto enriquecido “simple”: no es un WYSIWYG ni HTML libre. Se guarda una convención mínima (párrafos, `**negrita**`, `*cursiva*`, listas con `- ` y `[texto](/destino)`) que la previsualización renderiza y que la landing puede interpretar sin aceptar HTML arbitrario.

### Imágenes

- Nuevo componente de sistema `MediaUpload` (horizontal, 240×135; variante `compact` 128×72) para portada, hero, imagen + texto y galería. Sigue el patrón de `CoverUpload`/`PhotoUpload`: entrega el `File` crudo, previsualiza con objectURL y no inventa fotografía cuando no hay imagen.
- Cada imagen pide texto alternativo (obligatorio para publicar) y epígrafe (opcional).
- La portada vive en una tarjeta de ancho completo debajo de Datos: la imagen y sus controles arriba, y el texto alternativo y el epígrafe debajo, a ancho completo, sin comprimirse al costado.
- Validación visual: formatos JPG/PNG/WebP, máximo 8 MB, resolución mínima 1200×600 para portada/hero y 800×450 para imágenes de bloque/galería. El rechazo se muestra con toast.
- La previsualización muestra la imagen real si existe; si no, un marcador neutro “Sin imagen”.

### Publicación

- Borrador y publicada son estados explícitos. En una página publicada, “Guardar cambios” conserva el estado; “Despublicar” es una acción aparte y confirmada.
- El estado y la última edición no tienen un recuadro propio: viven en el encabezado del editor. Los requisitos, en una lista vertical compacta arriba; la visibilidad y el orden, dentro de Datos de la página.
- “Publicar” sólo se habilita si se cumplen los requisitos, visibles en la lista vertical de arriba: título, slug válido y disponible, descripción para buscadores, al menos un bloque y todas las imágenes con alt. La lista explica qué falta y cuántos requisitos quedan.
- Indicador “Cambios sin guardar” y confirmación al salir con cambios sin guardar.
- La lista y el encabezado del editor muestran la última edición con fecha/hora local.

### Responsive y accesibilidad

- El editor es una columna vertical de ancho completo con el orden Requisitos → Datos → Portada → Bloques. Los requisitos se leen en una lista vertical de una sola columna; los campos usan `flex-wrap` y grillas `auto-fit`, así que se reacomodan en pantallas chicas sin cambiar el orden de lectura.
- Se hizo responsivo el shell del panel: debajo de 900 px la barra lateral fija se reemplaza por una barra superior con botón de menú y un panel de navegación (cierre por fondo, por botón y al elegir una sección). En escritorio no cambia nada.
- Foco de teclado visible (anillo del sistema), labels de formulario asociados al control (id compartido) y `aria-required` en los obligatorios, texto alternativo obligatorio en imágenes y botones explícitos para reordenar sin depender del arrastre.
- El contador de requisitos usa `role="status"`, así el cambio de “faltan” a “todo listo” se anuncia sin mover el foco.

### Craft, estados y detalles de browser (pasada de polish)

- Los controles segmentados de “Posición de la imagen” y “Columnas” dejaron de ocupar todo el ancho: se limitan a 360 y 260 px para que se lean como toggles.
- Los textos de ayuda y epígrafes pasaron a `--text-muted` (contraste legible a 11–13 px); los requisitos pendientes usan texto de cuerpo y el ícono de alerta para no depender sólo del color.
- El estado `loading` de un botón conserva el color de la acción y muestra el spinner sobre esa superficie; el estado deshabilitado usa texto muted para que la etiqueta siga siendo legible.
- La barra de scroll del documento y el caret de los campos usan la paleta (papel/pino). La selección y el foco ya venían del sistema.
- No cambió el flujo, el orden de las secciones, las acciones del encabezado ni el copy factual.

### Archivos principales

- `front/src/features/contenido/` — tipos, mock en memoria, hooks, listado, editor, bloques, previsualización y render de la página.
- `front/src/design-system/components/forms/MediaUpload.{jsx,d.ts,prompt.md}` y export en el barrel.
- `front/src/design-system/assets/icons/` — glifos Lucide faltantes (`arrow-up`, `arrow-down`, `grip-vertical`, `image`, `quote`, `layout-template`, `link`, `type`, `columns-2`, `save`, `bold`, `italic`, `list`).
- Ajustes reutilizables del sistema: asociación label-control (`fieldContext`), `aria-required` en obligatorios, estado loading/disabled de `Button`, contraste de hints en `Field` y `MediaUpload`, y scrollbar/caret en `tokens/base.css`.
- `front/src/lib/useMediaQuery.ts`, `front/src/layout/AppLayout.tsx`, `front/src/App.tsx`.

### Datos de muestra

- El mock vive en memoria (`mockContenido.ts`), **se reinicia al recargar** y no llama al backend.
- Cinco páginas de ejemplo: Editorial, Rizoma y Premios publicadas; Responsabilidad y En el mundo en borrador (Responsabilidad incluye una imagen sin alt a propósito para mostrar el bloqueo de publicación).
- Las imágenes de muestra están en `front/public/contenido/` (placas tipográficas generadas para el mock, no fotografía real). Se reemplazan cuando la editora suba las suyas.
- Los textos, cifras, autores y premios son sintéticos y no son afirmaciones de la editorial.

## Cómo verlo

El front ya está corriendo en `http://localhost:5174` y el back en `http://localhost:3001`; no hace falta levantar nada.

1. Entrar con la sesión existente del panel y abrir `http://localhost:5174/contenido`.
2. Abrir “Editorial”: el encabezado muestra estado y última edición; arriba de todo está la lista vertical de requisitos. En Datos están título, slug, descripción, visibilidad y orden; debajo siguen Portada y Bloques. “Previsualizar” abre el diálogo.
3. Editar, agregar un bloque desde la paleta, reordenar con flechas o arrastre, y guardar/publicar.
4. Abrir “Responsabilidad” para ver los requisitos de publicación incompletos por el alt faltante.
5. Reducir a ~390 px para ver el listado móvil y el panel de navegación.

## Decisiones de UX

- **Listado + editor, sin asistentes por pasos.** La editora trabaja sobre una página completa; el estado y los requisitos viven arriba, no en un wizard.
- **Todo el contexto arriba, sin panel lateral.** Estado y última edición en el encabezado; requisitos en una lista vertical compacta de ancho completo; visibilidad y orden dentro de Datos; acciones (Previsualizar, Guardar, Publicar/Despublicar) en el encabezado. Debajo, el contenido sigue el orden de lectura: Requisitos → Datos → Portada → Bloques.
- **Publicar es un acto explícito con checklist.** El botón deshabilitado nunca es la única explicación: la lista de requisitos muestra cada punto en su propia fila, cuántos faltan y qué se habilita al completarlos.
- **Previsualización con cambios sin guardar.** Permite revisar antes de persistir; el pie aclara qué ve la landing y qué no.
- **El menú de la previsualización sale de las páginas publicadas visibles**, más la página actual. Así “visible en menú” y “orden” tienen consecuencia visible.
- **Edición en línea de bloques** para evitar el ida y vuelta de modales; el encabezado colapsable mantiene navegable una página larga.
- **Una sola versión de contenido por página.** En una página publicada, “Guardar cambios” actualiza lo que ve la landing; para preparar cambios sin que salgan, la editora despublica primero. No hay versiones separadas borrador/publicado con historial: es una decisión de alcance de Fase 1, no un detalle técnico.
- **Sin lenguaje visual nuevo.** Se heredan tokens, tipografía, radios, sombras, tono y componentes de `front/src/design-system/`. Las placas de muestra usan Spectral y la paleta pino/papel.
- **La conexión con la landing queda fuera de Fase 1.** El botón “Abrir en la landing” está deshabilitado y explicado; no se inventó una URL pública.

## Datos necesarios

> Capacidades, no endpoints ni decisiones de almacenamiento. La forma de exponerlas la define el `planner`.

### Páginas institucionales

- Poder listar las páginas de la editorial con: título, slug, descripción, estado (borrador/publicada), visible en menú, orden, cantidad de bloques y fecha/hora de última edición.
- Poder leer una página completa con todos sus bloques en el orden guardado.
- Poder crear y actualizar una página con título, slug, descripción, portada, visible en menú, orden y estado.
- Poder cambiar el estado entre borrador y publicada sin perder el contenido ni los bloques.
- Poder detectar que un slug ya está en uso por otra página de la misma editorial y devolver un error de validación claro (“Ya hay otra página con este slug”).
- Poder registrar la fecha/hora de la última edición al guardar (y, si el modelo lo permite, qué usuaria la hizo).

### Publicación y consumo de la landing

- Poder guardar un borrador completo aunque falten datos de publicación.
- Poder publicar sólo cuando se cumplan los mismos requisitos que valida el panel: título, slug válido y único, descripción para buscadores, al menos un bloque y todas las imágenes con texto alternativo. Si falta algo, el backend debe devolver qué requisito falla.
- Poder despublicar conservando todo el contenido como borrador.
- Poder entregar a la landing únicamente páginas publicadas, con sus metadatos, portada y bloques ordenados, para que el sitio Astro las renderice por slug.
- Poder entregar el menú del sitio: páginas publicadas marcadas como visibles, ordenadas por el orden definido, con título y slug.
- Poder conocer la URL pública de una página publicada (para habilitar “Abrir en la landing”).
- Los borradores no deben ser accesibles públicamente.

### Bloques

- Poder guardar una secuencia ordenada de bloques por página; cada bloque necesita un identificador estable, un tipo y su contenido propio.
- Poder agregar, editar, reordenar y eliminar bloques; el orden guardado es el que consume la landing.
- Poder guardar y devolver estos campos por tipo:
  - **Hero**: título, bajada e imagen (referencia, texto alternativo, epígrafe).
  - **Texto**: título opcional y contenido con formato simple (negrita, cursiva, listas y enlaces), sin HTML libre.
  - **Imagen y texto**: título opcional, texto, imagen (referencia, alt, epígrafe) y posición de la imagen (izquierda/derecha).
  - **Galería**: título opcional, lista ordenada de imágenes (cada una con referencia, alt y epígrafe) y cantidad de columnas (2 o 3).
  - **Cita**: texto, autor/a y fuente o rol.
  - **Datos**: título opcional y lista ordenada de pares valor/etiqueta (el panel admite entre 1 y 4).
  - **Enlaces**: título opcional y lista ordenada de enlaces con nombre, destino y descripción opcional.
- Poder validar que el contenido de cada bloque corresponda a su tipo (por ejemplo, una galería no debería aceptar una imagen suelta).

### Imágenes

- Poder subir una imagen desde el panel y obtener una referencia estable que la landing pueda mostrar.
- Poder reemplazar o quitar una imagen de una página o bloque sin romper el contenido que la rodea.
- Poder guardar por imagen el texto alternativo (obligatorio para publicar) y el epígrafe (opcional).
- Poder validar formato (JPG/PNG/WebP), peso máximo (8 MB) y resolución mínima (1200×600 para portada/hero; 800×450 para imágenes de bloque y galería). El panel ya lo valida antes de subir; el backend no debería aceptar algo que después rompa la landing.
- Poder servir las imágenes con una URL estable y apta para la landing (el mecanismo de almacenamiento lo decide el `planner`).

### Fuera de alcance de esta fase

- No se diseñó ni se nombró ninguna ruta, método HTTP, parámetro de consulta, forma de request/response ni mecanismo de storage.
- No hay publicación real en el sitio Astro todavía: la previsualización y el botón “Abrir en la landing” quedan preparados para la fase siguiente.
- No hay historial de versiones, permisos por rol ni flujo de aprobación editorial en Fase 1.
