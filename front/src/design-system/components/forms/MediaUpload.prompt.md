# MediaUpload

Cuándo usarlo: cualquier imagen de contenido horizontal — portada de una
página institucional, imagen de un bloque, ítem de una galería. Es el
equivalente horizontal de `CoverUpload` (vertical) y `PhotoUpload`
(circular): mismo patrón de interacción, marcador 240×135.

- `value` es una URL (objectURL mientras no se guardó, o la URL servida por
  el backend una vez subida). El componente no sube el archivo: entrega el
  `File` crudo en `onSelect` y quien lo integra decide cuándo persistirlo
  (ver "Datos necesarios" en `specs/020-cms-landing/design.md`).
- Acepta click o drag&drop sobre el marcador.
- Sin imagen, el marcador es neutro (papel + ícono `image`). No inventa una
  ilustración ni una foto de muestra: el contenido lo pone la editorial.
- `compact` reduce el marcador a 128×72 para filas de galería.
- `maxSizeMb`/`minWidthPx`/`minHeightPx` no están hardcodeados: los pasa
  quien lo usa. Cuando un archivo no cumple se llama `onRejected(mensaje)`
  en vez de `onSelect`; mostrar ese mensaje es responsabilidad de la
  pantalla.
- El texto alternativo y el epígrafe no viven acá: son campos del formulario
  que rodea a la imagen (la landing los necesita para accesibilidad y
  lectura).
