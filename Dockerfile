# Build stage
FROM oven/bun:alpine AS build-stage

## Set args, envs and workdir
ARG NPM_CONFIG_REGISTRY
ENV NPM_CONFIG_REGISTRY=$NPM_CONFIG_REGISTRY
WORKDIR /app

## Install packages
COPY ./.npmrc ./bun.lockb ./package.json ./
RUN bun i --frozen-lockfile

## Set production env
ENV NODE_ENV=production

## Copy files and build
COPY ./build.sh ./
COPY ./src ./src
COPY ./tsconfig.json ./
RUN bun run compile:optimization

# Runtime stage
FROM oven/bun:alpine

## Set args, envs and workdir
ENV NODE_ENV=production
ENV SERVER_HOST=127.0.0.1
ENV SERVER_PORT=8000
WORKDIR /app

## Set timezone and upgrade packages
RUN apk update && apk upgrade --no-cache
RUN apk add -lu --no-cache tzdata && ln -s /usr/share/zoneinfo/Asia/Taipei /etc/localtime

## Copy files and libraries
COPY --from=build-stage /app/dist/index ./
COPY ./.env.production.local ./.env

## Set cmd
CMD ["./index"]