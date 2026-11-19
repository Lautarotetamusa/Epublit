# Plan: registro con email confirmado, CUIT validado y "olvidé mi contraseña"

Estado: aprobado por el usuario (2026-11-18).

## Historia
El registro pasa a ser email + contraseña + CUIT (sin usuario visible), con CUIT validado por dígito verificador, email y usuario únicos, y email confirmado por link antes de poder ingresar (si no se confirma, la cuenta se borra); se suma restablecer la contraseña por mail y el login por "email o usuario".

## Diseño de API

Todas las rutas nuevas en inglés, bajo `/user`. Las rutas nuevas son públicas (sin sesión).

**Formato de error** (todas las rutas de esta historia): status HTTP + cuerpo con `code` (string estable, el front decide por él), `message` (texto mostrable) y, cuando el error es atribuible a un campo, `field` (`email` | `password` | `cuit` | `username`). Si el back ya tiene una convención de envoltorio de errores se puede usar, siempre que `code` y `field` lleguen tal cual.

**Sesión**: donde dice "sesión" es exactamente el mismo cuerpo que devuelve hoy `POST /user/login` al ingresar bien.

**Links de los mails** (sobre `PANEL_URL`): `/verificar-email?token=<token>` y `/restablecer-contrasena?token=<token>`.

**Cuenta pendiente vencida**: una cuenta nueva sin confirmar cuyo último link de confirmación tiene más de 24 h. Se borra definitivamente (Tarea 9). Mientras la limpieza periódica no la haya borrado, cualquier ruta que la encuentre la borra en ese momento y responde como si no existiera; la única excepción es `POST /user/verify-email`, que responde `registration_expired`.

### `POST /user/register` (cambia)
Request: `{ email, password, cuit }`. Ya no recibe `username`. `email` se normaliza (trim + minúsculas); `cuit` acepta guiones, espacios o puntos y se queda con los dígitos.

| Status | Cuerpo | Caso |
| --- | --- | --- |
| 201 | `{ email }` (normalizado) | Cuenta creada sin confirmar, mail de confirmación enviado |
| 400 | `code: invalid_email`, `field: email` | Formato de email inválido |
| 400 | `code: password_too_short`, `field: password` | Contraseña de menos de 8 caracteres |
| 400 | `code: invalid_cuit`, `field: cuit` | No son 11 dígitos o el dígito verificador (módulo 11) no cierra |
| 409 | `code: email_taken`, `field: email` | El email es de una cuenta confirmada o vieja |
| 409 | `code: cuit_taken`, `field: cuit` | El CUIT es de una cuenta confirmada o vieja |
| 422 | `code: cuit_not_in_padron`, `field: cuit` | El padrón de ARCA no tiene ese CUIT |
| 502 | `code: padron_unavailable` (sin `field`) | El padrón de ARCA no respondió / error inesperado |

Orden de chequeo: formato → email/CUIT ya tomados → padrón. Se devuelve el primer error.

### `POST /user/login` (cambia)
Request: `{ identifier, password }`. Si `identifier` contiene `@` se normaliza y se busca por email (sin distinguir mayúsculas); si no, por username exacto.

| Status | Cuerpo | Caso |
| --- | --- | --- |
| 200 | sesión | Credenciales correctas y cuenta confirmada (o vieja) |
| 401 | `code: invalid_credentials` | No existe, contraseña incorrecta (también si la cuenta no está confirmada) o cuenta pendiente vencida |
| 403 | `code: email_not_verified`, `email` | Contraseña correcta pero cuenta nueva sin confirmar y todavía vigente |

### `POST /user/verify-email` (nueva)
Request: `{ token }`.

| Status | Cuerpo | Caso |
| --- | --- | --- |
| 200 | `{ status: "verified", ...sesión }` | Confirmó ahora; sale la bienvenida |
| 200 | `{ status: "already_verified" }` | La cuenta ya estaba confirmada (por este u otro link, o por restablecer) |
| 410 | `code: registration_expired` | El token venció y la cuenta es una pendiente vencida: se borra en ese momento. El front pide registrarse de nuevo |
| 410 | `code: token_expired`, `email` | El token venció pero la cuenta sigue vigente porque se mandó un link más nuevo. El front ofrece reenviar a ese email |
| 404 | `code: token_invalid` | Token vacío, inexistente o de una cuenta que ya no existe (reemplazada o borrada) |

Prioridad: "ya confirmado" > "registro vencido" > "token vencido".

### `POST /user/resend-verification` (nueva)
Request: `{ email }`. Ya no se acepta un token.

| Status | Cuerpo | Caso |
| --- | --- | --- |
| 202 | `{}` | Pedido aceptado. Si el email es de una cuenta sin confirmar y vigente, sale un mail nuevo; si no (no existe, ya confirmada, vieja, pendiente vencida), no sale nada y la respuesta es la misma |
| 400 | `code: invalid_email`, `field: email` | Email con formato inválido |
| 429 | `code: too_many_requests` | Se superó el límite por cuenta (ver Tareas) |

### `POST /user/forgot-password` (nueva)
Request: `{ email }`.

| Status | Cuerpo | Caso |
| --- | --- | --- |
| 202 | `{}` | Siempre igual, exista o no la cuenta, esté o no confirmada |
| 400 | `code: invalid_email`, `field: email` | Formato inválido |
| 429 | `code: too_many_requests` | Se superó el límite por email (se cuenta por email pedido, exista o no la cuenta) |

### `GET /user/reset-password/:token` (nueva, no consume el token)

| Status | Cuerpo | Caso |
| --- | --- | --- |
| 200 | `{ status: "valid", razon_social, username }` | `username` sólo en cuentas viejas; `null` en las nuevas |
| 410 | `code: token_expired`, `email` | Vencido (más de 1 h) |
| 409 | `code: token_used` | Ya usado, o invalidado porque se usó otro link de la cuenta |
| 404 | `code: token_invalid` | Inexistente, o de una cuenta que ya no existe o es una pendiente vencida |

"Ya usado" tiene prioridad sobre "vencido".

### `POST /user/reset-password` (nueva)
Request: `{ token, password }`.

| Status | Cuerpo | Caso |
| --- | --- | --- |
| 200 | `{ status: "password_reset", ...sesión }` | Contraseña cambiada |
| 400 | `code: password_too_short`, `field: password` | Menos de 8 caracteres (el token no se consume) |
| 410 | `code: token_expired`, `email` | Vencido |
| 409 | `code: token_used` | Ya usado / invalidado |
| 404 | `code: token_invalid` | Inexistente, o de una cuenta que ya no existe o es una pendiente vencida |

### `PUT /user` (cambia sólo en email y username)
Si cambia el email: se normaliza; si ya es de otra cuenta, 409 `code: email_taken`, `field: email`. Si el perfil permite cambiar el username y el nuevo ya lo usa otra cuenta (sin distinguir mayúsculas), 409 `code: username_taken`, `field: username`. Guardar el propio email o username con otras mayúsculas no es error.

## Ambigüedad
- **Sesiones abiertas al restablecer la contraseña**: el design no dice si las sesiones ya emitidas de esa cuenta deben dejar de servir. El plan no las invalida (requeriría revocar sesiones, que hoy no existe); si el usuario lo quiere, es una tarea aparte.
- **Ajustes que tiene que hacer el front** (cambios de contrato respecto del design, que el front no puede deducir solo):
  - El body del login usa el campo `identifier`.
  - `/verificar-email`: el estado "link vencido" pasa a ser "registro vencido" cuando llega `registration_expired` ("Tu registro venció. Registrate de nuevo", con link al registro; sin "Reenviar link"). El estado "vencido con reenvío" queda sólo para `token_expired`, que trae el email y reenvía por email.
  - `resend-verification` acepta sólo `{ email }`: ya no hay reenvío a partir de un token.
  - "Revisá tu correo" y el login sin confirmar pueden avisar que, si no se confirma en 24 h, la cuenta se borra y hay que registrarse de nuevo (copia a definir en el front).

## Tareas

### 1. Migración: email y username únicos, estado de confirmación
Agregar a las cuentas el estado de confirmación del email, el momento del último link de confirmación enviado y una marca que distinga las cuentas viejas (usuario elegido por la persona) de las nuevas (usuario interno). Agregar dos índices únicos que no distinguen mayúsculas: uno sobre el email, que ignora vacíos y NULL, y otro sobre el username. El índice del username no distingue mayúsculas para que no puedan convivir "Caro" y "caro": son indistinguibles para una persona (al recuperar la cuenta, en soporte, en la barra superior) y una cuenta podría hacerse pasar por otra. El login igual sigue comparando el username exacto, así ninguna cuenta existente cambia cómo entra. Todas las cuentas existentes quedan confirmadas y marcadas como viejas. La migración no contiene ningún email ni username de clientes.

Criterios de aceptación:
- [ ] Después de migrar, todas las cuentas existentes figuran confirmadas y como viejas.
- [ ] Insertar dos cuentas con `Ana@x.com` y `ana@x.com` falla por el índice único.
- [ ] Dos cuentas con email vacío y dos con email NULL conviven sin error.
- [ ] Insertar dos cuentas con username `Caro` y `caro` falla por el índice único.
- [ ] Si hay emails duplicados (sin distinguir mayúsculas), la migración falla con un mensaje que dice explícitamente que hay emails duplicados y que hay que resolverlos antes, y la base queda exactamente como estaba antes de migrar.
- [ ] Ídem con usernames duplicados (sin distinguir mayúsculas): el mensaje habla de usernames duplicados.
- [ ] El archivo de migración no contiene ninguna dirección de email ni username de clientes.

### 2. Métodos de mail nuevos en el emailService
Agregar `enviarConfirmacionEmail({ nombre, url_confirmar })` (alias `confirmar-email`) y `enviarRestablecimientoContrasena({ cuenta, url_restablecer })` (alias `restablecer-contrasena`), con links armados sobre `PANEL_URL`. Los templates ya existen y no se tocan.

Criterios de aceptación:
- [ ] `test/email.test.ts` tiene un caso por cada método nuevo que verifica el alias, que el modelo trae todas las variables del template y que el link empieza con `PANEL_URL` y apunta a `/verificar-email?token=` o `/restablecer-contrasena?token=`.
- [ ] El caso existente de `bienvenida` sigue pasando.

### 3. Validación del registro
`POST /user/register` deja de pedir username y valida email, contraseña y CUIT según el contrato, con los códigos y `field` de la tabla.

Criterios de aceptación:
- [ ] Email ` Ana@Editorial.com ` se guarda y se devuelve como `ana@editorial.com`.
- [ ] Email `ana@` → 400 `invalid_email`, `field: email`.
- [ ] Contraseña de 7 caracteres → 400 `password_too_short`; de 8 → aceptada.
- [ ] CUIT `20-12345678-9` → 400 `invalid_cuit`; `20-12345678-6` (o `20.12345678.6`) pasa la validación.
- [ ] CUIT de 10 dígitos → 400 `invalid_cuit`.
- [ ] Con el padrón mockeado sin el CUIT → 422 `cuit_not_in_padron`, `field: cuit`; con el padrón fallando → 502 `padron_unavailable` sin `field`.
- [ ] Un error de validación no consulta el padrón ni crea nada.

### 4. Alta de cuenta sin confirmar con usuario interno
Una registración válida crea la cuenta sin confirmar, con un username interno generado que respeta la unicidad, y no manda la bienvenida.

Criterios de aceptación:
- [ ] Tras un 201, la cuenta existe sin confirmar, marcada como nueva, con los datos del padrón (razón social, etc.) como hoy.
- [ ] El username generado tiene 25 caracteres o menos, no contiene `@` y no coincide (sin distinguir mayúsculas) con ningún username existente.
- [ ] Dos registros seguidos generan usernames distintos.
- [ ] Si el primer username generado ya existe (forzado en el test), el registro igual responde 201 con otro username, sin error de índice.
- [ ] El registro no envía el mail de bienvenida.

### 5. Email y CUIT tomados vs. cuentas sin confirmar
Las cuentas confirmadas y las viejas bloquean su email y su CUIT. Una cuenta sin confirmar no los retiene: al registrarse de nuevo con ese email o ese CUIT, se borra definitivamente, igual que en la limpieza de la Tarea 9, y se crea la nueva.

Criterios de aceptación:
- [ ] Registro con el email de una cuenta confirmada (o vieja, con otras mayúsculas) → 409 `email_taken`, `field: email`.
- [ ] Registro con el CUIT de una cuenta confirmada o vieja → 409 `cuit_taken`, `field: cuit`.
- [ ] Registro con el mismo email que una cuenta sin confirmar (y otro CUIT) → 201; la cuenta pendiente y todo lo que su alta creó dejan de existir, y sus links de confirmación responden `token_invalid`.
- [ ] Registro con el mismo CUIT que una cuenta sin confirmar (y otro email) → 201; ídem, y las claves/CSR de ese CUIT en disco son las de la cuenta nueva (el CSR del mail de bienvenida corresponde a la clave nueva).
- [ ] Si el email coincide con una pendiente y el CUIT con otra pendiente, las dos se reemplazan por la nueva.
- [ ] Si el registro falla (CUIT tomado por una confirmada, padrón caído, etc.), la cuenta pendiente sigue existiendo intacta, con sus claves en disco.

### 6. Mail de confirmación al registrarse
Al crear la cuenta se genera un token de confirmación de un solo uso que vence a las 24 h, se guarda sólo su hash, se registra el momento del envío y se manda el mail `confirmar-email` con la razón social como `nombre`.

Criterios de aceptación:
- [ ] Tras un 201 se llamó a `enviarConfirmacionEmail` con `nombre` = razón social del padrón y un link `/verificar-email?token=…` sobre `PANEL_URL`.
- [ ] El token del link no aparece en claro en la base.
- [ ] Si el envío del mail falla, el registro igual responde 201 y la cuenta queda creada (se puede reenviar por email).

### 7. Confirmar el email
`POST /user/verify-email` con los resultados del contrato. Confirmar marca la cuenta, devuelve sesión y manda la bienvenida (con CSR, `nombre` = razón social).

Criterios de aceptación:
- [ ] Token válido → 200 `verified` con una sesión que sirve para llamar a un endpoint autenticado; la cuenta queda confirmada.
- [ ] Al confirmar se llama a `enviarBienvenida` una sola vez, con `nombre` = razón social y el CSR adjunto.
- [ ] Repetir con el mismo token → 200 `already_verified` sin sesión y sin otra bienvenida.
- [ ] Otro token pendiente de la misma cuenta, ya confirmada → 200 `already_verified`.
- [ ] Token de más de 24 h de una cuenta sin confirmar cuyo último link también tiene más de 24 h → 410 `registration_expired`; la cuenta y todo lo que su alta creó quedan borrados en ese momento.
- [ ] Repetir ese mismo token después → 404 `token_invalid`.
- [ ] Token de más de 24 h de una cuenta sin confirmar que recibió un link más nuevo todavía vigente → 410 `token_expired` con el email; la cuenta sigue existiendo sin confirmar.
- [ ] Token de más de 24 h de una cuenta ya confirmada → 200 `already_verified`.
- [ ] Token inexistente, vacío o ausente → 404 `token_invalid`.
- [ ] Si el envío de la bienvenida falla, la confirmación igual responde 200 `verified`.

### 8. Reenviar el link de confirmación
`POST /user/resend-verification` sólo por email, con límite por cuenta. Cada reenvío genera un token nuevo de 24 h y corre el plazo de borrado de la cuenta a 24 h desde ese envío; los links anteriores siguen sirviendo hasta vencer.

Criterios de aceptación:
- [ ] Con el email (en cualquier mayúscula) de una cuenta sin confirmar y vigente → 202 y sale un mail de confirmación con un token nuevo.
- [ ] Después de reenviar, el link anterior todavía no vencido confirma bien.
- [ ] Una cuenta registrada hace 23 h que reenvía el link no se borra al cumplir 24 h desde el registro, sino 24 h después del reenvío.
- [ ] Con un email inexistente, de cuenta confirmada, vieja o pendiente vencida → 202 y no sale ningún mail (la pendiente vencida queda borrada).
- [ ] Un body con `token` y sin `email` → 400 `invalid_email`.
- [ ] Un reenvío para la misma cuenta antes de 60 s del último mail → 429 `too_many_requests`, sin mail.
- [ ] Respetando los 60 s, el 4.º reenvío para la misma cuenta dentro de 15 minutos → 429 `too_many_requests`.

### 9. Borrado definitivo de cuentas sin confirmar vencidas
Una cuenta nueva sin confirmar cuyo último link de confirmación tiene más de 24 h se borra definitivamente, junto con todo lo que creó su alta: los clientes por defecto y sus depósitos, el depósito principal, los medios de pago, los roles, sus tokens y las claves/CSR que se generaron en disco para su CUIT. El mecanismo tiene dos partes:
- **Limpieza periódica**, cada hora, dentro del proceso del back (también una vez al arrancar). Garantiza que las cuentas que nadie vuelve a tocar no se acumulen, sin depender de ninguna infraestructura externa.
- **Borrado en el momento**: cuando una ruta encuentra una pendiente vencida que la limpieza todavía no borró. Garantiza que el resultado sea correcto en cualquier instante aunque falten hasta 60 minutos para la próxima limpieza.

La hora actual se le inyecta a la lógica de vencimiento y de limpieza, así los tests adelantan el reloj en vez de esperar 24 h. Un error al borrar una cuenta no frena la limpieza de las demás ni tira abajo el proceso.

Criterios de aceptación:
- [ ] Con el reloj adelantado 24 h + 1 min desde el último link, ejecutar la limpieza borra la cuenta pendiente: no queda ninguna fila suya ni de los clientes, depósitos, medios de pago, roles y tokens que creó su alta, y el directorio de claves de su CUIT ya no existe.
- [ ] Con el reloj adelantado 23 h 59 min, la limpieza no la borra.
- [ ] La limpieza nunca borra cuentas viejas ni confirmadas, aunque sean de hace más de 24 h y tengan links de confirmación vencidos.
- [ ] La limpieza no toca datos ni claves en disco de otras cuentas.
- [ ] Si borrar una cuenta falla (forzado en el test), las demás pendientes vencidas igual se borran.
- [ ] La limpieza se programa al arrancar el back con un intervalo de una hora.
- [ ] Con una pendiente vencida no borrada todavía: el login con sus credenciales → 401 `invalid_credentials`, y `forgot-password` con su email → 202 sin mail. En los dos casos la cuenta queda borrada.
- [ ] Un link de restablecer de una cuenta que pasó a ser pendiente vencida → 404 `token_invalid` en GET y en POST.

### 10. Login por email o usuario
`POST /user/login` acepta `identifier` (email o username) y distingue la cuenta sin confirmar.

Criterios de aceptación:
- [ ] Una cuenta vieja entra con su username exacto; con el username en otras mayúsculas o con espacios agregados → 401 `invalid_credentials`.
- [ ] Una cuenta entra con su email escrito en mayúsculas y con espacios en los extremos.
- [ ] Una cuenta vieja sin email sigue entrando con su username.
- [ ] Cuenta nueva sin confirmar y vigente + contraseña correcta → 403 `email_not_verified` con su email.
- [ ] Cuenta nueva sin confirmar + contraseña incorrecta → 401 `invalid_credentials`.
- [ ] Cuentas viejas nunca reciben `email_not_verified`.

### 11. Email y username únicos al editar el perfil
`PUT /user` normaliza el email y rechaza un email o un username que ya use otra cuenta, con un error mostrable.

Criterios de aceptación:
- [ ] Cambiar el email a ` Otro@X.com ` lo guarda como `otro@x.com`.
- [ ] Cambiar el email al de otra cuenta (en cualquier mayúscula) → 409 `email_taken`, `field: email`, y el email no cambia.
- [ ] Guardar el propio email con otras mayúsculas → 200.
- [ ] Si el perfil permite cambiar el username: el username de otra cuenta en otras mayúsculas → 409 `username_taken`, `field: username`, y el username no cambia.

### 12. Pedir restablecer la contraseña
`POST /user/forgot-password` con respuesta siempre neutra y límite por email. Si el email es de una cuenta, genera un token de un solo uso que vence en 1 h (guardado sólo como hash) y manda `restablecer-contrasena`, con `cuenta` = razón social, más ` (usuario <username>)` sólo en cuentas viejas.

Criterios de aceptación:
- [ ] Email de cuenta existente (confirmada, vieja o sin confirmar vigente, en cualquier mayúscula) → 202 `{}` y un único mail con link `/restablecer-contrasena?token=…` sobre `PANEL_URL`.
- [ ] Email inexistente → 202 con el mismo cuerpo y sin mail.
- [ ] Cuenta vieja → `cuenta` = `"<razón social> (usuario <username>)"`; cuenta nueva → sólo la razón social.
- [ ] El token no aparece en claro en la base.
- [ ] Un pedido para el mismo email antes de 60 s del anterior → 429 `too_many_requests`, igual exista o no la cuenta.
- [ ] Respetando los 60 s, el 4.º pedido para un mismo email dentro de 15 minutos → 429 `too_many_requests`, igual exista o no la cuenta.
- [ ] Email con formato inválido → 400 `invalid_email`.

### 13. Consultar un link de restablecer
`GET /user/reset-password/:token` informa el estado del token sin consumirlo.

Criterios de aceptación:
- [ ] Token válido de cuenta vieja → 200 `valid` con `razon_social` y `username`; de cuenta nueva → `username: null`.
- [ ] Consultar dos veces el mismo token válido devuelve `valid` las dos veces.
- [ ] Token de más de 1 h → 410 `token_expired` con el email de la cuenta.
- [ ] Token ya usado, o de la misma cuenta que otro token ya usado → 409 `token_used` (también si además venció).
- [ ] Token inexistente → 404 `token_invalid`.

### 14. Guardar la contraseña nueva
`POST /user/reset-password` cambia la contraseña, invalida los demás links de restablecer de la cuenta y devuelve sesión. Si la cuenta nueva no estaba confirmada, la confirma (y deja de poder borrarse) y manda la bienvenida.

Criterios de aceptación:
- [ ] Token válido + contraseña de 8 o más → 200 `password_reset` con sesión; después el login con la contraseña nueva funciona y con la vieja da 401.
- [ ] El mismo token usado otra vez → 409 `token_used`.
- [ ] Otro token de restablecer de la misma cuenta, emitido antes, → 409 `token_used` (en GET y en POST).
- [ ] Contraseña de 7 caracteres → 400 `password_too_short` y el token sigue `valid`.
- [ ] Token vencido → 410 `token_expired` con el email, y la contraseña no cambia.
- [ ] Cuenta nueva sin confirmar → queda confirmada y se llama a `enviarBienvenida` una vez; con el reloj adelantado más de 24 h, la limpieza ya no la borra.
- [ ] Cuenta ya confirmada o vieja → no sale bienvenida.
- [ ] Los links de confirmación de la cuenta responden ahora `already_verified`.

### 15. Documentación de la API
`back/docs/api.md` refleja las rutas nuevas.

Criterios de aceptación:
- [ ] Regenerada la documentación, figuran `POST /user/verify-email`, `POST /user/resend-verification`, `POST /user/forgot-password`, `GET /user/reset-password/:token` y `POST /user/reset-password`.
