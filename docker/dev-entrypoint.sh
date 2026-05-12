#!/bin/sh
set -e
cd /app
# Non-interactive: allow native dependency postinstall scripts (esbuild, etc.).
pnpm config set dangerously-allow-all-builds true 2>/dev/null || true
# Always resolve deps for this platform (volume is Linux; lockfile may change on host).
pnpm install
exec ./node_modules/.bin/nuxt dev --host 0.0.0.0 --port "${PORT:-3000}"
