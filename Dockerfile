# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build

FROM node:22-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DRIZZLE_MIGRATIONS_PATH=/app/migrations

COPY --from=build /app/.output ./.output
COPY --from=build /app/server/database/migrations ./migrations

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
