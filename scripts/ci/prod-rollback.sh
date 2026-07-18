#!/usr/bin/env bash
#
# PROD rollback — restore the runtime AND the canonical registry tag to the
# pinned known-good image, then PROVE it.
#
# WHY THIS IS A SCRIPT (not inline YAML)
# --------------------------------------
# The rollback path is the one path that only ever runs when things are already
# broken, so it is precisely the path that must be tested. Inline workflow YAML
# cannot be executed against a stubbed docker; this script can — see
# `prod-rollback.test.mjs`, which proves the OLD image is actually restored and
# that a mismatch cannot silently pass.
#
# WHAT IT FIXES (audit 2026-07-16)
# --------------------------------
# The previous rollback was a proven NO-OP: the safety gate retagged
# `:production` to the NEW image *before* the deploy step derived
# `production-previous` FROM `:production`, so "rolling back" re-deployed the
# broken build. Here we roll back to an IMMUTABLE image ID captured before any
# mutation, and we ASSERT the restored container runs byte-exactly that ID.
#
# It also re-pushes `:production`: restoring only the local runtime leaves the
# registry's canonical tag resolving to the DEFECTIVE image — the next pull
# anywhere (scale-out, host rebuild, manual `docker pull`) would silently
# resurrect it.
#
# Required env:
#   ROLLBACK_IMAGE_ID  immutable image ID captured BEFORE any :production mutation
# Optional env:
#   IMAGE_REPO               (default massdoc/nestjs-remix-monorepo)
#   PROD_CONTAINER           (default nestjs-remix-monorepo-prod)
#   ROLLBACK_SETTLE_SECONDS  (default 30 — tests set 0)
set -uo pipefail

IMAGE_REPO="${IMAGE_REPO:-massdoc/nestjs-remix-monorepo}"
CONTAINER="${PROD_CONTAINER:-nestjs-remix-monorepo-prod}"
SETTLE="${ROLLBACK_SETTLE_SECONDS:-30}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${ROLLBACK_IMAGE_ID:-}" ]; then
  echo "❌ ROLLBACK_IMAGE_ID is empty — no rollback point was pinned."
  echo "   The runtime may be running a defective image. MANUAL INTERVENTION REQUIRED."
  exit 1
fi

echo "⏪ Rolling back to pinned known-good image ID $ROLLBACK_IMAGE_ID ..."
docker stop "$CONTAINER" 2>/dev/null || true
docker rm "$CONTAINER" 2>/dev/null || true

# compose pins `image: <repo>:production`, so point that tag back at the pinned
# ID. NEVER at :production-previous — that is the tag the old broken logic
# corrupted, and it is only an off-box convenience copy.
docker tag "$ROLLBACK_IMAGE_ID" "${IMAGE_REPO}:production"

docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d --no-deps monorepo_prod caddy redis_prod
sleep "$SETTLE"

# ── Proof 1: the container really runs the pinned OLD image ──────────────────
RESTORED=$(docker inspect --format='{{.Image}}' "$CONTAINER" 2>/dev/null || echo "")
if [ "$RESTORED" != "$ROLLBACK_IMAGE_ID" ]; then
  echo "❌ ROLLBACK VERIFICATION FAILED: container runs '${RESTORED:-<none>}', expected '$ROLLBACK_IMAGE_ID'."
  echo "   MANUAL INTERVENTION REQUIRED."
  exit 1
fi
echo "✅ Rollback image ID verified byte-exact: $RESTORED"

# ── Proof 2: the registry's canonical tag no longer resolves to the bad build ─
if docker push "${IMAGE_REPO}:production"; then
  echo "✅ Registry :production restored to the known-good image"
else
  echo "❌ Could not push the restored :production to the registry."
  echo "   The runtime is back, but the canonical tag STILL resolves to the defective"
  echo "   image — any later pull would resurrect it. MANUAL FIX REQUIRED."
  exit 1
fi

# ── Proof 3: the restored runtime actually serves ────────────────────────────
HEALTH=$(docker exec "$CONTAINER" wget -qO- http://localhost:3000/health 2>/dev/null || echo "")
if ! echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "❌ Rollback /health FAILED — MANUAL INTERVENTION REQUIRED"
  exit 1
fi
echo "✅ Rollback /health -> OK"

# A rollback that restores a broken page is not a rollback.
if ! bash "$SCRIPT_DIR/prod-ssr-probe.sh" "post-rollback"; then
  echo "❌ Rollback SSR gate FAILED — MANUAL INTERVENTION REQUIRED"
  exit 1
fi

echo "⏪ Rollback complete and VERIFIED (image ID + registry + /health + SSR)"
