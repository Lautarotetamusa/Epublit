# PhotoUpload

Cuándo usarlo: ficha de una persona (autor/ilustrador), para cargar su foto.
Es el equivalente circular de `CoverUpload` — mismo patrón de interacción,
distinto marcador (96×96, `radius-pill`) porque una foto de persona es
cuadrada/circular, no vertical como una tapa de libro.

- `value` es una URL (objectURL mientras no se guardó, o la URL servida por
  el backend una vez subida). El componente no sube el archivo: sólo
  entrega el `File` crudo en `onSelect`; quien lo use decide cuándo
  llamar al endpoint de subida (ver "Datos necesarios" en
  `specs/004-persona-foto-bio/design.md`).
- Acepta click o drag&drop sobre el marcador circular.
- Sin foto, el marcador usa un ícono `user-round` sobre `pino-100` en vez de
  las iniciales de `Avatar` — acá no siempre hay contexto de nombre a mano
  donde se usa este control.
- `onRemove` sólo aparece si hay `value`; usarlo para limpiar el campo antes
  de guardar (no borra nada en el backend por sí solo).
- Si `value` apunta a una URL rota (ej. un objectURL vencido), el marcador
  cae solo al ícono en vez de mostrar el `alt` desbordando el círculo.
- No exige que la imagen sea cuadrada ni ofrece recorte manual: usa
  `object-fit: cover` para centrar y recortar cualquier proporción dentro
  del círculo, mismo criterio que `CoverUpload` con la portada (ver
  "Decisiones de formato" en `specs/004-persona-foto-bio/design.md`).
- `maxSizeMb`/`minWidthPx`/`minHeightPx` no están hardcodeados en el
  componente: se los pasa quien lo use, leyéndolos de donde se
  configuren (hoy, Perfil → "Restricciones de fotos", ver "Datos
  necesarios" en `specs/004-persona-foto-bio/design.md`). Sin esas props
  el componente no rechaza nada. Cuando un archivo no cumple, se llama a
  `onRejected(mensaje)` en vez de `onSelect` — mostrar ese mensaje
  (toast, `Field` con `error`, lo que use la pantalla) es responsabilidad
  de quien integra el componente, no de `PhotoUpload`.
