FROM node:16.19.1-alpine AS app

WORKDIR app/
COPY ./front/package.json .
RUN npm install
COPY ./front/src src/
COPY ./front/public public/
#RUN npm run build
#RUN npm install -g serve