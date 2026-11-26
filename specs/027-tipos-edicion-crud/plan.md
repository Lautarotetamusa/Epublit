# Plan: Tipos de edición como CRUD por cuenta

## Historia

Hoy el tipo de edición de un libro es un enum fijo
(`normal` | `pop_up` | `cartone`) guardado en `libros.tipo_edicion`. Se quiere
que cada cuenta tenga sus propios tipos de edición, con nombre editable y baja
lógica, para poder cargar, listar, editar y dar de baja tipos; que el alta y la
edición de un libro elijan el tipo desde esa lista; y que el catálogo público
siga mostrando el nombre del tipo. `Normal`, `Pop up` y `Cartoné` se crean por
defecto en cada cuenta. Un tipo dado de baja deja de ofrecerse pero los libros
que ya lo usan siguen mostrando su nombre.

Mismo patrón que Roles (`specs/011-roles`) y Medios de pago
(`specs/010-medios-pago`).

## Diseño de API

### Tipos de edición de la cuenta

- `GET /tipo_edicion/` → `200` → `[ { id, nombre } ]` — sólo los tipos
  **activos** de la cuenta autenticada.
- `POST /tipo_edicion/` — body `{ nombre }` → `201` → `{ id, nombre }`.
- `PUT /tipo_edicion/:id` — body `{ nombre }` → `200` → `{ id, nombre }`.
- `DELETE /tipo_edicion/:id` — **baja lógica** (no se borra) → `200`.

Las escrituras usan el sobre estándar (`{ success, data }`). El listado es un
array pelado, igual que `GET /rol` y `GET /medio_pago`.

Errores:

- `400` nombre vacío o sólo espacios.
- `409` nombre ya usado por otro tipo **activo** de la cuenta, comparando sin
  distinguir mayúsculas (`Normal` y `normal` no coexisten).
- `404` id inexistente, de otra cuenta o ya dado de baja.

### Libro

- `GET /libro`, `GET /libro/:isbn` y `GET /libro/lista_libros`: cada libro
  expone `tipo_edicion_id` (id de la cuenta) y `tipo_edicion` (nombre resuelto,
  incluso si el tipo está dado de baja).
- `POST /libro/` y `PUT /libro/:isbn`: `tipo_edicion_id` opcional. Si el alta
  lo omite, se usa el tipo `Normal` activo de la cuenta (o el primero
  alfabético). Un id inexistente, de otra cuenta o dado de baja es `404`.
- La API pública de la tienda sigue exponiendo `tipoEdicion` como el **nombre**
  del tipo (`Normal`, `Pop up`, `Cartoné`, o el que haya cargado la cuenta).

## Tareas

### 1. Tipos de edición por defecto al registrar una cuenta nueva
Cada cuenta nueva arranca con `Normal`, `Pop up` y `Cartoné`.

Criterios de aceptación:
- [x] Al registrar una cuenta nueva quedan exactamente esos 3 tipos activos.
- [x] Los tipos de una cuenta nunca aparecen al operar con otra cuenta.
- [x] Dar de baja la cuenta borra también sus tipos (cuentas que nunca se usaron).

### 2. Tipos por defecto para las cuentas existentes (migración)
Las cuentas ya cargadas reciben los 3 tipos al aplicar la migración.

Criterios de aceptación:
- [x] Tras migrar, cada cuenta existente tiene `Normal`, `Pop up` y `Cartoné`.
- [x] Correr la migración dos veces no duplica tipos.

### 3. Re-apuntar los libros al tipo de su cuenta (migración)
Cada libro pasa del enum fijo a referenciar el tipo de su cuenta.

Criterios de aceptación:
- [x] `normal` → `Normal`, `pop_up` → `Pop up`, `cartone` → `Cartoné`.
- [x] Ningún libro queda sin `tipo_edicion_id` (la columna termina `NOT NULL`).
- [x] Se elimina la columna `tipo_edicion` y el enum `libro_tipo_edicion`.
- [x] Correr la migración dos veces no pierde ni duplica libros.

### 4. CRUD de tipos de edición
Listar, crear, renombrar y dar de baja tipos de la cuenta.

Criterios de aceptación:
- [x] `GET /tipo_edicion/` devuelve sólo los activos, ordenados alfabéticamente.
- [x] `POST` con nombre válido devuelve 201 y queda disponible.
- [x] Sin nombre, vacío o sólo espacios devuelve 400.
- [x] Nombre repetido entre activos devuelve 409 (también sin distinguir mayúsculas).
- [x] Reutilizar el nombre de un tipo dado de baja devuelve 201.
- [x] `PUT` renombra y el nombre nuevo se refleja en los libros que lo usan.
- [x] `DELETE` da de baja (200) y el tipo deja de ofrecerse; 404 para id
  inexistente, ajeno o ya dado de baja.
- [x] Un libro que ya usaba el tipo sigue mostrando su nombre después de la baja.

### 5. Selección del tipo en el formulario de libro
El alta y la edición de un libro eligen el tipo desde la lista de la cuenta.

Criterios de aceptación:
- [x] El alta propone `Normal` (o el primero alfabético si no está activo).
- [x] El selector sólo muestra tipos activos.
- [x] La ficha del libro muestra el nombre del tipo.
- [x] Si la cuenta no tiene ningún tipo activo, el alta no puede guardar y el
  backend responde con un error claro.

### 6. Pantalla de gestión en el panel
Nueva sección `Tipos de edición` dentro de Catálogo, con listado, alta y ficha
de edición/baja (mismo patrón visual que Roles).

Criterios de aceptación:
- [x] El listado muestra los tipos activos y navega a la ficha.
- [x] El alta crea un tipo y abre su ficha.
- [x] La ficha permite renombrar y dar de baja, avisando que los libros que ya
  lo usan conservan el nombre.
- [x] La sección aparece en la navegación lateral.

## Notas de implementación

- Módulo backend: `back/src/modules/tipoEdicion/` (schema, validator, filter,
  repository, service, controller, routes, index).
- Migración: `back/db/migrations/0028_tipos_edicion.sql`.
- El `tipo_edicion_id` es opcional en el validator de alta para conservar el
  default histórico; el service resuelve el `Normal` de la cuenta.
- Datos de demo: `demo-data/scripts/generar_sql.py` genera los 3 tipos y
  `tipo_edicion_id` en los libros.
