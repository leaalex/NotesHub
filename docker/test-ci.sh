#!/usr/bin/env sh
set -e
cd /app
pnpm config set dangerously-allow-all-builds true 2>/dev/null || true
pnpm install
pnpm test
pnpm run build
