# Spec: Migrar el módulo `user` a la nueva arquitectura

## Estado
Draft

## Resumen
Migrar el módulo `user` (registro, login, consulta y actualización de datos
del usuario, gestión del certificado AFIP) de su implementación actual sobre
MySQL a la arquitectura Postgres que se viene aplicando en el resto del
proyecto (el módulo `persona` ya está migrado y sirve de referencia). El
resultado observable para quien usa la API debe ser el mismo que hoy.

## Motivación / por qué
El proyecto está migrando módulo por módulo de MySQL a Postgres. `user` es el
primero de la lista acordada (user -> libro -> libro_persona) porque es la
base de la que depende la autenticación de toda la API: el id de usuario que
viaja en el JWT y que casi todos los demás módulos usan para filtrar "sus"
datos (`res.locals.user.id`). Migrarlo primero es condición necesaria para
poder migrar el resto; el objetivo de esta etapa es avanzar la migración, no
garantizar que los módulos todavía no migrados queden sin ningún impacto (ver
"Datos existentes / integraciones a tener en cuenta").

## Alcance

### Incluye
- Registro de usuario (`POST /user/register`): validación de datos, consulta
  a AFIP para completar datos fiscales, creación del usuario, generación de
  clave privada y CSR para el certificado AFIP.
- Login (`POST /user/login`): validación de credenciales y emisión de un JWT.
- Consulta de los datos del usuario autenticado (`GET /user`).
- Actualización de datos editables del usuario autenticado (`PUT /user`:
  email y punto de venta).
- Actualización de los datos fiscales del usuario autenticado consultando de
  nuevo a AFIP (`PUT /user/afip`).
- Subida del certificado AFIP del usuario autenticado (`POST
  /user/uploadCert`).
- La creación automática de los clientes "MOSTRADOR" y "CONSUMIDOR FINAL" al
  dar de alta un usuario (comportamiento hoy implementado como trigger de
  base de datos sobre la tabla `users`, confirmado como necesario: hay tests
  de `user` y de `cliente`/`consignación` que dependen de que existan estos
  dos clientes apenas se crea el usuario).
- Que login, registro, consulta y actualización de los datos del usuario
  sigan funcionando correctamente en sí mismos después de la migración.

### No incluye
- Migrar ningún otro módulo (`libro`, `libro_persona`, `liquidacion`,
  `cliente`, `transaccion`, `venta`); esos siguen en MySQL y siguen
  confiando en que el id de usuario del JWT es válido.
- Cambiar el formato del JWT, el mecanismo de login, o agregar
  funcionalidad nueva de autenticación (roles, refresh tokens, recuperación
  de contraseña, etc.) que no exista hoy.
- Cambiar el comportamiento de la integración con AFIP (qué datos se piden,
  cuándo se piden, generación de clave/CSR/certificado).

## Comportamiento esperado

- Como usuario nuevo, quiero registrarme con mi username, password, cuit y
  email, para poder operar el sistema con mis propios datos fiscales
  completados automáticamente desde AFIP.
  - Criterio de aceptación: `POST /user/register` con datos válidos y un
    cuit existente en AFIP responde 201, crea el usuario con sus datos
    fiscales (condición fiscal, razón social, domicilio, fecha de inicio,
    ingresos brutos) completados desde AFIP, y deja generada la clave
    privada y el CSR del usuario.
  - Criterio de aceptación: si falta el cuit en el body, responde 400 y no
    crea nada.
  - Criterio de aceptación: si el cuit no existe en AFIP, responde 404 y no
    crea nada.
  - Criterio de aceptación: si ya existe un usuario con ese username (o ese
    cuit), responde 400 y no crea nada.
  - Criterio de aceptación: al crear el usuario con éxito, quedan
    disponibles automáticamente dos clientes para ese usuario: uno de tipo
    "negro" llamado "MOSTRADOR" y uno de tipo "particular" llamado
    "CONSUMIDOR FINAL" (con condición fiscal y razón social
    "CONSUMIDOR FINAL"), sin que el cliente de la API tenga que crearlos.

- Como usuario registrado, quiero iniciar sesión con mi username y
  password, para obtener un token que me permita usar el resto de la API.
  - Criterio de aceptación: `POST /user/login` con credenciales correctas
    responde 200 con un token.
  - Criterio de aceptación: `POST /user/login` con password incorrecta
    responde 401 con el mensaje "Contraseña incorrecta".
  - Criterio de aceptación: el token emitido sigue siendo aceptado por el
    middleware de autenticación de la API tal como es hoy (mismo esquema de
    verificación, mismos datos disponibles después de autenticar: como
    mínimo el id de usuario y el cuit).
  - Nice to have (no bloquea la migración): que el token siga siendo válido
    para acceder a endpoints de módulos que todavía no fueron migrados
    (`libro`, `persona`, `cliente`, `transaccion`, `liquidacion`, `venta`)
    sin cambios de comportamiento para esos módulos. El usuario aceptó
    explícitamente que en esta etapa el objetivo es avanzar la migración, y
    que romper algo de esos módulos no migrados es un costo aceptable si
    hace falta.

- Como usuario autenticado, quiero consultar mis propios datos, para ver mi
  información fiscal y de cuenta.
  - Criterio de aceptación: `GET /user` sin token responde 403.
  - Criterio de aceptación: `GET /user` con un token válido responde 200 con
    los datos del usuario dueño del token (nunca de otro usuario).
  - Criterio de aceptación: el campo `password` nunca se expone en ninguna
    respuesta de la API (ni en `GET /user`, ni en la respuesta de
    `POST /user/register`, `PUT /user` o `PUT /user/afip`, ni en ningún otro
    payload).

- Como usuario autenticado, quiero actualizar mi email y mi punto de venta,
  para mantener mis datos de contacto y facturación al día.
  - Criterio de aceptación: `PUT /user` actualiza únicamente los campos
    enviados (email y/o punto_venta); los campos no enviados quedan
    intactos.
  - Criterio de aceptación: enviar un body vacío no modifica ningún dato y
    responde 200.
  - Criterio de aceptación: enviar campos no editables (por ejemplo
    `username`) no los modifica.
  - Criterio de aceptación: un `punto_venta` negativo es rechazado con 400.
  - Criterio de aceptación: un `email` vacío es rechazado con 400.

- Como usuario autenticado, quiero volver a traer mis datos fiscales desde
  AFIP, para corregirlos si cambiaron en AFIP sin tener que cargarlos a
  mano.
  - Criterio de aceptación: `PUT /user/afip` actualiza los datos fiscales
    del usuario autenticado con lo que devuelve AFIP para su cuit.

- Como usuario autenticado, quiero subir mi certificado AFIP, para poder
  facturar electrónicamente.
  - Criterio de aceptación: `POST /user/uploadCert` sin token responde 403.
  - Criterio de aceptación: subir el certificado sin adjuntar el archivo
    responde 400 con el mensaje "El campo 'cert' es necesario".
  - Criterio de aceptación: subir un archivo que no es un certificado
    válido responde 400 con el mensaje "El certificado no es valido" y no
    deja el archivo guardado.
  - Criterio de aceptación: subir un certificado válido responde 201 y deja
    el certificado guardado para ese usuario.

## Casos borde
- Registrar un usuario con un username o cuit ya existente no debe dejar
  datos parciales (ni usuario, ni clientes MOSTRADOR/CONSUMIDOR FINAL, ni
  archivos de clave/CSR) si algún paso falla.
- Nice to have (no bloquea la migración): que un token válido emitido antes
  de la migración (o durante la transición) siga siendo aceptado por el
  middleware de auth sin que el usuario tenga que volver a loguearse, y que
  los endpoints de módulos no migrados que dependen del id de usuario del
  token (JOINs contra la tabla de usuarios, o simplemente confiar en el id)
  no se vean afectados. Si algo de esto se rompe durante la migración de
  `user`, no bloquea el trabajo: el criterio priorizado por el usuario es
  avanzar la migración.

## Datos existentes / integraciones a tener en cuenta
- El middleware `auth` (usado por casi todas las rutas de la API) depende
  únicamente de poder verificar el JWT emitido en el login y de que el
  payload decodificado tenga el id de usuario y el cuit; no debe requerir
  ningún cambio de contrato hacia los módulos que lo consumen.
- El resto de los módulos no migrados (`libro`, `libro_persona`,
  `liquidacion`, `cliente`, `transaccion`, `venta`) identifican al dueño de
  cada fila con el id de usuario del token y, en algunos casos, hacen JOIN
  directo contra la tabla de usuarios existente. Idealmente esta migración
  no debería romper esa relación mientras esos módulos no se migren también,
  pero el usuario confirmó explícitamente que no es un requisito duro para
  esta etapa: "no importa si rompemos algo en este paso, el objetivo es
  migrar todo. así que no pasa nada si rompemos algo existente". El foco
  prioritario es que el propio módulo `user` (login, registro, consulta,
  actualización) funcione correctamente.
- La integración con AFIP (consulta de datos fiscales por cuit, generación
  de clave privada, CSR, validación y guardado de certificado) es un
  dependencia externa del módulo `user` que no cambia con esta migración.
- El módulo `cliente` depende de que, al crearse un usuario, existan los
  clientes "MOSTRADOR" y "CONSUMIDOR FINAL" para ese usuario (hay
  funcionalidad, como la consulta de consumidor final y las reglas de
  consignación, que asume que ese cliente existe).

## Preguntas abiertas
Ninguna pendiente: `User.getAll` (listado de todos los usuarios) es código
muerto y no se migra; el campo `password` nunca se expone en ninguna
respuesta (ver criterio de aceptación en "Comportamiento esperado"); y no
existe ningún consumidor externo de `/user` fuera de esta app.
