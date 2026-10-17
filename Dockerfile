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
# Unique per image so a poisoned Cloudflare URL from a previous deploy cannot meet this HTML.
ARG SOURCE_COMMIT
ENV SOURCE_COMMIT=${SOURCE_COMMIT}

RUN SOURCE_COMMIT="${SOURCE_COMMIT:-$(date -u +%s)}" pnpm run build
# Keep the currently live HTML as the public pages so a rolling replica never asks for hashes the old container lacks.
ARG PUBLIC_URL=https://faceitbanner.vxh.pl
ENV PUBLIC_URL=${PUBLIC_URL}
RUN node deploy/preserve-live-assets.mjs

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
COPY deploy/start.sh deploy/check-site.sh /app/
RUN sed -i 's/\r$//' /app/start.sh /app/check-site.sh && chmod +x /app/start.sh /app/check-site.sh
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/pending /app/pending
# presence.mjs and auth.mjs import ../shared; without this the process never listens and nginx returns 502 for both the counter and login
COPY shared /app/shared
COPY server /app/server
RUN cd /app/server && npm install --omit=dev --no-audit --no-fund

# Next standalone server (accounts API). Static chunks sit next to server.js; nginx does not serve them.
COPY --from=build /app/web/.next/standalone /app/next-standalone
COPY --from=build /app/web/.next/static /app/next-standalone/web/.next/static

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=25s --retries=5 CMD ["/app/check-site.sh"]

# Restart either API if it exits. Nginx stays up, but a dead process is a 502: 3001 is login and the counter, 3100 is saved banners.
CMD ["/app/start.sh"]
