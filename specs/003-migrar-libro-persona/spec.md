# Spec: Migrar el módulo `libro_persona` a la nueva arquitectura

## Estado
Draft

## Resumen
Migrar la asociación entre libros y personas (autores/ilustradores, con su
porcentaje de participación en cada libro) de su implementación actual sobre
MySQL a la arquitectura Postgres que ya usan `user`, `persona` y `libro`.
Este feature es el que efectivamente crea, edita y borra por primera vez
filas reales en la relación libro-persona sobre Postgres; los módulos ya
migrados (`libro`, `persona`) sólo la leen o la limpian.

## Motivación / por qué
El orden de migración acordado es `user` -> `libro` -> `libro_persona`; los
dos primeros ya están migrados. `libro_persona` es la pieza que faltaba:
`POST /libro` se simplificó explícitamente para no crear ni asociar
autores/ilustradores, dejando esa responsabilidad exclusivamente para acá
(ver `specs/002-migrar-libro/spec.md`). Mientras este feature no exista, no
hay forma de asociar personas a un libro en la arquitectura nueva, aunque
`libro` y `persona` ya están preparados para leer esos datos.

## Alcance

### Incluye
- Asociar una o varias personas existentes a un libro, indicando para cada
  una su tipo (autor o ilustrador) y su porcentaje de participación
  (`POST /libro/:isbn/personas`). El endpoint acepta tanto un solo objeto
  como un array de objetos en el body (alta en lote).
- Editar el porcentaje de una o varias asociaciones existentes
  (`PUT /libro/:isbn/personas`), también aceptando un objeto único o un
  array.
- Quitar (desasociar) una o varias personas de un libro
  (`DELETE /libro/:isbn/personas`), también aceptando un objeto único o un
  array.
- Las validaciones de negocio equivalentes a las actuales: no asociar dos
  veces a la misma persona con el mismo libro, no asociar una persona que no
  existe, no editar una asociación que no existe.
- Que el aislamiento por usuario dueño se mantenga: sólo se puede
  asociar/editar/desasociar personas en libros propios, y sólo personas
  propias (del mismo usuario autenticado).

### No incluye
- Crear una persona nueva como parte de la asociación a un libro en el
  mismo request; hoy el código de estos tres endpoints sólo opera sobre
  personas que ya existen (identificadas por `id_persona`), aunque hay un
  esquema de validación (`createLibroPersona`) preparado para ese caso que
  no está conectado a ningún endpoint activo. Queda confirmado que queda
  fuera de este feature: se mantiene el comportamiento actual (sólo
  personas existentes).
- Cambiar el comportamiento observable de ningún endpoint (agregar
  funcionalidad nueva, cambiar validaciones existentes, cambiar formatos de
  respuesta) más allá de lo estrictamente necesario para reproducir el
  comportamiento actual sobre la arquitectura nueva, salvo la corrección
  explícita del porcentaje `0` en `PUT` descripta más abajo.
- Migrar ningún otro módulo (`liquidacion`, `cliente`, `transaccion`,
  `venta`); esos siguen en MySQL.
- Garantizar que los módulos todavía no migrados queden sin ningún impacto:
  como ya se decidió en migraciones anteriores (`user`, `libro`), el
  objetivo de esta etapa es avanzar la migración, no evitar a toda costa
  romper algo de lo que todavía no migró.

## Comportamiento esperado

- Como usuario autenticado, quiero asociar una o varias personas a un libro
  propio como autor/ilustrador con su porcentaje, para registrar quién
  participó en la obra y en qué medida.
  - Criterio de aceptación: `POST /libro/:isbn/personas` con un objeto (o
    array de objetos) válido `{id_persona, tipo, porcentaje}` responde 201
    y devuelve el libro junto con las asociaciones creadas.
  - Criterio de aceptación: si alguna persona indicada ya está asociada a
    ese libro (sin importar el tipo), la operación completa falla con un
    error de duplicado y no se crea ninguna asociación del lote (ni las que
    eran válidas).
  - Criterio de aceptación: si alguna persona indicada no existe (o no le
    pertenece al usuario autenticado), la operación completa falla con un
    error de "no encontrado" y no se crea ninguna asociación del lote.
  - Criterio de aceptación: el `isbn` de la URL debe corresponder a un
    libro propio y no eliminado; si no, responde con un error de "no
    encontrado" y no se crea nada.
  - Criterio de aceptación: el porcentaje debe estar en el rango 0-100; un
    valor fuera de ese rango responde 400 y no crea nada.

- Como usuario autenticado, quiero editar el porcentaje de una o varias
  personas ya asociadas a un libro propio, para corregir su participación.
  - Criterio de aceptación: `PUT /libro/:isbn/personas` con un objeto (o
    array de objetos) válido `{id_persona, tipo, porcentaje}` responde 201
    y devuelve el libro junto con las asociaciones actualizadas.
  - Criterio de aceptación: si alguna combinación persona+tipo indicada no
    está asociada a ese libro, la operación completa falla con un error de
    "no encontrado" y no se modifica ninguna asociación del lote.
  - Criterio de aceptación: `PUT /libro/:isbn/personas` con porcentaje `0`
    sí actualiza la asociación a `0` (a diferencia del código MySQL actual,
    que lo ignora por tratar `0` como "no enviado"); `0` es un valor válido
    del mismo rango 0-100 que ya acepta `POST`, y debe aplicarse igual que
    cualquier otro valor de ese rango.

- Como usuario autenticado, quiero quitar una o varias personas asociadas a
  un libro propio, para corregir asociaciones hechas por error o que ya no
  corresponden.
  - Criterio de aceptación: `DELETE /libro/:isbn/personas` con un objeto (o
    array de objetos) `{id_persona, tipo}` responde 200 y devuelve el libro
    junto con las asociaciones eliminadas; después de esto, esas personas
    dejan de figurar entre los autores/ilustradores del libro (`GET
    /libro/:isbn`) y el libro deja de figurar entre las obras de esas
    personas (`GET /persona/:id/libros`, si existe ese endpoint).
  - Criterio de aceptación: pedir eliminar una asociación que no existe no
    debe romper la request (comportamiento igual al actual: no valida
    existencia previa antes de borrar).

- Como usuario autenticado, quiero que estas operaciones sólo afecten
  libros y personas propias, para que un usuario no pueda alterar los datos
  de otro.
  - Criterio de aceptación: operar sobre un isbn que no existe, está
    eliminado, o pertenece a otro usuario responde con un error de "no
    encontrado" en los tres endpoints.
  - Criterio de aceptación: asociar una persona que pertenece a otro
    usuario responde con un error de "no encontrado" (se trata igual que
    una persona inexistente).

## Casos borde
- Enviar un solo objeto en el body (sin array) debe funcionar igual que
  enviar un array de un elemento, en los tres endpoints, igual que hoy.
- Un lote (`array`) donde parte de los elementos son válidos y parte no
  (duplicados, inexistentes, o sin asociación previa según el endpoint) no
  debe dejar nada aplicado a medias: falla la operación completa.
- Eliminar un libro (`DELETE /libro/:isbn`, ya migrado) desasocia todas sus
  personas como efecto de la baja; después de eso, `POST`/`PUT`/`DELETE
  /libro/:isbn/personas` sobre ese isbn deben comportarse como si el libro
  no existiera (error de "no encontrado"), igual que cualquier otra
  operación sobre un libro eliminado.
- Actualizar una asociación con porcentaje `0`: el código MySQL actual
  (`LibroPersona.update`) ignora la actualización cuando el porcentaje
  enviado es `0` (lo trata como "no enviado", por un chequeo de verdad en
  JS), por lo que hoy un `PUT` con porcentaje `0` no cambia nada aunque
  responda como si hubiera funcionado. Queda confirmado que esto se corrige
  en la migración: un `PUT` con porcentaje `0` debe aplicar el cambio como
  cualquier otro valor válido del rango 0-100.

## Datos existentes / integraciones a tener en cuenta
- La relación vive en `libros_personas`, con clave `(id_libro, id_persona,
  tipo)`: una misma persona puede estar asociada a un mismo libro dos veces
  sólo si es con tipos distintos (autor e ilustrador a la vez), pero nunca
  duplicada con el mismo tipo. La validación de "ya está asociada" al crear
  ignora el tipo (ver criterio de aceptación de `POST`), igual que hoy.
- `libro.service.ts` (`getPersonas`) ya lee de esta relación para mostrar
  autores/ilustradores en `GET /libro/:isbn`, y `removeLibro` ya limpia
  estas filas al eliminar un libro; este feature es el primero en escribir
  datos reales ahí, así que conviene verificar que ambas lecturas sigan
  funcionando igual una vez que empiece a haber filas.
- `persona.service.ts` (`getAllByTipo`, `getLibros`) también lee de esta
  relación (para listar personas por tipo y para listar los libros de una
  persona); no necesita cambios propios para este feature, pero sus
  resultados van a reflejar por primera vez datos reales una vez que este
  feature esté escribiendo asociaciones.
- El aislamiento por usuario dueño debe verificarse en dos puntos: el libro
  (`isbn` de la URL) y cada persona referenciada (`id_persona` del body),
  igual que hacen hoy `Libro.getByIsbn` y `Persona.all_exists` en el código
  MySQL.
- `libro` y `persona` ya migrados son la referencia de patrón (servicios
  con `ServiceBuilder`/bradb, validadores con zod, aislamiento por `user`).

## Preguntas abiertas
Ninguna pendiente: la creación de personas nuevas "al vuelo" al asociarlas
a un libro queda confirmada fuera de este feature (ver "No incluye"); el
comportamiento del porcentaje `0` en `PUT` queda confirmado como una
corrección, no como algo a mantener igual (ver "Comportamiento esperado" y
"Casos borde"); y no hace falta agregar ningún criterio de aceptación
sobre un eventual `GET /persona/:id/libros`, que no existe como ruta HTTP
hoy.
