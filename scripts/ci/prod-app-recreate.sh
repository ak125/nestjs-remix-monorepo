#!/usr/bin/env bash
#
# PROD app recreate — replace the running app container WITHOUT tearing down the
# public TLS listener, and WITHOUT the blind fixed sleep.
#
# WHY THIS EXISTS (deploy outage root cause, audit 2026-07-19)
# -----------------------------------------------------------
# The old deploy did, in order:
#     docker stop  nestjs-remix-caddy nestjs-remix-monorepo-prod   # ← the 80/443 listener dies too
#     docker rm    nestjs-remix-caddy nestjs-remix-monorepo-prod
#     docker compose up -d monorepo_prod caddy redis_prod
#     sleep 60                                                     # ← blind, before any health check
# So for the whole window the PUBLIC TLS LISTENER (Caddy) was gone — every request
# got connection-refused / TLS failure, not just a 502 — and a hard `sleep 60` ran
# regardless of how fast the app actually booted. That is the 60–90 s outage.
#
# Two of those are simply wrong and are fixed here, WITHOUT changing any container
# name, network alias, or Caddy upstream (all load-bearing: the fixed container
# name `nestjs-remix-monorepo-prod` is an ops interface consumed by the watchdog,
# cron health-checks, monitoring and smoke tests; the Caddy upstream is the DNS
# name `monorepo_prod` in the Caddyfile). So:
#
#   1. Caddy is NEVER stopped. It keeps serving TLS the whole time. While the app
#      is briefly down mid-recreate, Caddy answers via its own `handle_errors`
#      (5xx + `Cache-Control: no-store`, so a transient error can't be cached by
#      Cloudflare) and its fallback active health-check re-attaches the moment the
#      app answers /health again. The residual is a short 502 window behind a LIVE
#      listener that Cloudflare fronts — not a total outage.
#   2. The blind `sleep 60` becomes an early readiness poll: it starts checking
#      immediately and succeeds the instant /health is ok (often ~15–25 s), and
#      fails fast (non-zero) if the app never becomes healthy — the caller's
#      `if: failure()` step then owns the rollback, exactly as before.
#   3. Caddy is restarted ONLY when the Caddyfile actually changed (admin is off,
#      so `caddy reload` is unavailable; a restart is the only way to apply a new
#      config). That ~1 s blip happens AFTER the app is healthy and only on the
#      rare deploys that touch the Caddyfile — not on every app-only deploy.
#
# This does NOT achieve true zero-downtime (a two-slot blue/green would, but that
# requires making the fixed ops name non-hardcoded first — see the PR design note).
# It removes the listener-down window and the blind wait, which is the bulk of it.
#
# WHY A SCRIPT (not inline YAML): the deploy path must be testable. `bash -n` and
# static step order prove nothing about "Caddy is never stopped" or "the poll
# succeeds early / fails late". prod-app-recreate.test.mjs EXECUTES this against a
# stubbed docker and asserts exactly that. Mirrors prod-rollback.sh (#1288).
#
# Required env: none (safe defaults below).
# Optional env:
#   PROD_CONTAINER            app container name     (default nestjs-remix-monorepo-prod)
#   CADDY_CONTAINER           caddy container name   (default nestjs-remix-caddy)
#   APP_SERVICE               compose service name   (default monorepo_prod)
#   COMPOSE_FILES             compose -f flags       (default the prod + caddy files)
#   EXPECTED_IMAGE            image the app must run (default massdoc/nestjs-remix-monorepo:production)
#   CADDYFILE_PATH            path to the Caddyfile   (default config/caddy/Caddyfile, relative to CWD)
#   READINESS_TIMEOUT_SECONDS max wait for /health   (default 120)
#   READINESS_INTERVAL_SECONDS poll interval         (default 5 — tests set 0)
set -uo pipefail

PROD_CONTAINER="${PROD_CONTAINER:-nestjs-remix-monorepo-prod}"
CADDY_CONTAINER="${CADDY_CONTAINER:-nestjs-remix-caddy}"
APP_SERVICE="${APP_SERVICE:-monorepo_prod}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.prod.yml -f docker-compose.caddy.yml}"
EXPECTED_IMAGE="${EXPECTED_IMAGE:-massdoc/nestjs-remix-monorepo:production}"
CADDYFILE_PATH="${CADDYFILE_PATH:-config/caddy/Caddyfile}"
READINESS_TIMEOUT_SECONDS="${READINESS_TIMEOUT_SECONDS:-120}"
READINESS_INTERVAL_SECONDS="${READINESS_INTERVAL_SECONDS:-5}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Step 0: decide whether the Caddyfile changed, BEFORE we touch anything ─────
# A sidecar sha file records what config the running Caddy last loaded. The deploy
# copies the fresh Caddyfile into place before calling this script, so comparing
# its current hash against the recorded one tells us whether Caddy must reload.
# No recorded hash (first deploy on this box) ⇒ treat as changed (ensures Caddy
# loads the current config). `admin off` ⇒ a restart is the only apply mechanism.
CADDY_CONFIG_CHANGED=0
CADDY_SHA_FILE="${CADDYFILE_PATH}.deployed.sha"
if [ -f "$CADDYFILE_PATH" ]; then
  NEW_CADDY_SHA=$(sha256sum "$CADDYFILE_PATH" | awk '{print $1}')
  OLD_CADDY_SHA=$(cat "$CADDY_SHA_FILE" 2>/dev/null || echo "")
  if [ "$NEW_CADDY_SHA" != "$OLD_CADDY_SHA" ]; then
    CADDY_CONFIG_CHANGED=1
    echo "🧩 Caddyfile changed since last deploy (or first deploy) — Caddy will be restarted after the app is healthy."
  else
    echo "🧩 Caddyfile unchanged — Caddy stays up untouched (no reload needed)."
  fi
else
  echo "::warning::Caddyfile not found at $CADDYFILE_PATH — skipping Caddy config-change detection."
fi

# ── Step 1: ensure the supporting containers are UP, without recreating them ──
# `--no-deps` + no `--force-recreate`: idempotent. A running Caddy/redis is left
# exactly as-is (this is the whole point — Caddy must NOT go down). On a first
# deploy this creates them. Caddy is NEVER in a stop/rm here.
echo "🔌 Ensuring Caddy + redis are up (no recreate — Caddy must keep serving TLS)..."
# shellcheck disable=SC2086
if ! docker compose $COMPOSE_FILES up -d --no-deps redis_prod caddy; then
  echo "❌ FATAL: could not ensure Caddy + redis are up."
  exit 1
fi

# ── Step 2: recreate ONLY the app container ───────────────────────────────────
# POINT OF NO RETURN for the app: --force-recreate destroys the old app container.
# Caddy is untouched (--no-deps). The image comes from compose's pinned
# `image: …:production`, which the caller retagged to the new build.
echo "🚀 Recreating app container ($APP_SERVICE) in place — Caddy stays up..."
# shellcheck disable=SC2086
if ! docker compose $COMPOSE_FILES up -d --no-deps --force-recreate "$APP_SERVICE"; then
  echo "❌ FATAL: docker compose failed to recreate $APP_SERVICE."
  exit 1
fi

# ── Step 3: assert the app runs the image we intended ─────────────────────────
ACTUAL_IMAGE=$(docker inspect "$PROD_CONTAINER" --format='{{.Config.Image}}' 2>/dev/null || echo "")
if [ "$ACTUAL_IMAGE" != "$EXPECTED_IMAGE" ]; then
  echo "❌ FATAL: $PROD_CONTAINER runs '${ACTUAL_IMAGE:-<none>}', expected '$EXPECTED_IMAGE'."
  exit 1
fi
echo "✅ Image verified: $ACTUAL_IMAGE"

# ── Step 4: readiness poll (replaces the blind sleep 60) ──────────────────────
# Start checking immediately; succeed the instant /health is ok; fail fast if the
# deadline passes. All checks run INSIDE the container (host networking is
# unreliable on the self-hosted runner — same reason prod-rollback.sh uses exec).
echo "🩺 Readiness poll: /health (timeout ${READINESS_TIMEOUT_SECONDS}s, every ${READINESS_INTERVAL_SECONDS}s)..."
HEALTH_OK=0
elapsed=0
while [ "$elapsed" -le "$READINESS_TIMEOUT_SECONDS" ]; do
  HEALTH=$(docker exec "$PROD_CONTAINER" wget -qO- http://localhost:3000/health 2>/dev/null || echo "")
  if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo "✅ /health -> OK after ${elapsed}s"
    HEALTH_OK=1
    break
  fi
  sleep "$READINESS_INTERVAL_SECONDS"
  elapsed=$((elapsed + READINESS_INTERVAL_SECONDS))
  # Guard against an infinite loop when the interval is 0 (tests): one pass only.
  if [ "$READINESS_INTERVAL_SECONDS" -eq 0 ]; then break; fi
done

if [ "$HEALTH_OK" != "1" ]; then
  echo "❌ App did not become healthy within ${READINESS_TIMEOUT_SECONDS}s."
  docker logs "$PROD_CONTAINER" --tail 40 2>/dev/null || true
  exit 1
fi

# ── Step 5: SSR gate (BLOCKING) ───────────────────────────────────────────────
# /health is a separate controller and never renders SSR; the degraded homepage
# fallback answers 200 + noindex without throwing. prod-ssr-probe.sh is the only
# gate that catches that. Retry a few times (SSR data path can warm slightly after
# /health flips green).
SSR_OK=0
for i in 1 2 3; do
  if bash "$SCRIPT_DIR/prod-ssr-probe.sh" "post-recreate $i/3"; then
    SSR_OK=1
    break
  fi
  echo "  SSR gate attempt $i/3 failed, retrying..."
  sleep "$READINESS_INTERVAL_SECONDS"
  if [ "$READINESS_INTERVAL_SECONDS" -eq 0 ]; then break; fi
done

if [ "$SSR_OK" != "1" ]; then
  echo "❌ SSR gate failed — GET / is not a healthy, indexable, server-rendered document."
  docker logs "$PROD_CONTAINER" --tail 30 2>/dev/null || true
  exit 1
fi

# ── Step 6: apply a changed Caddyfile (only now, only if it changed) ──────────
# Done AFTER the app is healthy so the ~1 s Caddy restart never overlaps an app
# that isn't answering. Only on deploys that actually changed the Caddyfile.
if [ "$CADDY_CONFIG_CHANGED" = "1" ]; then
  echo "🧩 Restarting Caddy to load the changed Caddyfile (admin off ⇒ restart is the apply path)..."
  if docker restart "$CADDY_CONTAINER"; then
    echo "$NEW_CADDY_SHA" > "$CADDY_SHA_FILE"
    echo "✅ Caddy restarted with the new config."
  else
    # Non-fatal: the app is healthy and the OLD Caddy config is still valid and
    # serving. Surface loudly; do not fail the deploy over a config-reload blip.
    echo "::warning::Could not restart Caddy to apply the new config — app is healthy, Caddy still serving the previous config."
  fi
fi

echo "✅ App recreate complete — Caddy never went down, /health OK, GET / is a healthy indexable SSR document."
