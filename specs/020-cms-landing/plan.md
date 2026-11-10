# Plan: CMS de contenido de la landing (Fase 1)

Estado: aprobado por el usuario (2026-11-10).

## Decisiones confirmadas

1. La URL pública para "Abrir en la landing" queda fuera de Fase 1: se expone
   el `slug` como referencia estable y no se inventa una URL.
2. La eliminación de páginas es **baja lógica**, conservando bloques e imágenes
   y liberando el slug.
3. El texto alternativo y el epígrafe se guardan **por colocación**, no por
   archivo; reemplazar una imagen sube un archivo nuevo.

## Historia

La editora de Libros Silvestres administra desde el panel las páginas
institucionales de la landing (Editorial, Rizoma, Responsabilidad, Premios, En
el mundo) con bloques de texto, imágenes, galerías, citas, datos y enlaces:
guarda borradores, previsualiza y publica sin depender de un desarrollador.
Fase 1: CRUD por cuenta, bloques tipados, imágenes, publicación y API pública;
sin historial de versiones, permisos por rol ni flujo de aprobación.

## Diseño de API

### Convenciones generales

- **Admin**: prefijo `/contenido`. Usa la sesión del panel. Sin sesión,
  `401`. Todo se acota a la cuenta autenticada; un recurso de otra cuenta
  responde `404` (no `403`, para no filtrar su existencia).
- **Público**: prefijo `/public/tienda/v1/contenido`. Reutiliza la integración
  y la API key (`X-API-Key`) que ya consume la landing en la tienda: es otro
  consumidor de la misma cuenta y no hace falta una segunda credencial ni
  duplicar el control de origen. Sin clave o con clave inválida, `401`;
  integración inactiva/revocada u origen distinto, `403`. Sin `Origin` se
  acepta (server-to-server), igual que el resto de la API pública.
- **Errores**: sobre estable
  `{ "error": { "codigo": "...", "mensaje": "...", "detalles": [...] } }`,
  igual que la API pública existente. `detalles` es una lista de
  `{ "campo", "codigo", "mensaje" }` cuando hay varios campos en falta.
- **Fechas**: ISO 8601 con zona horaria. **Ids**: enteros.
- **Estado**: `borrador` o `publicada`. No se envía en alta ni edición:
  guardar nunca publica ni despublica. Cambia sólo con las acciones explícitas
  de publicar/despublicar, tal como define el diseño aprobado ("Guardar
  cambios" conserva el estado; "Despublicar" es una acción aparte y
  confirmada).
- **Borrador permisivo / publicación estricta**: un borrador se guarda aunque
  falten título, slug, descripción, bloques o textos alternativos. Publicar
  exige el checklist completo.
- **Listado sin paginación**: las páginas institucionales son un conjunto
  acotado y el panel necesita todas para mostrar conteos y armar el menú de
  previsualización. Se devuelven todas las que coinciden con el filtro.
- **Slug**: 1–80 caracteres, sólo minúsculas, números y guiones simples; no
  puede empezar ni terminar con guion. `orden` es un entero no negativo y
  `visibleEnMenu` es booleano.
- **Aislamiento**: una página, un bloque o una imagen de otra cuenta no se
  puede leer, modificar, publicar, borrar ni referenciar.

### API de administración

#### `GET /contenido/paginas`

Query opcional:

- `estado`: `todas` (por defecto), `publicadas` o `borradores`. Cualquier otro
  valor devuelve `400`.
- `buscar`: coincidencia parcial, sin distinguir mayúsculas ni acentos, por
  título o slug.

`200`:

```json
{
  "paginas": [
    {
      "id": 12,
      "titulo": "Editorial",
      "slug": "editorial",
      "descripcion": "Quiénes somos y cómo trabajamos.",
      "estado": "publicada",
      "visibleEnMenu": true,
      "orden": 1,
      "cantidadBloques": 5,
      "actualizadaEn": "2026-11-10T10:00:00-03:00"
    }
  ],
  "total": 5,
  "conteos": { "todas": 5, "publicadas": 3, "borradores": 2 }
}
```

- Sólo páginas vigentes de la cuenta, ordenadas por `orden` ascendente y, en
  empate, por título ascendente.
- `conteos` se calcula sobre el recorte de `buscar`, sin aplicar el filtro de
  `estado`, para que el panel muestre los tres contadores a la vez.
- No incluye bloques ni portada: el editor los pide en el detalle.

#### `GET /contenido/paginas/slug-disponible`

Query: `slug` (obligatorio) y `paginaId` (opcional, para excluir la página que
se está editando).

`200`:

```json
{ "disponible": true, "motivo": "libre" }
```

`motivo`: `libre`, `invalido` o `en_uso`. Un slug repetido en otra cuenta no
afecta. `400` si falta `slug`. Sirve para el checklist del editor antes de
guardar; el guardado y la publicación vuelven a validar.

#### `POST /contenido/paginas`

Body (todos los campos opcionales; los ausentes toman el valor por defecto):

```json
{
  "titulo": "Editorial",
  "slug": "editorial",
  "descripcion": "Quiénes somos y cómo trabajamos.",
  "visibleEnMenu": true,
  "orden": 1,
  "portada": {
    "imagenId": 3,
    "textoAlternativo": "Mesa de trabajo con libros",
    "epigrafe": null
  },
  "bloques": []
}
```

Valores por defecto: `titulo: ""`, `slug: null`, `descripcion: null`,
`visibleEnMenu: false`, `orden: 0`, `portada: null`, `bloques: []`.

`201` con `{ "pagina": { ... } }` (representación completa, ver abajo).

Errores: `400` por campos inválidos; `409` con `slug_duplicado` si el slug ya
lo usa otra página vigente de la cuenta. `estado` no forma parte del cuerpo y
se ignora si se envía.

#### `GET /contenido/paginas/:id`

`200` con la página completa:

```json
{
  "pagina": {
    "id": 12,
    "titulo": "Editorial",
    "slug": "editorial",
    "descripcion": "Quiénes somos y cómo trabajamos.",
    "estado": "borrador",
    "visibleEnMenu": true,
    "orden": 1,
    "portada": {
      "imagenId": 3,
      "url": "https://ejemplo.com/files/contenido/...",
      "textoAlternativo": "Mesa de trabajo con libros",
      "epigrafe": null,
      "ancho": 1600,
      "alto": 900
    },
    "bloques": [
      {
        "id": 41,
        "tipo": "hero",
        "titulo": "Una editorial pequeña",
        "bajada": "Libros que crecen con quien los lee.",
        "imagen": {
          "imagenId": 3,
          "url": "https://ejemplo.com/files/contenido/...",
          "textoAlternativo": "Mesa de trabajo con libros",
          "epigrafe": null,
          "ancho": 1600,
          "alto": 900
        }
      }
    ],
    "actualizadaEn": "2026-11-10T10:00:00-03:00",
    "actualizadaPor": "libreria_sur"
  }
}
```

`404` si no existe, fue dada de baja o es de otra cuenta.

#### `PUT /contenido/paginas/:id`

Reemplaza la página completa con el mismo cuerpo que el alta. Lo omitido vuelve
a su valor por defecto; `portada: null` la quita y `bloques: []` deja la página
sin bloques. El estado no cambia: una página publicada sigue publicada y un
borrador sigue borrador. Cada guardado actualiza `actualizadaEn` y
`actualizadaPor`.

`200` con la página completa. `400`, `409` (`slug_duplicado`) y `404` con las
mismas reglas que el alta.

#### `DELETE /contenido/paginas/:id`

Baja lógica: la página deja de aparecer en el panel y en el público, conserva
sus bloques e imágenes y libera su slug. `200` con
`{ "eliminada": true }`; `404` si es de otra cuenta o ya estaba dada de baja.

#### `POST /contenido/paginas/:id/publicar`

Publica una página existente sin reenviar el contenido. `200` con la página
completa y `estado: "publicada"`. Si ya estaba publicada, `200` sin cambios.

`422` con `publicacion_incompleta` y un detalle por cada requisito que falta
(ver "Publicación"). `409` con `slug_duplicado` si el slug pasó a estar
ocupado. `404` si es de otra cuenta o está dada de baja.

#### `POST /contenido/paginas/:id/despublicar`

Deja la página en `borrador` conservando contenido y bloques. `200` con la
página completa. Si ya era borrador, `200` sin cambios. `404` si es de otra
cuenta o está dada de baja.

#### `POST /contenido/imagenes`

Multipart con `archivo` y `uso` (`portada`, `hero`, `bloque` o `galeria`).
El alt y el epígrafe no se guardan en el archivo: se guardan en cada
colocación (portada o bloque), porque la misma imagen puede usarse en dos
lugares con textos distintos.

`201`:

```json
{
  "imagen": {
    "id": 3,
    "url": "https://ejemplo.com/files/contenido/...",
    "ancho": 1600,
    "alto": 900,
    "mime": "image/jpeg",
    "bytes": 184320
  }
}
```

- Formatos: JPG, PNG y WebP, validados por contenido real, no por extensión.
  Otro formato: `400` con `formato_no_permitido`.
- Peso máximo: 8 MB. Más: `413` con `archivo_demasiado_grande`.
- Resolución mínima: `portada` y `hero`, 1200×600; `bloque` y `galeria`,
  800×450. Menos: `422` con `resolucion_insuficiente`.
- `uso` ausente o desconocido: `400`. Archivo ausente o ilegible: `400` con
  `archivo_invalido`.
- La `url` es absoluta, se sirve por la ruta pública de archivos existente y
  responde sin sesión ni API key.

#### `DELETE /contenido/imagenes/:id`

Elimina el archivo y su registro. `200` con `{ "eliminada": true }`. Si una
página vigente la referencia (portada o bloque), `409` con `imagen_en_uso` y no
elimina nada; si sólo la referencian páginas dadas de baja, se puede eliminar.
`404` si es de otra cuenta.

Reemplazar una imagen es subir una nueva y apuntar la página a la referencia
nueva; no se reescribe el archivo existente para no romper URLs ya servidas.
La imagen anterior queda sin uso y puede borrarse con este endpoint.

### Bloques

Se guardan dentro del alta y la edición de la página, en el orden del array.
El orden del array es el orden canónico: no se envía un campo de posición.

Cada bloque de escritura es `{ "id"?: 41, "tipo": "...", ...campos }`. El `id`
es opcional al crear; si se envía un `id` de la misma página, el bloque
conserva su identidad; si es inexistente o de otra página, `400` con
`bloque_inexistente`. Los bloques omitidos se eliminan. La lectura siempre
devuelve `id` y `tipo`.

| Tipo | Campos propios |
| --- | --- |
| `hero` | `titulo`, `bajada`, `imagen` (referencia o `null`) |
| `texto` | `titulo` (opcional), `contenido` (texto enriquecido simple) |
| `imagen_texto` | `titulo` (opcional), `texto`, `imagen` (referencia o `null`), `posicion` (`izquierda`/`derecha`, por defecto `derecha`) |
| `galeria` | `titulo` (opcional), `imagenes` (lista de referencias), `columnas` (`2`/`3`, por defecto `3`) |
| `cita` | `texto`, `autor`, `fuente` (opcional) |
| `datos` | `titulo` (opcional), `items` (lista de pares `valor`/`etiqueta`) |
| `enlaces` | `titulo` (opcional), `enlaces` (lista de `nombre`, `destino`, `descripcion` opcional) |

Referencia de imagen:

- Escritura: `{ "imagenId": 3, "textoAlternativo": "..." | null,
  "epigrafe": "..." | null }`. Los campos derivados (`url`, `ancho`, `alto`)
  se ignoran si el cliente los reenvía desde una lectura.
- Lectura admin: la misma referencia más `url`, `ancho` y `alto`.
- Lectura pública: igual que la lectura admin, sin `imagenId`.

Reglas de validación:

- Los siete tipos aceptan sólo sus campos. Un campo de otro tipo (por ejemplo,
  una galería con `imagen` único o un texto con `imagenes`) devuelve `400` con
  `bloque_invalido`. Un `tipo` desconocido también.
- Hasta 60 bloques por página, 24 imágenes por galería, 20 enlaces por bloque y
  4 pares por bloque de datos. Más, `400`.
- `columnas` sólo `2` o `3`; `posicion` sólo `izquierda` o `derecha`.
- Un `imagenId` inexistente o de otra cuenta devuelve `400` con
  `imagen_inexistente`.
- Una imagen de 800×450 usada en portada o hero devuelve `400` con
  `imagen_resolucion_insuficiente`; una de 1200×600 usada en bloque o galería
  se acepta.
- Texto enriquecido simple: párrafos, `**negrita**`, `*cursiva*`, líneas que
  empiezan con `- ` y `[texto](/destino)`. No se acepta HTML: un contenido con
  `<strong>` o `<script>` devuelve `400` con `texto_invalido`.
- Los destinos de enlaces y de vínculos del texto aceptan `http(s)://` o rutas
  que empiezan con `/`; `javascript:` y `data:` devuelven `400`.
- Límites de texto: título de página 200, slug 80, descripción 320; título de
  bloque 200; bajada 500; contenido/texto 20.000; texto de cita 2.000; autor
  160; fuente 160; valor de dato 60; etiqueta 120; nombre de enlace 160;
  destino 500; descripción de enlace 300; alt y epígrafe 300.
- Los campos opcionales no completados se devuelven como `null`; el título de
  la página y los textos propios de un bloque se devuelven como cadena
  (posiblemente vacía). Un alt con sólo espacios se normaliza a vacío.

### Publicación

Requisitos, exactamente los del diseño aprobado:

1. Título no vacío.
2. Slug presente, con formato válido y libre.
3. Descripción no vacía.
4. Al menos un bloque.
5. Toda imagen presente (portada, hero, imagen y texto, y cada imagen de
   galería) con texto alternativo no vacío.

`422`:

```json
{
  "error": {
    "codigo": "publicacion_incompleta",
    "mensaje": "Faltan requisitos para publicar la página",
    "detalles": [
      { "campo": "titulo", "codigo": "titulo_faltante", "mensaje": "..." },
      { "campo": "descripcion", "codigo": "descripcion_faltante", "mensaje": "..." },
      { "campo": "bloques[2].imagenes[0].textoAlternativo",
        "codigo": "imagen_sin_texto_alternativo", "mensaje": "..." }
    ]
  }
}
```

Códigos de detalle: `titulo_faltante`, `descripcion_faltante`,
`slug_faltante`, `slug_invalido`, `sin_bloques`,
`imagen_sin_texto_alternativo`. Si faltan varios, se devuelven todos juntos.
Un slug ocupado se informa aparte con `409` y `slug_duplicado`. El borrador se
puede guardar con cualquiera de estos faltantes y sigue en `borrador`.

### API pública

#### `GET /public/tienda/v1/contenido/paginas`

`200`:

```json
{
  "paginas": [
    {
      "slug": "editorial",
      "titulo": "Editorial",
      "descripcion": "Quiénes somos y cómo trabajamos.",
      "portada": {
        "url": "https://ejemplo.com/files/contenido/...",
        "textoAlternativo": "Mesa de trabajo con libros",
        "epigrafe": null,
        "ancho": 1600,
        "alto": 900
      },
      "actualizadaEn": "2026-11-10T10:00:00-03:00"
    }
  ]
}
```

Sólo páginas publicadas y vigentes de la cuenta de la integración, ordenadas
por `orden` y luego título. No incluye bloques: la landing los pide por slug.

#### `GET /public/tienda/v1/contenido/paginas/:slug`

`200` con `{ "pagina": { slug, titulo, descripcion, portada, actualizadaEn,
bloques } }` y los bloques en el orden guardado. Cada bloque conserva su `id`
estable y su `tipo`; las imágenes salen resueltas como
`{ url, textoAlternativo, epigrafe, ancho, alto }`. `404` si la página no
existe, está en borrador, fue dada de baja o es de otra cuenta.

#### `GET /public/tienda/v1/contenido/menu`

`200`:

```json
{
  "paginas": [
    { "titulo": "Editorial", "slug": "editorial" },
    { "titulo": "Rizoma", "slug": "rizoma" }
  ]
}
```

Sólo páginas publicadas y visibles en menú, en el orden definido. Una página
publicada no visible no aparece.

Reglas públicas: nunca se exponen borradores, ids de página, ids de imagen,
cuenta, usuaria ni banderas internas. Las URLs de imagen son absolutas y
responden sin API key. Sin `X-API-Key` o con clave inexistente, `401`;
integración inactiva/revocada, `403`; `Origin` distinto, `403`.

### Persistencia y migraciones

Una migración nueva y aditiva incorpora tres entidades acotadas por cuenta:

- **Páginas**: título, slug, descripción, referencia de portada, visibilidad,
  orden, estado, fechas y usuaria de última edición. El slug es único entre
  páginas vigentes de la misma cuenta; varias páginas sin slug pueden
  coexistir. Dar de baja una página libera su slug.
- **Bloques**: pertenecen a una página, tienen tipo, posición y contenido
  propio; la secuencia guardada no tiene posiciones repetidas ni huecos.
- **Imágenes**: pertenecen a la cuenta y guardan la clave de almacenamiento,
  formato, peso y dimensiones. Ninguna página ni bloque puede referenciar una
  imagen de otra cuenta.

Los estados se limitan a `borrador` y `publicada`. Las referencias entre
entidades incluyen la cuenta para impedir cruces. La migración no modifica
datos existentes y se aplica sobre la base actual sin pasos manuales.

## Ambigüedad

- **URL pública de la página.** El diseño pide poder conocer la URL pública
  para "Abrir en la landing", pero el dominio y la ruta del Astro no están
  definidos y el propio diseño deja el botón deshabilitado en Fase 1. Este plan
  expone el `slug` como referencia estable y no inventa una URL. Para habilitar
  el botón hace falta definir una base pública (configurable por cuenta o por
  entorno) y la ruta de la landing.
- **Eliminación de páginas.** El alcance pide CRUD, pero el diseño no describe
  qué pasa al eliminar. Se propone baja lógica: desaparece del panel y del
  público, conserva bloques e imágenes y libera el slug, sin restauración en
  Fase 1. Confirmar si se prefiere baja definitiva.
- **Alt y epígrafe por uso, no por archivo.** Se guardan en cada colocación
  (portada, hero, imagen y texto, galería), así la misma imagen puede tener
  distinto alt en dos lugares. Reemplazar una imagen sube un archivo nuevo y
  deja el anterior sin uso, en lugar de reescribir el archivo existente.
  Confirmar si se espera un alt único por imagen subida.

## Tareas

### 1. Persistir páginas, bloques e imágenes del CMS

Incorporar una migración aditiva con el modelo persistente del CMS, acotado por
cuenta, con estado, orden, visibilidad, slug único y auditoría de última
edición.

Criterios de aceptación:
- [ ] Una página guarda cuenta, título, slug, descripción, portada,
      visibilidad, orden, estado, fecha de creación, última edición y usuaria
      que editó.
- [ ] El slug es único entre páginas vigentes de una misma cuenta; la misma
      cadena puede repetirse en cuentas distintas.
- [ ] Varias páginas vigentes sin slug pueden coexistir; el slug vacío no
      compite por unicidad.
- [ ] Sólo se persisten los estados `borrador` y `publicada`; cualquier otro
      valor se rechaza.
- [ ] Cada bloque guarda página, tipo, posición y contenido; la secuencia
      guardada no tiene posiciones repetidas ni huecos.
- [ ] Cada imagen guarda cuenta, clave de almacenamiento, formato, peso y
      dimensiones.
- [ ] Una página o bloque no puede referenciar una imagen de otra cuenta.
- [ ] Dar de baja una página no borra sus bloques ni sus imágenes, y libera el
      slug para reutilizarlo.
- [ ] La migración no modifica datos existentes y se aplica sobre la base
      actual sin pasos manuales.

### 2. Subir, servir y eliminar imágenes

Permitir subir imágenes desde el panel, servirlas públicamente con una URL
estable y eliminarlas cuando no estén en uso, validando formato, peso y
resolución según el destino.

Criterios de aceptación:
- [ ] `POST /contenido/imagenes` con multipart `archivo` y `uso` devuelve `201`
      con `id`, `url`, `ancho`, `alto`, `mime` y `bytes`.
- [ ] Se aceptan JPG, PNG y WebP hasta 8 MB; un formato distinto devuelve `400`
      con `formato_no_permitido`.
- [ ] Un archivo de más de 8 MB devuelve `413` con `archivo_demasiado_grande`.
- [ ] Un archivo cuyo contenido no es una imagen válida, aunque la extensión lo
      simule, devuelve `400` con `archivo_invalido`.
- [ ] `uso=portada` o `uso=hero` exige al menos 1200×600; `uso=bloque` o
      `uso=galeria` exige al menos 800×450; si no cumple, `422` con
      `resolucion_insuficiente`.
- [ ] `uso` ausente o distinto de los cuatro valores devuelve `400`.
- [ ] La `url` es absoluta, responde `200` sin sesión ni API key y se mantiene
      igual en consultas posteriores.
- [ ] `DELETE /contenido/imagenes/:id` elimina el archivo y su registro, la
      `url` deja de responder y devuelve `200`.
- [ ] Borrar una imagen referenciada por una página vigente devuelve `409` con
      `imagen_en_uso` y no elimina nada.
- [ ] Una imagen referenciada sólo por páginas dadas de baja se puede eliminar.
- [ ] Una imagen de otra cuenta devuelve `404`; sin sesión, `401`.
- [ ] Reemplazar una imagen no reescribe el archivo existente: se sube uno
      nuevo, con otra URL, y la página apunta a la referencia nueva.

### 3. Crear, listar, leer y editar páginas

Exponer el alta, listado, lectura y edición de los datos de una página, con
filtros, conteos, búsqueda y control de slug único, sin tocar todavía la
secuencia de bloques.

Criterios de aceptación:
- [ ] `GET /contenido/paginas` devuelve sólo páginas vigentes de la cuenta con
      `id`, `titulo`, `slug`, `descripcion`, `estado`, `visibleEnMenu`,
      `orden`, `cantidadBloques` y `actualizadaEn`.
- [ ] `estado=todas|publicadas|borradores` filtra el listado; un valor distinto
      devuelve `400`.
- [ ] `buscar` coincide de forma parcial por título o slug, sin distinguir
      mayúsculas ni acentos.
- [ ] `conteos.todas`, `conteos.publicadas` y `conteos.borradores` se calculan
      sobre la búsqueda sin aplicar el filtro de estado.
- [ ] El listado se ordena por `orden` ascendente y, en empate, por título
      ascendente.
- [ ] `POST /contenido/paginas` crea un borrador incluso sin título, slug,
      descripción ni bloques; devuelve `201` y la página con valores vacíos por
      defecto.
- [ ] `GET /contenido/paginas/:id` devuelve la página completa (con
      `bloques: []` si no tiene); `404` para otra cuenta o página dada de baja.
- [ ] `PUT /contenido/paginas/:id` reemplaza los datos enviados: lo omitido
      vuelve a vacío/nulo/`false`/`0`.
- [ ] Guardar nunca cambia el estado: una página publicada sigue publicada y un
      borrador sigue borrador.
- [ ] Cada guardado actualiza `actualizadaEn` con fecha/hora y `actualizadaPor`
      con la usuaria de la sesión.
- [ ] Un slug con mayúsculas, acentos, espacios, guiones repetidos, guiones en
      los extremos o caracteres fuera de minúsculas/números/guiones devuelve
      `400` con `slug_invalido`.
- [ ] Un slug ya usado por otra página vigente de la cuenta devuelve `409` con
      `slug_duplicado` y un mensaje claro.
- [ ] Un título de más de 200 caracteres, una descripción de más de 320 o un
      slug de más de 80 devuelve `400`.
- [ ] Un `orden` negativo o no entero, o un `visibleEnMenu` que no sea booleano,
      devuelve `400`.
- [ ] `GET /contenido/paginas/slug-disponible?slug=...&paginaId=...` devuelve
      `{ disponible, motivo }` con `motivo` `libre`, `invalido` o `en_uso`; el
      slug de la propia página cuenta como libre.
- [ ] Sin sesión, `401`; una página de otra cuenta, `404`.

### 4. Guardar bloques tipados y ordenados

Guardar y devolver la secuencia ordenada de bloques de una página, validando
los campos de cada tipo, las referencias a imágenes y las reglas del texto
enriquecido y de los enlaces.

Criterios de aceptación:
- [ ] `POST` y `PUT` aceptan `bloques` y los guardan en el orden del array;
      `GET` y la API pública los devuelven en ese mismo orden.
- [ ] Cada bloque devuelto incluye `id` estable y `tipo`.
- [ ] Un bloque con `id` existente de la misma página conserva su identidad;
      sin `id` se crea; un `id` inexistente o de otra página devuelve `400` con
      `bloque_inexistente`.
- [ ] Los bloques omitidos se eliminan; `bloques: []` deja la página sin
      bloques.
- [ ] Reordenar el mismo conjunto de bloques cambia el orden devuelto.
- [ ] Los siete tipos aceptan sólo sus campos; un campo de otro tipo (galería
      con `imagen` único, texto con `imagenes`) devuelve `400` con
      `bloque_invalido`.
- [ ] Un `tipo` desconocido devuelve `400`.
- [ ] `galeria.columnas` sólo acepta `2` o `3`; `imagen_texto.posicion` sólo
      `izquierda` o `derecha`.
- [ ] Una página admite hasta 60 bloques, una galería hasta 24 imágenes, datos
      hasta 4 pares y enlaces hasta 20; más devuelve `400`.
- [ ] Un `imagenId` inexistente o de otra cuenta devuelve `400` con
      `imagen_inexistente`.
- [ ] Una imagen de 800×450 usada en portada o hero devuelve `400` con
      `imagen_resolucion_insuficiente`; una de 1200×600 usada en bloque o
      galería se acepta.
- [ ] El texto con etiquetas HTML (`<strong>`, `<script>`) devuelve `400` con
      `texto_invalido`; el texto con párrafos, `**negrita**`, `*cursiva*`,
      líneas `- ` y `[texto](/destino)` se guarda y devuelve sin cambios.
- [ ] Un enlace con destino `javascript:` o `data:` devuelve `400`; se aceptan
      `http(s)://` y rutas que empiezan con `/`.
- [ ] Un alt o epígrafe de más de 300 caracteres devuelve `400`.
- [ ] Un `textoAlternativo` con sólo espacios se guarda como vacío y no cuenta
      como alt para publicar.

### 5. Dar de baja páginas

Permitir eliminar una página desde el panel sin perder sus bloques ni sus
imágenes, liberando su slug y sacándola de todos los listados públicos.

Criterios de aceptación:
- [ ] `DELETE /contenido/paginas/:id` devuelve `200` y la página deja de
      aparecer en el listado admin, en el listado público, en el detalle por
      slug y en el menú.
- [ ] Los bloques y las imágenes se conservan; la página ya no se puede leer ni
      editar por id.
- [ ] El slug queda libre y otra página puede usarlo.
- [ ] Una página de otra cuenta o ya dada de baja devuelve `404`.
- [ ] Sin sesión, `401`.

### 6. Publicar y despublicar con checklist

Publicar y despublicar con las validaciones del backend, devolviendo qué
requisito falla y conservando el contenido en todo momento.

Criterios de aceptación:
- [ ] `POST /contenido/paginas/:id/publicar` deja la página en `publicada` y
      devuelve `200` con la página completa.
- [ ] Sin título, el `422` incluye `titulo_faltante`; sin descripción,
      `descripcion_faltante`; sin bloques, `sin_bloques`; sin slug,
      `slug_faltante`; con slug inválido, `slug_invalido`.
- [ ] Un slug ya usado por otra página vigente devuelve `409` con
      `slug_duplicado`.
- [ ] Una portada, una imagen de hero, una imagen de imagen y texto o cualquier
      imagen de galería sin texto alternativo impide publicar; el `422` incluye
      un detalle por cada una con la ruta exacta del campo.
- [ ] Si faltan varios requisitos, se devuelven todos juntos en
      `error.detalles`, con `campo`, `codigo` y `mensaje`.
- [ ] El `422` usa `error.codigo = publicacion_incompleta`.
- [ ] Un borrador con requisitos faltantes se guarda con `200` y sigue en
      `borrador`.
- [ ] Publicar una página ya publicada devuelve `200` sin alterar contenido ni
      última edición.
- [ ] `POST /contenido/paginas/:id/despublicar` deja la página en `borrador`
      sin borrar contenido ni bloques, y devuelve `200`.
- [ ] Despublicar una página ya en borrador devuelve `200` sin cambios.
- [ ] Publicar o despublicar no modifica `actualizadaEn` ni `actualizadaPor`.
- [ ] Una página publicada sigue siendo editable y `PUT` conserva el estado
      `publicada`.
- [ ] Sin sesión, `401`; otra cuenta o página dada de baja, `404`.

### 7. API pública de páginas y menú

Exponer a la landing las páginas publicadas, el detalle por slug y el menú del
sitio, reutilizando la autenticación por API key de la tienda y sin filtrar
borradores ni datos internos.

Criterios de aceptación:
- [ ] `GET /public/tienda/v1/contenido/paginas` devuelve sólo páginas
      publicadas y vigentes de la cuenta de la integración, ordenadas por
      `orden` y título, con `slug`, `titulo`, `descripcion`, `portada` y
      `actualizadaEn`.
- [ ] `GET /public/tienda/v1/contenido/paginas/:slug` devuelve la página con
      portada y `bloques` en el orden guardado.
- [ ] Un slug en borrador, dado de baja o inexistente devuelve `404`.
- [ ] `GET /public/tienda/v1/contenido/menu` devuelve sólo páginas publicadas y
      visibles, ordenadas, con `titulo` y `slug`; las publicadas no visibles no
      aparecen.
- [ ] Publicar suma la página al listado y al detalle; despublicar o dar de
      baja la quita; el menú respeta `visibleEnMenu` y `orden` en cada cambio.
- [ ] Las imágenes se devuelven con `url` absoluta, `textoAlternativo`,
      `epigrafe`, `ancho` y `alto`.
- [ ] La respuesta no incluye ids de página, ids de imagen, cuenta, usuaria ni
      banderas internas; los bloques conservan su `id` estable.
- [ ] Sin `X-API-Key` o con clave inexistente devuelve `401`; integración
      inactiva o revocada, `403`; `Origin` distinto al configurado, `403`.
- [ ] Una integración de una cuenta sólo ve páginas de esa cuenta y nunca
      borradores.
- [ ] La `url` de cada imagen responde `200` sin API key.

### 8. Cerrar aislamiento por cuenta y regresión

Verificar que el CMS no permite cruces entre cuentas y que la migración y los
endpoints nuevos no alteran el funcionamiento existente.

Criterios de aceptación:
- [ ] Leer, editar, publicar, despublicar, borrar o consultar imágenes de otra
      cuenta devuelve `404` en todos los casos.
- [ ] Referenciar en una página una imagen de otra cuenta devuelve `400` y no
      guarda nada.
- [ ] Dos cuentas pueden tener páginas con el mismo slug y cada integración
      pública ve sólo las suyas.
- [ ] Los borradores no son accesibles por ningún endpoint público ni
      adivinando el slug.
- [ ] La API pública no expone datos internos de la cuenta ni de otras cuentas.
- [ ] Los endpoints existentes de libros, colecciones, personas, tienda y
      pedidos siguen respondiendo igual; la migración no toca sus datos.
- [ ] Las pruebas automatizadas existentes siguen pasando.
