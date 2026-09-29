# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# build: compila TypeScript. Necesita devDependencies (tsc, tsc-alias).
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Puppeteer no baja su propio Chromium: la imagen final usa el Chrome del
# sistema (ver stage runtime y src/lib/comprobantes/comprobante.ts).
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ---------------------------------------------------------------------------
# deps: sólo dependencias de producción, sin devDependencies ni Chromium.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# ---------------------------------------------------------------------------
# runtime: imagen final sin toolchain. Chrome del sistema + dist + prod deps.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=prod \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    TZ=America/Buenos_Aires

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg tzdata fontconfig fonts-liberation; \
    install -d -m 0755 /etc/apt/keyrings; \
    curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
        | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg; \
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends google-chrome-stable; \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime; \
    echo "$TZ" > /etc/timezone; \
    rm -rf /var/lib/apt/lists/*

COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
# Migraciones versionadas: permiten correr `node dist/src/db/migrate.js` como
# job puntual de deploy sin volver a construir la imagen.
COPY --chown=node:node db/migrations ./db/migrations

# files/ y afipkeys/ en prod se montan como volúmenes (comprobantes generados y
# credenciales AFIP); se crean acá para que el usuario no-root pueda escribir
# aun sin montar nada.
RUN mkdir -p files afipkeys && chown -R node:node files afipkeys

USER node
EXPOSE 3000
CMD ["node", "--tls-cipher-list=ECDHE-RSA-AES128-GCM-SHA256", "dist/src/index.js"]
