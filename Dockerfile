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
  && apt-get install -y --no-install-recommends ca-certificates openssl nginx \
  && rm -f /etc/nginx/sites-enabled/default \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=4001 \
  APP_INTERNAL_PORT=4001 \
  DATABASE_PROVIDER=sqlite \
  DATABASE_PATH=/app/data/sso.sqlite \
  AUTO_SETUP=false

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY docker/nginx/default.conf /etc/nginx/nginx.conf
COPY docker/start-with-nginx.sh /usr/local/bin/start-with-nginx.sh

RUN mkdir -p /app/data \
  && mkdir -p /app/src/generated \
  && ln -s /app/dist/generated/prisma /app/src/generated/prisma \
  && chmod +x /usr/local/bin/start-with-nginx.sh

EXPOSE 80 8443

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port = process.env.APP_INTERNAL_PORT || 4001; fetch('http://127.0.0.1:' + port + '/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1));"

CMD ["/usr/local/bin/start-with-nginx.sh"]
