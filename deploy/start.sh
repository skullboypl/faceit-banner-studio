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
exec nginx -g 'daemon off;'
