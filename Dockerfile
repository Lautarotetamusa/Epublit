FROM node:22.8-slim AS app

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

#Poner el timezone de buenos aires para que el servicio de Afip funcione bien
ENV TZ="America/Buenos_Aires"
RUN date && cp /usr/share/zoneinfo/$TZ etc/localtime

WORKDIR /app

#Install dependencies
COPY package.json .
RUN npm install && npm install typescript -g

COPY src/ src/
COPY types/ types/
COPY tsconfig.json .

RUN npm run build
