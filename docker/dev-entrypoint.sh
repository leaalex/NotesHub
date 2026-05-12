#!/bin/sh
set -e
cd /app
# Always resolve deps for this platform (volume is Linux; lockfile may change on host).
npm install
exec ./node_modules/.bin/nuxt dev --host 0.0.0.0 --port "${PORT:-3000}"
