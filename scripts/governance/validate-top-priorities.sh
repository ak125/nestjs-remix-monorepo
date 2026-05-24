#!/usr/bin/env bash
# Valide .claude/top-priorities.md :
#   - 4 sections obligatoires (TOP / DO_NOT_START / ACTIVE_INCIDENTS / STRUCTURAL_CONSTRAINTS)
#   - bornes strictes (5 / 7 / 10 / 10) — anti-bloat mécanique
#   - slugs kebab-case stricts (^[a-z][a-z0-9-]*$)
#
# Usage : scripts/governance/validate-top-priorities.sh [path]
# Exit 0 = OK, 1 = FAIL (au moins une violation)

set -euo pipefail

FILE="${1:-.claude/top-priorities.md}"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE introuvable"
  exit 1
fi

ERRORS=0

# 1. Sections obligatoires (EXPLORATION_BUDGET = optional G10 slot ADR-081)
for section in TOP DO_NOT_START ACTIVE_INCIDENTS STRUCTURAL_CONSTRAINTS; do
  if ! grep -qE "^## ${section}$" "$FILE"; then
    echo "FAIL: section ## $section manquante"
    ERRORS=$((ERRORS+1))
  fi
done

# 2. Bornes (anti-bloat) — EXPLORATION_BUDGET ≤ 3 (G10 ADR-081)
declare -A LIMITS=([TOP]=5 [DO_NOT_START]=7 [ACTIVE_INCIDENTS]=10 [STRUCTURAL_CONSTRAINTS]=10 [EXPLORATION_BUDGET]=3)
for section in "${!LIMITS[@]}"; do
  count=$(awk -v s="## ${section}" '
    $0 == s { flag=1; next }
    /^## / { flag=0 }
    flag && /^- / { c++ }
    END { print c+0 }
  ' "$FILE")
  limit=${LIMITS[$section]}
  if (( count > limit )); then
    echo "FAIL: $section a $count slugs > limite $limit"
    ERRORS=$((ERRORS+1))
  fi
done

# 3. Slugs kebab-case strict (^- [a-z][a-z0-9-]*$)
INVALID=$(grep -nE "^- " "$FILE" | grep -vE "^[0-9]+:- [a-z][a-z0-9-]*$" || true)
if [ -n "$INVALID" ]; then
  echo "FAIL: slugs non-kebab-case détectés :"
  echo "$INVALID" | sed 's/^/  /'
  ERRORS=$((ERRORS+1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "$ERRORS violation(s) détectée(s) dans $FILE"
  exit 1
fi

echo "OK: $FILE conforme (sections / bornes / slugs)"
exit 0
