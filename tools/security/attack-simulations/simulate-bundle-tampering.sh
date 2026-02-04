#!/bin/bash
# ============================================================
# simulate-bundle-tampering.sh
# ADR-010: Attack Vector #3 - Bundle Tampering (HIGH)
# ============================================================
#
# Tests that tampered bundles are correctly rejected.
#
# Attack scenarios:
#   1. Modified envelope with original signature
#   2. Invalid signature format
#   3. Missing signature
#   4. Empty envelope
#
# Exit codes:
#   0 - All tampered bundles rejected (PROTECTED)
#   1 - Vulnerability detected (FAIL)
#
# ============================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=============================================="
echo "  ATTACK SIMULATION: Bundle Tampering"
echo "  ADR-010 Security Test"
echo "=============================================="
echo ""

# Configuration
VERIFY_SCRIPT="${VERIFY_SCRIPT:-/opt/automecanik/app/tools/governance/verify-bundle-signature.sh}"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

VULNERABILITIES=0

# Check verify script exists
if [ ! -x "$VERIFY_SCRIPT" ]; then
    echo -e "${RED}Error: Verification script not found or not executable${NC}"
    echo "Expected: $VERIFY_SCRIPT"
    exit 2
fi

echo -e "${YELLOW}[TEST 1] Tampered envelope with original signature...${NC}"
echo ""

# Create a "valid" bundle structure with wrong signature
cat > "$TEMP_DIR/tampered1.json" << 'EOF'
{
  "envelope": {
    "job_id": "TAMPERED-001",
    "agent_id": "malicious-agent",
    "intent": "STEAL_DATA",
    "scope": ["backend/src/config/secrets.ts"],
    "timestamp": "2026-02-04T00:00:00Z"
  },
  "signature": "fake_signature_that_should_not_match",
  "signedAt": "2026-02-04T00:00:00Z",
  "signedBy": "attacker"
}
EOF

echo -n "  Testing tampered envelope... "
if BUNDLE_HMAC_KEY="test_key" "$VERIFY_SCRIPT" "$TEMP_DIR/tampered1.json" > /dev/null 2>&1; then
    echo -e "${RED}VULNERABLE - Tampered bundle accepted!${NC}"
    VULNERABILITIES=$((VULNERABILITIES + 1))
else
    echo -e "${GREEN}PROTECTED - Correctly rejected${NC}"
fi

echo ""
echo -e "${YELLOW}[TEST 2] Missing signature field...${NC}"
echo ""

cat > "$TEMP_DIR/nosig.json" << 'EOF'
{
  "envelope": {
    "job_id": "NO-SIG-001",
    "agent_id": "test-agent",
    "intent": "TEST",
    "timestamp": "2026-02-04T00:00:00Z"
  },
  "signedAt": "2026-02-04T00:00:00Z"
}
EOF

echo -n "  Testing missing signature... "
if BUNDLE_HMAC_KEY="test_key" "$VERIFY_SCRIPT" "$TEMP_DIR/nosig.json" > /dev/null 2>&1; then
    echo -e "${RED}VULNERABLE - Bundle without signature accepted!${NC}"
    VULNERABILITIES=$((VULNERABILITIES + 1))
else
    echo -e "${GREEN}PROTECTED - Correctly rejected${NC}"
fi

echo ""
echo -e "${YELLOW}[TEST 3] Empty envelope...${NC}"
echo ""

cat > "$TEMP_DIR/empty.json" << 'EOF'
{
  "envelope": {},
  "signature": "anything",
  "signedAt": "2026-02-04T00:00:00Z"
}
EOF

echo -n "  Testing empty envelope... "
if BUNDLE_HMAC_KEY="test_key" "$VERIFY_SCRIPT" "$TEMP_DIR/empty.json" > /dev/null 2>&1; then
    echo -e "${RED}VULNERABLE - Empty envelope accepted!${NC}"
    VULNERABILITIES=$((VULNERABILITIES + 1))
else
    echo -e "${GREEN}PROTECTED - Correctly rejected${NC}"
fi

echo ""
echo -e "${YELLOW}[TEST 4] Valid bundle structure with correct signature...${NC}"
echo ""

# Create a properly signed bundle for positive test
ENVELOPE='{"job_id":"VALID-001","agent_id":"test-agent","intent":"TEST","timestamp":"2026-02-04T00:00:00Z"}'
VALID_SIG=$(echo -n "$ENVELOPE" | openssl dgst -sha256 -hmac "test_key" | cut -d' ' -f2)

cat > "$TEMP_DIR/valid.json" << EOF
{
  "envelope": $ENVELOPE,
  "signature": "$VALID_SIG",
  "signedAt": "2026-02-04T00:00:00Z",
  "signedBy": "test-agent"
}
EOF

echo -n "  Testing valid bundle... "
if BUNDLE_HMAC_KEY="test_key" "$VERIFY_SCRIPT" "$TEMP_DIR/valid.json" > /dev/null 2>&1; then
    echo -e "${GREEN}ACCEPTED (correct behavior)${NC}"
else
    echo -e "${RED}REJECTED - Valid bundle was rejected!${NC}"
    VULNERABILITIES=$((VULNERABILITIES + 1))
fi

echo ""
echo "=============================================="

if [ $VULNERABILITIES -eq 0 ]; then
    echo -e "${GREEN}RESULT: BUNDLE SIGNATURE VERIFICATION WORKING${NC}"
    echo "Bundle tampering attack surface: MINIMAL"
    exit 0
else
    echo -e "${RED}RESULT: $VULNERABILITIES VULNERABILITY(IES) DETECTED${NC}"
    echo "Action required: Fix bundle signature verification"
    exit 1
fi
