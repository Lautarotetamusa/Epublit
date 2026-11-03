# 018 — Tienda Feria conectada al backend real

## Estado verificado (02/11/2026)

- **Back** en `localhost:3001` (nodemon), DB `epublit` en Docker (`epublit-postgresdb-1`).
- **API pública ya existe** (`/public/tienda/v1`, specs/016):
  - `GET /config`
  - `GET /libros?buscar=&pagina=&porPagina=`
  - `GET /libros/:isbn`
  - `POST /cotizar`, `POST /pedidos`, `GET /pedidos/:codigo`, `POST /pedidos/:codigo/pago|cancelar`
  - Auth por **API key** (`X-API-Key`) + integración activa. Sin `Origin` (server-to-server)
    se acepta; con `Origin` tiene que coincidir con el de la integración.
- **Login del panel** probado: `libreria_sur` / `seed12345`.
- **Catálogo actual de `libreria_sur`**: 12 libros genéricos, 3 colecciones vacías,
  6 personas, roles `autor`/`ilustrador`, depósito principal. Tiene 2 integraciones del
  seed (origen `https://tienda.ejemplo.com`), pero la API key no se puede recuperar: sólo
  se guarda el hash.
- **Serializer público actual**: `isbn`, `titulo`, `precio`, `portadaUrl`,
  `disponibleParaVenta`, `enStock` y `personas` (nombre/rol/foto/bio). **No** expone
  `brief`, páginas, medidas, año, edad, trailer ni colección.
- **Tienda Feria (Astro)** en `Thorque/librossilvestres`: usa `src/data/catalogo.ts` con
  19 libros reales, 6 colecciones, tapas en `public/img/tapas` e interiores en
  `public/img/ilustraciones`.

## Objetivo

Que `/feria` lea del back real el catálogo, las fichas, las colecciones, precios, stock y
portadas, y cargar el catálogo real (19 libros) en la cuenta de la tienda.

## Decisiones propuestas (a confirmar)

1. **Cuenta**: reusar `libreria_sur` (la única con depósito, roles e integración de
   tienda ya armados) y reemplazar su catálogo demo por el de Libros Silvestres. Una
   cuenta nueva `libros_silvestres` obliga a un script de back que cree el usuario con
   AFIP mock; queda para producción.
2. **Import**: script **HTTP** contra la API con el token del panel. No toca código del
   back; usa los mismos endpoints que usaría un cliente real.
3. **Back**: sólo dos cambios de código: completar el serializer público y agregar
   `GET /colecciones`. **Búsqueda y filtros quedan client-side** sobre los 19 libros, que
   es lo que ya hace la tienda; no hace falta tocar filtros ni migrar nada.
4. **Front**: pasar Feria a **SSR** (`@astrojs/node`) para que precios y stock sean
   vivos; `/`, `/collage` y `/viento` quedan `prerender`.
5. **Checkout**: fuera de alcance de esta fase (la API ya lo tiene; se conecta después).

---

## Back — cambios de código (requieren aprobación)

### B1. Serializer público completo

`src/modules/tienda/catalog/catalog.serializer.ts`

- **Listado** (`toBookSummary`), agregar:
  - `coleccion: { id, titulo } | null`
  - `edadMin: number | null`, `edadMax: number | null`
  - `fechaEdicion: string` (ISO `YYYY-MM-DD`)
  - `novedad: boolean` (los 3 últimos libros creados)
- **Detalle** (`toBookDetail`), agregar además:
  - `brief: string | null`
  - `paginas: number | null`
  - `alto`, `ancho`, `largo: number | null`
  - `bookTrailerUrl: string | null`
- Mantener fuera: porcentajes, montos, email, DNI, stock por depósito, datos fiscales.

Criterios de aceptación:
- [ ] `GET /public/tienda/v1/libros` devuelve los campos nuevos por libro.
- [ ] `GET /public/tienda/v1/libros/:isbn` devuelve ficha completa + personas con rol.
- [ ] No aparece ningún campo interno en las respuestas.
- [ ] Tests existentes del catálogo público siguen verdes.

### B2. Endpoint de colecciones

- `GET /public/tienda/v1/colecciones` →
  `{ colecciones: [{ id, titulo, descripcion, portadaUrl, cantidadLibros }] }`
- Sólo colecciones activas de la cuenta de la integración.
- Inyectar `coleccionService` en `createTiendaModule` (el `container` ya lo tiene) y
  usarlo desde `catalog.service.getCollections`.

Criterios de aceptación:
- [ ] Sin API key → 401.
- [ ] Con API key → 200 con las 6 colecciones reales, contadas.
- [ ] `portadaUrl` es una URL navegable de `/files`.

Sin migraciones: todos los campos ya existen en `libros`/`colecciones`.

---

## Back — datos (sin tocar código)

### B3. Import del catálogo real (script HTTP)

Script `Thorque/librossilvestres/scripts/importar-catalogo.mjs` (corre con Node, no
levanta nada):

1. Login `POST /user/login` (`libreria_sur`) → token.
2. **Baja del demo**: `DELETE /libro/:isbn` para los 12 libros genéricos y
   `DELETE /coleccion/:id` para las 3 colecciones vacías.
3. **Colecciones**: `POST /coleccion` para las 6 del catálogo (`La vertical`, `Ñu`,
   `Mediomundo`, `Serie ¡Tarumba!`, `Serie Picuí`, `Una cosa maravillosa`) +
   `POST /coleccion/:id/portada` con los logos PNG de `public/img/colecciones`.
4. **Personas**: `POST /persona` por cada autor/a e ilustrador/a único (nombre, DNI
   determinístico, email). Reusar si ya existe.
5. **Libros**: `POST /libro` con `isbn` (sin guiones), título, `fecha_edicion`
   (`anio-01-01`), precio, `coleccion_id`, `brief` (sinopsis), `paginas`, `alto`,
   `ancho`, `edad_min`/`edad_max` (bandas: 0–5, 6–8, 9–12, 13+),
   `book_trailer_url` si existe.
6. **Personas del libro**: `POST /libro/:isbn/personas` con el rol `autor`/`ilustrador`
   (ids de `GET /rol`) y `porcentaje: 0`.
7. **Portadas**: `POST /libro/:isbn/portada` (multipart) con `public/img/tapas/*`.
8. **Stock**: `POST /movimiento` exterior → depósito principal, 20 ejemplares por libro,
   para que `disponibleParaVenta` sea > 0.
9. **Integración**: `POST /integraciones` `{ nombre: "Tienda Feria local", origen:
   "http://localhost:4321" }`; guardar la API key en `Thorque/librossilvestres/.env`.

Idempotente: si un ISBN ya existe, se saltea/actualiza; si la colección existe, se reusa;
si la portada ya está, no se vuelve a subir.

Criterios de aceptación:
- [ ] `GET /public/tienda/v1/libros?porPagina=100` devuelve exactamente 19 libros, sin
      los 12 genéricos.
- [ ] Los 19 tienen portada, personas con rol y stock > 0.
- [ ] Las 6 colecciones aparecen con su cantidad y logo.
- [ ] La API key nueva funciona con `Origin: http://localhost:4321`.

### B4. Integración/API key

- La integración se crea en B3. La key va a `.env` (no se commitea, no se imprime en
  logs). Sin `Origin` desde el server de Astro también funciona.

---

## Front — cambios

### F1. Cliente + tipos + mapper

- `.env` / `.env.example`:
  `TIENDA_API_URL=http://localhost:3001/public/tienda/v1`, `TIENDA_API_KEY=...`.
- `src/lib/tienda/client.ts`: `getLibros()` (`porPagina=100`), `getLibro(isbn)`,
  `getColecciones()`; header `X-API-Key`; `cache: "no-store"`; errores claros.
- `src/lib/tienda/types.ts`: `TiendaLibro`, `TiendaColeccion`, `TiendaPersona`.
- `src/lib/tienda/mapper.ts`: API → modelo de Feria:
  - `tapa` = `portadaUrl` (fallback local por ISBN);
  - `autor`/`ilustrador` desde `personas[].rol`;
  - `coleccion` = `{ id, titulo }` + slug/logo/color local (mapa por título);
  - `lector` = banda derivada de `edadMin` (specs/019); `edadTexto` = rango
    `edadMin`/`edadMax` ("De 6 a 8 años", "A partir de 13 años", "Todas las edades");
  - `ficha` = `ancho × alto`, páginas, ISBN, año;
  - `sinopsis` = `brief`;
  - `novedad` = flag de la API (los 3 últimos libros creados, `id_libro` desc);
  - `interiores` = mapa local por ISBN (el back no los tiene todavía).

### F2. SSR

- `astro.config.mjs`: `output: "server"` + `@astrojs/node` (`mode: "standalone"`).
- `/`, `/collage`, `/viento`: `export const prerender = true` para que sigan estáticas.
- Feria (`/feria`, `/feria/catalogo`, `/feria/libros/[isbn]`) renderiza por request.

### F3. Páginas

- `feria/index.astro`: libros y colecciones desde la API; novedades, mural y contadores
  calculados con los datos reales.
- `feria/catalogo.astro`: fetch de los 19; el filtro/búsqueda client-side actual se
  mantiene (colección por id, edad por banda, año, precio, orden).
- `feria/libros/[slug].astro` → `[isbn].astro`: fetch por ISBN; ficha completa; galería
  local; “otros” por colección/ilustrador.
- `feria/Tarjeta.astro`: props del modelo nuevo; links por ISBN.
- Carrito: la clave pasa a ser el ISBN; los links del drawer apuntan a
  `/feria/libros/<isbn>`. El checkout sigue como está (email/placeholder).

### F4. Env / seguridad

- `.env` en `.gitignore`; la API key no se expone al cliente (sin prefijo `PUBLIC_`).
- El fetch es server-side (SSR); no hace falta CORS para el navegador.

---

## Verificación

- Back: curl a `/public/tienda/v1/libros`, `/libros/:isbn`, `/colecciones` con la key.
- Front: `/feria`, `/feria/catalogo` (filtros y búsqueda), `/feria/libros/<isbn>`,
  carrito, mobile.
- Datos: 19 libros, 6 colecciones, portadas desde `:3001/files`, stock visible.
- Las versiones `/`, `/collage` y `/viento` siguen funcionando.

## Checkout (implementado en esta fase)

- `/feria/checkout`: carrito desde localStorage, datos del comprador, retiro/envío,
  cotización, resumen y pago.
- `/feria/pedido/retorno`: estado del pedido, ítems, totales, entrega, pago y
  reintento de pago.
- Proxy server-side `/api/tienda/{cotizar, pedidos, pedidos/[codigo],
  pedidos/[codigo]/pago}`: la API key queda en el servidor, nunca en el navegador.
- Alta de pedido con `Idempotency-Key`, reserva de stock, snapshot y preferencia de
  MercadoPago; la referencia del comprador se guarda en localStorage para consultar
  y reintentar el pago.
- Requiere **MercadoPago conectado** en la cuenta (se quitó la conexión fake del seed)
  y, para envío, **MiCorreo/PAQ configurados**. El retiro funciona sin correo.
- La cuenta sigue mostrando la dirección/horario de retiro del seed (“Librería Sur”);
  se cambia desde el panel de la tienda.

## Fuera de alcance

- Cobro real en producción: requiere conectar la cuenta de MercadoPago y configurar
  MiCorreo/PAQ.AR.
- Imágenes interiores en la base (se mantiene el mapa local por ISBN).
- Sinopsis en inglés (`sinopsisEn`) y campo “edición”: no existen en el schema; se
  mantiene un mapa local o se omiten.
- Cuenta propia `libros_silvestres` y despliegue de producción.

## Decisiones tomadas

1. Cuenta: `libreria_sur` (se reemplazó su catálogo demo).
2. B1 + B2 + import aprobados e implementados.
3. SSR para Feria; `/`, `/collage` y `/viento` quedan prerender.
4. Checkout implementado en esta fase (UI + proxy + alta de pedido); el cobro real
   queda sujeto a conectar MercadoPago.

4. ¿Confirmás que checkout queda para la próxima fase?
