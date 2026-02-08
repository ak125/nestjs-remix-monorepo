#!/bin/bash
#
# capture-health-check.sh - Capture health check data into governance vault
#
# Usage:
#   ./capture-health-check.sh [--env production|preprod]
#
# Designed to be run via cron:
#   0 */4 * * * /opt/automecanik/scripts/governance/capture-health-check.sh
#

set -eo pipefail

VAULT_PATH=".local/governance-vault/04-audit-trail/health-checks"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M:%SZ)
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
ENV="production"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENV="$2"
      shift 2
      ;;
    production|preprod)
      ENV="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Endpoints based on environment
if [[ "$ENV" == "production" ]]; then
  BASE_URL="https://www.automecanik.com"
else
  BASE_URL="http://localhost:3100"
fi

# Fetch health data
HEALTH=$(curl -sf "${BASE_URL}/health" 2>/dev/null || echo '{"status":"error"}')
RPC_GATE=$(curl -sf "${BASE_URL}/health/rpc-gate" 2>/dev/null || echo '{"error":"unavailable"}')

# Extract values
STATUS=$(echo "$HEALTH" | jq -r '.status // "error"')
RPC_MODE=$(echo "$RPC_GATE" | jq -r '.mode // "unknown"')
RPC_LEVEL=$(echo "$RPC_GATE" | jq -r '.enforceLevel // "unknown"')
RPC_BLOCKS=$(echo "$RPC_GATE" | jq -r '.totalBlocks // -1')
ALLOWLIST_SIZE=$(echo "$RPC_GATE" | jq -r '.allowlistSize // -1')
DENYLIST_P2=$(echo "$RPC_GATE" | jq -r '.denylistP2Size // -1')

# Determine overall status
if [[ "$STATUS" == "ok" && "$RPC_BLOCKS" == "0" ]]; then
  OVERALL_STATUS="passed"
elif [[ "$STATUS" == "ok" ]]; then
  OVERALL_STATUS="warning"
else
  OVERALL_STATUS="failed"
fi

# Create output directory
mkdir -p "$VAULT_PATH"

# Generate sequence for today (handle grep no-match gracefully)
SEQ_COUNT=$(ls -1 "$VAULT_PATH" 2>/dev/null | { grep -c "^${DATE}" || true; })
SEQ=$((SEQ_COUNT + 1))

OUTPUT_FILE="${VAULT_PATH}/${DATE}_health-$(printf '%03d' $SEQ).md"

# Write verification entry
cat > "$OUTPUT_FILE" << EOF
---
id: VERIF-HEALTH-${DATE}-$(printf '%03d' $SEQ)
date: ${DATE}
time: "${TIME}"
type: health-check
status: ${OVERALL_STATUS}
author: "@cron"
trigger: cron
environment: ${ENV}
---

# Health Check: ${DATE} $(date +%H:%M)

## Overall Status: ${OVERALL_STATUS^^}

## Service Health

| Service | Status | Details |
|---------|--------|---------|
| API | $([ "$STATUS" == "ok" ] && echo "PASS" || echo "FAIL") | status: ${STATUS} |
| RPC Gate | $([ "$RPC_BLOCKS" == "0" ] && echo "PASS" || echo "WARN") | ${RPC_MODE}/${RPC_LEVEL}, ${RPC_BLOCKS} blocks |

## RPC Gate Metrics

| Metric | Value | Baseline | Delta |
|--------|-------|----------|-------|
| mode | ${RPC_MODE} | enforce | $([ "$RPC_MODE" == "enforce" ] && echo "=" || echo "!") |
| enforceLevel | ${RPC_LEVEL} | P2 | $([ "$RPC_LEVEL" == "P2" ] && echo "=" || echo "!") |
| allowlistSize | ${ALLOWLIST_SIZE} | 154 | $((ALLOWLIST_SIZE - 154)) |
| denylistP2Size | ${DENYLIST_P2} | 40 | $((DENYLIST_P2 - 40)) |
| totalBlocks | ${RPC_BLOCKS} | 0 | $((RPC_BLOCKS - 0)) |

## Raw Data

\`\`\`json
$(echo "$RPC_GATE" | jq '.')
\`\`\`

## Verification Commands

\`\`\`bash
curl -s ${BASE_URL}/health/rpc-gate | jq '{mode, enforceLevel, totalBlocks}'
\`\`\`

---

*Captured: ${TIMESTAMP}*
*Baseline: 2026-02-03_p2-enforce-baseline.md*
EOF

echo "Health check captured: $OUTPUT_FILE"
echo "Status: ${OVERALL_STATUS}"

exit 0
