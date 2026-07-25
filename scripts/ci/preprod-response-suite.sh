#!/usr/bin/env bash
#
# PREPROD response suite — runs every response probe, then decides ONE verdict.
#
# WHY THIS IS A SCRIPT AND NOT INLINE YAML
# ----------------------------------------
# The retry branch is where the contract can silently break. Review of PR #1316
# caught exactly that: an aggregate "any failure → retry" made a WRONG STATUS
# retryable, so `200,500,200` on the first pass followed by `200,200,200` on the
# second ended the job green. The per-probe test suite could not see it because
# the orchestration lived in YAML. It lives here now, and it is tested.
#
# VERDICT RULES
# -------------
#   * Every endpoint is probed even after a failure — the summary must show the
#     FULL picture, never truncate at the first defect.
#   * A WRONG STATUS anywhere (probe exit 1) is NEVER retried → exit 1.
#     Re-running until an endpoint looks green is the silent fallback this gate
#     exists to prevent.
#   * TRANSPORT-ONLY failures (probe exit 2: connection refused / reset / DNS /
#     timeout / http_code 000) MAY be retried ONCE, and only after the target is
#     STABLY healthy again — the ~20s PREPROD container-restart blind window
#     (diagnostic 2026-06-21). Same discipline as the "🎭 Run critical E2E tests"
#     job: announced, bounded to one, and a still-failing re-run still blocks.
#
# Usage:  preprod-response-suite.sh [base_url]
# Exit:   0 = all endpoints answered their expected status
#         1 = wrong status somewhere (or the single re-run still failed)
#         2 = transport failures that never re-stabilized
#
# Env overrides (used by the behavioural tests):
#   PROBE_SPEC_FILE   endpoint list, one `path|label|budget_ms|expected` per line
#   PROBE_BIN         path to preprod-response-probe.sh
#   STABLE_NEEDED     consecutive healthy checks required   (default 4)
#   STABLE_TRIES      health poll attempts                  (default 30)
#   STABLE_SLEEP      seconds between health polls          (default 3)
#   GITHUB_STEP_SUMMARY  markdown summary sink              (default /dev/null)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${1:-${PREPROD_BASE_URL:-http://localhost:3200}}"
PROBE="${PROBE_BIN:-$SCRIPT_DIR/preprod-response-probe.sh}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
STABLE_NEEDED="${STABLE_NEEDED:-4}"
STABLE_TRIES="${STABLE_TRIES:-30}"
STABLE_SLEEP="${STABLE_SLEEP:-3}"

# Default endpoint list. `expected` defaults to 200; /pieces/catalogue is a legacy
# route that 301s to `/` — verified on DEV and PREPROD — so its redirect is DECLARED
# rather than silently timed as if it were a page. The probe never follows it, so
# that row now fails if the route drifts either way (301→200 or 301→500).
# ADR-024 R1 gamme perf gate (parity R2): backed by __gamme_page_cache (Phase 1) +
# SSR cache-first read path (Phase 5a); cold-path/legacy ceiling 3000ms. Top 5 G1
# gammes covering the bulk of indexed traffic.
read -r -d '' DEFAULT_SPEC <<'SPEC' || true
/health|/health|200|200
/api/catalog/families|/api/catalog/families|1000|200
/|Homepage|2000|200
/pieces/catalogue|/pieces/catalogue (legacy 301→/)|2000|301
/pieces/plaquette-de-frein-402/renault-140/megane-iii-140049/1-5-dci-100413.html|R2 Product Page|3000|200
/pieces/plaquette-de-frein-402.html|R1 Gamme (plaquette-de-frein)|3000|200
/pieces/disque-de-frein-82.html|R1 Gamme (disque-de-frein)|3000|200
/pieces/filtre-a-huile-7.html|R1 Gamme (filtre-a-huile)|3000|200
/pieces/filtre-a-air-8.html|R1 Gamme (filtre-a-air)|3000|200
/pieces/courroie-de-distribution-306.html|R1 Gamme (courroie-distribution)|3000|200
SPEC

if [ -n "${PROBE_SPEC_FILE:-}" ]; then
  SPEC=$(cat "$PROBE_SPEC_FILE")
else
  SPEC="$DEFAULT_SPEC"
fi

summary_header() {
  echo "| Endpoint | Median (ms) | Budget (ms) | Status | HTTP |" >>"$SUMMARY"
  echo "|----------|-------------|-------------|--------|------|" >>"$SUMMARY"
}

# Returns 0 (all good) · 1 (a wrong status occurred) · 2 (transport only).
# A wrong status DOMINATES: if both kinds happen, the verdict is 1, never 2,
# so a co-occurring transport blip can never make a real defect retryable.
run_probes() {
  local status_fail=0 transport_fail=0 rc path label budget expected
  while IFS='|' read -r path label budget expected; do
    [ -z "${path:-}" ] && continue
    "$PROBE" "${BASE}${path}" "$label" "$budget" "${expected:-200}"
    rc=$?
    case "$rc" in
      0) ;;
      1) status_fail=1 ;;
      *) transport_fail=1 ;;
    esac
  done <<<"$SPEC"

  [ "$status_fail" -eq 1 ] && return 1
  [ "$transport_fail" -eq 1 ] && return 2
  return 0
}

echo "## ⏱️ PREPROD Response Times" >>"$SUMMARY"
echo "" >>"$SUMMARY"
summary_header

run_probes
verdict=$?

if [ "$verdict" -eq 0 ]; then
  echo "✅ All endpoints answered their expected status."
  exit 0
fi

if [ "$verdict" -eq 1 ]; then
  echo "::error::A wrong HTTP status is a real defect — never retried. Blocking."
  exit 1
fi

# verdict == 2 → transport only. Wait for a STABLE target, then re-run ONCE.
echo "::warning::Transport-only probe failures — checking for a transient PREPROD restart…"
stable=0
for _ in $(seq 1 "$STABLE_TRIES"); do
  # Bounded on BOTH connect and total: without --max-time this loop can hang on a
  # socket that is accepted but never answers, defeating the announced bound.
  if curl -sf --connect-timeout 5 --max-time 10 "${BASE}/health" >/dev/null 2>&1; then
    stable=$((stable + 1))
    [ "$stable" -ge "$STABLE_NEEDED" ] && break
  else
    stable=0
  fi
  sleep "$STABLE_SLEEP"
done

if [ "$stable" -lt "$STABLE_NEEDED" ]; then
  echo "::error::PREPROD did not re-stabilize — real failure, not a transient restart"
  exit 2
fi

echo "PREPROD stably healthy again — re-running the response probes once"
echo "" >>"$SUMMARY"
echo "_(re-run after a transient PREPROD restart)_" >>"$SUMMARY"
echo "" >>"$SUMMARY"
summary_header

run_probes
verdict=$?
if [ "$verdict" -ne 0 ]; then
  echo "::error::Probes still failing after the single re-run — blocking."
fi
exit $verdict
