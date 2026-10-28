# Infra al momento
el server de hostinger está ocupado con el chatwoot de la utn y el nuestro
propio, y con nginx instalado localmente ahi, por eso era un quilombo
cambiarlo, asi que dejé el docker compose levantando el back con el puerto PORT
abierto para q nginx lo apunte desde ahi.


# infra/ — Producción

Infraestructura de producción del refactor: **Postgres + back + nginx con
TLS**, más el job de migraciones de esquema y los scripts de operación.

Todo vive **autocontenido en `/home/Epublit`** (no se reusan directorios de la
app vieja; sus datos se mueven acá en el corte).

```
Internet
   │ 80/443
   ▼
 nginx (borde, TLS, Let's Encrypt)
   ├── /        → estáticos del SPA (./www/front)
   ├── /api/    → back (Express :3000, prefijo recortado)
   └── /files/  → back (./files: logos, portadas, fotos y etiquetas)
                      │
                      └── db (Postgres 16, sólo red interna)
```

**El front no corre en Docker.** Es un SPA de Vite: el workflow de deploy lo
buildea y copia `front/dist` a `www/front`; el nginx de borde lo sirve directo.
El compose monta `./www` (no el dist) para que el reemplazo se vea al instante.

El front se buildea con `VITE_API_URL=https://<dominio>/api`, así que todo
vive en el mismo origen y no hay CORS en el navegador.

## Layout en el servidor

```
/home/Epublit/
├── .env                              # se crea una vez a mano (nunca en git)
├── docker-compose.yml                # lo copia el workflow
├── nginx/templates/default.conf.template
├── www/front/                        # dist del SPA (lo copia el workflow)
├── files/                            # logos/, etiquetas/ y uploads
└── afipkeys/                         # <cuit>/cert.*, private_key.key, Tokens/
```

## Archivos

| archivo | qué es |
|---|---|
| `docker-compose.yml` | stack de producción (db, back, nginx, certbot) + jobs |
| `.env.example` | variables; copiar a `.env` en el servidor |
| `nginx/templates/default.conf.template` | vhost (HTTP→HTTPS, `/api`, `/files`, SPA) |
| `scripts/init-letsencrypt.sh` | emite el certificado inicial |
| `scripts/backup-db.sh` / `restore-db.sh` | backup y restore de Postgres |
| `scripts/push-env.sh` | sube el `.env` local al servidor y recrea el back |

## Requisitos

- Docker + Docker Compose v2 en el servidor.
- DNS `DOMAIN` apuntando al servidor.
- Puertos **80** y **443** libres.
- Los archivos existentes (`files/` y `afipkeys/`) accesibles para moverlos.

## Primer despliegue

El **código** (compose, nginx, dist del front) lo copia
`.github/workflows/deploy.yml`. Lo que se hace una sola vez a mano:

```bash
# 1. Directorio de la app + datos
sudo mkdir -p /home/Epublit/{files,afipkeys,www}
sudo chown -R ubuntu:ubuntu /home/Epublit

# 2. Mover los archivos existentes (logos, portadas, fotos y certs AFIP)
mv <carpeta-vieja>/files/*    /home/Epublit/files/
mv <carpeta-vieja>/afipkeys/* /home/Epublit/afipkeys/

# 3. Permisos del contenedor: el back corre como `node` (uid 1000)
sudo chown -R 1000:1000 /home/Epublit/files /home/Epublit/afipkeys

# 4. Configuración
cd /home/Epublit
cp <repo>/infra/.env.example .env
$EDITOR .env                # dominio, images, password de Postgres, CUIT...

# 5. Primer deploy (desde GitHub Actions, ver abajo) o a mano:
#    copiar docker-compose.yml + nginx/ + www/front/ y después:
docker compose pull
docker compose --profile tools run --rm migrate
docker compose up -d

# 6. Certificado TLS
<repo>/infra/scripts/init-letsencrypt.sh
```

> `DB_PASS` debe ser **alfanumérica**: el back arma `DATABASE_URL`
> por interpolación y una password con `@`, `:` o `/` rompe la URL.

## nginx del host

El compose **no** levanta nginx: el server ya tiene uno (Hostinger). El back
queda publicado sólo en loopback (`127.0.0.1:${BACK_PORT}`, default 3001) y el
nginx del host hace:

```nginx
# API + landing
server {
    listen 443 ssl;
    server_name epublit.com.ar;

    root /home/Epublit/landing;
    index index.html;
    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /files/ {
        proxy_pass http://127.0.0.1:3001/files/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# SPA interno
server {
    listen 443 ssl;
    server_name app.epublit.com.ar;

    root /home/Epublit/www/front;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`PUBLIC_URL` es el origen de la **API** (`https://epublit.com.ar`): de ahí
salen las URLs de `/files` y el `VITE_API_URL` del build. `CORS_ORIGIN` es el
origen del **SPA** (`https://app.epublit.com.ar`), separado justamente porque
viven en dominios distintos. Si el SPA llamara a la API en su mismo origen, no
haría falta CORS.

`BACK_PORT` se define en el `.env`; el contenedor siempre escucha en `3000`.

## Deploy automático

`.github/workflows/deploy.yml` corre **después** de `build` en `main` (o a
mano con `workflow_dispatch`):

1. **Front**: `npm ci && npm run build` con la URL derivada de `PUBLIC_URL`
   (del `.env`) y copia `front/dist` a `www/front` (reemplazo atómico).
2. **Infra**: copia `docker-compose.yml`, `nginx/templates/` y el `.env`.
3. **Deploy**: login a GHCR, `docker compose pull`, migraciones
   (`--profile tools run --rm migrate`), `up -d --remove-orphans` y limpieza
   de imágenes.

Secretos ya cargados en el repo:

| secret | qué es |
|---|---|
| `SERVER_HOST` | host SSH |
| `SERVER_PORT` | puerto SSH |
| `SERVER_USERNAME` | usuario SSH |
| `SSH_PRIVATE_KEY` | clave privada SSH |
| `SSH_PASSWORD` | **passphrase** de la clave |
| `DEPLOY_PATH` | `/home/Epublit` |
| `ENV_FILE_CONTENT` | contenido completo del `.env` (ver `.env.example`) |
| `AFIP_CERT` / `AFIP_PRIVATE_KEY` | par de homologación (CUIT 20434919798) |

`ENV_FILE_CONTENT` es la fuente de verdad del `.env`: el deploy lo reescribe en
cada corrida. Tiene que incluir `DB_NAME`, `DB_USER`, `DB_PASS`, `JWT_SECRET`,
`AFIP_CUIT_PROD`, `DOMAIN`, `PUBLIC_URL` y `CORS_ORIGIN` (de `PUBLIC_URL` se
deriva `VITE_API_URL` para el build del front).

## Migración de datos

La migración MariaDB → Postgres ya fue ejecutada. El script one-off, la imagen
`Dockerfile.migracion`, la dependencia `mysql2` y las variables `LEGACY_DB_*`
se retiraron del repo. El registro histórico queda en
`specs/015-migracion-produccion/plan.md`.

## Volúmenes y archivos

- `files/`: `logos/<cuit>.png` (el logo que va en la factura), `etiquetas/`
  (PDFs de envío que se bajan por el endpoint autenticado) y las carpetas de
  uploads del refactor (`libros/portadas`, `personas/fotos`,
  `colecciones/portadas`, que se crean solas). Las carpetas históricas
  `facturas/` y `remitos/` ya no se sirven ni se generan; pueden conservarse
  en el volumen como respaldo.
- `afipkeys/<cuit>/`: `cert.crt` (producción) o `cert.pem` (homologación),
  `private_key.key` y `Tokens/`. **No hay que re-registrar certificados**, pero
  el uid 1000 necesita escritura en `Tokens/`.

## Cambiar el `.env`

El `.env` vive **sólo en el servidor** (`/home/Epublit/.env`), nunca en git ni
en el workflow. Para actualizarlo:

```bash
# desde el repo, con infra/.env completo
SERVER_HOST=thorque SERVER_USER=ubuntu SSH_KEY_PATH=~/.ssh/id_ed25519 \
  infra/scripts/push-env.sh
```

O a mano:

```bash
scp infra/.env ubuntu@thorque:/home/Epublit/.env
ssh ubuntu@thorque 'chmod 600 /home/Epublit/.env && cd /home/Epublit && docker compose up -d back'
```

> **No cambies `DB_PASS` después de inicializar la base**: queda
> grabada en el volumen. Para cambiarla hay que hacer `ALTER USER` en Postgres
> primero. Si cambiás `DOMAIN`/`PUBLIC_URL`, recreá también `nginx` (y volvé a
> emitir el certificado si cambió el dominio).

## Backups

```bash
infra/scripts/backup-db.sh          # deja infra/backups/epublit_*.dump (rota 14)
infra/scripts/restore-db.sh <dump>  # destructivo, pide confirmación
```

Los **archivos** (`files/`) y las **claves AFIP** (`afipkeys/`) viven en el
host: respaldarlos con `rsync`/`tar` aparte, idealmente a otro disco o bucket.

## Operación

```bash
docker compose ps
docker compose logs -f back
docker compose logs -f nginx
docker compose restart back
```

Renovación de TLS: el servicio `certbot` renueva cada 12 h y nginx recarga
cada 6 h. No hay que hacer nada.

## Notas

- **Imágenes**: `.github/workflows/build.yml` publica `epublit-back:prod`
  desde `main`. El front ya no se publica como imagen.
- **Postgres** no publica puerto: sólo se llega desde la red `interna`.
- **Subidas**: nginx acepta hasta 25 MB (el back limita a 20 MB).
