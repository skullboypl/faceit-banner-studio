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
# FACEIT "client side" key: public on purpose, built into the page, used only when our server is rate limited.
ARG VITE_FACEIT_CLIENT_KEY=${VITE_FACEIT_CLIENT_KEY}
ENV VITE_FACEIT_CLIENT_KEY=${VITE_FACEIT_CLIENT_KEY}

RUN pnpm run build

# Accounts, saved banners and the feedback board. Nginx in the runtime image proxies /api/me and /api/posts here.
RUN cd /app/web && pnpm install --frozen-lockfile && pnpm run build

FROM nginx:1.27-alpine

# Same key the widget uses, so a banner that only reports player_id can still be named on the live board.
ARG VITE_FACEIT_API_KEY
ENV FACEIT_API_KEY=${VITE_FACEIT_API_KEY}
# The FACEIT "server side" key. Wins over the two above when set; it stays on the server.
ARG FACEIT_SERVER_KEY
ENV FACEIT_SERVER_KEY=${FACEIT_SERVER_KEY}

RUN apk add --no-cache nodejs npm

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# presence.mjs and auth.mjs import ../shared; without this the process never listens and nginx returns 502 for both the counter and login
COPY shared /app/shared
COPY server /app/server
RUN cd /app/server && npm install --omit=dev --no-audit --no-fund

# Next standalone server (accounts API). Static chunks sit next to server.js; nginx does not serve them.
COPY --from=build /app/web/.next/standalone /app/next-standalone
COPY --from=build /app/web/.next/static /app/next-standalone/web/.next/static

EXPOSE 80

# Restart either API if it exits. Nginx stays up, but a dead process is a 502: 3001 is login and the counter, 3100 is saved banners.
CMD ["sh", "-c", "while true; do node /app/server/presence-service.mjs; echo \"presence exited $?\"; sleep 2; done & while true; do PORT=3100 HOSTNAME=127.0.0.1 node /app/next-standalone/web/server.js; echo \"accounts exited $?\"; sleep 2; done & exec nginx -g 'daemon off;'"]
