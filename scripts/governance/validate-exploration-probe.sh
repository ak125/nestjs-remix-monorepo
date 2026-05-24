#!/usr/bin/env bash
# Valide qu'une probe EXPLORATION_BUDGET (G10, ADR-081) respecte son scope.
#
# Lint single-check au PR final (pas per-checkpoint — anti over-governance creep G10.X).
#
# Usage : scripts/governance/validate-exploration-probe.sh <probe-slug>
#   ex.  scripts/governance/validate-exploration-probe.sh geo-discovery-probe-2026-05
#
# Vérifications :
#   1. Le slug existe dans .claude/top-priorities.md → EXPLORATION_BUDGET
#   2. Aucune nouvelle migration DB sous backend/supabase/migrations/ liée au slug
#   3. Aucun nouveau module sous backend/src/modules/ liée au slug
#   4. Aucun nouveau composant admin UI sous frontend/app/routes/admin* liée au slug
#   5. Aucune modification @repo/seo-roles liée au slug
#   6. Le rapport final docs/research/YYYY-MM-DD-<slug-topic>-empirical-report.md existe
#
# Note : "lié au slug" = fichiers ajoutés/modifiés dans le diff vs origin/main
# qui matchent le pattern probe (ex. scripts/research/<probe-topic>* ou
# referenced via le slug dans le commit message / file content).
#
# Exit 0 = scope OK, 1 = violation détectée
#
# Référence canon : ADR-081 G10 + ledger/policies/exploration-budget.md

set -euo pipefail

PROBE_SLUG="${1:-}"
TOP_PRIO="${2:-.claude/top-priorities.md}"
BASE_REF="${BASE_REF:-origin/main}"

if [ -z "$PROBE_SLUG" ]; then
  echo "Usage: $0 <probe-slug> [top-priorities-path]"
  echo "  ex.  $0 geo-discovery-probe-2026-05"
  exit 1
fi

ERRORS=0

# 1. Slug présent dans EXPLORATION_BUDGET
if ! awk -v s="## EXPLORATION_BUDGET" '
  $0 == s { flag=1; next }
  /^## / { flag=0 }
  flag && /^- / { sub(/^- /, ""); print }
' "$TOP_PRIO" | grep -qFx "$PROBE_SLUG"; then
  echo "FAIL: '$PROBE_SLUG' absent de $TOP_PRIO section EXPLORATION_BUDGET"
  echo "      Ajouter le slug avant de démarrer la probe (G10 ADR-081)"
  ERRORS=$((ERRORS+1))
fi

# Diff vs base ref
CHANGED_FILES=$(git diff --name-only "$BASE_REF"..HEAD 2>/dev/null || git diff --name-only "$BASE_REF" 2>/dev/null || true)

if [ -z "$CHANGED_FILES" ]; then
  echo "WARN: aucun fichier changé vs $BASE_REF (rien à valider)"
  exit 0
fi

# 2. Aucune migration DB
MIGRATIONS=$(echo "$CHANGED_FILES" | grep -E "^backend/supabase/migrations/" || true)
if [ -n "$MIGRATIONS" ]; then
  echo "FAIL: probe $PROBE_SLUG touche aux migrations DB (interdit G10 scope measurement-only) :"
  echo "$MIGRATIONS" | sed 's/^/  /'
  ERRORS=$((ERRORS+1))
fi

# 3. Aucun nouveau module backend (services NestJS)
MODULES=$(echo "$CHANGED_FILES" | grep -E "^backend/src/modules/" || true)
if [ -n "$MODULES" ]; then
  echo "FAIL: probe $PROBE_SLUG touche aux modules NestJS (interdit G10 scope measurement-only) :"
  echo "$MODULES" | sed 's/^/  /'
  ERRORS=$((ERRORS+1))
fi

# 4. Aucun admin UI
ADMIN_UI=$(echo "$CHANGED_FILES" | grep -E "^frontend/app/routes/admin" || true)
if [ -n "$ADMIN_UI" ]; then
  echo "FAIL: probe $PROBE_SLUG touche à l'admin UI (interdit G10 scope measurement-only) :"
  echo "$ADMIN_UI" | sed 's/^/  /'
  ERRORS=$((ERRORS+1))
fi

# 5. Aucune modification @repo/seo-roles
SEO_ROLES=$(echo "$CHANGED_FILES" | grep -E "^packages/seo-roles/" || true)
if [ -n "$SEO_ROLES" ]; then
  echo "FAIL: probe $PROBE_SLUG modifie @repo/seo-roles (interdit G10 scope measurement-only) :"
  echo "$SEO_ROLES" | sed 's/^/  /'
  ERRORS=$((ERRORS+1))
fi

# 6. Rapport final présent
# Convention naming : docs/research/YYYY-MM-DD-<slug-without-probe-suffix>-empirical-report.md
# Ex. geo-discovery-probe-2026-05 → docs/research/2026-05-*-geo-discovery-*-empirical-report.md
SLUG_TOPIC=$(echo "$PROBE_SLUG" | sed -E 's/-probe-[0-9]{4}-[0-9]{2}$//')
REPORT_PATTERN="docs/research/[0-9]{4}-[0-9]{2}-[0-9]{2}-${SLUG_TOPIC}.*-empirical-report\.md"
REPORTS=$(echo "$CHANGED_FILES" | grep -E "$REPORT_PATTERN" || true)
if [ -z "$REPORTS" ]; then
  echo "FAIL: probe $PROBE_SLUG sans rapport final matching docs/research/YYYY-MM-DD-${SLUG_TOPIC}-*-empirical-report.md"
  echo "      Pattern attendu : $REPORT_PATTERN"
  ERRORS=$((ERRORS+1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "$ERRORS violation(s) G10 scope sur probe '$PROBE_SLUG'"
  echo "Référence canon : ADR-081 G10 + ledger/policies/exploration-budget.md (vault)"
  exit 1
fi

echo "OK: probe '$PROBE_SLUG' respecte le scope G10 measurement-only"
exit 0
