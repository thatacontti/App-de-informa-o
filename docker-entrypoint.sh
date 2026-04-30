#!/bin/sh
# Painel V27 · web container entrypoint.
# Applies pending Prisma migrations once before handing off to the
# Next.js standalone server.
set -e

echo "[entrypoint] running prisma migrate deploy..."
cd /app/apps/web
npx --yes prisma migrate deploy --schema prisma/schema.prisma || {
  echo "[entrypoint] migration failed — refusing to start." >&2
  exit 1
}
cd /app

echo "[entrypoint] handing off to: $*"
exec "$@"
