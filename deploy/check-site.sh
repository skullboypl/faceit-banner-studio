#!/bin/sh
# Fail the container while index.html points at a script that is not JavaScript.
html=$(wget -qO- http://127.0.0.1/) || exit 1
js=$(printf '%s\n' "$html" | sed -n 's/.*src="\(\/assets\/main-[^"]*\.js\)".*/\1/p' | head -n 1)
[ -n "$js" ] || exit 1
headers=$(wget -S -O /dev/null "http://127.0.0.1$js" 2>&1) || exit 1
printf '%s\n' "$headers" | grep -qi 'content-type:.*javascript'
