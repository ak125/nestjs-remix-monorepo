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

  # Check 1: pull_request_target + extraction du code de la PR = supply chain risk.
  # Strip yaml comments before matching: a `#` comment like
  # "# Pas de `actions/checkout` ici" is documentation, not a real `uses:`.
  # Le risque visé est l'extraction de code non fiable avec le jeton du dépôt de base.
  # Seule exception : une étape actions/checkout dont `ref` vaut exactement
  # ${{ github.event.pull_request.base.sha }} (commit déjà sur la base), avec
  # `persist-credentials: false` et sans `repository`. Tout autre checkout reste
  # CRITICAL, et toute forme non reconnue (flow mapping, clés manquantes) aussi :
  # le nombre de checkouts sûrs doit égaler le nombre total de checkouts du fichier.
  wf_uncommented=$(sed 's/[[:space:]]*#.*//' "$wf" 2>/dev/null)
  if grep -q "pull_request_target" <<<"$wf_uncommented"; then
    total=$(grep -cE "uses:[[:space:]]*[\"']?actions/checkout" <<<"$wf_uncommented" || true)
    if [[ "$total" -gt 0 ]]; then
      safe=$(awk -v want='${{ github.event.pull_request.base.sha }}' '
        function unq(v) { sub(/^[[:space:]]+/, "", v); sub(/[[:space:]]+$/, "", v)
          if (v ~ /^".*"$/ || v ~ /^\047.*\047$/) v = substr(v, 2, length(v) - 2); return v }
        function close_step() { if (open && co && ref == want && pc == "false" && !repo) n++
          open = 0; co = 0; ref = ""; pc = ""; repo = 0 }
        function content(l) {
          if (l ~ /^[[:space:]]*uses:[[:space:]]*["\047]?actions\/checkout(@|["\047]|[[:space:]]*$)/) co = 1
          else if (l ~ /^[[:space:]]*ref:/) { sub(/^[[:space:]]*ref:/, "", l); ref = unq(l) }
          else if (l ~ /^[[:space:]]*persist-credentials:/) { sub(/^[[:space:]]*persist-credentials:/, "", l); pc = unq(l) }
          else if (l ~ /^[[:space:]]*repository:/) repo = 1 }
        /^[[:space:]]*$/ { next }
        { match($0, /^ */); ind = RLENGTH }
        /^[[:space:]]*- / && !(open && ind > sind) {
          close_step(); open = 1; sind = ind; l = $0; sub(/^[[:space:]]*- /, "", l); content(l); next }
        open && ind <= sind { close_step() }
        open { content($0) }
        END { close_step(); print n + 0 }' <<<"$wf_uncommented")
      if [[ "$safe" -lt "$total" ]]; then
        echo "❌ CRITICAL: $wf uses pull_request_target with actions/checkout ($((total-safe))/$total checkout(s) not pinned to base.sha with persist-credentials: false)"
        critical=$((critical+1))
      fi
    fi
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
