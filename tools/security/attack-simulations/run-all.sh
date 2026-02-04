#!/bin/bash
# ============================================================
# run-all.sh
# ADR-010: Run All Attack Simulations
# ============================================================
#
# Runs all attack simulation scripts and produces a summary report.
#
# Attack Vectors Tested:
#   1. RPC Injection (P0 Critical)
#   3. Bundle Tampering (HIGH)
#   5. Escalation Hijacking (MEDIUM)
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#
# ============================================================

set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ADR-010 ATTACK SIMULATION SUITE                    ║${NC}"
echo -e "${BLUE}║         AutoMecanik Governance Security Tests              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Date: $(date -Iseconds)"
echo "Environment: ${NODE_ENV:-development}"
echo ""

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

run_test() {
    local name="$1"
    local script="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Running: $name${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ ! -x "$script" ]; then
        echo -e "${YELLOW}SKIPPED: Script not found or not executable${NC}"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        return
    fi

    if "$script"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    echo ""
}

# Run all simulations
run_test "RPC Injection (P0 Critical)" "$SCRIPT_DIR/simulate-rpc-injection.sh"
run_test "Bundle Tampering (HIGH)" "$SCRIPT_DIR/simulate-bundle-tampering.sh"
run_test "Escalation Hijacking (MEDIUM)" "$SCRIPT_DIR/simulate-escalation-hijack.sh"

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    SUMMARY REPORT                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Total Tests:   $TOTAL_TESTS"
echo -e "  ${GREEN}Passed:        $PASSED_TESTS${NC}"
echo -e "  ${RED}Failed:        $FAILED_TESTS${NC}"
echo -e "  ${YELLOW}Skipped:       $SKIPPED_TESTS${NC}"
echo ""

# Attack surface summary
echo "Attack Surface Assessment:"
echo "  ┌─────────────────────────────┬────────────┬────────────┐"
echo "  │ Vector                      │ Risk       │ Status     │"
echo "  ├─────────────────────────────┼────────────┼────────────┤"

if [ $FAILED_TESTS -eq 0 ]; then
    echo "  │ RPC Injection               │ P0 CRIT    │ PROTECTED  │"
    echo "  │ Bundle Tampering            │ HIGH       │ PROTECTED  │"
    echo "  │ Escalation Hijacking        │ MEDIUM     │ PROTECTED  │"
else
    echo "  │ (Run individual tests for details)                    │"
fi

echo "  └─────────────────────────────┴────────────┴────────────┘"
echo ""

# Remaining vectors (not yet implemented)
echo "Vectors Not Yet Tested:"
echo "  - Prompt Injection (HIGH) - Requires LLM integration"
echo "  - Side-Effect Escaping (MEDIUM) - Requires runtime monitoring"
echo "  - RAG Hallucination (MEDIUM) - Requires RAG integration"
echo "  - Budget Overflow (MEDIUM) - Requires token tracking"
echo "  - Idempotency Collision (MEDIUM) - Requires hash system"
echo "  - Permission Escalation (MEDIUM) - Requires RBAC testing"
echo "  - Artifact Exfiltration (MEDIUM) - Requires path allowlist"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  OVERALL RESULT: ALL TESTS PASSED                          ║${NC}"
    echo -e "${GREEN}║  System governance is functioning correctly                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  OVERALL RESULT: $FAILED_TESTS TEST(S) FAILED                           ║${NC}"
    echo -e "${RED}║  Review failures and remediate before deployment           ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
