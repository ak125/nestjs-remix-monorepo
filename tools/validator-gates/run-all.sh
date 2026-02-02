#!/usr/bin/env bash
set -euo pipefail

# ============================================
# DEV Safety Gates - Orchestrator
# MODE=observe (default) | block
# ============================================

MODE="${MODE:-observe}"

echo "============================================"
echo "DEV SAFETY GATES (MODE=$MODE)"
echo "============================================"

run_gate() {
  local gate="$1"
  echo ""
  echo "▶ Running $gate (MODE=$MODE)"
  if bash "$gate"; then
    return 0
  else
    if [[ "$MODE" == "observe" ]]; then
      echo "⚠️  Gate failed but MODE=observe => not blocking"
      return 0
    fi
    return 1
  fi
}

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_gate "$DIR/gate-1-no-prod-supabase.sh"
run_gate "$DIR/gate-2-mcp-permissions.sh"
run_gate "$DIR/gate-3-runner-blast-radius.sh"
run_gate "$DIR/gate-4-secrets-hygiene.sh"

echo ""
echo "============================================"
echo "✅ DEV safety gates completed (MODE=$MODE)"
echo "============================================"
