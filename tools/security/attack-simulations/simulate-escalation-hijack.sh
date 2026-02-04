#!/bin/bash
# ============================================================
# simulate-escalation-hijack.sh
# ADR-010: Attack Vector #5 - Escalation Hijacking (MEDIUM)
# ============================================================
#
# Tests that NOT_APPROVED agents cannot be invoked.
#
# Blocked agents (Phase 1):
#   - AI-COS Level 1 (Executive): agent.ceo.ia, agent.cto.ia, etc.
#   - AI-COS Level 2 (Leads): agent.seo.lead, agent.data.lead, etc.
#   - Lettered Series: G1-G18, F1-F6, M2-M4, A-series, B7
#
# Exit codes:
#   0 - All L1/L2 agents properly blocked (PROTECTED)
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
echo "  ATTACK SIMULATION: Escalation Hijacking"
echo "  ADR-010 Security Test"
echo "=============================================="
echo ""

# Configuration
REGISTRY_FILE="${REGISTRY_FILE:-/opt/automecanik/governance-vault/05-agents/registry/REG-001-agents.md}"
BACKEND_SRC="${BACKEND_SRC:-/opt/automecanik/app/backend/src}"

# L1 Executive agents that MUST be NOT_APPROVED
L1_AGENTS=(
    "agent.ceo.ia"
    "agent.cto.ia"
    "agent.cpo.ia"
    "agent.cmo.ia"
    "agent.cfo.ia"
    "agent.qto"
)

# L2 Lead agents that MUST be NOT_APPROVED
L2_AGENTS=(
    "agent.seo.lead"
    "agent.data.lead"
    "agent.rag.lead"
)

VULNERABILITIES=0

echo -e "${YELLOW}[TEST 1] Checking L1 Executive agents in registry...${NC}"
echo ""

if [ ! -f "$REGISTRY_FILE" ]; then
    echo -e "${RED}Error: Registry file not found: $REGISTRY_FILE${NC}"
    exit 2
fi

for agent in "${L1_AGENTS[@]}"; do
    echo -n "  $agent... "

    # Check if agent is marked as NOT_APPROVED
    ENTRY=$(grep "$agent" "$REGISTRY_FILE" 2>/dev/null || true)

    if [ -z "$ENTRY" ]; then
        echo -e "${YELLOW}NOT FOUND in registry${NC}"
    elif echo "$ENTRY" | grep -q "NOT_APPROVED"; then
        echo -e "${GREEN}BLOCKED (NOT_APPROVED)${NC}"
    else
        echo -e "${RED}VULNERABLE - Not marked as NOT_APPROVED!${NC}"
        VULNERABILITIES=$((VULNERABILITIES + 1))
    fi
done

echo ""
echo -e "${YELLOW}[TEST 2] Checking L2 Lead agents in registry...${NC}"
echo ""

for agent in "${L2_AGENTS[@]}"; do
    echo -n "  $agent... "

    ENTRY=$(grep "$agent" "$REGISTRY_FILE" 2>/dev/null || true)

    if [ -z "$ENTRY" ]; then
        echo -e "${YELLOW}NOT FOUND in registry${NC}"
    elif echo "$ENTRY" | grep -q "NOT_APPROVED"; then
        echo -e "${GREEN}BLOCKED (NOT_APPROVED)${NC}"
    else
        echo -e "${RED}VULNERABLE - Not marked as NOT_APPROVED!${NC}"
        VULNERABILITIES=$((VULNERABILITIES + 1))
    fi
done

echo ""
echo -e "${YELLOW}[TEST 3] Checking for L1/L2 agent invocations in code...${NC}"
echo ""

# Check if any code directly invokes L1/L2 agents
ALL_BLOCKED_AGENTS=("${L1_AGENTS[@]}" "${L2_AGENTS[@]}")

echo -n "  Scanning backend for L1/L2 agent calls... "

FOUND_INVOCATIONS=0
for agent in "${ALL_BLOCKED_AGENTS[@]}"; do
    # Look for direct agent invocations (excluding comments and tests)
    MATCHES=$(grep -rn "\"$agent\"\|'$agent'" "$BACKEND_SRC" --include="*.ts" 2>/dev/null | \
        grep -v "//\|\.test\.\|\.spec\.\|registry\|NOT_APPROVED" || true)

    if [ -n "$MATCHES" ]; then
        if [ $FOUND_INVOCATIONS -eq 0 ]; then
            echo -e "${RED}FOUND${NC}"
            echo ""
        fi
        echo "    $agent found in:"
        echo "$MATCHES" | head -3 | sed 's/^/      /'
        FOUND_INVOCATIONS=$((FOUND_INVOCATIONS + 1))
    fi
done

if [ $FOUND_INVOCATIONS -eq 0 ]; then
    echo -e "${GREEN}NONE FOUND${NC}"
else
    VULNERABILITIES=$((VULNERABILITIES + FOUND_INVOCATIONS))
fi

echo ""
echo -e "${YELLOW}[TEST 4] Verifying ADR-009 Phase 1 restrictions...${NC}"
echo ""

ADR_FILE="/opt/automecanik/governance-vault/02-decisions/adr/ADR-009-agents-phase1-activation.md"
echo -n "  ADR-009 exists... "
if [ -f "$ADR_FILE" ]; then
    echo -e "${GREEN}YES${NC}"

    echo -n "  Phase 1 restrictions documented... "
    if grep -q "AI-COS.*L1\|NOT ALLOWED\|FORBIDDEN" "$ADR_FILE" 2>/dev/null; then
        echo -e "${GREEN}YES${NC}"
    else
        echo -e "${YELLOW}PARTIAL${NC}"
    fi
else
    echo -e "${YELLOW}NOT FOUND${NC}"
fi

echo ""
echo "=============================================="

if [ $VULNERABILITIES -eq 0 ]; then
    echo -e "${GREEN}RESULT: L1/L2 AGENT ESCALATION BLOCKED${NC}"
    echo "Escalation hijacking attack surface: MINIMAL"
    exit 0
else
    echo -e "${RED}RESULT: $VULNERABILITIES VULNERABILITY(IES) DETECTED${NC}"
    echo "Action required: Block L1/L2 agent activation"
    exit 1
fi
