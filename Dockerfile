# syntax=docker/dockerfile:1
#
# One image in which Express serves both the API and the Angular build (design §15, D10).
# Both stages use node:24-slim (Debian, glibc), so better-sqlite3's prebuilt Linux binary matches
# the runtime and nothing has to be compiled.

# ---- Build: compile the shared contracts and the server, and build the client ----
FROM node:24-slim AS build
WORKDIR /app

# Dependencies first, so source changes don't invalidate the install layer.
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
# The e2e workspace is listed in the lockfile, so npm ci needs its manifest (not its tests).
COPY e2e/package.json e2e/
RUN npm ci

COPY shared shared
COPY server server
COPY client client
RUN npm run build

# ---- Runtime: production dependencies, compiled output, and the dataset only ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/the-block.db \
    DATASET_PATH=/app/data/vehicles.json \
    CLIENT_DIR=/app/client/dist/client/browser
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
COPY e2e/package.json e2e/
RUN npm ci --omit=dev --workspace=server && npm cache clean --force

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist/client/browser client/dist/client/browser
COPY data/vehicles.json data/vehicles.json

# The SQLite database lives in a volume owned by the unprivileged `node` user.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "server/dist/index.js"]
