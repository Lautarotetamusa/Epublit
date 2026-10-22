# CoverUpload

Cuándo usarlo: alta o edición de un libro, para cargar la imagen de portada.
Es el único control de subida de archivo con preview del sistema — no
reimplementar un `<input type="file">` suelto en una feature.

- `value` es una URL (objectURL mientras no se guardó, o la URL servida por
  el backend una vez subida). El componente no sube el archivo: sólo
  entrega el `File` crudo en `onSelect`; quien lo use decide cuándo
  llamar al endpoint de subida (ver "Datos necesarios" en
  `specs/003-libro-campos-extendidos/design.md`).
- Acepta click o drag&drop sobre el marcador vertical (120×168, misma
  proporción que una tapa de libro).
- `onRemove` sólo aparece si hay `value`; usarlo para limpiar el campo antes
  de guardar (no borra nada en el backend por sí solo).
