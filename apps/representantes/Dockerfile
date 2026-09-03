# Plataforma do Representante · Grupo Catarina
# Node 22 + Express + SQLite (better-sqlite3 compilado no build).
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
# db e uploads vêm de volumes montados
RUN mkdir -p /app/db /app/public/uploads
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=4s --retries=5 \
  CMD wget -q -O- http://localhost:8080/healthz || exit 1
# O seed roda automaticamente no boot se o banco estiver vazio.
CMD ["node", "server/index.js"]
