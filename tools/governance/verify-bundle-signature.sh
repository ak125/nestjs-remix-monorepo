#!/bin/bash
# ============================================================
# verify-bundle-signature.sh
# ADR-010: Bundle Signature Verification (HMAC-SHA256)
# ============================================================
#
# Usage:
#   ./verify-bundle-signature.sh <bundle.json>
#   echo '{"envelope":{...},"signature":"..."}' | ./verify-bundle-signature.sh /dev/stdin
#
# Environment:
#   BUNDLE_HMAC_KEY - HMAC key for signature verification (required in prod)
#
# Exit codes:
#   0 - Signature valid
#   1 - Signature invalid or verification failed
#   2 - Missing dependencies or input
#
# Reference: ADR-010-airlock-enforce-activation.md
# ============================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: apt-get install jq"
    exit 2
fi

if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: openssl is required but not installed${NC}"
    exit 2
fi

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <bundle.json>"
    echo "       cat bundle.json | $0 /dev/stdin"
    exit 2
fi

BUNDLE_FILE="$1"

# Check file exists
if [ ! -f "$BUNDLE_FILE" ] && [ "$BUNDLE_FILE" != "/dev/stdin" ]; then
    echo -e "${RED}Error: Bundle file not found: $BUNDLE_FILE${NC}"
    exit 2
fi

# Get HMAC key
HMAC_KEY="${BUNDLE_HMAC_KEY:-}"

# In development, allow a default key with warning
if [ -z "$HMAC_KEY" ]; then
    if [ "${NODE_ENV:-development}" = "production" ]; then
        echo -e "${RED}Error: BUNDLE_HMAC_KEY is required in production${NC}"
        exit 1
    fi
    HMAC_KEY="dev_default_key_not_for_production"
    echo -e "${YELLOW}Warning: Using default dev key (not for production)${NC}"
fi

# Read bundle content
BUNDLE_CONTENT=$(cat "$BUNDLE_FILE")

# Extract signature and envelope
SIGNATURE=$(echo "$BUNDLE_CONTENT" | jq -r '.signature // empty')
ENVELOPE=$(echo "$BUNDLE_CONTENT" | jq -c '.envelope // empty')

# Check required fields
if [ -z "$SIGNATURE" ]; then
    echo -e "${RED}Error: No signature found in bundle${NC}"
    exit 1
fi

if [ -z "$ENVELOPE" ] || [ "$ENVELOPE" = "null" ]; then
    echo -e "${RED}Error: No envelope found in bundle${NC}"
    exit 1
fi

# Compute expected signature (HMAC-SHA256)
EXPECTED_SIG=$(echo -n "$ENVELOPE" | openssl dgst -sha256 -hmac "$HMAC_KEY" | cut -d' ' -f2)

# Compare signatures (constant-time comparison via openssl)
if [ "$SIGNATURE" = "$EXPECTED_SIG" ]; then
    echo -e "${GREEN}Bundle signature VALID${NC}"

    # Extract and display bundle metadata
    AGENT_ID=$(echo "$BUNDLE_CONTENT" | jq -r '.envelope.agent_id // "unknown"')
    INTENT=$(echo "$BUNDLE_CONTENT" | jq -r '.envelope.intent // "unknown"')
    SIGNED_AT=$(echo "$BUNDLE_CONTENT" | jq -r '.signedAt // "unknown"')

    echo ""
    echo "Bundle metadata:"
    echo "  Agent ID: $AGENT_ID"
    echo "  Intent:   $INTENT"
    echo "  Signed:   $SIGNED_AT"

    exit 0
else
    echo -e "${RED}Bundle signature INVALID${NC}"
    echo ""
    echo "Expected: $EXPECTED_SIG"
    echo "Got:      $SIGNATURE"
    echo ""
    echo "Possible causes:"
    echo "  - Bundle was tampered with"
    echo "  - Wrong HMAC key"
    echo "  - Bundle was not signed correctly"
    exit 1
fi
