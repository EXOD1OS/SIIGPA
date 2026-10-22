FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Generar el cliente en Linux: no reutilizar node_modules ni binarios de Windows.
RUN npm ci && npm run prisma:generate
COPY . .
RUN npm run build

FROM base AS app
ENV NODE_ENV=production
# Prisma y tsx son necesarios para migraciones y la instalación inicial.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/docker ./docker
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/tsconfig.json /app/next.config.js ./
USER node
EXPOSE 3000
ENTRYPOINT ["sh", "/app/docker/iniciar-app.sh"]
