#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

BASELINE_MIGRATION="${PRISMA_BASELINE_MIGRATION:-202603300001_init}"

echo "[playchess] Starting database migration run"
echo "[playchess] Ensuring postgres service is up"
docker compose up -d postgres

echo "[playchess] Running Prisma migrate deploy"
if docker compose run --rm --no-deps \
  -e PRISMA_BASELINE_MIGRATION="$BASELINE_MIGRATION" \
  migrate; then
  echo "[playchess] Migration completed"
  exit 0
fi

echo "[playchess] Migration failed, retrying with baseline resolution"
docker compose run --rm --no-deps \
  -e PRISMA_BASELINE_MIGRATION="$BASELINE_MIGRATION" \
  migrate \
  sh -c "pnpm prisma migrate resolve --applied \"$BASELINE_MIGRATION\" && pnpm prisma migrate deploy"

echo "[playchess] Migration completed after baseline resolution"