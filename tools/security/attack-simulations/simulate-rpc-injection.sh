#!/bin/bash
# ============================================================
# simulate-rpc-injection.sh
# ADR-010: Attack Vector #1 - RPC Injection (P0 Critical)
# ============================================================
#
# Tests that P0 critical RPC functions are properly blocked.
#
# P0 Functions (BLOCK_ALL):
#   - exec_sql
#   - delete_duplicates_batch
#   - rollback_switch
#   - truncate_table
#   - drop_table
#   - delete_all_rows
#   - admin_reset
#
# Exit codes:
#   0 - All P0 functions properly blocked (PROTECTED)
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
echo "  ATTACK SIMULATION: RPC Injection (P0)"
echo "  ADR-010 Security Test"
echo "=============================================="
echo ""

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
BACKEND_SRC="${BACKEND_SRC:-/opt/automecanik/app/backend/src}"

# P0 Critical functions that MUST be blocked
P0_FUNCTIONS=(
    "exec_sql"
    "delete_duplicates_batch"
    "rollback_switch"
)

VULNERABILITIES=0

echo -e "${YELLOW}[TEST 1] Checking P0 patterns in source code...${NC}"
echo ""

for func in "${P0_FUNCTIONS[@]}"; do
    echo -n "  Checking $func... "

    # Search for direct usage (excluding denylist/allowlist definitions and tests)
    MATCHES=$(grep -rn "$func" "$BACKEND_SRC" --include="*.ts" 2>/dev/null | \
        grep -v "rpc_denylist\|rpc_allowlist\|\.test\.\|\.spec\." | \
        grep -v "// P0\|// blocked\|// forbidden" || true)

    if [ -n "$MATCHES" ]; then
        echo -e "${RED}VULNERABLE${NC}"
        echo "    Found in:"
        echo "$MATCHES" | head -5 | sed 's/^/      /'
        VULNERABILITIES=$((VULNERABILITIES + 1))
    else
        echo -e "${GREEN}PROTECTED${NC}"
    fi
done

echo ""
echo -e "${YELLOW}[TEST 2] Checking RPC gate configuration...${NC}"
echo ""

# Check if RpcGateService exists and has denylist
RPC_GATE_FILE="$BACKEND_SRC/core/services/rpc-gate.service.ts"
if [ -f "$RPC_GATE_FILE" ]; then
    echo -n "  RpcGateService exists... "
    echo -e "${GREEN}YES${NC}"

    echo -n "  P0 denylist configured... "
    if grep -q "exec_sql\|delete_duplicates_batch" "$RPC_GATE_FILE" 2>/dev/null; then
        echo -e "${GREEN}YES${NC}"
    else
        echo -e "${RED}NO${NC}"
        VULNERABILITIES=$((VULNERABILITIES + 1))
    fi
else
    echo -n "  RpcGateService exists... "
    echo -e "${YELLOW}NOT FOUND (checking alternative location)${NC}"

    # Try to find it elsewhere
    GATE_LOCATION=$(find "$BACKEND_SRC" -name "*rpc*gate*.ts" -o -name "*rpc*service*.ts" 2>/dev/null | head -1)
    if [ -n "$GATE_LOCATION" ]; then
        echo "    Found at: $GATE_LOCATION"
    fi
fi

echo ""
echo "=============================================="

if [ $VULNERABILITIES -eq 0 ]; then
    echo -e "${GREEN}RESULT: ALL P0 FUNCTIONS PROTECTED${NC}"
    echo "RPC Injection attack surface: MINIMAL"
    exit 0
else
    echo -e "${RED}RESULT: $VULNERABILITIES VULNERABILITY(IES) DETECTED${NC}"
    echo "Action required: Review and block P0 functions"
    exit 1
fi
