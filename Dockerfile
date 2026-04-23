FROM node:22-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY . .

RUN npm ci

RUN npm run prisma:generate \
  && npm run build \
  && npm run build:admin \
  && npm run build:portal \
  && (ls src/generated/prisma/sqlite/*.so.node 2>/dev/null && cp src/generated/prisma/sqlite/*.so.node dist/generated/prisma/sqlite/ || true) \
  && (ls src/generated/prisma/postgresql/*.so.node 2>/dev/null && cp src/generated/prisma/postgresql/*.so.node dist/generated/prisma/postgresql/ || true) \
  && (ls src/generated/prisma/mysql/*.so.node 2>/dev/null && cp src/generated/prisma/mysql/*.so.node dist/generated/prisma/mysql/ || true) \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=4000 \
  DATABASE_PROVIDER=sqlite \
  DATABASE_PATH=/app/data/sso.sqlite \
  AUTO_SETUP=false

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

RUN mkdir -p /app/data \
  && mkdir -p /app/src/generated \
  && ln -s /app/dist/generated/prisma /app/src/generated/prisma \
  && chown -R node:node /app

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port = process.env.PORT || 4000; fetch('http://127.0.0.1:' + port + '/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1));"

CMD ["node", "dist/container/entrypoint.js"]