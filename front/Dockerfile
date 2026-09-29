# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# build: Vite compila el bundle. VITE_API_URL se hornea en build time (Vite
# sólo expone lo que empieza con VITE_), por eso entra como build-arg y no
# como variable de entorno del contenedor.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------------------------------------------------------------------------
# runtime: nginx sirviendo estáticos (fallback de SPA y cache de assets, ver
# nginx.conf). La imagen oficial ya arranca nginx en foreground.
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
