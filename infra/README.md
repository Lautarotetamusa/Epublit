# infra/ — Producción

Infraestructura de producción del refactor: **Postgres + back + nginx con
TLS**, más los jobs de migración y los scripts de operación.

```
Internet
   │ 80/443
   ▼
 nginx (borde, TLS, Let's Encrypt)
   ├── /        → estáticos del SPA (dist, bind mount)
   ├── /api/    → back (Express :3000, prefijo recortado)
   └── /files/  → back (facturas, remitos, portadas, fotos)
                      │
                      └── db (Postgres 16, sólo red interna)
```

**El front no corre en Docker.** Es un SPA de Vite: el workflow de deploy lo
buildea y copia `front/dist` al servidor; el nginx de borde lo sirve directo.
Evita un segundo nginx dentro de un contenedor y un salto de proxy.

El front se buildea con `VITE_API_URL=https://<dominio>/api`, así que todo
vive en el mismo origen y no hay CORS en el navegador.

## Layout en el servidor

```
/home/ubuntu/epublit/
├── .env                              # se crea una vez a mano (nunca en git)
├── docker-compose.yml                # lo copia el workflow
├── nginx/templates/default.conf.template
└── www/front/                        # dist del SPA (lo copia el workflow)
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

## Requisitos

- Docker + Docker Compose v2 en el servidor.
- DNS `DOMAIN` apuntando al servidor.
- Puertos **80** y **443** libres (la app vieja publica el 80: pararla en el
  corte).
- Los directorios de la app vieja (`files/`, `afipkeys/`) accesibles.

## Primer despliegue

El **código** (compose, nginx, dist del front) lo copia
`.github/workflows/deploy.yml`. Lo que se hace una sola vez a mano:

```bash
# 1. Directorio de la app en el servidor
sudo mkdir -p /home/ubuntu/epublit && sudo chown ubuntu:ubuntu /home/ubuntu/epublit
cd /home/ubuntu/epublit

# 2. Configuración
cp <repo>/infra/.env.example .env
$EDITOR .env                # dominio, password de Postgres, CUIT, rutas...

# 3. Permisos de los volúmenes que se reusan
#    El back corre como `node` (uid 1000); la app vieja escribía como root.
sudo chown -R 1000:1000 /home/Epublit/files /home/Epublit/afipkeys

# 4. Primer deploy (desde GitHub Actions, ver abajo) o a mano:
#    copiar docker-compose.yml + nginx/ + www/front/ y después:
docker compose pull
docker compose --profile tools run --rm migrate
docker compose up -d

# 5. Certificado TLS
<repo>/infra/scripts/init-letsencrypt.sh
```

> `POSTGRES_PASSWORD` debe ser **alfanumérica**: el back arma `DATABASE_URL`
> por interpolación y una password con `@`, `:` o `/` rompe la URL.

## Deploy automático

`.github/workflows/deploy.yml` corre **después** de `build` en `main` (o a
mano con `workflow_dispatch`):

1. **Front**: `npm ci && npm run build` con `VITE_API_URL_PROD` y copia
   `front/dist` al servidor (`www/front`, reemplazo atómico). nginx monta
   `www/` (no el dist), así ve el cambio sin recrear el contenedor.
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
| variable | `PROD_APP_DIR` | `/home/ubuntu/epublit` |
| variable | `VITE_API_URL_PROD` | `https://<dominio>/api` |

El `.env` **no** lo toca el deploy: vive sólo en el servidor.

## Migración de datos (corte)

La migración está documentada en `specs/015-migracion-produccion/plan.md`.
Resumen operativo (se corre desde un checkout del repo, porque el servicio
`migracion` construye una imagen con el script):

```bash
cd <repo>

# 0. Backup de la MariaDB vieja (rollback)
cd /home/Epublit
read -rsp "DB password: " DBPASS; echo
docker compose exec -T -e MYSQL_PWD="$DBPASS" mariadb \
  mariadb-dump -u teti --single-transaction --routines --triggers \
  --no-tablespaces --default-character-set=utf8mb4 epublit \
  | gzip > /tmp/epublit_pre_corte.sql.gz
unset DBPASS

# 1. Parar SÓLO la API vieja (la MariaDB sigue arriba para leerla)
docker compose -f /home/Epublit/docker-compose.yml stop api

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
- Abrir una venta histórica y un PDF de `/files/facturas/...`.
- Verificar AFIP en **homologación** antes de emitir una factura real.

## Rollback

La MariaDB vieja no se toca. Si algo falla:

```bash
# Bajar el stack nuevo
docker compose -f /home/ubuntu/epublit/docker-compose.yml down

# Volver a levantar la app vieja (mismos volúmenes)
docker compose -f /home/Epublit/docker-compose.yml up -d api
```

## Backups

```bash
infra/scripts/backup-db.sh          # deja infra/backups/epublit_*.dump (rota 14)
infra/scripts/restore-db.sh <dump>  # destructivo, pide confirmación
```

Los **archivos** (`FILES_DIR`) y las **claves AFIP** (`AFIPKEYS_DIR`) viven en
el host: respaldarlos con `rsync`/`tar` aparte, idealmente a otro disco o
bucket.

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
- **AFIP**: el layout de claves es idéntico al de la app vieja
  (`<cuit>/cert.crt|cert.pem`, `private_key.key`, `Tokens/`). No hay que
  re-registrar certificados; sí darle permiso de escritura al uid 1000
  (AFIP cachea tokens en `Tokens/`).
- **Postgres** no publica puerto: sólo se llega desde la red `interna`.
- **Subidas**: nginx acepta hasta 25 MB (el back limita a 20 MB).
