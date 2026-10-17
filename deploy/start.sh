#!/bin/sh
set -eu
(while true; do node /app/server/presence-service.mjs; echo "presence exited $?"; sleep 2; done) &
(while true; do PORT=3100 HOSTNAME=127.0.0.1 node /app/next-standalone/web/server.js; echo "accounts exited $?"; sleep 2; done) &
n=0
while [ "$n" -lt 40 ]; do
  if wget -qO- http://127.0.0.1:3001/api/presence >/dev/null 2>&1; then
    break
  fi
  n=$((n + 1))
  sleep 0.25
done
# Keep the live HTML until the previous replica is gone. New hashes only go public after that.
(
  sleep "${HTML_CUTOVER_SECONDS:-120}"
  if [ -f /app/pending/index.html ]; then
    cp /app/pending/index.html /usr/share/nginx/html/index.html
  fi
  if [ -f /app/pending/widget/index.html ]; then
    mkdir -p /usr/share/nginx/html/widget
    cp /app/pending/widget/index.html /usr/share/nginx/html/widget/index.html
  fi
) &
exec nginx -g 'daemon off;'
