# API

Generado por `scripts/generate-api-docs.js`. No editar a mano.

## anticipo (/anticipos)

- `GET    /anticipos/`
- `POST   /anticipos/:id/pagar`

## cliente (/cliente)

- `POST   /cliente/`
- `GET    /cliente/`
- `GET    /cliente/:id/stock`
- `PUT    /cliente/:id/stock`
- `GET    /cliente/:id/ventas`
- `GET    /cliente/:id`
- `PUT    /cliente/:id`
- `DELETE /cliente/:id`

## coleccion (/coleccion)

- `POST   /coleccion/`
- `GET    /coleccion/`
- `GET    /coleccion/:id`
- `PUT    /coleccion/:id`
- `DELETE /coleccion/:id`
- `GET    /coleccion/:id/libros`
- `POST   /coleccion/:id/portada`
- `DELETE /coleccion/:id/portada`

## deposito (/deposito)

- `POST   /deposito/`
- `GET    /deposito/`
- `GET    /deposito/:id`
- `PUT    /deposito/:id`
- `DELETE /deposito/:id`
- `GET    /deposito/:id/libros`

## libro (/libro)

- `POST   /libro/`
- `GET    /libro/lista_libros`
- `GET    /libro`
- `GET    /libro/:isbn`
- `GET    /libro/:isbn/precio`
- `GET    /libro/:isbn/depositos`
- `PUT    /libro/:isbn`
- `DELETE /libro/:isbn`
- `POST   /libro/:isbn/portada`
- `POST   /libro/:isbn/personas`
- `PUT    /libro/:isbn/personas`
- `DELETE /libro/:isbn/personas`

## liquidacion (/liquidacion)

- `GET    /liquidacion/`

## liquidaciones (/liquidaciones)

- `GET    /liquidaciones/`
- `POST   /liquidaciones/`
- `GET    /liquidaciones/:id`
- `POST   /liquidaciones/:id/personas/:idPersona/pagos`
- `DELETE /liquidaciones/:id/pagos/:idPago`

## medioPago (/medio_pago)

- `GET    /medio_pago/`
- `POST   /medio_pago/`
- `PUT    /medio_pago/:id`
- `DELETE /medio_pago/:id`

## metricas (/metricas)

- `GET    /metricas/meses`
- `GET    /metricas/resumen`
- `GET    /metricas/cortes`
- `GET    /metricas/serie`
- `GET    /metricas/medios-pago`

## movimiento (/movimiento)

- `POST   /movimiento/`
- `GET    /movimiento/`
- `GET    /movimiento/:id`

## persona (/persona)

- `POST   /persona/`
- `GET    /persona/`
- `GET    /persona/:id`
- `PUT    /persona/:id`
- `DELETE /persona/:id`
- `POST   /persona/:id/foto`
- `DELETE /persona/:id/foto`

## rol (/rol)

- `GET    /rol/`
- `POST   /rol/`
- `PUT    /rol/:id`
- `DELETE /rol/:id`

## transaccion ()

- `GET    /venta/medios_pago`
- `GET    /:tipo`
- `GET    /:tipo/:id`
- `POST   /:tipo`

## user (/user)

- `POST   /user/register`
- `POST   /user/login`
- `PUT    /user`
- `POST   /user/uploadCert`
- `PUT    /user/afip`
- `GET    /user/`
