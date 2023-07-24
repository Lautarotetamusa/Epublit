FROM node:slim AS app

# We don't need the standalone Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Install Google Chrome Stable and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install google-chrome-stable -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR app/
COPY ./api/package.json .
COPY ./api/tsconfig.json .
RUN npm install
RUN npm install typescript -g

COPY ./api/src src/
RUN tsc --project .

COPY ./api/src/afip/Claves dist/afip/Claves
COPY ./api/src/afip/ClavesLibrosSilvestres dist/afip/ClavesLibrosSilvestres
COPY ./api/src/afip/afip.js/src/Afip_res dist/afip/afip.js/src/Afip_res

COPY ./api/src/comprobantes/factura dist/comprobantes/factura
COPY ./api/src/comprobantes/remito dist/comprobantes/remito