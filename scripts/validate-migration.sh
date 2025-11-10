#!/bin/bash

# 🎯 Script de Validation Visuelle - Migration Tokens
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

echo "🎨 Validation de Migration - Design Tokens"
echo "=========================================="
echo ""

# Créer le dossier screenshots si nécessaire
mkdir -p "$SCREENSHOTS_DIR"

# Fonction pour capturer l'état actuel
capture_before() {
    local component=$1
    echo -e "${YELLOW}📸 Capture AVANT migration : $component${NC}"
    echo "   → Ouvrez http://localhost:3000 dans votre navigateur"
    echo "   → Capturez un screenshot et enregistrez-le dans:"
    echo "      $SCREENSHOTS_DIR/before-${component}-${TIMESTAMP}.png"
    echo ""
    read -p "Appuyez sur Entrée quand le screenshot AVANT est fait..."
}

# Fonction pour capturer après migration
capture_after() {
    local component=$1
    echo -e "${YELLOW}📸 Capture APRÈS migration : $component${NC}"
    echo "   → Rechargez http://localhost:3000"
    echo "   → Capturez un screenshot et enregistrez-le dans:"
    echo "      $SCREENSHOTS_DIR/after-${component}-${TIMESTAMP}.png"
    echo ""
    read -p "Appuyez sur Entrée quand le screenshot APRÈS est fait..."
}

# Fonction de validation
validate() {
    local component=$1
    
    echo ""
    echo -e "${GREEN}✅ Checklist de Validation - $component${NC}"
    echo "=================================="
    echo ""
    
    # Questions de validation
    echo "1. Layout identique (pas de décalage) ?"
    read -p "   Réponse (o/n): " layout
    
    echo "2. Couleurs visuellement identiques ?"
    read -p "   Réponse (o/n): " colors
    
    echo "3. Hover states fonctionnent ?"
    read -p "   Réponse (o/n): " hover
    
    echo "4. Focus states fonctionnent ?"
    read -p "   Réponse (o/n): " focus
    
    echo "5. Responsive OK (mobile/tablet/desktop) ?"
    read -p "   Réponse (o/n): " responsive
    
    echo "6. Aucune erreur console ?"
    read -p "   Réponse (o/n): " console_errors
    
    echo "7. Contraste texte suffisant ?"
    read -p "   Réponse (o/n): " contrast
    
    echo ""
    
    # Analyse des réponses
    if [[ "$layout" == "o" && "$colors" == "o" && "$hover" == "o" && \
          "$focus" == "o" && "$responsive" == "o" && "$console_errors" == "o" && \
          "$contrast" == "o" ]]; then
        echo -e "${GREEN}✅ VALIDATION RÉUSSIE - Aucune régression détectée${NC}"
        echo ""
        echo "📝 Vous pouvez maintenant commiter :"
        echo "   git add ."
        echo "   git commit -m \"feat(tokens): migrate $component to semantic tokens\""
        return 0
    else
        echo -e "${RED}❌ VALIDATION ÉCHOUÉE - Régression détectée${NC}"
        echo ""
        echo "⚠️  Points à corriger :"
        [[ "$layout" != "o" ]] && echo "   - Layout modifié"
        [[ "$colors" != "o" ]] && echo "   - Couleurs différentes"
        [[ "$hover" != "o" ]] && echo "   - Hover states cassés"
        [[ "$focus" != "o" ]] && echo "   - Focus states cassés"
        [[ "$responsive" != "o" ]] && echo "   - Responsive cassé"
        [[ "$console_errors" != "o" ]] && echo "   - Erreurs console"
        [[ "$contrast" != "o" ]] && echo "   - Contraste insuffisant"
        echo ""
        echo "🔄 Rollback recommandé :"
        echo "   git reset --hard HEAD"
        return 1
    fi
}

# Fonction principale
run_validation() {
    local component=$1
    
    echo ""
    echo "🔍 Validation du composant : $component"
    echo "======================================"
    echo ""
    
    # Capture avant
    capture_before "$component"
    
    # Demander à l'utilisateur de faire les modifications
    echo ""
    echo -e "${YELLOW}✏️  MIGRATION${NC}"
    echo "   1. Ouvrez frontend/app/components/$component.tsx"
    echo "   2. Remplacez les couleurs Tailwind par les tokens"
    echo "   3. Sauvegardez et rechargez le navigateur"
    echo ""
    read -p "Appuyez sur Entrée quand la migration est terminée..."
    
    # Capture après
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
        echo "🎯 Mode : Validation complète"
        echo ""
        echo "Ordre de migration recommandé :"
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
            echo "Migration annulée"
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
echo "✨ Validation terminée !"
echo ""
