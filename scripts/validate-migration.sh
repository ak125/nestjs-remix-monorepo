#!/bin/bash

# ðŸŽ¯ Script de Validation Visuelle - Migration Tokens
# Usage: ./validate-migration.sh [composant]
# Exemple: ./validate-migration.sh navbar

set -e

COMPONENT=${1:-"all"}
SCREENSHOTS_DIR="screenshots"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "ðŸŽ¨ Validation de Migration - Design Tokens"
echo "=========================================="
echo ""

# CrÃ©er le dossier screenshots si nÃ©cessaire
mkdir -p "$SCREENSHOTS_DIR"

# Fonction pour capturer l'Ã©tat actuel
capture_before() {
    local component=$1
    echo -e "${YELLOW}ðŸ“¸ Capture AVANT migration : $component${NC}"
    echo "   â†’ Ouvrez http://localhost:3000 dans votre navigateur"
    echo "   â†’ Capturez un screenshot et enregistrez-le dans:"
    echo "      $SCREENSHOTS_DIR/before-${component}-${TIMESTAMP}.png"
    echo ""
    read -p "Appuyez sur EntrÃ©e quand le screenshot AVANT est fait..."
}

# Fonction pour capturer aprÃ¨s migration
capture_after() {
    local component=$1
    echo -e "${YELLOW}ðŸ“¸ Capture APRÃˆS migration : $component${NC}"
    echo "   â†’ Rechargez http://localhost:3000"
    echo "   â†’ Capturez un screenshot et enregistrez-le dans:"
    echo "      $SCREENSHOTS_DIR/after-${component}-${TIMESTAMP}.png"
    echo ""
    read -p "Appuyez sur EntrÃ©e quand le screenshot APRÃˆS est fait..."
}

# Fonction de validation
validate() {
    local component=$1
    
    echo ""
    echo -e "${GREEN}âœ… Checklist de Validation - $component${NC}"
    echo "=================================="
    echo ""
    
    # Questions de validation
    echo "1. Layout identique (pas de dÃ©calage) ?"
    read -p "   RÃ©ponse (o/n): " layout
    
    echo "2. Couleurs visuellement identiques ?"
    read -p "   RÃ©ponse (o/n): " colors
    
    echo "3. Hover states fonctionnent ?"
    read -p "   RÃ©ponse (o/n): " hover
    
    echo "4. Focus states fonctionnent ?"
    read -p "   RÃ©ponse (o/n): " focus
    
    echo "5. Responsive OK (mobile/tablet/desktop) ?"
    read -p "   RÃ©ponse (o/n): " responsive
    
    echo "6. Aucune erreur console ?"
    read -p "   RÃ©ponse (o/n): " console_errors
    
    echo "7. Contraste texte suffisant ?"
    read -p "   RÃ©ponse (o/n): " contrast
    
    echo ""
    
    # Analyse des rÃ©ponses
    if [[ "$layout" == "o" && "$colors" == "o" && "$hover" == "o" && \
          "$focus" == "o" && "$responsive" == "o" && "$console_errors" == "o" && \
          "$contrast" == "o" ]]; then
        echo -e "${GREEN}âœ… VALIDATION RÃ‰USSIE - Aucune rÃ©gression dÃ©tectÃ©e${NC}"
        echo ""
        echo "ðŸ“ Vous pouvez maintenant commiter :"
        echo "   git add ."
        echo "   git commit -m \"feat(tokens): migrate $component to semantic tokens\""
        return 0
    else
        echo -e "${RED}âŒ VALIDATION Ã‰CHOUÃ‰E - RÃ©gression dÃ©tectÃ©e${NC}"
        echo ""
        echo "âš ï¸  Points Ã  corriger :"
        [[ "$layout" != "o" ]] && echo "   - Layout modifiÃ©"
        [[ "$colors" != "o" ]] && echo "   - Couleurs diffÃ©rentes"
        [[ "$hover" != "o" ]] && echo "   - Hover states cassÃ©s"
        [[ "$focus" != "o" ]] && echo "   - Focus states cassÃ©s"
        [[ "$responsive" != "o" ]] && echo "   - Responsive cassÃ©"
        [[ "$console_errors" != "o" ]] && echo "   - Erreurs console"
        [[ "$contrast" != "o" ]] && echo "   - Contraste insuffisant"
        echo ""
        echo "ðŸ”„ Rollback recommandÃ© :"
        echo "   git reset --hard HEAD"
        return 1
    fi
}

# Fonction principale
run_validation() {
    local component=$1
    
    echo ""
    echo "ðŸ” Validation du composant : $component"
    echo "======================================"
    echo ""
    
    # Capture avant
    capture_before "$component"
    
    # Demander Ã  l'utilisateur de faire les modifications
    echo ""
    echo -e "${YELLOW}âœï¸  MIGRATION${NC}"
    echo "   1. Ouvrez frontend/app/components/$component.tsx"
    echo "   2. Remplacez les couleurs Tailwind par les tokens"
    echo "   3. Sauvegardez et rechargez le navigateur"
    echo ""
    read -p "Appuyez sur EntrÃ©e quand la migration est terminÃ©e..."
    
    # Capture aprÃ¨s
    capture_after "$component"
    
    # Validation
    validate "$component"
}

# Menu principal
case $COMPONENT in
    navbar)
        run_validation "Navbar"
        ;;
    footer)
        run_validation "Footer"
        ;;
    index)
        run_validation "_index"
        ;;
    all)
        echo "ðŸŽ¯ Mode : Validation complÃ¨te"
        echo ""
        echo "Ordre de migration recommandÃ© :"
        echo "1. Footer (moins visible)"
        echo "2. Navbar (plus visible)"
        echo "3. Index (page principale)"
        echo ""
        read -p "Commencer avec le Footer ? (o/n): " start
        
        if [[ "$start" == "o" ]]; then
            run_validation "Footer" && \
            run_validation "Navbar" && \
            run_validation "_index"
        else
            echo "Migration annulÃ©e"
            exit 0
        fi
        ;;
    *)
        echo -e "${RED}Composant inconnu: $COMPONENT${NC}"
        echo ""
        echo "Usage: ./validate-migration.sh [composant]"
        echo ""
        echo "Composants disponibles :"
        echo "  - navbar"
        echo "  - footer"
        echo "  - index"
        echo "  - all (tous les composants)"
        exit 1
        ;;
esac

echo ""
echo "âœ¨ Validation terminÃ©e !"
echo ""
