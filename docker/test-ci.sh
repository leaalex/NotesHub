#!/usr/bin/env sh
set -e
cd /app
npm ci
npm test
npm run build
