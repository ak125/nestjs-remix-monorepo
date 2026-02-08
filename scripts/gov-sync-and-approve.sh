#!/usr/bin/env bash
set -euo pipefail

# ====== GOV SYNC & APPROVE ======
# One command to rule them all:
# 1. Pull bundles from OpenClaw
# 2. Approve all valid bundles (auto-reject invalid)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd /opt/automecanik/app

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GOV SYNC & APPROVE (Zero Corvée)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Pull bundles from OpenClaw
echo "[1/2] Pulling bundles from OpenClaw..."
"$SCRIPT_DIR/pull-openclaw-bundles.sh"

echo ""
echo "[2/2] Approving bundles..."
"$SCRIPT_DIR/airlock.sh" approve-all --auto-reject --yes

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ SYNC & APPROVE COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
