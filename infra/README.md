# infra/ — Producción

Infraestructura de producción del refactor: **Postgres + back + nginx con
TLS**, más los jobs de migración y los scripts de operación.

Todo vive **autocontenido en `/home/Epublit`** (no se reusan directorios de la
app vieja; sus datos se mueven acá en el corte).

```
Internet
   │ 80/443
   ▼
 nginx (borde, TLS, Let's Encrypt)
   ├── /        → estáticos del SPA (./www/front)
   ├── /api/    → back (Express :3000, prefijo recortado)
   └── /files/  → back (./files: facturas, remitos, logos, portadas, fotos)
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
├── files/                            # facturas/, remitos/, logos/, uploads
└── afipkeys/                         # <cuit>/cert.*, private_key.key, Tokens/
```

## Archivos

| archivo | qué es |
|---|---|
| `docker-compose.yml` | stack de producción (db, back, nginx, certbot) + jobs |
| `.env.example` | variables; copiar a `.env` en el servidor |
| `nginx/templates/default.conf.template` | vhost (HTTP→HTTPS, `/api`, `/files`, SPA) |
| `Dockerfile.migracion` | imagen efímera para la migración de datos (spec 015) |
| `scripts/init-letsencrypt.sh` | emite el certificado inicial |
| `scripts/backup-db.sh` / `restore-db.sh` | backup y restore de Postgres |
| `scripts/push-env.sh` | sube el `.env` local al servidor y recrea el back |

## Requisitos

- Docker + Docker Compose v2 en el servidor.
- DNS `DOMAIN` apuntando al servidor.
- Puertos **80** y **443** libres.
- Los datos de la app vieja (`files/`, `afipkeys/`) accesibles para moverlos.

## Primer despliegue

El **código** (compose, nginx, dist del front) lo copia
`.github/workflows/deploy.yml`. Lo que se hace una sola vez a mano:

```bash
# 1. Directorio de la app + datos
sudo mkdir -p /home/Epublit/{files,afipkeys,www}
sudo chown -R ubuntu:ubuntu /home/Epublit

# 2. Mover los datos de la app vieja (facturas, remitos, logos, certs AFIP)
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

> `POSTGRES_PASSWORD` debe ser **alfanumérica**: el back arma `DATABASE_URL`
> por interpolación y una password con `@`, `:` o `/` rompe la URL.

## Deploy automático

`.github/workflows/deploy.yml` corre **después** de `build` en `main` (o a
mano con `workflow_dispatch`):

1. **Front**: `npm ci && npm run build` con `VITE_API_URL_PROD` y copia
   `front/dist` a `www/front` (reemplazo atómico).
2. **Infra**: copia `docker-compose.yml` y `nginx/templates/`.
3. **Deploy**: login a GHCR, `docker compose pull`, migraciones
   (`--profile tools run --rm migrate`), `up -d --remove-orphans` y limpieza
   de imágenes.

Secretos/variables necesarios en GitHub:

| tipo | nombre | qué es |
|---|---|---|
| secret | `PROD_HOST` | host SSH |
| secret | `PROD_USER` | usuario SSH (`ubuntu`) |
| secret | `PROD_SSH_KEY` | clave privada SSH |
| variable | `PROD_APP_DIR` | `/home/Epublit` |
| variable | `VITE_API_URL_PROD` | `https://<dominio>/api` |

El `.env` **no** lo toca el deploy: vive sólo en el servidor.

## Migración de datos (corte)

La migración está documentada en `specs/015-migracion-produccion/plan.md`.
Resumen operativo (se corre desde un checkout del repo, porque el servicio
`migracion` construye una imagen con el script):

```bash
# 0. Backup de la MariaDB vieja (rollback), desde la carpeta de la app vieja
cd <carpeta-vieja>
read -rsp "DB password: " DBPASS; echo
docker compose exec -T -e MYSQL_PWD="$DBPASS" mariadb \
  mariadb-dump -u teti --single-transaction --routines --triggers \
  --no-tablespaces --default-character-set=utf8mb4 epublit \
  | gzip > /tmp/epublit_pre_corte.sql.gz
unset DBPASS

# 1. Parar SÓLO la API vieja (la MariaDB sigue arriba para leerla)
docker compose stop api

# 2. Ensayo en seco
cd <repo>
docker compose -f infra/docker-compose.yml --profile tools \
  run --rm migracion --dry-run

# 3. Carga real (base recién migrada, vacía de datos de dominio)
docker compose -f infra/docker-compose.yml --profile tools \
  run --rm migracion --reset
```

> `--reset` **borra las tablas de dominio** del destino antes de cargar. Sólo
> es seguro en el corte (base nueva). Después de ir a producción, una recarga
> requiere un backup y una ventana explícita.

### Verificación post-corte

- Login con un usuario real (mismo password que la app vieja).
- Cantidades por cuenta (libros, personas, clientes, ventas).
- Stock por libro contra el reporte del `--dry-run`.
- Que cada `file_path` exista: ver el chequeo en "Volúmenes" abajo.
- Verificar AFIP en **homologación** antes de emitir una factura real.

## Rollback

La MariaDB vieja no se toca. Si algo falla:

```bash
# Bajar el stack nuevo
docker compose -f /home/Epublit/docker-compose.yml down

# Volver a levantar la app vieja (mismos volúmenes)
cd <carpeta-vieja>
docker compose up -d api
```

## Volúmenes y comprobantes

- `files/`: `facturas/` y `remitos/` (ya referenciados por
  `movimientos.file_path`), `logos/<cuit>.png` (el logo que va en la factura) y
  las carpetas de uploads del refactor (`libros/portadas`, `personas/fotos`,
  `colecciones/portadas`, que se crean solas).
- `afipkeys/<cuit>/`: `cert.crt` (producción) o `cert.pem` (homologación),
  `private_key.key` y `Tokens/`. **No hay que re-registrar certificados**, pero
  el uid 1000 necesita escritura en `Tokens/`.

Chequeo de que no falte ningún comprobante referenciado:

```bash
cd /home/Epublit
set -a; . ./.env; set +a

docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
  "select file_path from movimientos where file_path is not null" > /tmp/paths.txt

faltan=0
while read -r p; do
  [ -f "/home/Epublit/files/$p" ] || { echo "FALTA: $p"; faltan=$((faltan+1)); }
done < /tmp/paths.txt
echo "Referenciados: $(wc -l < /tmp/paths.txt) · Faltan: $faltan"
```

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

> **No cambies `POSTGRES_PASSWORD` después de inicializar la base**: queda
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
