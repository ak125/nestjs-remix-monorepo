#!/bin/bash
#
# capture-verification.sh - Capture verification results into governance vault
#
# Usage:
#   ./capture-verification.sh --type ci-gate --status passed --run-id 12345
#   ./capture-verification.sh --type health-check --status passed
#   ./capture-verification.sh --type deployment --status passed --env production
#

set -euo pipefail

VAULT_PATH=".local/governance-vault/04-audit-trail"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M:%SZ)
TIMESTAMP=$(date +%Y-%m-%d_%H%M)

# Default values
TYPE=""
STATUS="passed"
ENV="production"
RUN_ID=""
COMMIT=""
TRIGGER="manual"
AUTHOR="@manual"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --type)
      TYPE="$2"
      shift 2
      ;;
    --status)
      STATUS="$2"
      shift 2
      ;;
    --env)
      ENV="$2"
      shift 2
      ;;
    --run-id)
      RUN_ID="$2"
      shift 2
      ;;
    --commit)
      COMMIT="$2"
      shift 2
      ;;
    --trigger)
      TRIGGER="$2"
      shift 2
      ;;
    --author)
      AUTHOR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate type
if [[ -z "$TYPE" ]]; then
  echo "Error: --type is required (ci-gate, health-check, deployment, rpc-gate)"
  exit 1
fi

# Get current commit if not provided
if [[ -z "$COMMIT" ]]; then
  COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
fi

# Generate sequence number (handle grep no-match gracefully)
SEQ_COUNT=$(ls -1 "${VAULT_PATH}/${TYPE}s/" 2>/dev/null | { grep -c "^${DATE}" || true; })
SEQ=$((SEQ_COUNT + 1))

# Determine output directory
case $TYPE in
  ci-gate)
    OUTPUT_DIR="${VAULT_PATH}/ci-gates"
    OUTPUT_FILE="${OUTPUT_DIR}/${DATE}_ci-run-${RUN_ID:-${SEQ}}.md"
    ;;
  health-check)
    OUTPUT_DIR="${VAULT_PATH}/health-checks"
    OUTPUT_FILE="${OUTPUT_DIR}/${DATE}_health-${TIMESTAMP##*_}.md"
    ;;
  deployment)
    OUTPUT_DIR="${VAULT_PATH}/deployments"
    OUTPUT_FILE="${OUTPUT_DIR}/${DATE}_${ENV}-deploy.md"
    ;;
  rpc-gate)
    OUTPUT_DIR="${VAULT_PATH}/rpc"
    OUTPUT_FILE="${OUTPUT_DIR}/${DATE}_rpc-verification.md"
    ;;
  *)
    echo "Error: Unknown type: $TYPE"
    exit 1
    ;;
esac

# Create directory if needed
mkdir -p "$OUTPUT_DIR"

# Generate verification entry
echo "---" > "$OUTPUT_FILE"
echo "id: VERIF-${TYPE^^}-${DATE}-$(printf '%03d' $SEQ)" >> "$OUTPUT_FILE"
echo "date: ${DATE}" >> "$OUTPUT_FILE"
echo "time: \"${TIME}\"" >> "$OUTPUT_FILE"
echo "type: ${TYPE}" >> "$OUTPUT_FILE"
echo "status: ${STATUS}" >> "$OUTPUT_FILE"
echo "author: \"${AUTHOR}\"" >> "$OUTPUT_FILE"
echo "trigger: ${TRIGGER}" >> "$OUTPUT_FILE"
echo "environment: ${ENV}" >> "$OUTPUT_FILE"
echo "commit: ${COMMIT}" >> "$OUTPUT_FILE"

if [[ -n "$RUN_ID" ]]; then
  echo "run_id: ${RUN_ID}" >> "$OUTPUT_FILE"
fi

echo "related: []" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add content based on type
case $TYPE in
  ci-gate)
    echo "# CI Gate Verification: ${COMMIT}" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "## Summary" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "| Job | Status |" >> "$OUTPUT_FILE"
    echo "|-----|--------|" >> "$OUTPUT_FILE"
    echo "| lint | ${STATUS^^} |" >> "$OUTPUT_FILE"
    echo "| typecheck | ${STATUS^^} |" >> "$OUTPUT_FILE"
    echo "| build | ${STATUS^^} |" >> "$OUTPUT_FILE"
    ;;

  health-check)
    echo "# Health Check: ${DATE} $(date +%H:%M)" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "## Overall Status: ${STATUS^^}" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    # Capture actual health data if production
    if command -v curl &> /dev/null; then
      echo "## RPC Gate Metrics" >> "$OUTPUT_FILE"
      echo "" >> "$OUTPUT_FILE"
      echo '```json' >> "$OUTPUT_FILE"
      curl -sf https://www.automecanik.com/health/rpc-gate 2>/dev/null | jq '{mode, enforceLevel, allowlistSize, denylistP0Size, denylistP1Size, denylistP2Size, totalBlocks}' >> "$OUTPUT_FILE" || echo '{"error": "Could not fetch"}' >> "$OUTPUT_FILE"
      echo '```' >> "$OUTPUT_FILE"
    fi
    ;;

  deployment)
    echo "# Deployment: ${ENV} ${DATE}" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "## Status: ${STATUS^^}" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "## Commit: ${COMMIT}" >> "$OUTPUT_FILE"
    ;;

  rpc-gate)
    echo "# RPC Gate Verification: ${DATE}" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    if command -v curl &> /dev/null; then
      echo '```json' >> "$OUTPUT_FILE"
      curl -sf https://www.automecanik.com/health/rpc-gate 2>/dev/null | jq '.' >> "$OUTPUT_FILE" || echo '{"error": "Could not fetch"}' >> "$OUTPUT_FILE"
      echo '```' >> "$OUTPUT_FILE"
    fi
    ;;
esac

echo "" >> "$OUTPUT_FILE"
echo "## Verification Commands" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```bash' >> "$OUTPUT_FILE"
echo "# Reproduce this verification" >> "$OUTPUT_FILE"

case $TYPE in
  ci-gate)
    echo "gh run view ${RUN_ID:-RUNID} --json conclusion" >> "$OUTPUT_FILE"
    ;;
  health-check)
    echo "curl -s https://www.automecanik.com/health/rpc-gate | jq '{mode, totalBlocks}'" >> "$OUTPUT_FILE"
    ;;
  *)
    echo "# No specific command" >> "$OUTPUT_FILE"
    ;;
esac

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "*Captured: ${TIMESTAMP}*" >> "$OUTPUT_FILE"

echo "Verification captured: $OUTPUT_FILE"
