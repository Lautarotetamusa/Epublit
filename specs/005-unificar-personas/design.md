# Design: Unificar autores e ilustradores

Estado: aprobado por el usuario

## Historia

"Quiero unificar autores e ilustradores. Que el listado me permita filtrar
por rol. Y que el alta de personas te permita cargar la imagen, ahora solo
se puede después de que ya existe."

## Qué se construyó

### 1. Listado único con filtro por rol

- Antes había dos rutas (`/autores`, `/ilustradores`) que renderizaban el
  mismo `PersonasPage` con una prop `tipo` fija. Ahora hay una única ruta
  `/personas` (`front/src/App.tsx`) con un único ítem de sidebar "Personas"
  (`front/src/layout/AppLayout.tsx`, reemplaza los dos ítems "Autores" e
  "Ilustradores").
- `front/src/features/personas/PersonasPage.tsx` ya no recibe `tipo` por
  prop: administra su propio estado de filtro (`rol`: todos / autor /
  ilustrador) y se lo pasa a `usePersonas`. El control es un
  `SegmentedControl` del sistema de diseño, no `Tabs`: se probó primero con
  `Tabs` pero se veía demasiado chico/apretado para un filtro que decide qué
  trae el listado (no es un sub-tab de una misma ficha, que es el uso
  documentado de `Tabs`). `SegmentedControl` es justamente el componente que
  el sistema de diseño documenta para "un set chico y fijo de opciones
  excluyentes que conviene mostrar de entrada" (ver su `.prompt.md`, ejemplo
  literal "un filtro de estado") y tiene más peso visual (fondo sólido en la
  opción activa, altura de control completa). Va envuelto en un `Field` con
  label "Rol" para que se lea como filtro y no como navegación.
- `front/src/features/personas/usePersonas.ts` ahora acepta
  `tipo: TipoPersona | undefined` (antes obligatorio) — "todos" simplemente
  no manda el filtro. Sigue usando `GET /persona?tipo=...` tal cual existía;
  no se tocó esa llamada.
- `front/src/features/personas/tipoPersona.ts`: antes mapeaba tipo → título
  + ruta por sección (autores/ilustradores como secciones separadas). Ahora
  define `ROL_FILTRO_OPTIONS`, las opciones del filtro (Todos / Autores /
  Ilustradores).
- Rutas viejas: `/autores`, `/autores/nuevo`, `/autores/:id`,
  `/ilustradores`, `/ilustradores/nuevo`, `/ilustradores/:id` quedan como
  redirects a sus equivalentes en `/personas/...` (`front/src/App.tsx`),
  para no romper marcadores o links existentes. No hay razón de producto
  para mantenerlas activas: "autor"/"ilustrador" nunca fue un atributo
  propio de la persona, es un atributo de su participación en un libro
  puntual — mantener dos listados separados no reflejaba el dominio real.
- `front/src/features/personas/FichaPersonaPage.tsx` también perdió la prop
  `tipo`: el breadcrumb y los mensajes ahora dicen simplemente "Personas" /
  "Persona" en vez de "Autores"/"autor" o "Ilustradores"/"ilustrador".

### 2. Foto en el alta

Se aplicó el mismo patrón ya usado por `front/src/features/libros/NuevoLibroPage.tsx`
+ `useNuevoLibro.ts` para la portada de libro: elegir el archivo en el mismo
formulario de alta y subirlo en un segundo paso transparente, dentro del
mismo submit, una vez creada la persona.

- `front/src/features/personas/NuevaPersonaPage.tsx`: sumó un campo `Foto`
  (componente `PhotoUpload` del sistema de diseño, mismo que ya usa la
  ficha) antes de los campos existentes. El archivo elegido se guarda en
  estado local y se previsualiza con `useFilePreview` (hook nuevo,
  `front/src/lib/useFilePreview.ts` — extraído de la lógica que ya existía
  duplicada en `LibroFormFields.tsx` para la portada, por la regla DRY del
  proyecto; `LibroFormFields.tsx` se actualizó para reusarlo en vez de tener
  su propia copia).
- `front/src/features/personas/useNuevaPersona.ts`: `create` ahora recibe
  también el archivo de foto (puede ser `null`). Si hay archivo, lo guarda
  después de crear la persona, con el mismo criterio que
  `useNuevoLibro.create` (crear, y si hay archivo elegido, subirlo con el
  id recién creado). El guardado en sí sigue usando el mock en memoria de
  `personaFotoMock.ts` que ya traía la ficha (specs/004-persona-foto-bio):
  no hay endpoint real todavía, así que no era una decisión nueva de este
  diseño, sólo reusar la misma infraestructura mockeada.

No se tocó `PersonaFormFields.tsx` (los campos compartidos entre alta y
ficha): la foto se maneja aparte porque en la ficha se sube de inmediato
(ya existe la persona) y en el alta se guarda como archivo pendiente hasta
el submit — mismo comportamiento que ya tiene la portada de libro entre
`NuevoLibroPage` y `FichaLibroPage`.

### 3. Mismo layout para alta y ficha

Alta y ficha se veían distintas entre sí (foto arriba del formulario en una
vs. foto al costado en la otra, con markup propio cada una). Se extrajo
`front/src/features/personas/PersonaFormPanel.tsx`: un único componente de
layout, todo apilado en una sola columna — foto primero (dentro de un
`Field` "Foto"), debajo Nombre/Email/DNI/Biografía, debajo el botón de
guardar — que ahora usan las dos páginas — no hay dos implementaciones
parecidas, hay una sola que cada página llama con sus propios manejadores:

- `NuevaPersonaPage.tsx` le pasa un archivo pendiente (`fotoFile` en estado
  local, recién se guarda en el submit) y el submit crea la persona.
- `FichaPersonaPage.tsx` le pasa la `fotoUrl` ya guardada y un `onSelect`
  que sube de inmediato (`uploadFoto`); el submit sólo actualiza los datos
  de texto.

`PersonaFormPanel` no decide ninguna de esas dos políticas: sólo recibe los
callbacks y renderiza siempre igual, así que futuras pantallas de persona
heredan el mismo layout por construcción en vez de por copiarlo.

## Datos necesarios

Nada de lo de arriba pide una capacidad de API nueva más allá de lo que
`specs/004-persona-foto-bio/design.md` ya había dejado anotado (poder
guardar y quitar una foto de una persona ya creada). Esta iteración sólo
reordena cuándo se ofrece esa misma capacidad en la UI (durante el alta,
además de en la ficha) — sigue siendo el mismo dato: una foto asociada a
una persona por id.

Dos puntos que sí quedan para que el planner decida (no son diseño de UI):

- Si el filtro de rol en el listado sigue resolviéndose server-side con el
  `tipo` de query que ya existe (`GET /persona?tipo=...`), o si conviene
  otra estrategia — esta pantalla no cambia esa capacidad, sólo la forma en
  que se dispara (antes por ruta, ahora por un control de filtro en la
  misma pantalla).
- Si tiene sentido que la foto se pueda mandar en el mismo request que crea
  la persona en vez de en un segundo paso — la UI de este diseño está
  armada para funcionar con cualquiera de las dos (hoy simula el segundo
  paso porque es el único que probó con la portada de libro), así que es
  una decisión de API, no de esta pantalla.
