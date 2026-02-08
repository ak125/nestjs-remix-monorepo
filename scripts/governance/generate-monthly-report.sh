#!/bin/bash
#
# generate-monthly-report.sh - Generate monthly audit report from vault entries
#
# Usage:
#   ./generate-monthly-report.sh [YYYY-MM]
#
# Example:
#   ./generate-monthly-report.sh 2026-02
#

set -euo pipefail

VAULT_PATH=".local/governance-vault/04-audit-trail"
YEAR_MONTH="${1:-$(date +%Y-%m)}"
DATE=$(date +%Y-%m-%d)

# Output file
OUTPUT_DIR="${VAULT_PATH}/reports"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="${OUTPUT_DIR}/${YEAR_MONTH}_monthly-audit.md"

# Helper function to count files safely
count_files() {
  local pattern="$1"
  local count=0
  shopt -s nullglob
  for f in $pattern; do
    [[ -f "$f" ]] && ((count++)) || true
  done
  shopt -u nullglob
  echo "$count"
}

# Helper function to count files with status
count_status() {
  local pattern="$1"
  local status="$2"
  local count=0
  shopt -s nullglob
  for f in $pattern; do
    if [[ -f "$f" ]] && grep -q "status: $status" "$f" 2>/dev/null; then
      ((count++)) || true
    fi
  done
  shopt -u nullglob
  echo "$count"
}

# Count verifications by type
CI_TOTAL=$(count_files "${VAULT_PATH}/ci-gates/${YEAR_MONTH}*")
CI_PASSED=$(count_status "${VAULT_PATH}/ci-gates/${YEAR_MONTH}*" "passed")
CI_FAILED=$(count_status "${VAULT_PATH}/ci-gates/${YEAR_MONTH}*" "failed")

HEALTH_TOTAL=$(count_files "${VAULT_PATH}/health-checks/${YEAR_MONTH}*")
HEALTH_PASSED=$(count_status "${VAULT_PATH}/health-checks/${YEAR_MONTH}*" "passed")
HEALTH_FAILED=$(count_status "${VAULT_PATH}/health-checks/${YEAR_MONTH}*" "failed")

DEPLOY_TOTAL=$(count_files "${VAULT_PATH}/deployments/${YEAR_MONTH}*")
DEPLOY_PASSED=$(count_status "${VAULT_PATH}/deployments/${YEAR_MONTH}*" "passed")
DEPLOY_FAILED=$(count_status "${VAULT_PATH}/deployments/${YEAR_MONTH}*" "failed")

RPC_TOTAL=$(count_files "${VAULT_PATH}/rpc/${YEAR_MONTH}*")

# Calculate warnings (ensure non-negative)
CI_WARNING=$((CI_TOTAL - CI_PASSED - CI_FAILED))
HEALTH_WARNING=$((HEALTH_TOTAL - HEALTH_PASSED - HEALTH_FAILED))
DEPLOY_WARNING=$((DEPLOY_TOTAL - DEPLOY_PASSED - DEPLOY_FAILED))

# Generate report
cat > "$OUTPUT_FILE" << EOF
---
id: REPORT-${YEAR_MONTH}
date: ${DATE}
type: periodic-report
period: ${YEAR_MONTH}
---

# Monthly Audit Report: ${YEAR_MONTH}

## Summary

| Category | Total | Passed | Failed | Warning |
|----------|-------|--------|--------|---------|
| CI Gates | ${CI_TOTAL} | ${CI_PASSED} | ${CI_FAILED} | ${CI_WARNING} |
| Health Checks | ${HEALTH_TOTAL} | ${HEALTH_PASSED} | ${HEALTH_FAILED} | ${HEALTH_WARNING} |
| Deployments | ${DEPLOY_TOTAL} | ${DEPLOY_PASSED} | ${DEPLOY_FAILED} | ${DEPLOY_WARNING} |
| RPC Gate | ${RPC_TOTAL} | - | - | - |

## Key Metrics

- **Total Verifications**: $((CI_TOTAL + HEALTH_TOTAL + DEPLOY_TOTAL + RPC_TOTAL))
- **Pass Rate**: $(echo "scale=1; (${CI_PASSED} + ${HEALTH_PASSED} + ${DEPLOY_PASSED}) * 100 / (${CI_TOTAL} + ${HEALTH_TOTAL} + ${DEPLOY_TOTAL} + 1)" | bc)%
- **RPC Blocks (expected)**: 0

## Notable Events

### Incidents
- (List any incidents this month)

### Baseline Changes
- (List any baseline changes)

### New Rules
- (List any new governance rules)

## RPC Gate Baseline

| Metric | Start of Month | End of Month | Change |
|--------|----------------|--------------|--------|
| allowlistSize | 154 | TBD | - |
| denylistP2Size | 40 | TBD | - |
| totalBlocks | 0 | TBD | - |

## Recommendations

- (Based on verification patterns)

## Linked Documents

- [[2026-02-03_p2-enforce-baseline]]
- [[ADR-003-rpc-governance]]

---

*Generated: ${DATE}*
*Period: ${YEAR_MONTH}*
EOF

echo "Monthly report generated: $OUTPUT_FILE"
echo ""
echo "Summary for ${YEAR_MONTH}:"
echo "  CI Gates:      ${CI_TOTAL} (${CI_PASSED} passed, ${CI_FAILED} failed)"
echo "  Health Checks: ${HEALTH_TOTAL} (${HEALTH_PASSED} passed, ${HEALTH_FAILED} failed)"
echo "  Deployments:   ${DEPLOY_TOTAL} (${DEPLOY_PASSED} passed, ${DEPLOY_FAILED} failed)"
echo "  RPC Gate:      ${RPC_TOTAL} entries"
