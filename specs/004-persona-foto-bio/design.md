# Design: Foto y biografía de autores/ilustradores

Estado: aprobado por el usuario

## Historia

Cada persona (autor/ilustrador) debe tener una foto y una biografía.

## Qué se construyó

Hoy `Persona` sólo tenía nombre, email y DNI, y no existía ninguna ficha de
detalle (sólo listado + alta + gestión dentro del libro). Agregar foto y
biografía necesita más espacio del que hay en una fila de tabla o en un
diálogo chico, así que se sumó una **ficha de persona nueva**
(`/autores/:id` y `/ilustradores/:id`), con el mismo criterio que ya existe
para clientes (`/clientes/:id`) y libros (`/libros/:isbn`).

Archivos principales:
- `front/src/features/personas/FichaPersonaPage.tsx` — ficha nueva: foto
  (`PhotoUpload`) + formulario editable (nombre, email, DNI, biografía).
  Ruteada por tipo, igual que el resto de las pantallas de persona.
- `front/src/features/personas/PersonaFormFields.tsx` — campos
  compartidos por la ficha y el alta (nombre, email, DNI, biografía),
  extraídos para no duplicar la validación entre las dos pantallas.
- `front/src/features/personas/NuevaPersonaPage.tsx` — suma el campo
  Biografía al alta. La foto no se pide acá: se sube recién en la ficha,
  una vez que la persona ya existe (ver "Datos necesarios"); por eso el
  alta ahora navega a `/autores/:id` (o `/ilustradores/:id`) en vez de al
  listado.
- `front/src/features/personas/PersonasPage.tsx` — el listado suma una
  columna con la foto (o `Avatar` con iniciales si no tiene) como primera
  columna, y las filas son clickeables y navegan a la ficha (mismo patrón
  que `CatalogoPage`).
- `front/src/features/personas/useFichaPersona.ts` — trae/actualiza la
  persona y orquesta la subida de la foto.
- `front/src/api/persona.ts` — `Persona`/`CreatePersonaInput` extendidos
  con `fotoUrl` y `bio` (ver "Datos necesarios").
- `front/src/features/personas/personaFotoMock.ts` — mock temporal en
  memoria para la foto (ver "Datos necesarios"; el backend hoy no tiene
  dónde guardarla).
- `front/src/design-system/components/forms/PhotoUpload.jsx` (+ `.d.ts`,
  `.prompt.md`) — componente nuevo del sistema de diseño: selector de
  imagen con marcador circular (96×96), mismo patrón de interacción que
  `CoverUpload` pero con la forma circular que corresponde a una foto de
  persona en vez de una tapa de libro — no exige que la imagen elegida sea
  cuadrada (ver "Decisiones de formato"). Recibe el tamaño máximo y la
  resolución mínima como props (`maxSizeMb`, `minWidthPx`, `minHeightPx`),
  no fijos en el componente — ver "Restricciones configurables" más abajo.
  Sumado al barrel (`design-system/index.ts`).
- `front/src/features/personas/useFotoPersonaConfig.ts` — hook de lectura
  de esa configuración, para que `FichaPersonaPage` sepa qué límites
  pasarle a `PhotoUpload`.
- `front/src/features/perfil/PerfilPage.tsx` — suma la tarjeta
  "Restricciones de fotos", donde la editorial edita esos límites (ver
  "Restricciones configurables").
- `front/src/api/user.ts` — `User`/`UpdateUserInput` extendidos con
  `fotoPersonaMaxSizeMb`, `fotoPersonaMinAnchoPx`, `fotoPersonaMinAltoPx`.

Rutas para ver la pantalla: `/autores` y `/ilustradores` (listado, con la
columna de foto nueva), `/autores/nuevo` y `/ilustradores/nuevo` (alta, con
el campo de biografía nuevo), `/autores/:id` y `/ilustradores/:id` (ficha
nueva, con foto y biografía).

### Decisiones de formato

- **Ficha de detalle nueva**: se evaluó sumar foto y bio directamente al
  alta y al listado existentes, pero la biografía necesita espacio para
  leerse y editarse cómodamente, y hoy no había ningún lugar para eso ni
  para editar una persona ya creada (sólo se podía crear y borrar). La
  ficha resuelve ambas cosas con el mismo patrón que ya usan clientes y
  libros.
- **Biografía**: `Textarea` de 5 filas, sin límite de caracteres impuesto
  en el front, igual criterio que el brief de libro.
- **Foto**: marcador circular, 96×96, mismo patrón de click/drag&drop que
  `CoverUpload` (portada de libro) pero con forma circular en vez de
  vertical — ver el brief de marca en `design-system/readme.md` (radios:
  "pill exclusivamente en avatares"). Sin foto, el listado usa el
  `Avatar` de iniciales que ya existe en el sistema de diseño; en la ficha,
  el marcador vacío de `PhotoUpload` usa un ícono en vez de iniciales.
- **Foto que no es cuadrada**: no se pide que la imagen sea cuadrada ni se
  ofrece una herramienta de recorte antes de subir. `PhotoUpload` usa
  `object-fit: cover` para centrar y recortar visualmente cualquier
  proporción dentro del marcador circular — mismo criterio que ya usa
  `CoverUpload` con la portada de libro (tampoco exige la proporción
  vertical exacta, simplemente recorta al mostrarla). Es el recorte más
  simple y sin fricción para quien carga la foto; si en el futuro hace
  falta que la persona vea y ajuste el encuadre antes de guardar (recorte
  manual), es una mejora aparte, no algo que haga falta para esta
  historia. El recorte es sólo visual en el front: el archivo original se
  manda entero, sin recortar, a donde lo reciba el backend.
- **Alta en dos pasos**: igual que la portada de libro, la foto se sube
  después de crear la persona, nunca en el mismo paso — por eso el alta
  ahora redirige a la ficha en vez de al listado. Esto es un hecho del
  flujo de UI (la foto necesita una persona ya creada), no una preferencia
  de implementación.
- **Diálogo "Nueva persona" dentro de la ficha de libro**
  (`PersonasLibroSection`): se dejó sin foto ni biografía a propósito. Es
  un alta rápida en un modal, pensada para cargar lo mínimo y seguir
  cargando el libro; si hace falta completar la foto o la bio, se hace
  después desde la ficha de la persona.
- **Restricciones configurables (tamaño máximo, resolución mínima)**: no
  quedan fijas en `PhotoUpload` — se editan desde Perfil (tarjeta
  "Restricciones de fotos", con un diálogo de edición igual al que ya usa
  "Editar perfil") y `PhotoUpload` las recibe como props opcionales
  (`maxSizeMb`, `minWidthPx`, `minHeightPx`). Sin configurar, el
  componente no rechaza nada. Cuando el archivo elegido no cumple, el
  componente no llama a `onSelect`: llama a `onRejected` con un mensaje ya
  redactado ("El archivo pesa más de 5 MB.", "La imagen tiene que medir
  al menos 400×400px.") y quien lo integra decide cómo mostrarlo — en la
  ficha de persona, como toast de error. Cualquiera de los tres valores
  puede dejarse vacío ("Sin límite"); no hace falta configurar los tres.
  Esta validación es sólo del lado del cliente (lee el peso del archivo y
  las dimensiones reales de la imagen antes de aceptarla) — no reemplaza
  una validación real del lado del servidor, que el planner tiene que
  decidir si hace falta.

## Datos necesarios

Ningún campo de esta historia existe hoy en el tipo `Persona` del front ni
en la tabla real del backend. Cómo se exponen (rutas, forma del
request/response, mecanismo de storage) lo decide el planner; acá sólo la
capacidad que necesita la pantalla.

### 1. Cargar y mostrar una biografía por persona

Una persona tiene que poder cargar (al crear o editar) y devolver (en
listado y detalle) un campo de biografía: texto largo, opcional, sin límite
fijo impuesto por el front.

### 2. Poder asociar una foto a una persona (la parte ambigua)

- La pantalla necesita que la persona **ya exista** antes de poder
  asociarle la foto — el flujo es "primero se crea la persona con sus
  datos, después se le agrega la foto", igual que la portada de libro. Es
  un hecho del flujo de UI: el mock de esta pasada no tiene ninguna otra
  forma de probarlo (la foto se guarda en memoria del navegador, se
  pierde al recargar).
- Tipo de archivo: el selector sólo deja elegir imágenes
  (`image/png`/`image/jpeg`). El front sí valida el peso y la resolución
  antes de mandar el archivo (a diferencia del criterio que usa la
  portada de libro) usando la configuración de la capacidad #3 — pero es
  sólo una validación de cliente, no hay que confiar sólo en ella.
- Reemplazo: cargar una foto nueva sobre una persona que ya tenía tiene
  que reemplazarla, no acumularse.
- Poder quitar la foto de una persona que ya tenía una guardada (a
  diferencia de la portada de libro, acá el botón "Quitar" de la ficha sí
  dispara la acción de sacarla, con una confirmación — no es sólo limpiar
  una selección local todavía no guardada, porque en la ficha la foto ya
  está persistida).
- Mientras una persona no tiene foto cargada, el listado y la ficha tienen
  que poder representar "sin foto" (el front ya maneja ese estado con las
  iniciales de la persona en el listado, y con un ícono en la ficha).

El proyecto ya tiene un patrón de subida de archivos con reemplazo (la
portada de libro, ver `specs/003-libro-campos-extendidos/design.md`) que el
planner puede evaluar si le sirve de referencia para esta misma capacidad
aplicada a personas — no es una propuesta cerrada de esta pasada.

### 3. Poder leer y actualizar la configuración de restricciones de foto

La pantalla de Perfil necesita poder leer y actualizar tres valores,
editables por la editorial, que después se usan para validar la foto de
persona antes de subirla:

| Campo | Tipo | Notas |
| --- | --- | --- |
| Tamaño máximo del archivo | decimal, MB | opcional; vacío es "sin límite" |
| Ancho mínimo de la imagen | entero, px | opcional; vacío es "sin límite" |
| Alto mínimo de la imagen | entero, px | opcional; vacío es "sin límite" |

Es configuración de la editorial (mismo dueño que el resto de los datos de
Perfil: CUIT, email, punto de venta), no algo por persona ni por foto
puntual. No es una propuesta de cómo guardarla (podría ser parte del mismo
registro de usuario/editorial que ya existe, o una entidad de
configuración aparte) — eso lo decide el planner con el contexto real del
schema.

Agent: abc5ebf8e69737c06
