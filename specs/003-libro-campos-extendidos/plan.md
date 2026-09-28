# Plan: Campos extendidos de libro

## Historia

Cada libro debe poder tener dimensiones (alto, ancho, largo), brief,
cantidad de páginas, edad recomendada, una imagen de portada y un book
trailer opcional (link de YouTube).

## Diseño de API

### Campos simples nuevos

`POST /libro/` y `PUT /libro/:isbn` aceptan estos campos adicionales en el
body, todos opcionales (pueden omitirse o enviarse `null`):

| Campo | Tipo | Validación server-side |
| --- | --- | --- |
| `alto` | número decimal | si viene, > 0 |
| `ancho` | número decimal | si viene, > 0 |
| `largo` | número decimal | si viene, > 0 |
| `brief` | string | sin límite adicional |
| `paginas` | entero | si viene, > 0 |
| `edad_recomendada` | entero | si viene, >= 0 |
| `book_trailer_url` | string | si viene y no es vacío, tiene que matchear un link de YouTube válido (`youtube.com/watch?v=...`, `youtube.com/embed/...` o `youtu.be/...`); si no matchea, 400 |

`GET /libro`, `GET /libro/:isbn` y `GET /libro/lista_libros` devuelven estos
mismos campos en cada libro (valor `null` si nunca se cargaron), más
`portada_url` (ver abajo).

### Portada (subida en dos pasos)

`POST /libro/:isbn/portada` — multipart/form-data, un único archivo.

- 200 con el libro actualizado (incluye `portada_url`) si se subió/reemplazó
  correctamente.
- 404 si el `isbn` no corresponde a un libro del usuario autenticado.
- 400 si no viene ningún archivo en la request.
- 415 si el archivo no es `image/jpeg` ni `image/png`.
- 413 si el archivo pesa más de 5 MB.
- Si el libro ya tenía portada, la nueva la reemplaza (la anterior deja de
  estar disponible).

`portada_url` es el campo que se agrega a la respuesta de cualquier
endpoint que ya devuelve datos de un libro (creación, edición, detalle,
listado/catálogo): `null` mientras el libro no tiene portada cargada, o una
URL utilizable directamente por el front (`<img src>`) una vez cargada.

## Ambigüedad

- El design.md deja explícitamente fuera de alcance "sacar la portada sin
  reemplazarla" como acción separada; este plan no la incluye.
- No hay endpoint de borrado de libro completo que deba tocar la portada
  (el borrado existente es soft-delete); no se agregan tareas de limpieza
  de portada al borrar, salvo que back-implementer detecte que el
  mecanismo de storage elegido lo requiera — en ese caso es una decisión de
  implementación, no de este plan.

## Tareas

### 1. Persistir los campos simples nuevos en el libro
El libro tiene que poder guardar dimensiones, brief, páginas, edad
recomendada y book trailer, todos opcionales, sin afectar libros existentes
(que no los tienen cargados).

Criterios de aceptación:
- [ ] Un libro creado antes de este cambio sigue siendo accesible y devuelve estos campos nuevos como `null`.
- [ ] Guardar un libro con estos campos en `null`/ausentes no falla.

### 2. Aceptar y guardar los campos nuevos al crear un libro
`POST /libro/` acepta los campos de la tabla de arriba y los persiste.

Criterios de aceptación:
- [ ] Crear un libro con todos los campos nuevos cargados los devuelve tal cual en la respuesta.
- [ ] Crear un libro sin ninguno de estos campos sigue funcionando igual que hoy (201, libro creado) y los devuelve en `null`.
- [ ] Crear un libro con `alto`, `ancho`, `largo` o `paginas` en 0 o negativo devuelve 400.
- [ ] Crear un libro con `book_trailer_url` que no matchea un link de YouTube válido devuelve 400.
- [ ] Crear un libro con `book_trailer_url` vacío u omitido no falla.

### 3. Aceptar y guardar los campos nuevos al editar un libro
`PUT /libro/:isbn` acepta y actualiza los mismos campos, incluyendo poder
pisar un valor previamente cargado con uno nuevo.

Criterios de aceptación:
- [ ] Editar un libro para cargar por primera vez estos campos los persiste y los devuelve en la respuesta.
- [ ] Editar un libro que ya tenía estos campos cargados con valores nuevos los reemplaza.
- [ ] Las mismas validaciones de la tarea 2 (dimensiones/páginas positivas, `book_trailer_url` válido) aplican acá y devuelven 400 si se violan.

### 4. Devolver los campos nuevos en listado y detalle
`GET /libro`, `GET /libro/:isbn` y `GET /libro/lista_libros` incluyen los
campos nuevos de cada libro.

Criterios de aceptación:
- [ ] `GET /libro/:isbn` de un libro con campos cargados los devuelve con sus valores reales.
- [ ] `GET /libro/:isbn` de un libro sin estos campos cargados los devuelve en `null`.
- [ ] `GET /libro` y `GET /libro/lista_libros` incluyen estos mismos campos por cada libro del listado.

### 5. Subir/reemplazar la portada de un libro existente
`POST /libro/:isbn/portada` recibe un archivo de imagen y lo asocia al
libro, reemplazando la portada anterior si existía.

Criterios de aceptación:
- [ ] Subir una imagen JPG o PNG válida a un libro sin portada devuelve 200 y el libro resultante trae un `portada_url` no nulo.
- [ ] Subir una segunda imagen al mismo libro reemplaza la portada: `portada_url` cambia y la imagen vieja deja de estar accesible en la URL anterior.
- [ ] Subir un archivo de un tipo distinto a JPG/PNG (ej. PDF, GIF) devuelve 415 y no modifica el libro.
- [ ] Subir un archivo de más de 5 MB devuelve 413 y no modifica el libro.
- [ ] Subir una portada a un `isbn` inexistente (o de otro usuario) devuelve 404.
- [ ] Llamar al endpoint sin adjuntar ningún archivo devuelve 400.

### 6. Servir la portada cargada
La `portada_url` devuelta por la API tiene que resolver efectivamente a la
imagen cargada, accesible sin autenticación adicional más allá de la que ya
use el resto de archivos servidos por la app.

Criterios de aceptación:
- [ ] Hacer un `GET` a la `portada_url` devuelta tras subir una portada devuelve la imagen (status 200, contenido de imagen).
- [ ] Tras reemplazar una portada, un `GET` a la `portada_url` anterior ya no devuelve la imagen vieja.
