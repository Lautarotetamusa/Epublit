# Plan: tipo de edición, visibilidad en el sitio y reseñas del libro

## Historia

Como admin:

1. Quiero indicar el **tipo de edición** de un libro: pop up, cartoné o normal.
2. Quiero marcar un libro como **visible o invisible en el sitio**. Por defecto un
   libro es visible.
3. Quiero **cargar, editar y borrar reseñas** de un libro. Un libro tiene 0 o
   muchas reseñas, y cada reseña es un link (URL) a una página externa.

## 1. Tipo de edición

- Enum de Postgres `libro_tipo_edicion` con los valores `normal | pop_up | cartone`.
- `libros.tipo_edicion` es NOT NULL con default `normal`: los libros que ya
  existen quedan como «Normal» sin necesidad de backfill.
- `POST /libro` y `PUT /libro/:isbn` aceptan `tipo_edicion` (opcional al crear).
  Un valor fuera del enum devuelve `400`.
- La ficha y el alta del libro lo editan con un selector («Normal», «Pop up»,
  «Cartoné»).
- La API pública de la tienda lo expone en el detalle del libro como `tipoEdicion`.

## 2. Visible en el sitio

- `libros.visible` es un boolean NOT NULL con default `true`.
- `POST /libro` / `PUT /libro/:isbn` aceptan `visible`.
- El panel sigue mostrando todos los libros. Los invisibles llevan el badge
  «Oculto en el sitio» en el catálogo y en la ficha.
- La API pública de la tienda (`/tienda/...`) trata un libro invisible como si no
  existiera:
  - no aparece en el listado ni en las novedades;
  - su detalle devuelve `404`;
  - no aparece en los libros de una persona (Autorxs), y una persona sin libros
    visibles no aparece;
  - no cuenta en `cantidadLibros` de las colecciones;
  - no se puede cotizar ni comprar (`404`, mismo error que un ISBN inexistente).
- Las ventas y los movimientos manuales del panel **no** cambian: la visibilidad es
  sólo del sitio.

## 3. Reseñas

Tabla `libro_resenas`:

| Columna | Tipo |
|---|---|
| `id` | identity, PK compuesta `(id, user)` |
| `id_libro` | FK a `libros.id_libro`, `on delete cascade` |
| `url` | `varchar(500)`, NOT NULL |
| `created_at` | timestamp, default now |
| `user` | FK a `users.id` |

Endpoints (todos por cuenta, `404` si el libro o la reseña no existen o son de otra
cuenta):

- `GET /libro/:isbn/resenas` → `200` → `[ { id, url, created_at } ]`, de la más vieja
  a la más nueva.
- `POST /libro/:isbn/resenas` — body `{ url }` → `201` → la reseña creada.
- `PUT /libro/:isbn/resenas/:id` — body `{ url }` → `200` → la reseña actualizada.
- `DELETE /libro/:isbn/resenas/:id` → `200`. El borrado es físico: una reseña no
  tiene historia que conservar.

Validación de `url`: string de hasta 500 caracteres que sea una URL `http(s)` válida.
Si no lo es, devuelve `400`.

- La ficha del libro tiene una tarjeta «Reseñas» con la lista de links, alta,
  edición y borrado (con confirmación).
- La API pública expone en el detalle del libro `resenas: [ { url } ]`.

## Criterios de aceptación

- [x] Un libro creado sin `tipo_edicion` queda `normal` y sin `visible` queda `true`.
- [x] `tipo_edicion: "tapa_dura"` → `400`.
- [ ] Un libro con `visible: false` no aparece en `GET /tienda/libros`, su detalle da
      `404` y cotizarlo da `404`.
- [x] El panel sigue listando el libro oculto.
- [x] `POST /libro/:isbn/resenas` con `{ url: "no-es-url" }` → `400`; con una URL
      válida → `201`, y aparece en `GET /libro/:isbn/resenas`.
- [x] Editar y borrar una reseña de otra cuenta → `404`.
- [ ] Borrar un libro no deja reseñas huérfanas que rompan la FK.

Estado (2026-11-16): cubierto por `test/libro_edicion_resenas.test.ts`. El criterio del libro oculto queda sin marcar porque el listado y el detalle están testeados pero cotizar un libro oculto no (el test necesita configuración de envíos; el código usa `libroService.findOneVisible`). El borrado de un libro es lógico, así que sus reseñas no se tocan; la FK tiene `on delete cascade` para un borrado físico.
