# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.14.0

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
ENV PATH=/app/node_modules/.bin:$PATH
COPY package.json package-lock.json ./
CMD ["npm", "run", "dev"]

FROM deps AS build
ARG VITE_API_BASE_URL=/api
ARG VITE_PUBLIC_BASE_PATH=/
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_PUBLIC_BASE_PATH=${VITE_PUBLIC_BASE_PATH}
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
