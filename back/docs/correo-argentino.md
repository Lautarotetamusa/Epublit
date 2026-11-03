# Integración con Correo Argentino (MiCorreo + PAQ.AR)

Cómo se cotizan, generan y siguen los envíos de la tienda online. Cada
editorial usa **su propia cuenta** de Correo Argentino: Epublit no es el
remitente ni factura los envíos, solo guarda las credenciales de cada cuenta y
las usa para operar en su nombre.

> Este documento es la fuente técnica. La sección
> [Onboarding de una editorial](#onboarding-de-una-editorial) y el
> [checklist](#checklist) están pensados para derivar de ahí el instructivo
> para editoriales.

## Las dos APIs

Correo Argentino expone dos APIs distintas y complementarias:

| API | Para qué la usamos | Base TEST | Base PRODUCCIÓN |
|---|---|---|---|
| **MiCorreo** | Cotizar el envío (`POST /rates`) y autenticar | `https://apitest.correoargentino.com.ar/micorreo/v1` | `https://api.correoargentino.com.ar/micorreo/v1` |
| **PAQ.AR** | Crear la orden, generar la etiqueta y consultar el seguimiento | `https://apitest.correoargentino.com.ar/paqar/v1` | `https://api.correoargentino.com.ar/paqar/v1` |

En el código:

- `src/modules/tienda/shipping/clients/micorreo.client.ts` — token y tarifas.
- `src/modules/tienda/shipping/clients/paqar.client.ts` — auth, órdenes, etiquetas y tracking.
- `src/modules/tienda/shipping/quote.service.ts` — cotización del carrito.
- `src/modules/tienda/order/label.service.ts` — alta de la orden y etiqueta.
- `src/modules/tienda/order/tracking.service.ts` — seguimiento.
- `src/modules/tienda/shipping/shippingConfig.service.ts` — credenciales y configuración por cuenta.

## Modelo de cuentas: una por editorial

La tienda es multi-tenant: cada editorial tiene su propio depósito, su propio
MercadoPago y su propia facturación. Los envíos siguen la misma lógica.

| Aspecto | Por qué la cuenta es de la editorial |
|---|---|
| **Remitente** | El envío sale del domicilio de la editorial. El origen y el `customerId` son suyos. |
| **Facturación** | PAQ.AR le factura los envíos al titular del `agreement`. Una cuenta única trasladaría ese costo a Epublit. |
| **Datos fiscales** | La etiqueta muestra la razón social y el domicilio del remitente. Deben ser los de la editorial. |
| **Seguimiento y reclamos** | Los tracking numbers y los reclamos quedan en la cuenta que generó el envío. |
| **Aislamiento** | `shipping_config` guarda las credenciales cifradas por `user`; todas las consultas están scoped a la cuenta. |
| **MercadoPago** | Ya es por editorial: cada una cobra con su propia cuenta. Los envíos no son la excepción. |

Epublit **no necesita credenciales globales** para operar la plataforma. Solo
guarda las de cada editorial.

### TEST no es la cuenta de producción

- **Para QA de la plataforma**: alcanza con **una cuenta TEST de Epublit** (o
  la de una editorial piloto). Es un sandbox para validar token, cotización y
  etiquetas. No opera la producción.
- **Para producción**: cada editorial abre su cuenta y carga sus credenciales.
- El `customerId` de TEST tiene que existir en el ambiente TEST. El de
  producción no sirve para probar.

### Sin cuenta de Correo

Una editorial puede vender igual con **retiro en local**. La cotización de
envío queda deshabilitada hasta que configure MiCorreo y PAQ.AR.

## Cómo se obtienen las credenciales

No hay autogestión de credenciales de API. Las asigna el área comercial de
Correo Argentino, **por ambiente** (TEST y PRODUCCIÓN son credenciales
distintas). El manual de MiCorreo lo dice explícitamente: “las credenciales de
acceso deberán ser solicitadas a Correo para cada uno de los ambientes”.

### 1. Tener cuenta MiCorreo

Si la empresa no tiene cuenta web de MiCorreo:

- Registro: <https://micorreo.correoargentino.com.ar/register>

Pide razón social, CUIT, domicilio y datos del responsable. El alta web es
independiente de las credenciales de API, pero la cuenta comercial es la que
después usa el ejecutivo.

### 2. Pedir las credenciales de API

Formulario de integración:

- <https://www.correoargentino.com.ar/MiCorreo/public/contact>

Campos y qué poner:

| Campo | Qué cargar |
|---|---|
| Razón social | La empresa titular (Epublit para la cuenta TEST de la plataforma; cada editorial para la suya) |
| Nombre y apellido | Responsable de la integración |
| CUIT / CUIL | El real de la empresa |
| Correo electrónico | Email de contacto técnico/comercial |
| Cód. área + Celular | Teléfono de contacto |
| Sitio web | URL de la tienda o de la empresa |
| Motivo del contacto | **“Asesoramiento sobre integración por app”** (o “Requiero abrir cuenta MiCorreo” si todavía no tienen cuenta) |
| ¿Sos cliente de MiCorreo? | Sí/No según corresponda |
| N° de cliente | Solo si ya son clientes |
| ¿Sos agencia? | No, salvo que corresponda |

El formulario **no tiene un campo de mensaje libre**. La solicitud de TEST se
hace explícita cuando el ejecutivo contacta por teléfono o email.

### 3. Qué pedirle al ejecutivo

Para **cada ambiente** que se quiera habilitar:

- **MiCorreo**: `userToken` y `passwordToken` (HTTP Basic).
- **MiCorreo**: `customerId` de ese ambiente (o el email y contraseña de la
  cuenta web para obtenerlo con `POST /users/validate`).
- **PAQ.AR**: `agreement` (código de acuerdo comercial) y `API-Key`.
- **PAQ.AR**: `sellerId` si la cuenta lo requiere (marketplaces; si no, se usa
  el `agreement`).

Aclarar en la conversación:

> “Necesitamos credenciales del ambiente de **TEST** para desarrollar y
> homologar la integración, y las de **PRODUCCIÓN** para operar. Son cuentas
> distintas.”

### 4. Datos reales también para TEST

El formulario pide datos reales de la empresa porque es un alta comercial, no
un registro de sandbox. No conviene inventar un CUIT: se valida. Para TEST se
usan los datos reales de Epublit y se pide el ambiente de prueba; el
`customerId` de prueba lo crea Correo o se crea con `POST /register` una vez
que se tienen las credenciales de API de TEST.

### 5. Diferencia entre credenciales de API y cuenta web

| Credencial | Sirve para | NO sirve para |
|---|---|---|
| `userToken` / `passwordToken` | Autenticar la API (Basic → JWT) | Entrar a la web de MiCorreo |
| Email / contraseña de la cuenta web | Entrar al panel y llamar `/users/validate` | Autenticar la API |
| `customerId` | Identificar la cuenta comercial en `/rates`, `/shipping/import`, etc. | Autenticar |

El campo **Usuario** y **Contraseña** de nuestra configuración son
`userToken`/`passwordToken`, no el email y la contraseña de la web.

## Configuración en la app

**Configuración → Envíos y retiro** (`/tienda` → pestaña “Envíos y retiro”).
Los datos se guardan por cuenta en `shipping_config`; la contraseña y la API key
se cifran con `CredentialsCipher` y nunca se devuelven al front.

| Sección | Campo | Para qué |
|---|---|---|
| MiCorreo | Usuario | `userToken` |
| MiCorreo | Contraseña | `passwordToken` (vacío = conservar la actual) |
| MiCorreo | Customer ID | `customerId` del ambiente |
| PAQ.AR | Agreement | Código de acuerdo comercial |
| PAQ.AR | API key | `API-Key` (vacío = conservar la actual) |
| PAQ.AR | Seller ID | Identificador de vendedor; si no aplica, el `agreement` |
| Origen | Calle, número, piso, depto, localidad, provincia, CP | Remitente y `postalCodeOrigin` de la cotización |
| Caja default | Alto, ancho, largo (cm) | Dimensiones del paquete |
| Peso promedio | kg | Respaldo cuando un libro no tiene peso cargado |
| Etiqueta | Formato | Formato del PDF (por defecto `10x15`) |
| Retiro | Activo, dirección, horario | Retiro en local; si está activo, dirección y horario son obligatorios |

El domicilio de origen es obligatorio para cotizar y para generar la etiqueta.
Sin peso por libro ni promedio de cuenta, la cotización devuelve
`peso_faltante`.

## Flujo de un envío

```
Comprador                Back Epublit                         Correo Argentino
─────────                ────────────                         ────────────────
Elige envío o retiro ──► POST /public/tienda/v1/cotizar
                         calcula peso y caja
                         POST MiCorreo /token ──────────────► JWT
                         POST MiCorreo /rates ──────────────► precio + plazo
                         devuelve costo al checkout

Editorial acepta ──────► POST /pedidos/:codigo/aceptar
el pedido                POST PAQ.AR /orders ───────────────► shipmentId + tracking
                         (senderData = editorial, shippingData = comprador)
                         POST PAQ.AR /labels ───────────────► PDF de la etiqueta
                         guarda el PDF y el tracking
                         GET PAQ.AR /tracking ──────────────► estado y eventos
```

Detalles de implementación:

- La cotización usa `deliveredType: "D"` (domicilio). El retiro en local no
  cotiza.
- La orden de PAQ.AR es idempotente por `shipmentClientId` (el código del
  pedido). Si el proveedor ya la conoce, se reconcilia en vez de duplicarla.
- El remitente se arma con la razón social de la editorial y el domicilio de
  origen de `shipping_config`; el destinatario sale del pedido.
- La etiqueta se guarda como PDF y se sirve por una ruta autenticada.

## Errores comunes

| Error | Causa probable | Qué revisar |
|---|---|---|
| `401 Unauthorized` en `/token` | Credenciales de API inválidas o de otro ambiente | `userToken`/`passwordToken` y URL base |
| `Customer ID no valido` | `customerId` de producción usado en TEST, o cuenta no registrada en ese ambiente | Pedir/crear el `customerId` del ambiente correcto |
| `Peso no valido` / `El peso debe ser mayor a 0` | Peso en gramos fuera de rango (1–25000) | Peso del libro o promedio de la cuenta |
| `La orden ya fue importada con anterioridad` | `extOrderId`/`shipmentClientId` repetido | La app reconcilia; si persiste, revisar el tracking existente |
| `no se encontro datos de remitente` | Perfil de MiCorreo incompleto | La app manda `senderData`; verificar domicilio de origen |
| `Account not found by apiKey` (PAQ.AR) | `agreement` o `API-Key` incorrectos | Probar conexión de PAQ.AR |
| `El codigo Postal del emisor debe tener valor` | Falta el CP de origen | Completar el domicilio de origen |
| “Probar conexión” OK pero la cotización falla | El botón solo valida el token | Probar una cotización real con un carrito |

## Seguridad

- Las credenciales se guardan cifradas en `shipping_config`; el panel nunca las
  muestra ni las devuelve.
- Las URLs base viven en `.env` (`MICORREO_BASE_URL`, `PAQAR_BASE_URL`); las
  credenciales comerciales, en la base por cuenta.
- No commitear credenciales ni pegarlas en issues/chat. Si se filtran, pedir
  la rotación al ejecutivo comercial.
- No loguear el JWT ni los datos personales del destinatario.

## Onboarding de una editorial

Para derivar el instructivo para editoriales:

1. **Crear la cuenta MiCorreo** de la editorial
   (<https://micorreo.correoargentino.com.ar/register>) si no la tiene.
2. **Pedir las credenciales de API** por el formulario
   (<https://www.correoargentino.com.ar/MiCorreo/public/contact>), motivo
   “Asesoramiento sobre integración por app”.
3. **Solicitar explícitamente** MiCorreo (`userToken`, `passwordToken`,
   `customerId`) y PAQ.AR (`agreement`, `API-Key`, `sellerId`) para TEST y
   PRODUCCIÓN.
4. **Cargar las credenciales** en Configuración → Envíos y retiro.
5. **Completar el domicilio de origen**, la caja default y el peso promedio.
6. **Probar la conexión** de MiCorreo y PAQ.AR.
7. **Hacer una cotización real** y, si corresponde, generar la primera
   etiqueta de prueba.
8. **Configurar retiro en local** si la editorial lo ofrece.

## Checklist

- [ ] Cuenta MiCorreo creada.
- [ ] Credenciales de API de TEST solicitadas (solo Epublit/QA).
- [ ] Credenciales de API de PRODUCCIÓN solicitadas (cada editorial).
- [ ] `customerId` confirmado para el ambiente que se va a usar.
- [ ] `agreement` + `API-Key` de PAQ.AR confirmados.
- [ ] Credenciales cargadas y guardadas en la app.
- [ ] Domicilio de origen completo.
- [ ] Caja default y peso promedio definidos.
- [ ] “Probar conexión” OK en MiCorreo y PAQ.AR.
- [ ] Cotización de prueba OK.
- [ ] Primera etiqueta generada y descargada.
- [ ] Retiro en local configurado (si aplica).

## Mejoras pendientes

- Obtener el `customerId` automáticamente con `POST /users/validate` a partir
  del email y contraseña de la cuenta web, para no pedirlo a mano.
- Sumar `GET /agencies` para cotizar y elegir sucursal de destino.
- Ampliar “Probar conexión” para que además haga una cotización de prueba
  (`POST /rates`) y valide `customerId` + tarifas, no solo el token.
- Evaluar `POST /shipping/import` de MiCorreo si se quiere prescindir de
  PAQ.AR para el alta de envíos (hoy PAQ.AR es el proveedor de etiquetas).

## Referencias

- API MiCorreo:
  <https://www.correoargentino.com.ar/MiCorreo/public/img/pag/Correo%20Argentino%20-%20API%20MiCorreo.pdf>
- API PAQ.AR 2.0:
  <https://www.correoargentino.com.ar/MiCorreo/public/img/pag/apiPaqAr-v2.pdf>
- Primeros pasos / integraciones:
  <https://www.correoargentino.com.ar/MiCorreo/public/primeros-pasos>
- Formulario de contacto:
  <https://www.correoargentino.com.ar/MiCorreo/public/contact>
