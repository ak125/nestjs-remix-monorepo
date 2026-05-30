#!/usr/bin/env bash
#
# warm-soft-404-fixtures.sh — cache pre-pass for the "🩹 Soft-404 R2 smoke" CI step.
#
# WHY ------------------------------------------------------------------------
# The soft-404 R2 smoke asserts (in assert-soft-404.py) that each /pieces/ R2
# soft-404 page renders "≥ 1 deep link /pieces/<a>/<b>/<c>.html" (vehicle
# alternatives). Those alternatives are computed + cached PER URL on first
# request. On a freshly-deployed (cold) PREPROD container, the very first hit
# can render WITHOUT them, flaking only assertion #4 — observed on the SAME 2
# fixtures across deploys #798, #800 and #799, and cleared every time by a
# plain re-run (warm container). It cost one CI re-run on each of those deploys.
#
# WHAT THIS DOES (and does NOT do) -------------------------------------------
# This is a DETERMINISTIC WARM PRE-PASS, run BEFORE the smoke's assertion loop:
# it fetches each fixture once (output discarded) so the per-URL alternatives
# cache is populated by the time the smoke asserts.
#
#   - It does NOT assert anything (the smoke remains the single source of truth).
#   - It does NOT change the smoke contract, skip the smoke, lower thresholds,
#     touch fixtures, or modify application runtime.
#   - It is NOT a blind retry: it never re-runs a failed assertion. If the
#     alternatives are GENUINELY absent after warming, the smoke still fails.
#   - Warm failures are non-fatal here on purpose — diagnosing them is the
#     smoke's job, not this pre-pass's.
#
# It reads the SAME fixtures file the smoke reads, so the two never drift.
#
# Usage: warm-soft-404-fixtures.sh <BASE_URL> [FIXTURES_FILE]
#   WARM_SETTLE_SECONDS (env, default 2): brief settle after warming so any
#   async cache-fill completes before assertions. Set 0 to disable.
# ----------------------------------------------------------------------------
set -uo pipefail

BASE="${1:?usage: warm-soft-404-fixtures.sh <BASE_URL> [fixtures_file]}"
FIXTURES="${2:-scripts/ci/soft-404-fixtures.txt}"
SETTLE_SECONDS="${WARM_SETTLE_SECONDS:-2}"

if [ ! -f "$FIXTURES" ]; then
  echo "🔥 warm: fixtures file not found: $FIXTURES" >&2
  exit 1
fi

echo "🔥 Warming soft-404 R2 fixtures (cache pre-pass — no assertions) against $BASE"
warmed=0
while IFS= read -r url || [ -n "$url" ]; do
  # Same skip rules as the smoke loop: blank lines + comments.
  [[ -z "${url// }" ]] && continue
  case "$url" in \#*) continue ;; esac
  # Same --max-time as the smoke (15s) — no per-request timeout increase.
  curl -s -o /dev/null --max-time 15 "$BASE$url" || true
  warmed=$((warmed + 1))
  echo "  warmed: $url"
done < "$FIXTURES"

echo "🔥 Warmed ${warmed} fixture(s); settling ${SETTLE_SECONDS}s before assertions."
sleep "$SETTLE_SECONDS"
