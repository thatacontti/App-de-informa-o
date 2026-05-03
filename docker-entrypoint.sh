#!/bin/sh
# Painel V27 · web container entrypoint.
# Applies pending Prisma migrations once before handing off to the
# Next.js standalone server. Structural data (UFs, default users,
# CSV histórico DataSources) ships embedded in migration SQL so we
# don't need tsx / bcryptjs / @painel/shared at runtime.
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
