#!/usr/bin/env bash
#
# PREPROD response probe — assert STATUS first, then measure latency.
#
# WHY THIS EXISTS
# ---------------
# The `⏱️ Response Time Baseline` step used to run:
#
#     curl -s -o /dev/null -w "%{time_total}" "$url"
#
# i.e. it measured ONLY elapsed time and asserted NOTHING about the response.
# A page returning 500 — quickly — passed the gate with a green ✅ row. This was
# found while verifying PR #1297 (RAG→R1 write closure) on PREPROD: the step does
# probe `/pieces/filtre-a-huile-7.html`, so it *looked* like proof the R1 page was
# served, but the run could not distinguish 200 from 500. The R1 gamme perf gate
# (ADR-024) was blind on exactly the surface it exists to protect.
#
# CONTRACT — the two failure exits are DISTINCT on purpose
# --------------------------------------------------------
#   0  expected status on every probe (may still warn on latency).
#   1  WRONG STATUS — a real defect. The caller must NEVER retry this. An endpoint
#      answering 500 then 200 is broken, and re-running until it looks green is
#      precisely the silent fallback this gate exists to prevent.
#   2  TRANSPORT — network error / DNS / connection reset / timeout / http_code 000.
#      No wrong status was ever observed, so the caller MAY re-run once after the
#      target is stably healthy again (~20s PREPROD container-restart blind window).
#
# The verdict is decided AFTER all probes, never inside the loop: a wrong status
# already observed OUTRANKS a transport error that happens later in the same
# sequence. Exiting early on the transport error (as this script first did) let
# `500 → connection reset → 200` report "transport-only"; the caller then retried,
# the second pass came back clean, and the 500 shipped green — the very masking
# this gate exists to prevent.
#
#   redirect (301/302/307/308) → exit 1 unless explicitly declared as expected;
#                                redirects are NEVER followed (no `-L`), so a
#                                canonical URL that silently starts redirecting is
#                                caught instead of being measured as its target.
#   status OK but median > budget → WARNING only (unchanged, non-blocking).
#
# All three probes are status-checked, not just one: an endpoint that flaps
# 200/500/200 is a real defect and must not average away into a green row.
#
# Usage:  preprod-response-probe.sh <url> <label> <budget_ms> [expected_status]
# Exit:   0 = ok · 1 = wrong status (never retry) · 2 = transport (retryable once)
#
# Env overrides (used by the behavioural tests):
#   PROBE_COUNT           number of probes           (default 3)
#   PROBE_MAX_TIME        curl --max-time seconds    (default 30)
#   GITHUB_STEP_SUMMARY   markdown summary sink      (default /dev/null)
set -uo pipefail

URL="${1:?usage: preprod-response-probe.sh <url> <label> <budget_ms> [expected_status]}"
LABEL="${2:?missing label}"
BUDGET_MS="${3:?missing budget_ms}"
EXPECTED="${4:-200}"

COUNT="${PROBE_COUNT:-3}"
MAX_TIME="${PROBE_MAX_TIME:-30}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

times=()
statuses=()
status_fail=0
transport_fail=0
transport_detail=""

# NEVER exit inside this loop. A transport error on attempt 2 used to abort with
# exit 2 while a 500 was already observed on attempt 1 — the caller then read
# "transport-only", retried, got a clean pass, and the real defect shipped green.
# Every attempt is collected; the verdict is decided once, after the loop.
for _ in $(seq 1 "$COUNT"); do
  # One curl per probe yields BOTH status and timing, so the two can never drift
  # apart. No `-L`: a redirect must surface as 3xx, never be followed silently.
  # On a network error / DNS failure / timeout curl exits non-zero and prints
  # `000` as %{http_code} — both are captured below.
  out=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" --max-time "$MAX_TIME" "$URL" 2>/dev/null)
  rc=$?
  code=$(printf '%s' "$out" | awk '{print $1}')
  secs=$(printf '%s' "$out" | awk '{print $2}')

  if [ "$rc" -ne 0 ] || [ -z "$code" ] || [ "$code" = "000" ]; then
    # curl exit 28 = timeout, 6 = DNS, 7 = connection refused, 56 = recv error.
    transport_fail=1
    transport_detail="curl exit $rc, http_code=${code:-<none>}"
    statuses+=("ERR")
    continue
  fi

  statuses+=("$code")
  times+=("$(printf '%s' "${secs:-0}" | awk '{printf "%.0f", $1 * 1000}')")
  # Every probe must carry the expected status — no averaging over a flap.
  [ "$code" != "$EXPECTED" ] && status_fail=1
done

# VERDICT — a status actually OBSERVED outranks a transport error seen later.
# Anything else would let a retry bury a defect the probe already proved.
if [ "$status_fail" -eq 1 ]; then
  echo "❌ $LABEL — $URL: HTTP ${statuses[*]} (expected $EXPECTED)"
  for code in "${statuses[@]}"; do
    case "$code" in
      3??)
        echo "   redirect not followed on purpose: this URL is canonical and must answer directly."
        break
        ;;
    esac
  done
  echo "| $LABEL | — | ${BUDGET_MS} | ❌ HTTP ${statuses[*]} (expected $EXPECTED) | ❌ |" >>"$SUMMARY"
  # exit 1 = WRONG STATUS: a real defect, never retried by the caller.
  exit 1
fi

if [ "$transport_fail" -eq 1 ]; then
  # exit 2 = TRANSPORT: no wrong status was observed, so the caller may retry once.
  echo "❌ $LABEL — $URL: no usable response (${transport_detail})"
  echo "| $LABEL | — | ${BUDGET_MS} | ❌ no response (${transport_detail}) | ❌ |" >>"$SUMMARY"
  exit 2
fi

median=$(printf '%s\n' "${times[@]}" | sort -n | awk '{a[NR]=$1} END {print a[int((NR+1)/2)]}')

if [ "$median" -gt "$BUDGET_MS" ]; then
  echo "⚠️ $LABEL — HTTP $EXPECTED, ${median}ms exceeds budget ${BUDGET_MS}ms"
  echo "::warning::$LABEL response time (${median}ms) exceeds budget (${BUDGET_MS}ms)"
  echo "| $LABEL | ${median} | ${BUDGET_MS} | ⚠️ SLOW | ${EXPECTED} |" >>"$SUMMARY"
else
  echo "✅ $LABEL — HTTP $EXPECTED, ${median}ms (budget ${BUDGET_MS}ms)"
  echo "| $LABEL | ${median} | ${BUDGET_MS} | ✅ | ${EXPECTED} |" >>"$SUMMARY"
fi
