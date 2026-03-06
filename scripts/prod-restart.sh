#!/bin/bash
# prod-restart.sh — Secure production restart script
# Usage: Copy to ~/production/restart.sh on prod server
# NEVER use "docker run" manually — always use this script or docker compose
set -euo pipefail

PROD_DIR="${PROD_DIR:-$HOME/production}"
EXPECTED_IMAGE="massdoc/nestjs-remix-monorepo:production"
COMPOSE_FILES="-f docker-compose.prod.yml -f docker-compose.caddy.yml"

cd "$PROD_DIR"

echo "=== PROD RESTART ==="
echo "Directory: $PROD_DIR"

# 1. Pull latest production image
echo "[1/4] Pulling latest production image..."
docker pull "$EXPECTED_IMAGE"

# 2. Restart via compose (the only authorized method)
echo "[2/4] Restarting via docker compose..."
docker compose $COMPOSE_FILES up -d --no-deps monorepo_prod caddy redis_prod
docker compose -f docker-compose.imgproxy.yml up -d 2>/dev/null || true

# 3. Verify image tag
echo "[3/4] Verifying container image..."
sleep 5
ACTUAL_IMAGE=$(docker inspect nestjs-remix-monorepo-prod --format='{{.Config.Image}}' 2>/dev/null || echo "UNKNOWN")
if [ "$ACTUAL_IMAGE" != "$EXPECTED_IMAGE" ]; then
  echo "ERREUR: Image incorrecte: $ACTUAL_IMAGE (attendu: $EXPECTED_IMAGE)"
  echo "Le container n'a PAS ete lance avec la bonne image."
  exit 1
fi
echo "Image OK: $ACTUAL_IMAGE"

# 4. Health check (60s timeout)
echo "[4/4] Health check..."
HEALTHY=0
for i in {1..12}; do
  if docker exec nestjs-remix-monorepo-prod wget -qO- http://localhost:3000/health 2>/dev/null | grep -q '"status":"ok"'; then
    HEALTHY=1
    break
  fi
  echo "  Attempt $i/12 - waiting 5s..."
  sleep 5
done

if [ "$HEALTHY" != "1" ]; then
  echo "ERREUR: Health check failed apres 60s"
  docker logs nestjs-remix-monorepo-prod --tail 20
  exit 1
fi

# Summary
echo ""
echo "=== PROD OK ==="
echo "Image:     $ACTUAL_IMAGE"
echo "Container: $(docker ps --filter name=nestjs-remix-monorepo-prod --format '{{.Status}}')"
echo "Caddy:     $(docker ps --filter name=nestjs-remix-caddy --format '{{.Status}}')"
echo "Network:   $(docker inspect nestjs-remix-monorepo-prod --format='{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
