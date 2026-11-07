#!/usr/bin/env bash
#
# PROD Caddy — load the deployed commit's Caddyfile, and leave Caddy running
# when it already serves that file.
#
# WHY (PROD deploy of 2026-11-05, run 41977068875)
# ------------------------------------------------
# The deploy stopped and removed Caddy together with the app container. The
# site had no listener at all until Caddy came back, then Caddy answered 500
# "Une erreur est survenue" until the new app had booted: about 20 s of
# errors per deploy. The Caddyfile now waits for a container being replaced
# (snippet `attente_remplacement`); that wait only covers the deploy if Caddy
# stays up while the app is replaced.
#
# Caddy runs with `admin off`: it reads its config once, when it starts. A new
# Caddyfile therefore needs a new Caddy container; an unchanged one does not.
# The deploy calls this script past the point of no return and BEFORE it stops
# the app, so when Caddy has to be recreated, the old app serves meanwhile.
#
# WHAT IT DOES
#   * Caddy running, serving the deployed file (same content, and Caddy
#     started after the file was last written): `compose up` without
#     recreation. Compose recreates Caddy only if its service definition
#     changed; otherwise Caddy keeps running.
#   * Caddy running on another file: validate the deployed file INSIDE the
#     running Caddy (same image, same certificates) BEFORE writing it, so an
#     invalid file is never put in place where a later restart would load it;
#     then write it and recreate Caddy alone.
#   * Caddy absent or stopped: write the file and let compose start Caddy.
#   Then, in every case, Caddy must be running and not restarting.
#
# Run from the PROD compose directory (~/production).
# Usage: prod-caddy-config.sh <deployed Caddyfile>
# Optional env:
#   CADDY_CONTAINER       (default nestjs-remix-caddy)
#   CADDY_SETTLE_SECONDS  (default 5 — tests set 0)
set -euo pipefail

NEW="${1:-}"
LIVE="config/caddy/Caddyfile"
CONTAINER="${CADDY_CONTAINER:-nestjs-remix-caddy}"
SETTLE="${CADDY_SETTLE_SECONDS:-5}"
COMPOSE=(docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml)

if [ -z "$NEW" ] || [ ! -s "$NEW" ]; then
  echo "❌ Deployed Caddyfile missing or empty: '${NEW}'"
  exit 1
fi

CHANGED=1
if [ -f "$LIVE" ] && cmp -s "$NEW" "$LIVE"; then
  CHANGED=0
fi

STATE=$(docker inspect -f '{{.State.Running}} {{.State.StartedAt}}' "$CONTAINER" 2>/dev/null || true)
RUNNING=0
RELOAD=0
if [ "${STATE%% *}" = "true" ]; then
  RUNNING=1
  STARTED_AT=$(date -d "${STATE#* }" +%s)
  # Same second counts as stale: Caddy may have read the previous content.
  if [ "$CHANGED" = 1 ] || [ "$(stat -c %Y "$LIVE")" -ge "$STARTED_AT" ]; then
    RELOAD=1
  fi
fi

if [ "$RELOAD" = 1 ]; then
  echo "🔎 Validating the deployed Caddyfile inside $CONTAINER (same image, same certificates)..."
  if ! docker exec -i "$CONTAINER" sh -c 'cat > /tmp/Caddyfile.deploy && caddy validate --config /tmp/Caddyfile.deploy --adapter caddyfile' < "$NEW"; then
    echo "❌ The deployed Caddyfile is INVALID: nothing written, Caddy left running on its current config."
    exit 1
  fi
fi

if [ "$CHANGED" = 1 ]; then
  mkdir -p "$(dirname "$LIVE")"
  # cp onto the existing file keeps its inode, so the running container's
  # single-file bind mount keeps pointing at it.
  cp "$NEW" "$LIVE"
  echo "📝 Caddyfile written: $LIVE"
fi

if [ "$RELOAD" = 1 ]; then
  echo "♻️ Recreating Caddy alone on the new Caddyfile (the current app keeps serving)..."
  "${COMPOSE[@]}" up -d --no-deps --force-recreate caddy
elif [ "$RUNNING" = 1 ]; then
  echo "✅ Caddy already serves the deployed Caddyfile: kept running."
  "${COMPOSE[@]}" up -d --no-deps caddy
else
  echo "ℹ️ $CONTAINER absent or stopped: starting it on the deployed Caddyfile."
  "${COMPOSE[@]}" up -d --no-deps caddy
fi

sleep "$SETTLE"
AFTER=$(docker inspect -f '{{.State.Running}} {{.State.Restarting}}' "$CONTAINER" 2>/dev/null || true)
if [ "$AFTER" != "true false" ]; then
  echo "❌ Caddy is not running after the update (state: '${AFTER:-<none>}')."
  docker logs --tail 50 "$CONTAINER" 2>&1 || true
  exit 1
fi
echo "✅ Caddy running on the deployed Caddyfile."
