#!/usr/bin/env bash
# Signal A — checkout error rate (last 24h, /api/payments/* + /panier/*)
#
# Queries the Sentry events API for error events matching the checkout funnel
# and emits a JSON file at $OUTPUT_PATH. Designed to run as a VPS cron — see
# docs/runbooks/sentry-vps-setup.md § Signal A.
#
# Reads token from $SENTRY_AUTH_TOKEN (set via sops exec-env or ~/.sentryclirc).
# Never logs the token. Refuses to run if token is unset.
#
# Usage:
#   ./sentry-signal-a.sh
#   ./sentry-signal-a.sh --hours 6
#   OUTPUT_PATH=/var/log/sentry-signal-a.json ./sentry-signal-a.sh
set -euo pipefail

HOURS="${HOURS:-24}"
OUTPUT_PATH="${OUTPUT_PATH:-/var/log/sentry-signal-a-latest.json}"
SENTRY_API_BASE="${SENTRY_API_BASE:-https://sentry.io/api/0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hours) HOURS="$2"; shift 2 ;;
    --output) OUTPUT_PATH="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 64 ;;
  esac
done

: "${SENTRY_AUTH_TOKEN:?SENTRY_AUTH_TOKEN must be set (sops exec-env or ~/.sentryclirc)}"
: "${SENTRY_ORG:?SENTRY_ORG must be set}"
: "${SENTRY_PROJECT_BACKEND:?SENTRY_PROJECT_BACKEND must be set}"

now_iso="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
since_iso="$(date -u -d "${HOURS} hours ago" +%Y-%m-%dT%H:%M:%SZ)"

# Sentry discover query — count events tagged as 5xx in the checkout funnel.
# Adjust the `query` parameter to match the actual transaction names emitted
# once Sentry has been live for a few hours and you can see real labels.
query='url:"/api/payments/*" OR url:"/panier/*" event.type:error'

curl_response=$(curl -fsS \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Accept: application/json" \
  -G \
  --data-urlencode "query=$query" \
  --data-urlencode "start=$since_iso" \
  --data-urlencode "end=$now_iso" \
  --data-urlencode "field=count()" \
  "${SENTRY_API_BASE}/organizations/${SENTRY_ORG}/events/")

# count() result is in .data[0]."count()" — extract robustly with jq
event_count=$(echo "$curl_response" | jq -r '.data[0]["count()"] // 0')

cat > "$OUTPUT_PATH" <<EOF
{
  "signal": "A",
  "name": "checkout_error_rate",
  "window_hours": $HOURS,
  "since": "$since_iso",
  "until": "$now_iso",
  "event_count": $event_count,
  "query": $(echo "$query" | jq -Rs .),
  "computed_at": "$now_iso",
  "source": "sentry-signal-a.sh"
}
EOF

echo "✓ Signal A: $event_count error events in last ${HOURS}h → $OUTPUT_PATH"
