# Plan: Colecciones (crear, editar, borrar y asignar libros)

## Historia

Crear, actualizar y eliminar colecciones, cada una con portada opcional, título,
descripción y muchos libros. Un libro pertenece a lo sumo a una colección (o a
ninguna), su colección se puede cambiar en cualquier momento, y una colección
con libros no se puede eliminar.

## Diseño de API

### Representación de una colección

`{ "id": <entero>, "titulo": <string>, "descripcion": <string|null>,
"portada_url": <string|null>, "cantidad_libros": <entero> }`

- `portada_url` sigue el mismo patrón que la portada de libro: `null` mientras
  no hay portada, o una URL usable directamente en un `<img>` una vez cargada.
- `cantidad_libros` cuenta sólo los libros vigentes de la colección (no los
  libros borrados del catálogo).
- Todo acotado al usuario autenticado: una colección de otro usuario se trata
  igual que una inexistente (404).

### Endpoints de colección

| Método y ruta | Request | Respuesta |
| --- | --- | --- |
| `POST /coleccion/` | `{ titulo, descripcion? }` | 201 con la colección. 400 si falta `titulo` o viene vacío. |
| `GET /coleccion/` | — | 200 con la lista de todas las colecciones del usuario. |
| `GET /coleccion/:id` | — | 200 con la colección. 404 si no existe o es de otro usuario. |
| `PUT /coleccion/:id` | `{ titulo, descripcion? }` | 200 con la colección actualizada. 400 si falta `titulo`. 404. |
| `DELETE /coleccion/:id` | — | 204 si se borró. 409 con un mensaje de motivo si todavía tiene libros. 404. |
| `GET /coleccion/:id/libros` | query de paginación | 200 paginado con los libros de esa colección. 404. |

### Portada de colección

`POST /coleccion/:id/portada` — multipart/form-data, un único archivo.

- 200 con la colección actualizada (incluye `portada_url`) si se subió o
  reemplazó correctamente.
- 404 si el `id` no existe o es de otro usuario.
- 400 si no viene ningún archivo.
- 415 si el archivo no es `image/jpeg` ni `image/png`.
- 413 si el archivo pesa más de 5 MB.
- Una imagen nueva reemplaza la anterior: la URL anterior deja de resolver.

`DELETE /coleccion/:id/portada`

- 200 con la colección actualizada (`portada_url` en `null`). Idempotente: si ya
  no tenía portada, también 200.
- 404 si el `id` no existe o es de otro usuario.

### Pertenencia libro → colección

`POST /libro/` y `PUT /libro/:isbn` aceptan un campo adicional `coleccion_id`:

- `coleccion_id` con el identificador de una colección del usuario → el libro
  queda en esa colección, reemplazando la que tuviera (nunca acumula).
- `coleccion_id: null` → el libro queda sin colección.
- En `PUT /libro/:isbn`, `coleccion_id` omitido → la colección actual no cambia.
- `coleccion_id` inexistente o de otro usuario → 404 y el libro no se modifica.

Los endpoints que ya devuelven datos de un libro (`GET /libro`,
`GET /libro/:isbn`, `GET /libro/lista_libros`, `POST /libro/`,
`PUT /libro/:isbn`) suman `coleccion_id` y `coleccion_titulo`, ambos `null`
cuando el libro no pertenece a ninguna colección.

### Listar los libros de una colección

`GET /coleccion/:id/libros` usa las mismas convenciones de paginación que ya
tiene `GET /libro` (`page`, `pageSize` y el total informado). Cada libro de la
respuesta incluye al menos `isbn`, `titulo`, `precio` y `portada_url`. La lista
está acotada a esa colección y el total informado cuenta sólo esos libros.

### Buscar en el catálogo excluyendo los ya asignados

`GET /libro` suma el filtro booleano `sin_coleccion`. Con `sin_coleccion=true`
devuelve únicamente libros que no pertenecen a ninguna colección del usuario, y
el total de la paginación cuenta sólo esos libros (no el catálogo entero). Se
combina con los filtros existentes `titulo` (parcial) e `isbn` (igualdad) y con
la paginación. Sin `sin_coleccion`, `GET /libro` se comporta como hoy.

## Decisiones

Ninguna ambigüedad pendiente. Quedaron cerradas estas decisiones, ya reflejadas
en las tareas:

- **Código del rechazo de borrado**: 409 con un mensaje de motivo, distinguible
  de un 404.
- **Límites de la portada**: los mismos de la portada de libro (JPG/PNG, hasta
  5 MB, fijos), no configurables como la foto de persona.
- **`coleccion_id` omitido en `PUT /libro/:isbn`**: no cambia la colección
  actual; `null` la quita.
- **Datos de muestra**: las 3 colecciones del `design.md` (#10) quedan
  persistidas en la base al terminar la implementación (ver tarea 14).

## Tareas

### 1. Persistir colecciones y la pertenencia de libros
El sistema tiene que poder guardar colecciones (título obligatorio, descripción
y portada opcionales) y registrar a lo sumo una colección por libro, sin afectar
los datos existentes.

Criterios de aceptación:
- [ ] Una colección guardada con título y descripción se recupera íntegra; sin descripción, la descripción queda nula.
- [ ] Sin portada cargada, la portada de una colección es nula.
- [ ] Reasignar un libro de una colección a otra deja únicamente la última (no acumula dos).
- [ ] Un libro existente antes de este cambio sigue siendo legible y queda sin colección.
- [ ] Las colecciones y las pertenencias de un usuario no son accesibles ni modificables desde otro usuario.

### 2. Crear una colección
`POST /coleccion/` da de alta una colección del usuario con título obligatorio y
descripción opcional.

Criterios de aceptación:
- [ ] `POST /coleccion/` con `titulo` y `descripcion` devuelve 201 con `id`, `titulo`, `descripcion`, `portada_url` en `null` y `cantidad_libros` en 0.
- [ ] `POST /coleccion/` con `descripcion` ausente o `null` devuelve 201 con `descripcion` en `null`.
- [ ] `POST /coleccion/` sin `titulo` o con `titulo` vacío devuelve 400 y no crea ninguna colección.
- [ ] La colección creada aparece en el listado del usuario que la creó y no en el de otro usuario.

### 3. Listar colecciones con su cantidad de libros
`GET /coleccion/` devuelve todas las colecciones del usuario con los datos que
necesita el listado y el selector de la ficha de libro.

Criterios de aceptación:
- [ ] `GET /coleccion/` devuelve 200 con todas y sólo las colecciones del usuario autenticado.
- [ ] Cada colección incluye `id`, `titulo`, `descripcion`, `portada_url` y `cantidad_libros`.
- [ ] Una colección recién creada informa `cantidad_libros` en 0.
- [ ] Asignar o quitarle libros a una colección se refleja en su `cantidad_libros`.
- [ ] Un libro borrado del catálogo deja de contarse en la `cantidad_libros` de su colección.

### 4. Ver una colección
`GET /coleccion/:id` devuelve una colección puntual por su identificador.

Criterios de aceptación:
- [ ] `GET /coleccion/:id` de una colección del usuario devuelve 200 con los mismos campos que el listado.
- [ ] Con portada cargada devuelve `portada_url` no nula; sin portada, `null`.
- [ ] `GET /coleccion/:id` con un id inexistente o de otro usuario devuelve 404.

### 5. Actualizar una colección
`PUT /coleccion/:id` actualiza título y descripción, incluyendo poder pisar
valores previos.

Criterios de aceptación:
- [ ] `PUT /coleccion/:id` con título y descripción nuevos devuelve 200 con los valores actualizados.
- [ ] `PUT /coleccion/:id` puede dejar la descripción en `null`.
- [ ] `PUT /coleccion/:id` sin `titulo` o con `titulo` vacío devuelve 400 y no modifica la colección.
- [ ] `PUT /coleccion/:id` con un id inexistente o de otro usuario devuelve 404.
- [ ] Actualizar una colección no cambia sus libros ni su `cantidad_libros`.

### 6. Eliminar una colección sólo si no tiene libros
`DELETE /coleccion/:id` borra una colección vacía y rechaza en el servidor el
borrado de una colección que todavía tiene libros.

Criterios de aceptación:
- [ ] `DELETE /coleccion/:id` de una colección sin libros devuelve 204; deja de aparecer en `GET /coleccion/` y `GET /coleccion/:id` devuelve 404.
- [ ] `DELETE /coleccion/:id` de una colección con al menos un libro devuelve 409 con un mensaje de motivo, y la colección sigue existiendo con sus libros intactos.
- [ ] El rechazo es del servidor: una llamada directa al endpoint (sin pasar por el front) sobre una colección con libros devuelve 409.
- [ ] `DELETE /coleccion/:id` con un id inexistente o de otro usuario devuelve 404.
- [ ] Tras borrar una colección vacía, ningún libro queda con una referencia colgante: los que no tenían colección siguen sin colección.

### 7. Subir o reemplazar la portada de una colección
`POST /coleccion/:id/portada` asocia una imagen a una colección existente,
reemplazando la anterior si existía.

Criterios de aceptación:
- [ ] Subir una imagen JPG o PNG válida a una colección sin portada devuelve 200 con `portada_url` no nula.
- [ ] Subir una segunda imagen a la misma colección reemplaza la portada: `portada_url` cambia y la imagen anterior deja de estar disponible.
- [ ] Subir un archivo de tipo distinto a JPG/PNG (ej. PDF, GIF) devuelve 415 y no modifica la colección.
- [ ] Subir un archivo de más de 5 MB devuelve 413 y no modifica la colección.
- [ ] Llamar al endpoint sin adjuntar archivo devuelve 400 y no modifica la colección.
- [ ] Subir una portada a un id inexistente o de otro usuario devuelve 404.

### 8. Quitar la portada de una colección
`DELETE /coleccion/:id/portada` desasocia la portada actual.

Criterios de aceptación:
- [ ] Quitar la portada de una colección que tenía una devuelve 200 con `portada_url` en `null`, y la URL anterior deja de estar disponible.
- [ ] Quitar la portada de una colección sin portada devuelve 200 con `portada_url` en `null` (no falla).
- [ ] `DELETE /coleccion/:id/portada` con un id inexistente o de otro usuario devuelve 404.

### 9. Servir la portada cargada
La `portada_url` devuelta por la API tiene que resolver efectivamente a la
imagen cargada, sin exigir más autenticación que la que ya usan los otros
archivos servidos por la app.

Criterios de aceptación:
- [ ] Un `GET` a la `portada_url` devuelta tras subir una portada devuelve la imagen (200, contenido de imagen).
- [ ] Tras reemplazar o quitar la portada, un `GET` a la `portada_url` anterior ya no devuelve la imagen vieja.

### 10. Asignar, cambiar o quitar la colección de un libro
`POST /libro/` y `PUT /libro/:isbn` aceptan `coleccion_id` y aplican la regla de
a lo sumo una colección por libro.

Criterios de aceptación:
- [ ] `POST /libro/` con `coleccion_id` de una colección válida del usuario deja al libro en esa colección y lo devuelve así en la respuesta.
- [ ] `PUT /libro/:isbn` con `coleccion_id` de otra colección reemplaza la anterior: el libro queda en una sola colección, nunca en dos.
- [ ] `PUT /libro/:isbn` con `coleccion_id: null` deja el libro sin colección.
- [ ] `PUT /libro/:isbn` sin `coleccion_id` no cambia la colección que el libro ya tenía.
- [ ] `PUT /libro/:isbn` con un `coleccion_id` inexistente o de otro usuario devuelve 404 y no modifica el libro.
- [ ] Un libro se puede mover de la colección A a la B y de vuelta a A en cualquier momento, sin errores ni acumulación.

### 11. Devolver la colección actual del libro al leerlo
Las respuestas de libro incluyen la colección a la que pertenece (o su ausencia),
para que la ficha de libro sepa qué mostrar en el selector.

Criterios de aceptación:
- [ ] `GET /libro/:isbn` de un libro con colección devuelve `coleccion_id` y `coleccion_titulo` con los valores reales.
- [ ] `GET /libro/:isbn` de un libro sin colección devuelve ambos campos en `null`.
- [ ] `GET /libro` y `GET /libro/lista_libros` incluyen `coleccion_id` y `coleccion_titulo` por cada libro.
- [ ] Tras cambiar o quitar la colección de un libro, la lectura inmediata del libro refleja el nuevo estado.

### 12. Listar los libros de una colección, acotado a ella
`GET /coleccion/:id/libros` devuelve los libros de una colección sin depender del
catálogo completo.

Criterios de aceptación:
- [ ] Devuelve sólo los libros que pertenecen a esa colección, cada uno con `isbn`, `titulo`, `precio` y `portada_url`.
- [ ] Un libro de otra colección o sin colección no aparece en la respuesta.
- [ ] La respuesta está paginada con las mismas convenciones que `GET /libro`, y el total informado cuenta sólo los libros de esa colección.
- [ ] `GET /coleccion/:id/libros` con una colección inexistente o de otro usuario devuelve 404.
- [ ] Mover un libro a otra colección lo saca del listado de la colección anterior y lo agrega al de la nueva.

### 13. Buscar en el catálogo excluyendo los libros ya asignados
`GET /libro` suma `sin_coleccion` para que el diálogo "Agregar libros" reciba
sólo libros sin colección, con el total real.

Criterios de aceptación:
- [ ] `GET /libro?sin_coleccion=true` no devuelve ningún libro que pertenezca a una colección del usuario.
- [ ] Con `sin_coleccion=true`, el total de la paginación cuenta sólo los libros sin colección (no el catálogo entero).
- [ ] `sin_coleccion=true` se combina con `titulo` (coincidencia parcial) y con `isbn` (igualdad) manteniendo el total correcto de esa combinación.
- [ ] Al asignar a una colección un libro que aparecía en los resultados, ese libro deja de aparecer y el total baja en la siguiente consulta.
- [ ] Sin `sin_coleccion`, `GET /libro` se comporta igual que hoy.

### 14. Dejar persistidas las 3 colecciones de muestra
El seeder del proyecto deja cargadas en la base las 3 colecciones de muestra del
`design.md` (#10), sin libros y sin portada, de forma idempotente.

Criterios de aceptación:
- [ ] Tras correr el seeder, existen las 3 colecciones: "Clásicos recuperados", "Serie Aljibe" y "Álbum ilustrado".
- [ ] Cada una queda con la descripción que figura en el `design.md` (#10).
- [ ] Las 3 quedan sin libros y sin portada: `cantidad_libros` en 0 y `portada_url` en `null` al leerlas.
- [ ] `GET /coleccion/` del usuario dueño de los datos de muestra incluye las 3 colecciones.
- [ ] Correr el seeder dos veces no duplica: siguen existiendo 3 colecciones con esos títulos, sin repetidos.
