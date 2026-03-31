#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[playchess] Pulling/building images and running database migration"

docker compose up -d postgres

echo "[playchess] Recreating migrate service"
docker compose rm -sf migrate >/dev/null 2>&1 || true

docker compose up --build --abort-on-container-exit --exit-code-from migrate migrate

echo "[playchess] Recreating app service"
docker compose rm -sf app >/dev/null 2>&1 || true

docker compose up -d --build app

echo "[playchess] Deployment finished"
docker compose ps
