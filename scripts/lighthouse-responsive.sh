#!/bin/bash
#
# Lighthouse Responsive Audit
# Génère des rapports Lighthouse mobile et desktop pour les pages critiques
#
# Usage: bash scripts/lighthouse-responsive.sh [base_url]
# Exemple: bash scripts/lighthouse-responsive.sh http://localhost:3000
#

set -e

# Configuration
BASE_URL="${1:-http://localhost:3000}"
REPORT_DIR="lighthouse-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       🔦 Lighthouse Responsive Audit                       ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Base URL: ${GREEN}$BASE_URL${NC}"
echo -e "Reports:  ${GREEN}$REPORT_DIR/${NC}"
echo ""

# Vérifier que lighthouse est disponible
if ! command -v npx &> /dev/null; then
    echo -e "${YELLOW}⚠️  npx non trouvé. Installez Node.js.${NC}"
    exit 1
fi

# Créer le dossier de rapports
mkdir -p "$REPORT_DIR"

# URLs critiques à auditer
declare -a URLS=(
    "/pieces/kit-distribution"
    "/cart"
    "/checkout"
    "/search?q=filtre"
    "/account/dashboard"
    "/contact"
)

# Compteurs
TOTAL_TESTS=$((${#URLS[@]} * 2))
CURRENT_TEST=0

echo -e "${BLUE}📱 Audit de ${#URLS[@]} pages (mobile + desktop)${NC}"
echo ""

for path in "${URLS[@]}"; do
    url="${BASE_URL}${path}"

    # Générer un nom de fichier propre
    slug=$(echo "$path" | sed 's|^/||' | tr '/' '-' | tr '?' '-' | tr '=' '-')
    if [ -z "$slug" ]; then
        slug="homepage"
    fi

    # Test Mobile
    CURRENT_TEST=$((CURRENT_TEST + 1))
    echo -e "${YELLOW}[$CURRENT_TEST/$TOTAL_TESTS]${NC} 📱 Mobile: $path"

    npx lighthouse "$url" \
        --preset=mobile \
        --output=html \
        --output-path="$REPORT_DIR/${slug}-mobile-${TIMESTAMP}.html" \
        --chrome-flags="--headless --no-sandbox --disable-gpu" \
        --only-categories=performance,accessibility,best-practices \
        --quiet 2>/dev/null || echo -e "${YELLOW}⚠️  Erreur sur $url (mobile)${NC}"

    # Test Desktop
    CURRENT_TEST=$((CURRENT_TEST + 1))
    echo -e "${YELLOW}[$CURRENT_TEST/$TOTAL_TESTS]${NC} 🖥️  Desktop: $path"

    npx lighthouse "$url" \
        --preset=desktop \
        --output=html \
        --output-path="$REPORT_DIR/${slug}-desktop-${TIMESTAMP}.html" \
        --chrome-flags="--headless --no-sandbox --disable-gpu" \
        --only-categories=performance,accessibility,best-practices \
        --quiet 2>/dev/null || echo -e "${YELLOW}⚠️  Erreur sur $url (desktop)${NC}"
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Audit terminé!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "📁 Rapports générés dans: ${GREEN}$REPORT_DIR/${NC}"
echo ""

# Lister les rapports générés
echo "Rapports disponibles:"
ls -la "$REPORT_DIR"/*.html 2>/dev/null | tail -20

echo ""
echo -e "${BLUE}💡 Pour ouvrir un rapport:${NC}"
echo "   open $REPORT_DIR/<nom-rapport>.html"
echo ""

# Score summary (optionnel - nécessite jq)
if command -v jq &> /dev/null; then
    echo -e "${BLUE}📊 Résumé des scores (si JSON disponible):${NC}"
    for json in "$REPORT_DIR"/*.json 2>/dev/null; do
        if [ -f "$json" ]; then
            perf=$(jq '.categories.performance.score * 100 | floor' "$json" 2>/dev/null)
            a11y=$(jq '.categories.accessibility.score * 100 | floor' "$json" 2>/dev/null)
            echo "   $(basename "$json"): Perf=$perf A11y=$a11y"
        fi
    done
fi
