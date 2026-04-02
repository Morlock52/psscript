FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL=
ARG VITE_DISABLE_AUTH=false

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_DISABLE_AUTH=${VITE_DISABLE_AUTH}

COPY src/frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY src/frontend ./
RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

