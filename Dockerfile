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

RUN apk add --no-cache nodejs npm

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# presence.mjs and auth.mjs import ../shared; without this the process never listens and nginx returns 502 for both the counter and login
COPY shared /app/shared
COPY server /app/server
RUN cd /app/server && npm install --omit=dev --no-audit --no-fund

EXPOSE 80

# Restart the API if it exits. Nginx stays up either way, but a dead process is what turns the counter and login into 502.
CMD ["sh", "-c", "while true; do node /app/server/presence-service.mjs; echo \"presence exited $?\"; sleep 2; done & exec nginx -g 'daemon off;'"]
