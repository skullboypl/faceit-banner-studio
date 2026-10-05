# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

# CapRover App Configs → VITE_FACEIT_API_KEY (dostępne przy docker build)
ARG VITE_FACEIT_API_KEY=${VITE_FACEIT_API_KEY}
ENV VITE_FACEIT_API_KEY=${VITE_FACEIT_API_KEY}

RUN pnpm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache nodejs

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY server /app/server

EXPOSE 80

CMD ["sh", "-c", "node /app/server/presence-service.mjs & exec nginx -g 'daemon off;'"]
