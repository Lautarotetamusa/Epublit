# Integración con MercadoPago

Cómo cobra la tienda online: cada editorial conecta **su propia cuenta** de
MercadoPago y la plata de cada venta le llega directo a esa cuenta. Epublit no
toca el dinero; solo crea el link de pago con el token del vendedor y se entera
del resultado por webhook.

Código: `src/modules/tienda/payment/` (OAuth, cliente HTTP, webhook) y
`src/modules/tienda/order/checkout.service.ts` (creación de la preferencia).

## Las tres cuentas

En toda operación participan tres cuentas de MercadoPago:

| Rol | Quién es | Para qué |
|---|---|---|
| **Integrador** | Dueño de la aplicación de MP (`MP_CLIENT_ID`) | Epublit. Recibe la autorización OAuth de cada editorial |
| **Vendedor** | La cuenta que conecta cada editorial | Cobra los pagos (`collector_id`) |
| **Comprador** | Quien paga en el checkout | Paga (`payer_id`) |

> **Las tres tienen que ser del mismo tipo: todas reales o todas de prueba.**
> Si se mezclan, MP falla de formas poco claras (ver [Problemas conocidos](#problemas-conocidos)).

## Flujo

```
Panel Epublit           Back Epublit                     MercadoPago
─────────────           ────────────                     ───────────
1. "Conectar MP" ─────► GET /tienda/mercadopago/conectar
                        arma URL /authorization con
                        state firmado (userId, 10 min) ─► login + autorizar app
                                                          │
2.                      GET /tienda/mercadopago/callback ◄┘ ?code&state
                        verifica state, canjea code
                        (POST /oauth/token), guarda
                        tokens cifrados ────────────────► redirect al panel

3. Web de la tienda ──► POST /public/tienda/v1/pedidos
                        reserva stock 30 min, crea
                        preferencia con el token del
                        vendedor ───────────────────────► devuelve init_point
                        responde initPoint al front

4. Comprador paga en init_point ────────────────────────► procesa el pago

5.                      POST /public/tienda/v1/webhooks/  ◄─ notificación firmada
                        mercadopago?data.id&type&user_id
                        valida firma, busca la conexión
                        por user_id, GET /v1/payments/:id
                        con el token del vendedor, y
                        actualiza pedido y pago
```

### 1-2. Conexión de la cuenta (OAuth)

- `GET /tienda/mercadopago/conectar` (panel, autenticado) devuelve la URL de
  autorización con `scope=offline_access` para recibir `refresh_token`.
- El `state` lleva el `userId` firmado con HMAC y vence a los 10 minutos
  (`oauthState.ts`).
- `GET /tienda/mercadopago/callback` es público (lo llama el navegador al volver
  de MP). Canjea el `code`, consulta `/users/me` y guarda la conexión en
  `mercadopago_conexiones` con access y refresh token cifrados con
  `CREDENTIALS_ENCRYPTION_KEY`.
- Una cuenta de MP solo puede estar conectada a una editorial a la vez.
- El access token se refresca solo cuando vence. Si MP rechaza el refresh
  token (4xx, `invalid_grant`), la conexión se borra y la editorial tiene que
  reconectar. Si MP no responde o da 5xx, la conexión se conserva y se responde
  502. Los refrescos concurrentes de una misma cuenta comparten la misma
  llamada, porque MP invalida el refresh token al usarlo.
- `GET /tienda/mercadopago` muestra el estado y `DELETE /tienda/mercadopago`
  desconecta.

### 3. Preferencia de pago (Checkout Pro)

`checkout.service.ts` (`preferenceBody`) crea la preferencia con el access token
**del vendedor**, por eso el cobro va a su cuenta. Campos relevantes:

- `external_reference`: UUID del pedido. Así se vincula el pago con el pedido.
- `notification_url`: `PUBLIC_API_URL + /public/tienda/v1/webhooks/mercadopago?user_id=<mp_user_id del vendedor>`.
  El `user_id` le dice al webhook qué conexión (qué token) usar.
- `expiration_date_to`: igual al vencimiento de la reserva de stock (30 min).
- `back_urls` apuntan a `urlRetorno` del pedido; `auto_return` solo si es https.

- `payment_methods.excluded_payment_types`: se excluyen `ticket` (Rapipago/Pago
  Fácil) y `atm`, porque se acreditan días después y la reserva dura 30 minutos.

La preferencia se crea **después** de commitear el pedido y la reserva, para no
retener locks de stock mientras MP responde. Si MP falla, el pedido queda en
`pendiente_pago` sin link y el `POST /pedidos` responde 502. Reintentar con la
misma `Idempotency-Key` genera el link.

`POST /public/tienda/v1/pedidos/:codigo/pago` regenera el link si el anterior
venció y la reserva sigue vigente. Un lock por pedido evita crear dos
preferencias pagables a la vez.

### Acceso del comprador al pedido

La API key es pública (vive en el JS de la tienda) y los códigos de pedido son
correlativos. Por eso `GET /pedidos/:codigo`, `POST /pedidos/:codigo/pago` y
`POST /pedidos/:codigo/cancelar` exigen además el header
`X-Pedido-Referencia` con la `referencia` del pedido:

- la devuelve `POST /pedidos` en `pedido.referencia`;
- MercadoPago la agrega como `external_reference` en la URL de retorno.

Sin la referencia o con una incorrecta, la respuesta es 404, igual que un
pedido inexistente.

### Límites de la API pública

- 120 requests por minuto por IP en toda la API pública (salvo el webhook).
- 20 `POST /pedidos` cada 15 minutos por IP.
- Máximo 50 ítems por carrito y 100 unidades por ítem.

Al superar un límite se responde `429 limite_excedido`. La IP sale de
`X-Forwarded-For` según `TRUST_PROXY`, que tiene que coincidir con la cantidad
de proxies delante del back.

### 5. Webhook

`webhook.service.ts` procesa solo las notificaciones `type=payment`:

1. **Firma**: solo para `type=payment`, valida `x-signature` (`ts=…,v1=…`) con HMAC-SHA256 de
   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` usando
   `MP_WEBHOOK_SECRET`. Rechaza con 401 si no coincide o si `ts` tiene más de
   10 minutos (`webhookSignature.ts`).
2. Busca la conexión por `user_id`. Si no existe responde **409** para que MP
   reintente: si la editorial reconecta, el pago todavía se procesa.
3. Consulta el pago real en MP. El estado se toma de la API, nunca del body.
   Si el `collector_id` del pago no es la cuenta conectada, se ignora (el
   `user_id` del query no forma parte de la firma).
4. Idempotencia: `webhook_eventos` registra `<payment_id>:<status>` y los
   eventos repetidos no hacen nada.
5. Busca el pedido por `external_reference`, valida monto y moneda, y aplica:
   `approved` → pedido `pagado`; `rejected`/`cancelled` → pago rechazado;
   `refunded`/`charged_back` → reembolsado.
6. Se reembolsan automáticamente (con `X-Idempotency-Key: refund-<pago>`):
   - un pago aprobado sobre un pedido ya cancelado o vencido;
   - un segundo pago aprobado sobre un pedido ya pagado (por ejemplo, el
     comprador pagó en dos pestañas).

Las notificaciones IPN legacy (`?topic=payment&id=…`, `topic=merchant_order`)
no vienen firmadas de forma verificable: se responden 200 y se ignoran.

## Configuración

Variables en `back/.env` (ver `infra/.env.example`):

| Variable | Valor |
|---|---|
| `MP_CLIENT_ID` | Client ID de la aplicación (Credenciales de producción) |
| `MP_CLIENT_SECRET` | **Client Secret**: unos 32 caracteres, sin prefijo. No confundir con el Access Token (`APP_USR-…`) |
| `MP_REDIRECT_URI` | `<URL pública del back>/tienda/mercadopago/callback`. Tiene que coincidir carácter por carácter con la cargada en la app de MP |
| `MP_WEBHOOK_SECRET` | Clave secreta de Webhooks **del modo que corresponda** (ver abajo) |
| `MP_PANEL_URL` | URL del panel a la que vuelve el navegador después del OAuth |
| `PUBLIC_API_URL` | URL pública del back. Con ella se arma el `notification_url` |
| `CREDENTIALS_ENCRYPTION_KEY` | Clave para cifrar los tokens. Si cambia, las conexiones existentes dejan de poder descifrarse |
| `TRUST_PROXY` | Cantidad de proxies delante del back, para el rate limit por IP |

En `NODE_ENV=prod` el back **no arranca** si falta alguna de estas variables o
tiene un valor de dev: `HOST`, `PUBLIC_API_URL`, `MP_REDIRECT_URI` y
`MP_PANEL_URL` tienen que ser URLs https públicas, los secretos de MP no pueden
estar vacíos, `MP_CLIENT_SECRET` no puede ser un Access Token, y
`CREDENTIALS_ENCRYPTION_KEY` tiene que tener al menos 32 caracteres y ser
distinta de `JWT_SECRET`. El error lista todas las variables con problemas.

En la aplicación de MP ("Tus integraciones"):

1. **Redirect URL de OAuth** = `MP_REDIRECT_URI`.
2. **Webhooks** → URL `<PUBLIC_API_URL>/public/tienda/v1/webhooks/mercadopago`,
   evento **Pagos**. Hay una configuración y **una clave secreta distinta para
   "Modo de prueba" y "Modo productivo"**. `MP_WEBHOOK_SECRET` tiene que ser la
   del modo con el que se firman los pagos de ese entorno.

Después de cambiar el `.env` hay que reiniciar el back (nodemon no lo relee).

## Entorno de prueba

La aplicación de producción pertenece a una cuenta real, así que **no sirve
para probar con usuarios de prueba**. Para dev se usa una aplicación aparte:

1. En el panel de developers (cuenta real) → **Cuentas de prueba**, crear tres
   usuarios de Argentina:
   - **Marketplace/integrador**: va a ser el dueño de la app de prueba.
   - **Vendedor**: la cuenta que conecta la tienda.
   - **Comprador**: el que paga.
2. Logueado **solo con el integrador** (ventana de incógnito o perfil de
   Firefox aparte), crear una aplicación de Checkout Pro con OAuth y configurar
   Redirect URL y Webhooks como arriba.
3. Poner `MP_CLIENT_ID`, `MP_CLIENT_SECRET` y `MP_WEBHOOK_SECRET` de esa app en
   el `.env` de dev y reiniciar el back.
4. Exponer el back con un túnel (`ngrok http 3001`) y usar esa URL en
   `PUBLIC_API_URL`, `MP_REDIRECT_URI` y en la config de la app. Si el túnel
   cambia de subdominio, hay que actualizar los tres lugares.
5. Conectar la tienda desde el panel, logueado en MP **solo con el vendedor**.
6. Abrir el `init_point` logueado **solo con el comprador** y pagar con una
   tarjeta de prueba:
   - Mastercard `5031 7557 3453 0604`, CVV `123`, vencimiento `11/30`, DNI `12345678`.
   - El titular define el resultado: `APRO` aprobado, `OTHE` rechazado, `CONT` pendiente.
   - Si MP pide un código de verificación por email, son los últimos 6 dígitos
     del User ID del usuario de prueba.

Para pagar solo hace falta la sesión del comprador. El vendedor ya autorizó por
OAuth y el back usa su token guardado.

### Depurar webhooks

`http://localhost:4040` es el inspector de ngrok: muestra cada request que
entró por el túnel (headers, body y respuesta del back). Con **Replay** se puede
reenviar una notificación sin esperar el reintento de MP, pero solo dentro de
los 10 minutos de vigencia de la firma. Pasado ese tiempo el back la rechaza con
401 aunque la clave sea correcta.

El simulador de notificaciones del panel de MP manda un `data.id` inventado: el
back valida la firma, MP responde 404 al consultar ese pago y el back contesta
502. Eso no indica un problema. La prueba válida es un pago real.

## Problemas conocidos

| Síntoma | Causa |
|---|---|
| Botón "Pagar" deshabilitado, sin error | El comprador es la misma cuenta que el vendedor |
| "Una de las partes con la que intentás hacer el pago es de prueba" | Se mezclan cuentas reales y de prueba (por ejemplo, vendedor real y navegador logueado con un usuario de prueba) |
| "Oh, no, algo anduvo mal" con `challenge: "reauth"` en la respuesta de `/checkout/v1/payment/api/flow` | La app pertenece a una cuenta real y vendedor y comprador son de prueba. Usar una app creada por un integrador de prueba |
| `400 Invalid users involved` al crear un pago por API | La misma causa que la fila anterior |
| Como invitado: `is_eligible: false` y `service_error` | Con un vendedor de prueba, MP no permite pagar sin estar logueado |
| Callback de OAuth responde 502 | Falló el canje del `code`. El detalle de MP (por ejemplo `invalid_client`) queda en el log del back. Lo más común es tener el Access Token en `MP_CLIENT_SECRET` o una `MP_REDIRECT_URI` distinta a la de la app |
| Webhook responde 401 | `MP_WEBHOOK_SECRET` es la clave del otro modo (prueba o productivo), o la firma tiene más de 10 minutos |
| El webhook no llega | El túnel está caído o cambió de URL, o `PUBLIC_API_URL` no es pública |
| `EADDRINUSE :::3001` | Hay otro proceso del back corriendo (por ejemplo, uno lanzado por otra herramienta). Ver `ss -ltnp \| grep 3001` |

Al reconectar una tienda con otra cuenta de MP, los links pendientes que ya
existían siguen cobrando a la cuenta anterior. Hay que generar pedidos nuevos.
