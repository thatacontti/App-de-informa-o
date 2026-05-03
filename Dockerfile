# syntax=docker/dockerfile:1.7
# ----------------------------------------------------------------------
# Painel V27 · Next.js standalone build + BullMQ worker
# Stages: deps → builder → web (default) and worker (alt target)
# ----------------------------------------------------------------------

ARG NODE_VERSION=22-alpine

# ---------- deps ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/connectors/package.json ./packages/connectors/
COPY packages/jobs/package.json ./packages/jobs/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# ---------- builder ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/connectors/node_modules ./packages/connectors/node_modules
COPY --from=deps /app/packages/jobs/node_modules ./packages/jobs/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web exec prisma generate \
  && pnpm --filter web build

# ---------- web (Next.js standalone) ----------
FROM node:${NODE_VERSION} AS web
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat openssl chromium nss freetype harfbuzz ca-certificates ttf-freefont \
  && addgroup -g 1001 -S nodejs \
  && adduser -S painel -u 1001 -G nodejs

# Puppeteer uses the system Chromium so no extra download is needed.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/node_modules/.prisma ./apps/web/node_modules/.prisma
COPY --from=builder /app/apps/web/node_modules/@prisma ./apps/web/node_modules/@prisma
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/apps/web/storage/briefings && chown -R painel:nodejs /app/apps/web/storage

USER painel
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "apps/web/server.js"]

# ---------- worker (BullMQ) ----------
# Built off the same builder layer — runs the standalone TS via tsx so
# we don't need a separate compile step. The worker is read-only on the
# UI bundle.
FROM node:${NODE_VERSION} AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat openssl chromium nss freetype harfbuzz ca-certificates ttf-freefont \
  && addgroup -g 1001 -S nodejs \
  && adduser -S painel -u 1001 -G nodejs

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app /app

RUN mkdir -p /app/apps/web/storage/briefings && chown -R painel:nodejs /app/apps/web/storage

USER painel
WORKDIR /app/packages/jobs
CMD ["node", "--import", "tsx", "src/worker.ts"]
