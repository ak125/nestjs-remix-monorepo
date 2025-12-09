#!/bin/bash
# .spec/scripts/check-coverage.sh
# VÃ©rification de la couverture des spÃ©cifications

set -e

echo "ðŸ” VÃ©rification couverture SpecKit..."
echo ""

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compteurs
TOTAL_MODULES=0
MODULES_WITH_SPEC=0

# =============================================================================
# 1. VÃ‰RIFIER MODULES BACKEND
# =============================================================================

echo -e "${BLUE}ðŸ“¦ Modules Backend${NC}"
echo "-------------------"

if [ -d "backend/src/modules" ]; then
  BACKEND_MODULES=$(find backend/src/modules -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)
  MISSING_BACKEND_SPECS=()

  for module_path in $BACKEND_MODULES; do
    module=$(basename "$module_path")
    TOTAL_MODULES=$((TOTAL_MODULES + 1))
    
    # VÃ©rifier si spec existe
    if [ -f ".spec/features/${module}.md" ] || ls .spec/features/${module}-*.md >/dev/null 2>&1; then
      echo -e "  ${GREEN}âœ“${NC} $module"
      MODULES_WITH_SPEC=$((MODULES_WITH_SPEC + 1))
    else
      echo -e "  ${RED}âœ—${NC} $module ${YELLOW}(spec manquante)${NC}"
      MISSING_BACKEND_SPECS+=("$module")
    fi
  done

  if [ $TOTAL_MODULES -gt 0 ]; then
    BACKEND_COVERAGE=$(awk "BEGIN {printf \"%.1f\", ($MODULES_WITH_SPEC/$TOTAL_MODULES)*100}")
    echo ""
    echo -e "Coverage Backend: ${GREEN}${MODULES_WITH_SPEC}/${TOTAL_MODULES}${NC} modules (${BACKEND_COVERAGE}%)"
  else
    echo -e "  ${YELLOW}âš  Aucun module trouvÃ©${NC}"
  fi
else
  echo -e "  ${YELLOW}âš  Dossier backend/src/modules non trouvÃ©${NC}"
fi

echo ""

# =============================================================================
# 2. VÃ‰RIFIER ROUTES FRONTEND (approximatif)
# =============================================================================

echo -e "${BLUE}ðŸŽ¨ Routes Frontend (Remix)${NC}"
echo "-------------------------"

if [ -d "frontend/app/routes" ]; then
  FRONTEND_ROUTES=$(find frontend/app/routes -name "*.tsx" ! -name "_*" 2>/dev/null | wc -l)
  echo "  Routes dÃ©tectÃ©es: $FRONTEND_ROUTES"
  echo "  ${YELLOW}Note: VÃ©rification manuelle recommandÃ©e pour routes complexes${NC}"
else
  echo "  ${YELLOW}âš  Dossier frontend/app/routes non trouvÃ©${NC}"
fi

echo ""

# =============================================================================
# 3. VÃ‰RIFIER WORKFLOWS SPECKIT
# =============================================================================

echo -e "${BLUE}ðŸ“‹ Workflows SpecKit${NC}"
echo "-------------------"

WORKFLOWS=(
  "speckit-specify.md"
  "speckit-clarify.md"
  "speckit-plan.md"
  "speckit-tasks.md"
  "speckit-analyze.md"
  "speckit-checklist.md"
  "speckit-implement.md"
)

MISSING_WORKFLOWS=()

for workflow in "${WORKFLOWS[@]}"; do
  if [ -f ".spec/workflows/$workflow" ]; then
    echo -e "  ${GREEN}âœ“${NC} $workflow"
  else
    echo -e "  ${RED}âœ—${NC} $workflow ${YELLOW}(manquant)${NC}"
    MISSING_WORKFLOWS+=("$workflow")
  fi
done

echo ""

# =============================================================================
# 4. VÃ‰RIFIER CONSTITUTION
# =============================================================================

echo -e "${BLUE}ðŸ“œ Constitution & Standards${NC}"
echo "--------------------------"

if [ -f ".spec/constitution.md" ]; then
  echo -e "  ${GREEN}âœ“${NC} constitution.md"
  CONSTITUTION_EXISTS=1
else
  echo -e "  ${RED}âœ—${NC} constitution.md ${YELLOW}(manquant)${NC}"
  CONSTITUTION_EXISTS=0
fi

echo ""

# =============================================================================
# 5. RÃ‰SUMÃ‰ & RECOMMANDATIONS
# =============================================================================

echo "==============================================="
echo -e "${BLUE}ðŸ“Š RÃ‰SUMÃ‰${NC}"
echo "==============================================="
echo ""

# Calcul score global
TOTAL_CHECKS=$((TOTAL_MODULES + ${#WORKFLOWS[@]} + 1))
PASSED_CHECKS=$((MODULES_WITH_SPEC + (${#WORKFLOWS[@]} - ${#MISSING_WORKFLOWS[@]}) + CONSTITUTION_EXISTS))

if [ $TOTAL_CHECKS -gt 0 ]; then
  GLOBAL_SCORE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_CHECKS/$TOTAL_CHECKS)*100}")
  echo "Score Global: ${PASSED_CHECKS}/${TOTAL_CHECKS} (${GLOBAL_SCORE}%)"
else
  echo "Score Global: N/A"
  GLOBAL_SCORE=0
fi

echo ""

# Afficher specs manquantes
if [ ${#MISSING_BACKEND_SPECS[@]} -gt 0 ]; then
  echo -e "${RED}âŒ Specs Backend manquantes (${#MISSING_BACKEND_SPECS[@]}):${NC}"
  for module in "${MISSING_BACKEND_SPECS[@]}"; do
    echo "   - backend/src/modules/$module"
    echo "     â†’ CrÃ©er: .spec/features/$module.md"
  done
  echo ""
fi

# Afficher workflows manquants
if [ ${#MISSING_WORKFLOWS[@]} -gt 0 ]; then
  echo -e "${RED}âŒ Workflows SpecKit manquants (${#MISSING_WORKFLOWS[@]}):${NC}"
  for workflow in "${MISSING_WORKFLOWS[@]}"; do
    echo "   - .spec/workflows/$workflow"
  done
  echo ""
fi

# Recommandations
echo -e "${BLUE}ðŸ’¡ Recommandations:${NC}"
echo ""

if [ $TOTAL_MODULES -gt 0 ] && (( $(echo "$BACKEND_COVERAGE < 80" | bc -l 2>/dev/null || echo "1") )); then
  echo -e "  ${YELLOW}âš ${NC} Coverage backend < 80% â†’ CrÃ©er specs pour modules manquants"
fi

if [ ${#MISSING_WORKFLOWS[@]} -gt 0 ]; then
  echo -e "  ${YELLOW}âš ${NC} Workflows manquants â†’ ComplÃ©ter suite SpecKit"
fi

if (( $(echo "$GLOBAL_SCORE < 90" | bc -l 2>/dev/null || echo "1") )); then
  echo -e "  ${YELLOW}âš ${NC} Score global < 90% â†’ AmÃ©liorer couverture documentation"
else
  echo -e "  ${GREEN}âœ“${NC} Excellente couverture documentation !"
fi

echo ""

# =============================================================================
# 6. EXIT CODE
# =============================================================================

# Success si au moins workflows critiques prÃ©sents
CRITICAL_WORKFLOWS=("speckit-specify.md" "speckit-plan.md" "speckit-implement.md")
CRITICAL_MISSING=0

for workflow in "${CRITICAL_WORKFLOWS[@]}"; do
  if [ ! -f ".spec/workflows/$workflow" ]; then
    CRITICAL_MISSING=$((CRITICAL_MISSING + 1))
  fi
done

if [ $CRITICAL_MISSING -gt 0 ]; then
  echo -e "${RED}âŒ ATTENTION: $CRITICAL_MISSING workflow(s) critique(s) manquant(s)${NC}"
  exit 1
fi

echo -e "${GREEN}âœ… VÃ©rification rÃ©ussie !${NC}"
exit 0
