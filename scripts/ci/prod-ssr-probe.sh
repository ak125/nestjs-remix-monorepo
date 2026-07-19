#!/usr/bin/env bash
#
# PROD SSR gate — assert `GET /` is a healthy, indexable, SERVER-RENDERED document.
#
# WHY THIS EXISTS
# ---------------
# `/health` is a SEPARATE NestJS controller and every other deploy probe hits an
# API route — none of them render an SSR page. The SSR data path is exactly what
# PR #1285 rewrote, so an SSR regression used to sail through every gate and reach
# users.
#
# WHY IT CHECKS noindex
# ---------------------
# The homepage degraded fallback does NOT throw: it returns HTTP **200** with
# empty families plus `X-Robots-Tag: noindex, follow`
# (frontend/app/routes/_index.tsx). A status-only probe is therefore BLIND to it,
# and serving a noindex homepage to crawlers is an SEO incident. A healthy
# homepage serves NO X-Robots-Tag at all.
#
# MARKER
# ------
# `__reactRouterContext` is the RR8 hydration payload — present only when the
# document was really server-rendered (framework-level, so it does not churn with
# page content).
#
# Usage:  prod-ssr-probe.sh [label]
# Exit:   0 = healthy indexable SSR document · 1 = otherwise (caller decides)
#
# Env overrides (used by the behavioural tests):
#   PROD_CONTAINER  container name              (default nestjs-remix-monorepo-prod)
#   SSR_URL         URL probed inside container (default http://localhost:3000/)
#   SSR_MARKER      required body marker        (default __reactRouterContext)
set -uo pipefail

LABEL="${1:-ssr}"
CONTAINER="${PROD_CONTAINER:-nestjs-remix-monorepo-prod}"
URL="${SSR_URL:-http://localhost:3000/}"
MARKER="${SSR_MARKER:-__reactRouterContext}"

# Capture WITHOUT writing a temp file inside the container. The PROD container's
# rootfs is not writable by this process, so `wget -O /tmp/ssr-probe.html` failed
# with "Read-only file system" — yet `--server-response` still printed the 200 to
# stderr, so status/Content-Type parsed fine while the body file stayed EMPTY →
# the marker check false-failed and rejected even the known-good image on rollback
# (PROD deploy incident 2026-07-19, tag v2026.07.19-deploy-safety-sentry-beacon).
# Headers go to stderr with the body discarded to /dev/null (writable even on a
# read-only rootfs); the body streams to stdout via `wget -qO-` — the exact
# pattern the /health probe in prod-rollback.sh already relies on.
hdrs=$(docker exec "$CONTAINER" wget -q --server-response -O /dev/null "$URL" 2>&1 || true)
body=$(docker exec "$CONTAINER" wget -qO- "$URL" 2>/dev/null || echo "")

status=$(echo "$hdrs" | grep -m1 'HTTP/' | awk '{print $2}')
ctype=$(echo "$hdrs" | grep -i -m1 'Content-Type:' | tr -d '\r')
robots=$(echo "$hdrs" | grep -i -m1 'X-Robots-Tag:' | tr -d '\r')

echo "  [$LABEL] status=${status:-<none>} | ${ctype:-Content-Type: <none>} | ${robots:-X-Robots-Tag: <none>}"

if [ "${status:-}" != "200" ]; then
  echo "  ❌ [$LABEL] GET / -> ${status:-no response} (expected 200)"
  exit 1
fi
if ! echo "$ctype" | grep -qi 'text/html'; then
  echo "  ❌ [$LABEL] GET / Content-Type is not text/html"
  exit 1
fi
if ! printf '%s' "$body" | grep -qF "$MARKER"; then
  echo "  ❌ [$LABEL] GET / lacks the stable SSR marker $MARKER — document was not server-rendered"
  exit 1
fi
if echo "$robots" | grep -qi 'noindex'; then
  echo "  ❌ [$LABEL] GET / served X-Robots-Tag: noindex — homepage is in DEGRADED FALLBACK (families empty)"
  exit 1
fi

echo "  ✅ [$LABEL] GET / -> 200 text/html, SSR marker present, indexable (no noindex)"
