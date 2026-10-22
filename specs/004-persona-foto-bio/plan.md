# Plan: Foto y biografía de autores/ilustradores

## Historia

Cada persona (autor/ilustrador) debe tener una foto y una biografía.

## Diseño de API

### Biografía (campo simple)

`POST /persona/` y `PUT /persona/:id` aceptan un campo adicional en el body:

| Campo | Tipo | Validación server-side |
| --- | --- | --- |
| `bio` | string | opcional, sin límite de longitud |

`GET /persona/` y `GET /persona/:id` devuelven `bio` en cada persona (`null`
si nunca se cargó).

### Foto (subida en dos pasos, con reemplazo y borrado)

Mismo patrón que la portada de libro (`specs/003-libro-campos-extendidos`),
con el agregado de un endpoint de borrado que ese precedente no tenía.

`POST /persona/:id/foto` — multipart/form-data, un único archivo.

- 200 con la persona actualizada (incluye `foto_url`) si se subió/reemplazó
  correctamente.
- 404 si el `id` no corresponde a una persona del usuario autenticado.
- 400 si no viene ningún archivo en la request.
- 415 si el archivo no es `image/jpeg` ni `image/png`.
- 413 si el archivo pesa más que el tamaño máximo configurado por el usuario
  (ver "Restricciones de foto" abajo); si el usuario no configuró tamaño
  máximo, no hay límite de este tipo.
- 422 si la imagen mide menos que el ancho y/o alto mínimo configurado por
  el usuario; si no configuró mínimos, no hay límite de este tipo.
- Si la persona ya tenía foto, la nueva la reemplaza (la anterior deja de
  estar disponible).

`DELETE /persona/:id/foto`

- 200 con la persona actualizada (`foto_url` en `null`) si la foto se quitó
  (o si la persona ya no tenía foto: operación idempotente).
- 404 si el `id` no corresponde a una persona del usuario autenticado.

`foto_url` se agrega a la respuesta de cualquier endpoint que ya devuelve
datos de una persona (creación, edición, detalle, listado): `null` mientras
la persona no tiene foto cargada, o una URL utilizable directamente por el
front (`<img src>`) una vez cargada.

### Restricciones de foto (configuración por editorial)

`GET /user/` (ya existente) suma estos tres campos a la respuesta:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `foto_persona_max_size_mb` | decimal | `null` = sin límite |
| `foto_persona_min_ancho_px` | entero | `null` = sin límite |
| `foto_persona_min_alto_px` | entero | `null` = sin límite |

`PUT /user` (ya existente) acepta estos mismos tres campos, todos
opcionales e independientes entre sí (se puede mandar sólo uno). Enviar
`null` en cualquiera de ellos lo vuelve "sin límite". No hay validación
cruzada entre ellos (no hace falta que ancho y alto vengan juntos).

Estos valores son los que `POST /persona/:id/foto` usa para decidir 413/422.

## Ambigüedad

Ninguna: el `design.md` deja la forma de storage y de API abierta a este
plan, y no hay puntos del comportamiento observable que dependan de una
decisión que sólo el usuario pueda tomar.

## Tareas

### 1. Persistir la biografía de una persona
Una persona tiene que poder guardar un texto de biografía, opcional, sin
afectar personas existentes (que no lo tienen cargado).

Criterios de aceptación:
- [ ] Una persona creada antes de este cambio sigue siendo accesible y devuelve `bio` como `null`.
- [ ] Guardar una persona con `bio` ausente o `null` no falla.

### 2. Aceptar y guardar la biografía al crear y editar una persona
`POST /persona/` y `PUT /persona/:id` aceptan `bio` y lo persisten,
incluyendo poder pisar un valor previamente cargado con uno nuevo.

Criterios de aceptación:
- [ ] Crear una persona con `bio` cargada la devuelve tal cual en la respuesta.
- [ ] Crear una persona sin `bio` sigue funcionando igual que hoy (201, persona creada) y la devuelve en `null`.
- [ ] Editar una persona para cargar `bio` por primera vez la persiste y la devuelve en la respuesta.
- [ ] Editar una persona que ya tenía `bio` cargada con un valor nuevo lo reemplaza.

### 3. Devolver la biografía en listado y detalle
`GET /persona/` y `GET /persona/:id` incluyen `bio` de cada persona.

Criterios de aceptación:
- [ ] `GET /persona/:id` de una persona con `bio` cargada la devuelve con su valor real.
- [ ] `GET /persona/:id` de una persona sin `bio` cargada la devuelve en `null`.
- [ ] `GET /persona/` incluye `bio` por cada persona del listado.

### 4. Persistir la referencia de foto de una persona
Una persona tiene que poder tener asociada (o no) una foto, sin afectar
personas existentes (que no tienen foto cargada).

Criterios de aceptación:
- [ ] Una persona creada antes de este cambio sigue siendo accesible y devuelve `foto_url` como `null`.
- [ ] Una persona recién creada devuelve `foto_url` en `null` antes de subir ninguna foto.

### 5. Subir/reemplazar la foto de una persona existente
`POST /persona/:id/foto` recibe un archivo de imagen y lo asocia a la
persona, reemplazando la foto anterior si existía.

Criterios de aceptación:
- [ ] Subir una imagen JPG o PNG válida a una persona sin foto devuelve 200 y la persona resultante trae un `foto_url` no nulo.
- [ ] Subir una segunda imagen a la misma persona reemplaza la foto: `foto_url` cambia y la imagen vieja deja de estar accesible en la URL anterior.
- [ ] Subir un archivo de un tipo distinto a JPG/PNG (ej. PDF, GIF) devuelve 415 y no modifica la persona.
- [ ] Subir una foto a un `id` inexistente (o de otro usuario) devuelve 404.
- [ ] Llamar al endpoint sin adjuntar ningún archivo devuelve 400.

### 6. Aplicar los límites configurados de tamaño y resolución al subir la foto
`POST /persona/:id/foto` valida el archivo contra el tamaño máximo y la
resolución mínima configurados por el usuario dueño de la persona (tarea
9-11), antes de guardarlo.

Criterios de aceptación:
- [ ] Con un tamaño máximo configurado, subir un archivo que lo supera devuelve 413 y no modifica la persona.
- [ ] Con un tamaño máximo configurado, subir un archivo que no lo supera devuelve 200.
- [ ] Sin tamaño máximo configurado (`null`), subir un archivo de cualquier peso no devuelve 413 por este motivo.
- [ ] Con ancho y/o alto mínimo configurado, subir una imagen más chica que el mínimo devuelve 422 y no modifica la persona.
- [ ] Con ancho y/o alto mínimo configurado, subir una imagen que cumple el mínimo devuelve 200.
- [ ] Sin resolución mínima configurada (`null` en ambos), subir una imagen de cualquier tamaño no devuelve 422 por este motivo.

### 7. Quitar la foto de una persona
`DELETE /persona/:id/foto` desasocia la foto actual de la persona.

Criterios de aceptación:
- [ ] Quitar la foto de una persona que tenía una devuelve 200 con `foto_url` en `null`, y la URL anterior deja de estar accesible.
- [ ] Quitar la foto de una persona que no tenía foto devuelve 200 con `foto_url` en `null` (no falla).
- [ ] Quitar la foto de un `id` inexistente (o de otro usuario) devuelve 404.

### 8. Servir la foto cargada
La `foto_url` devuelta por la API tiene que resolver efectivamente a la
imagen cargada, accesible sin autenticación adicional más allá de la que ya
use el resto de archivos servidos por la app.

Criterios de aceptación:
- [ ] Hacer un `GET` a la `foto_url` devuelta tras subir una foto devuelve la imagen (status 200, contenido de imagen).
- [ ] Tras reemplazar o quitar una foto, un `GET` a la `foto_url` anterior ya no devuelve la imagen vieja.

### 9. Devolver `foto_url` en listado y detalle de persona
`GET /persona/` y `GET /persona/:id` incluyen `foto_url` de cada persona.

Criterios de aceptación:
- [ ] `GET /persona/:id` de una persona con foto cargada devuelve su `foto_url` real.
- [ ] `GET /persona/:id` de una persona sin foto cargada devuelve `foto_url` en `null`.
- [ ] `GET /persona/` incluye `foto_url` por cada persona del listado.

### 10. Persistir la configuración de restricciones de foto por editorial
El usuario (editorial) tiene que poder guardar, de forma independiente
entre sí, un tamaño máximo de archivo y una resolución mínima (ancho y
alto) para la foto de persona, todos opcionales.

Criterios de aceptación:
- [ ] Un usuario existente antes de este cambio sigue siendo accesible y devuelve los tres campos como `null`.
- [ ] Guardar sólo uno de los tres campos (dejando los otros dos ausentes/`null`) no falla.

### 11. Leer la configuración de restricciones de foto
`GET /user/` incluye `foto_persona_max_size_mb`, `foto_persona_min_ancho_px`
y `foto_persona_min_alto_px`.

Criterios de aceptación:
- [ ] `GET /user/` de un usuario con los tres campos configurados los devuelve con sus valores reales.
- [ ] `GET /user/` de un usuario sin configurar estos campos los devuelve en `null`.

### 12. Actualizar la configuración de restricciones de foto
`PUT /user` acepta los tres campos y los persiste, incluyendo poder pisar
un valor previamente configurado o volverlo a `null` ("sin límite").

Criterios de aceptación:
- [ ] Actualizar el usuario con los tres campos cargados por primera vez los persiste y los devuelve en la respuesta.
- [ ] Actualizar el usuario para cambiar sólo uno de los tres campos no modifica los otros dos.
- [ ] Actualizar el usuario mandando `null` en un campo previamente configurado lo vuelve a dejar en "sin límite".
