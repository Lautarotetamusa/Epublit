# Design: registro con email confirmado y CUIT validado

Estado: aprobado por el usuario (2026-11-18)

## Historia

Feedback sobre el registro: el CUIT se valida sólo al enviar, el email nunca se
confirma y el campo "Usuario" sobra (¿qué pasa con un espacio?). Se saca el
usuario, las cuentas nuevas ingresan con email + contraseña, el CUIT se valida
mientras se escribe y el email se confirma con un link antes de poder ingresar.
Segunda pasada (pedido del usuario): se suma "Olvidé mi contraseña" y los dos
mails nuevos (confirmar email, restablecer contraseña) como templates de
Postmark.

## Qué se construyó

Todo en `/front`, sobre el sistema de diseño (fondo `--pino-900`, tarjeta
blanca, Spectral en el título, Manrope en la interfaz, CUIT en JetBrains Mono).
Todas las pantallas comparten `features/auth/AuthLayout.tsx` (logo + tarjeta +
pie con el link secundario).

| Ruta | Pantalla | Archivo |
| --- | --- | --- |
| `/register` | Creá tu cuenta: email, contraseña, CUIT de la editorial | `features/auth/RegisterPage.tsx` + `useRegistroForm.ts` |
| `/revisar-correo` | Revisá tu correo (después de registrarse) | `features/auth/RevisarCorreoPage.tsx` |
| `/verificar-email?token=…` | Destino del link del mail: confirmando / confirmado / ya confirmado / vencido / inválido / error | `features/auth/VerificarEmailPage.tsx` |
| `/login` (y cualquier ruta sin sesión) | Ingresá a tu editorial: "Email o usuario" + contraseña + "¿Olvidaste tu contraseña?" | `features/auth/LoginPage.tsx` |
| `/olvide-contrasena` | Recuperá tu contraseña (pedir el link) y "Revisá tu correo" | `features/auth/OlvideContrasenaPage.tsx` + `useOlvideContrasena.ts` |
| `/restablecer-contrasena?token=…` | Destino del link: revisando / elegí una contraseña nueva / cambiada / vencido / ya usado / inválido / error | `features/auth/RestablecerContrasenaPage.tsx` + `useRestablecerContrasena.ts` |

`/verificar-email` y `/restablecer-contrasena` están montadas con y sin sesión
(el link se puede abrir en un navegador que ya tiene otra cuenta abierta). Las
dos consultan el token al abrirse con el mismo hook (`useConsultaDeToken.ts`)
y comparten los estados "revisando" y "error" (`EstadosDeLink.tsx`).

### Registro

- **Sin campo usuario.** Email, contraseña, CUIT de la editorial, en ese orden.
- **Email**: se normaliza al salir del campo y al enviar (sin espacios en los
  extremos, en minúsculas). Error inline si el formato no es válido. Ayuda:
  "Te vamos a mandar un link para confirmarlo."
- **Contraseña**: mínimo 8 caracteres (`PASSWORD_MIN_LENGTH` en
  `lib/validation.ts`), sin otras reglas. Botón para mostrar/ocultar.
- **CUIT**: acepta que lo peguen con guiones, espacios o puntos y se queda sólo
  con los dígitos (nunca más de 11). Al llegar a los 11 dígitos se muestra
  formateado (`20-12345678-9`) y se valida el dígito verificador (módulo 11)
  en ese mismo momento, sin esperar a salir del campo. Si falta algo, al salir
  del campo dice cuántos dígitos faltan. Helper reutilizable: `lib/cuit.ts`
  (`normalizeCuit`, `formatCuit`, `hasValidCuitCheckDigit`, `getCuitError`).
- **Enviar**: el botón queda habilitado (un botón deshabilitado no explica por
  qué); si algo no es válido, no se llama a la API, se marcan todos los errores
  y el foco va al primer campo con problema.
- **Errores del back en su campo**, no debajo del email como antes:
  - CUIT inexistente en el padrón → en el campo CUIT: "Este CUIT no figura en el
    padrón de ARCA. Revisá que sea el de la editorial."
  - CUIT ya registrado → en el campo CUIT, con link a ingresar.
  - Email ya registrado → en el campo email: "Ya hay una cuenta con este email.
    Ingresá" (el link precarga el email en el login).
  - Cualquier otro error (padrón caído, etc.) → aviso de error arriba del botón.
  - Al corregir un campo, su error del back desaparece.

### Revisá tu correo

Muestra el email al que se mandó el link, que vence en 24 horas, y que hasta
abrirlo no se puede ingresar. "Reenviar link" arranca bloqueado con cuenta
regresiva visible (1:00) porque el mail acaba de salir; después de cada
reenvío vuelve a bloquearse 60 s y confirma "Te mandamos otro link a …". Si el
back corta por reenvíos repetidos: "Ya pediste varios links seguidos. Esperá
unos minutos y probá de nuevo."

"¿Te equivocaste de email? **Corregilo**" vuelve al registro con el email y el
CUIT precargados (la contraseña no se guarda en la navegación) y el foco en el
email. Es lo más simple: no hace falta una pantalla de "cambiar email" ni
identificar la cuenta pendiente. Para que funcione, el back tiene que dejar
registrar de nuevo un CUIT/email cuya única cuenta está sin confirmar (ver
Datos necesarios).

### Destino del link (`/verificar-email`)

La confirmación la dispara la página (no el simple hecho de abrir la URL), así
los antivirus que abren los links del mail no la consumen.

- **Confirmando**: "Un momento, estamos revisando el link."
- **Confirmado**: "Tu email quedó confirmado. Ya podés usar Epublit. Te
  mandamos un mail de bienvenida con el pedido de certificado (CSR)…" +
  **Entrar a Epublit**, que entra directo con la sesión que devuelve la
  confirmación (sin volver a tipear la contraseña).
- **Ya confirmado** (link usado de nuevo): "Este email ya estaba confirmado" +
  Ingresar.
- **Vencido**: "El link venció. Los links de confirmación duran 24 horas. Pedí
  uno nuevo para ana@…" + Reenviar link (sin tener que escribir el email).
- **Inválido** (token incompleto o que no existe): "Este link no es válido…" +
  Ir a ingresar (desde el login se puede pedir otro link).
- **Error** (no se pudo consultar): mensaje + Probar de nuevo.

### Ingresar

- Etiqueta **"Email o usuario"**: las cuentas viejas siguen entrando con su
  usuario. Si lo tipeado tiene "@" se normaliza como email; un usuario se manda
  tal cual (no se toca el de las cuentas existentes).
- **Cuenta sin confirmar**: en vez de "credenciales inválidas", un aviso
  "Todavía no confirmaste tu email. Abrí el link que te mandamos a … y después
  ingresá." + Reenviar link (mismo componente y cuenta regresiva que en
  "Revisá tu correo").

### Olvidé mi contraseña

- **En el login**, "¿Olvidaste tu contraseña?" debajo de la contraseña. Si en
  "Email o usuario" ya había un email, llega precargado.
- **Pedir el link** (`/olvide-contrasena`): sólo email, validado y normalizado
  igual que en el registro. Botón "Mandarme el link". Sin texto para cuentas
  sin email: en producción todas quedan con email salvo `feriaros` (ver
  "Datos de producción").
- **Respuesta siempre neutra**: "Si hay una cuenta con ana@…, te mandamos un
  link para elegir una contraseña nueva. El link vence en 1 hora." Igual si
  el email no existe. Reenviar con la misma cuenta regresiva de 60 s (texto
  también neutro) y "Probar con otro email" vuelve al formulario.
- **Destino del link** (`/restablecer-contrasena`): el link se revisa al abrir
  la página, antes de pedir la contraseña, para no hacer escribir una
  contraseña sobre un link vencido.
  - **Válido**: "Elegí una contraseña nueva. Es para la cuenta de Librería Sur
    S.A., usuario libreria_sur." (el usuario sólo en cuentas viejas, para recordar
    con qué entran). Un solo campo
    "Contraseña nueva" con mostrar/ocultar, mínimo 8. Sin campo de
    confirmación: el botón de mostrar ya cubre el error de tipeo, y es lo mismo
    que se pide en el registro.
  - **Cambiada**: "Tu contraseña quedó cambiada" + **Entrar a Epublit**, que
    entra directo con la sesión que devuelve el back (igual que al confirmar
    el email).
  - **Vencido** (al abrir o si vence mientras se escribía): "Los links para
    restablecer la contraseña duran 1 hora…" + Reenviar link para ese email.
  - **Ya usado**: "Cada link sirve una sola vez. Si ya cambiaste la
    contraseña, ingresá con la nueva; si no, pedí otro link." + Ingresar.
  - **Inválido**: "Puede que se haya cortado al copiarlo…" + Pedir otro link.

### Mails (templates de Postmark)

En `back/emails/templates/`, mismo formato que `bienvenida` (`content.html`,
`content.txt`, `meta.json` con `Subject`, `LayoutTemplate: "base"` y
`TestRenderModel`). No se subieron a Postmark.

- **`confirmar-email`**: asunto "Confirmá tu email para usar Epublit".
  Variables `nombre` (razón social de ARCA) y `url_confirmar`. Botón
  "Confirmar mi email", avisa que el link vence en 24 h, que al confirmar llega
  la bienvenida con el pedido de certificado, el link en texto por si el botón
  no anda, y "Si no creaste una cuenta en Epublit, ignorá este mail".
- **`restablecer-contrasena`**: asunto "Restablecé tu contraseña de Epublit".
  Variables `cuenta` y `url_restablecer`. `cuenta` es la razón social, y en
  las cuentas viejas además el usuario: "Librería Sur S.A. (usuario
  libreria_sur)". Botón "Elegir contraseña nueva", vence en 1 hora y sirve una
  sola vez, y "Si no lo pediste vos, ignorá este mail: tu contraseña sigue
  siendo la misma y nadie puede cambiarla sin este link". `cuenta` llega armada
  desde el back para no depender de condicionales de Mustachio en el template.
- **`bienvenida`**: el contenido sigue teniendo sentido al mandarse después de
  confirmar ("Tu cuenta ya está creada"). Sólo se cambió su `TestRenderModel`
  (`nombre` pasa a ser una razón social). El saludo "¡Hola, {{nombre}}!" queda
  como está.
- **Logo en los tres mails** (layout `_layouts/base`): el encabezado muestra el
  lockup de Epublit (isotipo verde + wordmark blanco, el mismo de las pantallas
  de ingreso) en vez del texto "Epublit". El encabezado pasó de `#22605D` a
  `#12302F` (pino-900): sobre el verde medio el isotipo se perdía.
  - Es un PNG hosteado con URL absoluta fija en el layout,
    `https://epublit.com.ar/email/logo.png`: el archivo está en
    `landing/public/email/logo.png` y se publica con el deploy de la landing.
    Fija en el layout y no en el modelo porque no cambia por entorno y así
    ningún método del emailService tiene que mandarla.
  - Está a 2x (192×56) y se muestra a 96×28 (`width`/`height` explícitos), así
    se ve nítido en pantallas retina sin depender de `srcset`, que los
    clientes de correo no respetan.
  - **Hasta que esa URL exista en producción el logo no se ve**: queda el
    `alt="Epublit"` en blanco, negrita, 20 px (el texto que había antes). Hay
    que deployar la landing antes de (o junto con) el primer envío.
  - Anotado también en `back/emails/README.md`.

### Sistema de diseño

- Nuevo `PasswordInput` (`design-system/components/forms/`, en el barrel): un
  `Input` con botón mostrar/ocultar. `Input` ganó la prop `trailing` (control
  interactivo al final) y `ref`.
- `Field` ahora enlaza su ayuda/error con el control (`aria-describedby`) e
  `Input` marca `aria-invalid`: los errores inline se leen con el campo.
- Íconos Lucide nuevos: `mail`, `clock`.

### Mock temporal

`front/src/api/auth.mock.ts`, activo sólo con `VITE_MOCK_REGISTRO=true` (hoy
en `front/.env.development.local`, que no se commitea). `api/auth.ts` tiene
rutas provisorias para reenviar/confirmar/restablecer sólo para que el código compile: no
son una propuesta, el contrato lo define el planner. Se borra el mock (y la
variable) cuando el back esté listo.

Cómo forzar cada estado con el mock:

| Estado | Cómo |
| --- | --- |
| CUIT con dígito verificador inválido | Registro, CUIT `20-12345678-9` |
| CUIT inexistente en el padrón | Registro, CUIT `20-00000000-1` |
| CUIT ya registrado | Registro, CUIT `30-71234567-1` |
| Padrón caído (error general) | Registro, CUIT `30-70000000-8` |
| Email ya registrado | Registro, email `registrado@editorial.com.ar` |
| Registro OK → Revisá tu correo | Cualquier otro email + CUIT válido, p. ej. `20-12345678-6` |
| Demasiados reenvíos | Reenviar 4 veces en la misma sesión (esperando la cuenta regresiva) |
| Login sin confirmar | Login con `sinconfirmar@editorial.com.ar`, cualquier contraseña |
| Login normal | Cualquier otro: va al back real (`/user/login`) |
| Link confirmado | `/verificar-email?token=ok` ("Entrar a Epublit" abre una sesión falsa: el back rechaza sus llamadas; salir con "Cerrar sesión") |
| Link ya usado | `/verificar-email?token=ya-confirmado` |
| Link vencido | `/verificar-email?token=vencido` |
| Link inválido | `/verificar-email?token=cualquier-cosa` o sin token |
| Olvidé mi contraseña: pedido y "Revisá tu correo" | `/olvide-contrasena`, cualquier email válido (la respuesta es siempre la misma) |
| Demasiados pedidos de restablecimiento | Pedir 4 veces en la misma sesión |
| Restablecer, cuenta nueva | `/restablecer-contrasena?token=ok` |
| Restablecer, cuenta vieja (muestra el usuario) | `/restablecer-contrasena?token=ok-usuario` |
| Restablecer, contraseña cambiada | Con `ok`, guardar una contraseña de 8 o más ("Entrar a Epublit" abre la misma sesión falsa) |
| Restablecer, link vencido | `/restablecer-contrasena?token=vencido` |
| Restablecer, vence mientras se escribe | `/restablecer-contrasena?token=vence-al-guardar` y guardar |
| Restablecer, link ya usado | `/restablecer-contrasena?token=usado` |
| Restablecer, link inválido | `/restablecer-contrasena?token=cualquier-cosa` o sin token |

## Decisiones

1. **La bienvenida (con el CSR adjunto) se manda al confirmar el email, no al
   registrarse.** El primer mail es sólo el de confirmación. Así el CSR llega
   a una dirección comprobada, no salen dos mails juntos, y si el email estaba
   mal escrito no se le manda nada más que el link a un desconocido. La
   pantalla de "confirmado" avisa que la bienvenida está en camino.
2. **Confirmar el email inicia sesión** (botón "Entrar a Epublit"): quien abre
   el link acaba de registrarse y demostró que el email es suyo; pedirle la
   contraseña otra vez es fricción sin ganancia.
3. **Corregir el email = volver a registrarse** con los datos precargados, en
   lugar de una pantalla para cambiar el email de una cuenta pendiente.
4. **Los links de confirmación anteriores siguen sirviendo** hasta vencer
   después de un reenvío. Evita el "abrí el mail viejo y no anda".
5. **El email es único entre todas las cuentas** (decisión del usuario; reemplaza
   la propuesta anterior de un mail por cuenta para el email compartido). Un
   email = una cuenta: el login por email nunca es ambiguo y restablecer manda
   un solo mail. El login sigue aceptando "Email o usuario" por las 2 cuentas
   viejas sin email.
6. **Restablecer la contraseña de una cuenta nueva sin confirmar también
   confirma el email**: abrir el link demuestra que controla el correo. Como
   es una confirmación, en ese momento sale la bienvenida (decisión 1).
7. **Restablecer inicia sesión** al guardar, coherente con la decisión 2.
8. **Los links de restablecer duran 1 hora y sirven una vez**; al cambiar la
   contraseña con uno, los demás links de restablecer de esa cuenta dejan de
   servir (a diferencia de los de confirmación: acá un link viejo vivo es un
   riesgo, no una comodidad).
9. **Un solo campo de contraseña nueva**, sin repetirla: el botón de mostrar
   cubre el error de tipeo, igual que en el registro.
10. **Plazos aprobados por el usuario**: 24 h el link de confirmación, 1 h el
    de restablecer, 60 s de espera entre reenvíos.

## Datos necesarios

Capacidades que el front necesita del back. Nada de esto está implementado en
`back/` (salvo los templates de mail y el logo, ya creados).

**Nombres de rutas**: por pedido del usuario, toda ruta nueva del back va en
inglés. Los nombres provisorios del mock en `front/src/api/auth.ts`
(`/user/verify-email`, `/user/resend-verification`, `/user/forgot-password`,
`/user/reset-password`) sólo cumplen esa regla para que el código compile; el
contrato final (rutas, métodos, cuerpos) lo define el planner. Las rutas del
front (`/verificar-email`, `/revisar-correo`, `/olvide-contrasena`,
`/restablecer-contrasena`) quedan en castellano: son las que ve el usuario y
las que llevan los links de los mails.

**Registro (escritura: crear cuenta)**
- Crear una cuenta con email, contraseña y CUIT, **sin username**. El back
  genera un username interno para las cuentas nuevas (no se muestra ni se usa
  para ingresar).
- Validar lo mismo que el front: email con formato válido y normalizado (trim
  + minúsculas) antes de guardar y de comparar; contraseña de al menos 8
  caracteres; CUIT de 11 dígitos con dígito verificador válido (módulo 11,
  mismo algoritmo que `front/src/lib/cuit.ts#hasValidCuitCheckDigit`).
- **El email es único entre todas las cuentas** (viejas y nuevas), comparando
  normalizado: índice único sobre el email sin distinguir mayúsculas e
  ignorando vacíos/null (las 2 cuentas viejas sin email no chocan entre sí).
  Aplica también a editar el email desde el perfil: un email ya usado se
  rechaza con un mensaje mostrable.
- **Pre-requisito del deploy**: hoy en producción hay 2 cuentas con el mismo
  email (la misma persona con dos editoriales), así que la migración del índice
  único fallaría. Antes de migrar, alguien tiene que cambiar el email de una
  de las dos (pendiente de confirmar con el usuario cuál y por cuál).
- Cuando el error es atribuible a un campo, el front necesita saber **de qué
  campo es** (email / password / cuit) **y qué caso es**, para mostrarlo en
  ese campo y con la copia correcta: email ya registrado, CUIT ya registrado,
  CUIT que no figura en el padrón, formato inválido. Los errores no
  atribuibles (padrón de ARCA caído, etc.) siguen como error general con un
  mensaje mostrable.
- El padrón de ARCA se sigue consultando al registrar (no antes).
- Una cuenta recién creada queda **sin confirmar** y no puede ingresar.
- Una cuenta sin confirmar **no retiene** su CUIT ni su email: si alguien se
  registra de nuevo con ese CUIT o ese email, la cuenta pendiente se reemplaza
  (es el camino de "¿Te equivocaste de email?", y evita que un registro mal
  hecho bloquee el CUIT para siempre). Cuentas confirmadas y cuentas viejas sí
  bloquean.

**Mail de confirmación (escritura: mandar link)**
- Al registrarse se manda por Postmark un mail con un link a
  `/verificar-email?token=…` del front. El token es de un solo uso y vence a
  las **24 horas** (plazo aprobado por el usuario; lo dicen el front y el mail).

**Reenviar el link (escritura)**
- Poder pedir otro link para una cuenta sin confirmar, identificada por su
  email.
- Poder pedir otro link **desde un link vencido**, sin que el usuario tenga
  que escribir el email.
- Límite de reenvíos (además de los 60 s de espera que impone el front); al
  superarlo, el front necesita distinguir ese caso para mostrar "esperá unos
  minutos".
- Los links anteriores siguen siendo válidos hasta vencer.

**Confirmar el email (escritura, disparada por la página del link)**
- Confirmar con el token y distinguir cuatro resultados: confirmado,
  ya estaba confirmado, vencido (junto con **el email de la cuenta**, para
  mostrarlo y reenviar), inválido/inexistente.
- Al confirmar, devolver una **sesión** igual a la del login (el token que hoy
  devuelve `/user/login`), para entrar directo.
- Abrir la URL del link no confirma nada por sí solo (los antivirus de correo
  abren los links): confirma la acción que dispara la página.
- Repetir la confirmación de un token ya usado no es un error: responde "ya
  confirmado".

**Mail de bienvenida**
- Se manda **al confirmar el email**, no al registrarse (decisión 1), con el
  CSR adjunto como hoy.
- Saluda con la **razón social de ARCA** de la cuenta, no con el username.

**Pedir restablecer la contraseña (escritura: mandar link)**
- Pedir un link para restablecer la contraseña a partir de un email
  (normalizado). La respuesta es **siempre la misma**, exista o no una cuenta
  con ese email, esté confirmado o no: el front no puede distinguir los casos
  y nunca muestra si el email existe.
- Si el email es de una cuenta: mail `restablecer-contrasena` con un link a
  `/restablecer-contrasena?token=…` del front. Como el email es único, es
  siempre un solo mail.
- Las cuentas sin email no se pueden recuperar por acá (sólo queda `feriaros`,
  que entra con su usuario; la recupera Thorque a mano si hace falta).
- Límite de pedidos por email (y por origen) en un período; al superarlo, el
  front necesita distinguir ese caso para mostrar "esperá unos minutos". El
  límite no puede delatar si el email existe.

**Restablecer la contraseña (lectura + escritura)**
- Token de un solo uso, vence a la **1 hora** (la copia del front y del mail
  dice "1 hora").
- Consultar un token **sin consumirlo**, al abrir la página, y distinguir:
  válido (con la **razón social** de la cuenta y, sólo en cuentas viejas, su
  **usuario**), vencido (con **el email de la cuenta**, para mostrarlo y
  reenviar), ya usado, inválido/inexistente.
- Guardar la contraseña nueva con el token: misma regla de contraseña que el
  registro (al menos 8 caracteres). Responde con los mismos resultados (por si
  venció o se usó entre que se abrió la página y se guardó) y, si salió bien,
  con una **sesión** igual a la del login, para entrar directo.
- Al cambiar la contraseña, todos los links de restablecer pendientes de esa
  cuenta dejan de servir.
- Si la cuenta es nueva y no había confirmado el email, restablecer la
  contraseña **también lo confirma** y dispara la bienvenida (decisión 6).

**Métodos nuevos del emailService (los agrega back-implementer)**

Con el mismo criterio que `enviarBienvenida` (un método tipado por mail, links
armados con `panelUrl`):
- `enviarConfirmacionEmail`: alias `confirmar-email`, modelo
  `{ nombre, url_confirmar }`. `nombre` es la razón social de ARCA (ya se
  conoce al registrar, porque se consulta el padrón); `url_confirmar` es
  `/verificar-email?token=…` sobre `panelUrl`.
- `enviarRestablecimientoContrasena`: alias `restablecer-contrasena`, modelo
  `{ cuenta, url_restablecer }`. `cuenta` es la razón social, más
  ` (usuario <username>)` en las cuentas viejas (en las nuevas el username es
  interno y no se muestra); `url_restablecer` es
  `/restablecer-contrasena?token=…` sobre `panelUrl`.
- `enviarBienvenida`: sin cambios de modelo, pero `nombre` pasa a ser la razón
  social y se llama al confirmar el email, no al registrar.
- `test/email.test.ts` sólo prueba hoy `bienvenida`: hoy pasa con los
  templates nuevos. Hay que sumar un caso por cada método nuevo (variables del
  template presentes en el modelo y links apuntando a `panelUrl`).

**Login (lectura: iniciar sesión)**
- Ingresar con "email o usuario" + contraseña: si lo ingresado es un email,
  se busca por email normalizado; si no, por username exacto (las cuentas
  viejas siguen entrando con su usuario, incluidas las 2 sin email).
- Si la contraseña es correcta pero la cuenta nueva no confirmó el email, el
  front necesita distinguir ese caso de "credenciales inválidas". Con
  contraseña incorrecta, responde credenciales inválidas igual que siempre
  (no revela si la cuenta está sin confirmar).
- **Las cuentas existentes (las 8 de producción) no se bloquean** por no tener
  email confirmado: el requisito de confirmación aplica sólo a cuentas creadas
  con el registro nuevo.

## Fuera de alcance / para decidir después

- El perfil (`PerfilPage`) deja editar el email sin confirmarlo (la unicidad sí
  queda cubierta por el índice). Ahora que el email es el usuario de las
  cuentas nuevas, cambiarlo debería pasar por la misma confirmación: queda para
  otra historia.
- La barra superior muestra lo que se tipeó para ingresar (email o usuario);
  conviene que muestre la razón social.
- El alta de clientes (`ClienteFormFields`) valida el CUIT sólo por largo y
  corta el pegado con guiones (`maxLength` antes de limpiar). Podría usar
  `lib/cuit.ts`; no se tocó.

## Datos de producción (decidido con el usuario, 2026-11-18)

Antes de aplicar el índice único sobre email, en producción:

- `feriaros` comparte email con `caro` (misma persona): se le **vacía el
  email** (queda NULL). La cuenta y sus datos quedan intactos y sigue
  entrando con su usuario.
- `brumana` y `nidodevacas` no tienen email: se les carga el que pasó el
  usuario.

Se hace con un SQL puntual al deployar, **no** en una migración versionada,
para no dejar emails de clientes en el historial de git. La migración del
índice tiene que fallar con un mensaje claro si todavía hay duplicados.

Agent: ae8e82205bd757dad
