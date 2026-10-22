# Builds the app into a small image. Data (database, uploads, backups) lives in /data,
# which must be a mounted volume (docker-compose.yml, or a Northflank volume). No
# VOLUME line here: an anonymous volume would hide a missing one and be lost on redeploy.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Compilers for the SQLite module, in case a prebuilt copy can't be downloaded.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG APP_URL
ENV NEXT_TELEMETRY_DISABLED=1 APP_URL=${APP_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
 && npx esbuild scripts/seed.ts --bundle --platform=node --target=node22 --external:better-sqlite3 --outfile=dist/seed.js

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DATA_DIR=/data PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/dist/seed.js ./seed.js
# Shown in the app under Admin -> Leader guide.
COPY --from=build /app/docs/PRESIDENCY-GUIDE.md ./docs/PRESIDENCY-GUIDE.md
COPY --from=build /app/docs/MEMBER-GUIDE.md ./docs/MEMBER-GUIDE.md
EXPOSE 3000
CMD ["node", "server.js"]
