#!/usr/bin/env bash
set -euo pipefail

# ============================================
# GATE-3: Runner blast-radius control
# ============================================

echo "🔒 GATE-3: Runner blast-radius control"

workflows=$(git ls-files 2>/dev/null | grep -E '^\.github/workflows/.*\.yml$' || true)

critical=0
warnings=0

while IFS= read -r wf; do
  [[ -z "${wf:-}" ]] && continue
  [[ ! -f "$wf" ]] && continue

  # Check 1: pull_request_target avec checkout = supply chain risk
  if grep -q "pull_request_target" "$wf" 2>/dev/null && grep -q "actions/checkout" "$wf" 2>/dev/null; then
    echo "❌ CRITICAL: $wf uses pull_request_target with actions/checkout"
    critical=$((critical+1))
  fi

  # Check 2: self-hosted sur PR sans guard push-only
  if grep -q "self-hosted" "$wf" 2>/dev/null && grep -q "pull_request:" "$wf" 2>/dev/null; then
    # Verifier s'il y a une condition if push-only sur le job
    if ! grep -A10 "runs-on:.*self-hosted" "$wf" 2>/dev/null | grep -q "if:.*github\.event_name.*push"; then
      echo "⚠️  WARNING: $wf may run self-hosted on PR without push-only guard"
      warnings=$((warnings+1))
    fi
  fi

  # Check 3: References aux paths production
  if grep -qE "(~/production/|/production/\.env)" "$wf" 2>/dev/null; then
    echo "⚠️  WARNING: $wf references production paths"
    grep -n -E "(~/production/|/production/\.env)" "$wf" 2>/dev/null | head -5
    warnings=$((warnings+1))
  fi

done <<< "$workflows"

if [[ "$critical" -gt 0 ]]; then
  echo "🚫 GATE-3 FAILED ($critical critical issue(s))"
  exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
  echo "⚠️  GATE-3 WARNINGS: $warnings potential issue(s)"
fi

echo "✅ GATE-3 PASSED"
