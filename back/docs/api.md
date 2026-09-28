# API

Generado por `scripts/generate-api-docs.js`. No editar a mano.

## cliente (/cliente)

- `POST   /cliente/`
- `GET    /cliente/`
- `GET    /cliente/:id/stock`
- `PUT    /cliente/:id/stock`
- `GET    /cliente/:id/ventas`
- `GET    /cliente/:id`
- `PUT    /cliente/:id`
- `DELETE /cliente/:id`

## libro (/libro)

- `POST   /libro/`
- `GET    /libro/lista_libros`
- `GET    /libro`
- `GET    /libro/:isbn`
- `GET    /libro/:isbn/precio`
- `PUT    /libro/:isbn`
- `DELETE /libro/:isbn`
- `POST   /libro/:isbn/portada`
- `POST   /libro/:isbn/personas`
- `PUT    /libro/:isbn/personas`
- `DELETE /libro/:isbn/personas`

## liquidacion (/liquidacion)

- `GET    /liquidacion/`

## persona (/persona)

- `POST   /persona/`
- `GET    /persona/`
- `GET    /persona/:id`
- `PUT    /persona/:id`
- `DELETE /persona/:id`
- `POST   /persona/:id/foto`
- `DELETE /persona/:id/foto`

## transaccion ()

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
