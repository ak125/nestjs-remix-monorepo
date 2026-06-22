#!/usr/bin/env bash
#
# warm-soft-404-fixtures.sh — cache pre-pass for the "🩹 Soft-404 R2 smoke" CI step.
#
# WHY ------------------------------------------------------------------------
# The soft-404 R2 smoke asserts (in assert-soft-404.py) that each /pieces/ R2
# soft-404 page renders "≥ 1 deep link /pieces/<a>/<b>/<c>.html" (vehicle
# alternatives). Those alternatives come from get_soft_404_alternatives and are
# cached PER URL (Redis, 300s ok / 30s error) on first request. On a freshly
# deployed (cold) PREPROD container the first page hit fetches them through the
# SSR loader, which bounds the internal call with AbortSignal.timeout(3000): for
# a HEAVY vehicle (the BMW E60 alternateur fixture has 800+ siblings) the cold
# RPC exceeds 3s, the loader aborts, and the page renders WITHOUT alternatives.
# The backend RPC still completes + caches in the background, so a later (warm)
# hit passes — which is why this only ever cost a CI re-run on deploys #798/#799/
# #800, and recently turned the gate deterministically RED on the heaviest
# fixture once the old fixed 2s settle was shorter than the cold RPC.
#
# WHAT THIS DOES (and does NOT do) -------------------------------------------
# A CONDITION-BASED warm pre-pass, run BEFORE the smoke's assertion loop:
#   1. Directly primes the backend alternatives cache via GET /api/rm/alternatives
#      with a GENEROUS timeout (NOT bounded by the loader's 3s) so the cold RPC
#      finishes + caches deterministically.
#   2. Then POLLS the page until it actually renders warm — using the smoke's OWN
#      assert-soft-404.py as the readiness oracle (zero drift) — or a per-fixture
#      deadline elapses.
#
#   - It does NOT assert as a gate: warming is non-fatal and assert-soft-404.py is
#     used here ONLY as a readiness probe. The smoke step remains the single
#     source of truth — if alternatives are GENUINELY absent the warm spins to its
#     deadline and the smoke still fails (no masking, no blind retry of a failed
#     assertion).
#   - It does NOT change the smoke contract, skip the smoke, lower thresholds,
#     touch fixtures, or modify application runtime.
#   - It reads the SAME fixtures file the smoke reads, so the two never drift.
#
# Usage: warm-soft-404-fixtures.sh <BASE_URL> [FIXTURES_FILE]
#   WARM_MAX_SECONDS    (env, default 30): per-fixture condition-based deadline.
#   WARM_POLL_SECONDS   (env, default 2):  gap between readiness polls.
#   WARM_SETTLE_SECONDS (env, default 0):  residual settle after warming (legacy;
#                                          superseded by the condition-based poll).
# ----------------------------------------------------------------------------
set -uo pipefail

BASE="${1:?usage: warm-soft-404-fixtures.sh <BASE_URL> [fixtures_file]}"
FIXTURES="${2:-scripts/ci/soft-404-fixtures.txt}"
ASSERT="${SOFT_404_ASSERT:-scripts/ci/assert-soft-404.py}"
WARM_MAX_SECONDS="${WARM_MAX_SECONDS:-30}"
WARM_POLL_SECONDS="${WARM_POLL_SECONDS:-2}"
SETTLE_SECONDS="${WARM_SETTLE_SECONDS:-0}"

if [ ! -f "$FIXTURES" ]; then
  echo "🔥 warm: fixtures file not found: $FIXTURES" >&2
  exit 1
fi
if [ ! -f "$ASSERT" ]; then
  echo "🔥 warm: readiness oracle not found: $ASSERT" >&2
  exit 1
fi

# Prime the backend alternatives cache directly for one fixture URL. Best-effort:
# parses gamme_id (trailing -<id> of the first /pieces/ segment) + type_id
# (trailing -<id> before .html) and hits GET /api/rm/alternatives?...&limit=12
# (the EXACT call the SSR loader makes) with a generous timeout, so the cold RPC
# completes + caches even though the page loader would abort it at 3s. A parse
# miss or unreachable endpoint just falls through to the page-readiness poll.
prime_backend() {
  local url="$1" gamme_id type_id
  gamme_id="$(printf '%s' "$url" | sed -nE 's#^/pieces/[^/]*-([0-9]+)/.*#\1#p')"
  type_id="$(printf '%s' "$url" | sed -nE 's#.*-([0-9]+)\.html$#\1#p')"
  if [ -n "$gamme_id" ] && [ -n "$type_id" ]; then
    curl -s -o /dev/null --max-time 25 \
      "$BASE/api/rm/alternatives?gamme_id=${gamme_id}&type_id=${type_id}&limit=12" || true
  fi
}

echo "🔥 Warming soft-404 R2 fixtures (condition-based cache pre-pass) against $BASE"
warmed=0
ready=0
while IFS= read -r url || [ -n "$url" ]; do
  # Same skip rules as the smoke loop: blank lines + comments.
  [[ -z "${url// }" ]] && continue
  case "$url" in \#*) continue ;; esac
  warmed=$((warmed + 1))

  prime_backend "$url"

  deadline=$(( $(date +%s) + WARM_MAX_SECONDS ))
  hits=0
  while :; do
    hits=$((hits + 1))
    # Same request shape as the smoke (curl -s -i, 15s).
    http_out="$(curl -s -i --max-time 15 "$BASE$url" || true)"
    if [ -n "$http_out" ] && printf '%s' "$http_out" | python3 "$ASSERT" >/dev/null 2>&1; then
      ready=$((ready + 1))
      echo "  ✅ warm-ready: $url (after ${hits} page hit(s))"
      break
    fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "  ⏳ warm deadline ${WARM_MAX_SECONDS}s reached: $url (still cold or genuinely empty — the smoke assertion will decide)"
      break
    fi
    sleep "$WARM_POLL_SECONDS"
  done
done < "$FIXTURES"

echo "🔥 Warmed ${warmed} fixture(s); ${ready} reached warm-ready before assertions."
if [ "$SETTLE_SECONDS" -gt 0 ]; then
  sleep "$SETTLE_SECONDS"
fi
exit 0
