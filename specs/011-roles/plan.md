# Plan: Roles por cuenta

## Historia

Hoy el rol de una persona en un libro es un valor fijo (`autor` | `ilustrador`)
guardado en la relación libro↔persona. Se quiere que el rol sea una entidad
propia de cada cuenta, con nombre editable y baja lógica, para poder cargar,
listar, editar y eliminar roles; que la relación libro↔persona apunte al rol
(no copie el nombre, para que renombrar se refleje en todas las personas); que
al asignar una persona a un libro se elija el rol desde esa lista por cuenta;
que el listado de personas se filtre por rol; y que el detalle del libro siga
mostrando sus personas con su rol. `autor` e `ilustrador` se crean por defecto
en cada cuenta. No se puede borrar un rol que tiene personas asignadas.

## Diseño de API

### Roles de la cuenta

Análogo a medios de pago (`specs/010-medios-pago`).

- `GET /rol/` → `200` → `[ { id, nombre } ]` — sólo los roles **activos** de la
  cuenta autenticada.
- `POST /rol/` — body `{ nombre }` → `201` → `{ id, nombre }`.
- `PUT /rol/:id` — body `{ nombre }` → `200` → `{ id, nombre }`.
- `DELETE /rol/:id` — **baja lógica** (no se borra) → `200`.

Las respuestas de escritura de roles usan el sobre estándar del proyecto
(`{ success, data }`), con el rol creado o actualizado en `data` — igual que
medios de pago. El front asume ese sobre tal cual. Los roles por defecto
(`autor`, `ilustrador`) se guardan en minúscula; el front los capitaliza al
mostrar.

Errores:

- `400` nombre vacío o sólo espacios.
- `409` nombre ya usado por otro rol **activo** de la cuenta, comparando sin
  distinguir mayúsculas de minúsculas (`Autor` y `autor` no pueden coexistir).
- `409` dar de baja un rol **en uso**: lo usa al menos un libro activo con una
  persona activa (la baja no se aplica). Si sólo lo referencian libros o
  personas ya dados de baja, la baja se aplica.
- `404` id inexistente, de otra cuenta, o ya dado de baja.

### Asignación de personas a un libro

`POST /libro/:isbn/personas`, `PUT /libro/:isbn/personas` y
`DELETE /libro/:isbn/personas`: el dato que hoy identifica el rol con uno de
los dos valores fijos pasa a ser el **id** del rol de la cuenta. `400` si falta
o es inválido; `404` si el rol es inexistente, de otra cuenta o está dado de
baja. Una misma persona no puede quedar dos veces con el mismo rol en el mismo
libro (la terna libro + persona + rol es única).

### Detalle del libro

`GET /libro/:isbn` deja de partir las personas en dos arreglos fijos (uno por
cada valor del enum) y pasa a una **única lista** de las personas del libro;
cada una trae su rol de la cuenta como `{ id, nombre }`, leído del rol y no de
un valor copiado en la relación. Renombrar el rol cambia lo que muestran todas
las personas que lo usan, sin reasignar la relación.

`GET /persona/:id` (la ficha de la persona) muestra cada libro de la persona
con su rol como `{ id, nombre }`, con el mismo criterio.

### Filtro de personas por rol

`GET /persona?rol=<id>` devuelve las personas que participan de al menos un
libro con ese rol de la cuenta. `GET /persona` sin filtro sigue devolviendo
todas. `400` si el valor no es una referencia válida a un rol de la cuenta. El
filtro por los valores fijos anteriores (`tipo=autor` / `tipo=ilustrador`) deja
de usarse: el front pasa a filtrar por el id del rol de la cuenta.

### Liquidación

`GET /liquidacion`: cada línea del detalle por persona deja de exponer el valor
fijo de rol (`autor` / `ilustrador`) y expone el **rol de la cuenta**
(`{ id, nombre }`) con el que esa persona participa de ese libro. La liquidación
incluye **todos** los roles de la cuenta, no sólo los dos fijos. La lectura de
base ya trae todas las filas de la relación libro↔persona sin filtrar por rol:
cambia qué identifica al rol (el rol de la cuenta, leído por id), no qué filas
entran. Renombrar un rol cambia el nombre que muestra la liquidación sin tocar
las líneas. El resto de la respuesta (personas, total a pagar, agrupación por
libro, porcentajes e importes) no cambia.

## Tareas

### 1. Roles por defecto al registrar una cuenta nueva
Cada cuenta nueva arranca con los roles `autor` e `ilustrador`.

Criterios de aceptación:
- [ ] Al registrar una cuenta nueva quedan exactamente los roles activos `autor` e `ilustrador`.
- [ ] Los roles por defecto de una cuenta nueva no aparecen al operar con otra cuenta.

### 2. Roles por defecto para las cuentas existentes (migración)
Las cuentas ya cargadas reciben los mismos roles por defecto al aplicar la migración.

Criterios de aceptación:
- [ ] Tras aplicar la migración, cada cuenta existente tiene los roles `autor` e `ilustrador`.
- [ ] Ninguna cuenta existente queda sin roles.
- [ ] Correr la migración dos veces no duplica roles en ninguna cuenta.

### 3. Re-apuntar las relaciones libro↔persona al rol de su cuenta (migración)
Cada relación libro↔persona ya cargada pasa de guardar el valor fijo a referenciar el rol correspondiente de su cuenta.

Criterios de aceptación:
- [ ] Cada relación libro↔persona existente queda ligada al rol de su cuenta con el mismo nombre que tenía el valor fijo anterior.
- [ ] Cada relación conserva su libro, su persona y su porcentaje.
- [ ] Los roles por defecto de la cuenta quedan referenciados por las relaciones migradas (no se pierde ninguna relación).
- [ ] Una relación nueva ya no puede tomar un valor del conjunto fijo anterior: los roles sólo salen de los de la cuenta.
- [ ] Correr la migración dos veces no duplica ni pierde relaciones ni cambia su rol.

### 4. Listar los roles de la cuenta
La cuenta puede ver sus roles activos, que es lo que consumen los formularios.

Criterios de aceptación:
- [ ] `GET /rol/` devuelve sólo los roles activos de la cuenta, cada uno con id y nombre.
- [ ] Un rol dado de baja no aparece en `GET /rol/`.
- [ ] `GET /rol/` de un usuario nunca incluye roles de otra cuenta.
- [ ] Una cuenta recién creada lista sus roles `autor` e `ilustrador`.

### 5. Crear un rol
Agregar un rol nuevo con nombre, con las validaciones del contrato.

Criterios de aceptación:
- [ ] `POST /rol/` con un nombre válido devuelve 201 con el rol creado (id y nombre).
- [ ] El rol creado aparece en `GET /rol/` y queda disponible para asignar personas.
- [ ] `POST /rol/` sin nombre, o con nombre vacío o sólo espacios, devuelve 400.
- [ ] `POST /rol/` con un nombre ya usado por un rol activo de la cuenta devuelve 409.
- [ ] `POST /rol/` con un nombre que sólo difiere en mayúsculas de uno activo (ej. `Autor` cuando existe `autor`) también devuelve 409.
- [ ] `POST /rol/` con un nombre igual al de un rol dado de baja de la misma cuenta devuelve 201.
- [ ] Un usuario no puede crear roles en la cuenta de otro.

### 6. Editar (renombrar) un rol
Cambiar el nombre de un rol activo de la cuenta, reflejándose en todas las personas que lo usan.

Criterios de aceptación:
- [ ] `PUT /rol/:id` con un nombre válido devuelve 200 con el rol actualizado.
- [ ] Tras renombrar, el nombre nuevo aparece en todas las personas/libros que usaban ese rol, sin tocar cada relación.
- [ ] Editar el nombre a vacío o sólo espacios devuelve 400; a un nombre ya usado por otro rol activo devuelve 409 (también si sólo difiere en mayúsculas).
- [ ] `PUT /rol/:id` con id inexistente, de otra cuenta o de un rol dado de baja devuelve 404.

### 7. Dar de baja un rol (baja lógica)
El rol deja de estar disponible pero no se pierde; no se puede dar de baja mientras lo use un libro activo con una persona activa.

Criterios de aceptación:
- [ ] `DELETE /rol/:id` da de baja el rol y devuelve 200.
- [ ] Tras la baja, el rol no aparece en `GET /rol/` ni queda disponible para asignar personas.
- [ ] `DELETE /rol/:id` sobre un rol que usa al menos un libro activo con una persona activa devuelve 409 y no lo da de baja.
- [ ] `DELETE /rol/:id` sobre un rol que sólo referencian libros o personas ya dados de baja devuelve 200 y lo da de baja.
- [ ] `DELETE /rol/:id` con id inexistente, de otra cuenta o ya dado de baja devuelve 404.

### 8. Asignar una persona a un libro con un rol de la cuenta
El alta y la edición de las personas de un libro eligen el rol desde la lista de la cuenta.

Criterios de aceptación:
- [ ] `POST /libro/:isbn/personas` con la persona y el id de un rol de la cuenta asocia la persona al libro con ese rol.
- [ ] El detalle del libro muestra esa persona con el nombre del rol elegido.
- [ ] `POST /libro/:isbn/personas` sin el rol devuelve 400.
- [ ] `POST /libro/:isbn/personas` con un rol inexistente, de otra cuenta o dado de baja devuelve 404.
- [ ] `PUT /libro/:isbn/personas` puede cambiar el rol de una persona ya asociada al libro.
- [ ] Asignar dos veces la misma persona con el mismo rol en el mismo libro no crea un duplicado.
- [ ] La misma persona puede tener roles distintos en el mismo libro.

### 9. Quitar una persona de un libro por su rol
La baja de una persona de un libro identifica la relación por su rol de la cuenta.

Criterios de aceptación:
- [ ] `DELETE /libro/:isbn/personas` con la persona y el rol quita esa relación.
- [ ] El detalle del libro deja de mostrar esa persona con ese rol.
- [ ] Quitar una persona con un rol no borra la persona ni sus otros roles en el libro.
- [ ] `DELETE /libro/:isbn/personas` con un rol que esa persona no tiene asignado en el libro devuelve 404.

### 10. Filtrar el listado de personas por rol
El listado de personas se filtra por el rol de la cuenta.

Criterios de aceptación:
- [ ] `GET /persona?rol=<id>` devuelve sólo las personas que participan de al menos un libro con ese rol de la cuenta.
- [ ] `GET /persona` sin filtro sigue devolviendo todas, incluidas las que no tienen ningún libro.
- [ ] `GET /persona?rol=<valor que no es un rol de la cuenta>` devuelve 400.
- [ ] Un rol de otra cuenta no filtra ni expone personas ajenas.

### 11. Detalle del libro con las personas y su rol (una sola lista)
El detalle del libro deja de partir las personas en dos arreglos fijos y pasa a una única lista, cada una con su rol de la cuenta.

Criterios de aceptación:
- [ ] `GET /libro/:isbn` expone las personas del libro en una única lista, ya no en dos arreglos fijos separados.
- [ ] Cada persona de la lista trae su rol de la cuenta como `{ id, nombre }`.
- [ ] Una persona con distintos roles en el libro aparece en la lista con cada rol correspondiente.
- [ ] Renombrar un rol cambia el nombre que muestra el detalle del libro, sin reasignar la relación.
- [ ] Los campos restantes de cada persona (identificación, nombre, email, DNI, porcentaje) y del detalle del libro no cambian.

### 12. Ficha de la persona con sus libros y el rol
La ficha de la persona sigue mostrando los libros en los que participa, ahora con el rol de la cuenta.

Criterios de aceptación:
- [ ] `GET /persona/:id` muestra cada libro de la persona con su rol como `{ id, nombre }`.
- [ ] Renombrar un rol cambia el nombre que muestra la ficha de la persona, sin reasignar la relación.
- [ ] Los campos restantes de la ficha de la persona no cambian.

### 13. Liquidación con el rol de la cuenta en cada línea de detalle
Cada línea del detalle por persona identifica el rol de la cuenta —todos los roles, no sólo los fijos— en lugar del valor fijo anterior.

Criterios de aceptación:
- [ ] Cada línea del detalle por persona de `GET /liquidacion` expone el rol de la cuenta como `{ id, nombre }` en lugar del valor fijo anterior.
- [ ] La liquidación incluye líneas con roles distintos de `autor` / `ilustrador` (cualquier rol de la cuenta con participación en el período).
- [ ] La misma persona puede aparecer en dos líneas con roles distintos (dos libros, o el mismo libro con dos roles) y cada línea trae su rol.
- [ ] Renombrar un rol cambia el nombre que muestra la liquidación, sin reasignar ninguna participación.
- [ ] Las líneas que referencian un rol dado de baja siguen mostrando el nombre del rol.
- [ ] El resto de la respuesta no cambia: las personas liquidadas, sus totales, la agrupación por libro, los porcentajes y los importes son los mismos que antes.
