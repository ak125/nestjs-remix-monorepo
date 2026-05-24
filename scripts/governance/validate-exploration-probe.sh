#!/usr/bin/env bash
# Valide le scope d'une probe EXPLORATION_BUDGET (ADR-081 G10).
#
# Détection : PR est probe si elle modifie `docs/research/.+-empirical-report\.md`.
# Si probe → enforce scope strict measurement-only :
#   - NO new file sous backend/supabase/migrations/
#   - NO new file sous backend/src/modules/ (sauf tests / __tests__)
#   - NO new file sous frontend/app/routes/admin*
#   - NO modification de packages/seo-roles/ ou packages/registry/
#   - NO modification de R-role / @repo/seo-roles canon
# Si non-probe → exit 0 silencieusement.
#
# Single check au PR final — pas de lint per-checkpoint (anti over-governance creep).
# Cf. ADR-081 G10 + policy ledger/policies/exploration-budget.md.
#
# Usage : scripts/governance/validate-exploration-probe.sh [base-ref]
#   base-ref par défaut = origin/main
# Exit 0 = OK (non-probe OU probe scope conforme)
# Exit 1 = FAIL (probe avec scope violé)

set -euo pipefail

BASE_REF="${1:-origin/main}"

# 1. Détection probe : modif d'un rapport empirique sous docs/research/
DIFF_FILES=$(git diff --name-only "${BASE_REF}...HEAD" 2>/dev/null || true)
IS_PROBE=0
if echo "$DIFF_FILES" | grep -qE "^docs/research/.+-empirical-report\.md$"; then
  IS_PROBE=1
fi

if [ "$IS_PROBE" -eq 0 ]; then
  echo "OK: PR non-probe (aucun docs/research/*-empirical-report.md modifié) — scope check skip"
  exit 0
fi

echo "PROBE détectée — enforcement scope strict measurement-only (ADR-081 G10)..."
ERRORS=0

# 2. NO new migration DB
NEW_MIGRATIONS=$(echo "$DIFF_FILES" | grep -E "^backend/supabase/migrations/.+\.sql$" || true)
if [ -n "$NEW_MIGRATIONS" ]; then
  echo "FAIL: nouvelles migrations DB interdites en probe :"
  echo "$NEW_MIGRATIONS" | sed 's/^/  /'
  ERRORS=$((ERRORS+1))
fi

# 3. NO new NestJS service / controller / module (hors tests)
NEW_NESTJS=$(echo "$DIFF_FILES" \
  | grep -E "^backend/src/modules/.+\.(ts|tsx)$" \
  | grep -vE "\.(test|spec)\.ts$|/__tests__/" \
  || true)
if [ -n "$NEW_NESTJS" ]; then
  # Filtre seulement les ADDITIONS (not modifications)
  ADDED_NESTJS=$(git diff --name-only --diff-filter=A "${BASE_REF}...HEAD" \
    | grep -E "^backend/src/modules/.+\.(ts|tsx)$" \
    | grep -vE "\.(test|spec)\.ts$|/__tests__/" \
    || true)
  if [ -n "$ADDED_NESTJS" ]; then
    echo "FAIL: nouveaux services/controllers NestJS interdits en probe :"
    echo "$ADDED_NESTJS" | sed 's/^/  /'
    ERRORS=$((ERRORS+1))
  fi
fi

# 4. NO new admin UI route
NEW_ADMIN=$(git diff --name-only --diff-filter=A "${BASE_REF}...HEAD" \
  | grep -E "^frontend/app/routes/admin" || true)
if [ -n "$NEW_ADMIN" ]; then
  echo "FAIL: nouvelles routes admin UI interdites en probe :"
  echo "$NEW_ADMIN" | sed 's/^/  /'
  ERRORS=$((ERRORS+1))
fi

# 5. NO touch packages/seo-roles ou packages/registry (R-roles canon)
TOUCHED_CANON=$(echo "$DIFF_FILES" \
  | grep -E "^packages/(seo-roles|registry)/" || true)
if [ -n "$TOUCHED_CANON" ]; then
  echo "FAIL: modifications packages canon (seo-roles, registry) interdites en probe :"
  echo "$TOUCHED_CANON" | sed 's/^/  /'
  ERRORS=$((ERRORS+1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "$ERRORS violation(s) scope probe — voir ADR-081 G10 + ledger/policies/exploration-budget.md"
  echo "Si le scope a légitimement évolué, c'est plus une probe → ouvrir PR vault dédié pour cadrage canon."
  exit 1
fi

echo "OK: probe scope conforme (no migration / no service / no admin UI / no R-role canon touch)"
exit 0
