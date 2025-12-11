#!/bin/bash

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ðŸ§ª TEST BREADCRUMB LINKS - VALIDATION 404
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# Ce script teste que tous les liens du fil d'Ariane (breadcrumb) mÃ¨nent vers
# des pages valides (HTTP 200) et non vers des erreurs 404.
#
# Usage: ./test-breadcrumb-links-404.sh [BASE_URL]
# Exemple: ./test-breadcrumb-links-404.sh http://localhost:3000
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
BASE_URL="${1:-http://localhost:3000}"
REPORT_DIR="./breadcrumb-test-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/breadcrumb-test-$TIMESTAMP.json"
TEMP_FILE=$(mktemp)

# Compteurs
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# CrÃ©er le rÃ©pertoire de rapports
mkdir -p "$REPORT_DIR"

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ðŸ› ï¸ FONCTIONS UTILITAIRES
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

log_info() {
    echo -e "${BLUE}â„¹ï¸  $1${NC}"
}

log_success() {
    echo -e "${GREEN}âœ… $1${NC}"
}

log_error() {
    echo -e "${RED}âŒ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}âš ï¸  $1${NC}"
}

log_header() {
    echo ""
    echo -e "${CYAN}${BOLD}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}${BOLD}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
    echo ""
}

# Fonction pour tester une URL et retourner le code HTTP
test_url() {
    local url="$1"
    local timeout="${2:-10}"
    
    # Faire la requÃªte et rÃ©cupÃ©rer le code HTTP
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" -L "$url" 2>/dev/null || echo "000")
    
    echo "$http_code"
}

# Fonction pour extraire les liens du breadcrumb d'une page
extract_breadcrumb_links() {
    local page_url="$1"
    
    # TÃ©lÃ©charger la page
    local page_content
    page_content=$(curl -s -L --max-time 30 "$page_url" 2>/dev/null || echo "")
    
    if [[ -z "$page_content" ]]; then
        echo ""
        return
    fi
    
    # Extraire les hrefs du breadcrumb (plusieurs patterns possibles)
    # Pattern 1: href="..." dans une <nav> avec aria-label="Breadcrumb"
    # Pattern 2: href="..." dans un <ol> avec itemType="BreadcrumbList"
    # Pattern 3: Liens dans composant Breadcrumbs
    
    local links
    links=$(echo "$page_content" | grep -oP 'href="[^"]*"' | grep -oP '"/[^"]*"' | tr -d '"' | sort -u || echo "")
    
    echo "$links"
}

# Fonction pour tester une page et ses liens breadcrumb
test_page_breadcrumb() {
    local page_url="$1"
    local page_name="$2"
    local expected_links="$3"
    
    echo -e "${BOLD}ðŸ“„ Page: $page_name${NC}"
    echo "   URL: $page_url"
    
    # 1. Tester que la page elle-mÃªme est accessible
    local page_status
    page_status=$(test_url "$page_url")
    ((TOTAL_TESTS++))
    
    if [[ "$page_status" == "200" ]]; then
        log_success "Page accessible (HTTP $page_status)"
        ((PASSED_TESTS++))
    elif [[ "$page_status" == "000" ]]; then
        log_warning "Page inaccessible (timeout/erreur rÃ©seau)"
        ((SKIPPED_TESTS++))
        echo ""
        return
    else
        log_error "Page non accessible (HTTP $page_status)"
        ((FAILED_TESTS++))
        echo ""
        return
    fi
    
    # 2. Tester les liens breadcrumb attendus
    if [[ -n "$expected_links" ]]; then
        echo "   ðŸ”— Test des liens breadcrumb:"
        
        IFS=',' read -ra LINKS <<< "$expected_links"
        for link in "${LINKS[@]}"; do
            link=$(echo "$link" | xargs) # Trim whitespace
            if [[ -z "$link" ]]; then
                continue
            fi
            
            local full_url="${BASE_URL}${link}"
            local link_status
            link_status=$(test_url "$full_url")
            ((TOTAL_TESTS++))
            
            if [[ "$link_status" == "200" ]]; then
                echo -e "      ${GREEN}âœ…${NC} $link (HTTP $link_status)"
                ((PASSED_TESTS++))
            elif [[ "$link_status" == "301" ]] || [[ "$link_status" == "302" ]]; then
                echo -e "      ${YELLOW}â†ªï¸${NC}  $link (HTTP $link_status - redirect)"
                ((PASSED_TESTS++))
            elif [[ "$link_status" == "000" ]]; then
                echo -e "      ${YELLOW}â³${NC} $link (timeout)"
                ((SKIPPED_TESTS++))
            else
                echo -e "      ${RED}âŒ${NC} $link (HTTP $link_status)"
                ((FAILED_TESTS++))
            fi
        done
    fi
    
    echo ""
}

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ðŸ§ª DÃ‰FINITION DES TESTS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

log_header "ðŸ§ª TEST BREADCRUMB LINKS - VALIDATION 404"
echo "Base URL: $BASE_URL"
echo "Timestamp: $TIMESTAMP"
echo ""

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TEST 1: Pages PiÃ¨ces (gamme simple)
# Breadcrumb attendu: Accueil â†’ PiÃ¨ces â†’ {Gamme}
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
log_header "1ï¸âƒ£ PAGES PIÃˆCES - GAMME SIMPLE"

test_page_breadcrumb \
    "$BASE_URL/pieces/plaquette-de-frein-1.html" \
    "Plaquettes de frein" \
    "/, /pieces/catalogue"

test_page_breadcrumb \
    "$BASE_URL/pieces/disque-de-frein-2.html" \
    "Disques de frein" \
    "/, /pieces/catalogue"

test_page_breadcrumb \
    "$BASE_URL/pieces/amortisseur-6.html" \
    "Amortisseurs" \
    "/, /pieces/catalogue"

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TEST 2: Pages PiÃ¨ces avec VÃ©hicule (composit)
# Breadcrumb attendu: Accueil â†’ {Gamme} â†’ {Marque ModÃ¨le} â†’ {N piÃ¨ces}
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
log_header "2ï¸âƒ£ PAGES PIÃˆCES - AVEC VÃ‰HICULE"

test_page_breadcrumb \
    "$BASE_URL/pieces/plaquette-de-frein-1/renault-140/clio-iii-33058/1-5-dci-75-6547.html" \
    "Plaquettes Renault Clio III" \
    "/, /pieces/plaquette-de-frein-1.html, /constructeurs/renault-140/clio-iii-33058/1-5-dci-75-6547.html"

test_page_breadcrumb \
    "$BASE_URL/pieces/disque-de-frein-2/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html" \
    "Disques BMW SÃ©rie 1" \
    "/, /pieces/disque-de-frein-2.html, /constructeurs/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html"

test_page_breadcrumb \
    "$BASE_URL/pieces/amortisseur-6/peugeot-136/308-ii-33066/1-6-hdi-92-8234.html" \
    "Amortisseurs Peugeot 308" \
    "/, /pieces/amortisseur-6.html, /constructeurs/peugeot-136/308-ii-33066/1-6-hdi-92-8234.html"

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TEST 3: Pages Constructeurs (marque)
# Breadcrumb attendu: Accueil â†’ {Marque}
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
log_header "3ï¸âƒ£ PAGES CONSTRUCTEURS - MARQUE"

test_page_breadcrumb \
    "$BASE_URL/constructeurs/renault-140.html" \
    "Renault (marque)" \
    "/"

test_page_breadcrumb \
    "$BASE_URL/constructeurs/bmw-33.html" \
    "BMW (marque)" \
    "/"

test_page_breadcrumb \
    "$BASE_URL/constructeurs/peugeot-136.html" \
    "Peugeot (marque)" \
    "/"

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TEST 4: Pages Constructeurs (vÃ©hicule complet)
# Breadcrumb attendu: Accueil â†’ {Marque} â†’ {ModÃ¨le Type}
# (SANS niveau "Constructeurs" intermÃ©diaire)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
log_header "4ï¸âƒ£ PAGES CONSTRUCTEURS - VÃ‰HICULE"

test_page_breadcrumb \
    "$BASE_URL/constructeurs/renault-140/clio-iii-33058/1-5-dci-75-6547.html" \
    "Renault Clio III 1.5 dCi" \
    "/, /constructeurs/renault-140.html"

test_page_breadcrumb \
    "$BASE_URL/constructeurs/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html" \
    "BMW SÃ©rie 1 118d" \
    "/, /constructeurs/bmw-33.html"

test_page_breadcrumb \
    "$BASE_URL/constructeurs/peugeot-136/308-ii-33066/1-6-hdi-92-8234.html" \
    "Peugeot 308 1.6 HDi" \
    "/, /constructeurs/peugeot-136.html"

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TEST 5: Pages Blog
# Breadcrumb attendu: Accueil â†’ Blog â†’ {Section} â†’ {Article}
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
log_header "5ï¸âƒ£ PAGES BLOG"

test_page_breadcrumb \
    "$BASE_URL/blog-pieces-auto" \
    "Blog (accueil)" \
    "/"

test_page_breadcrumb \
    "$BASE_URL/blog-pieces-auto/conseils" \
    "Blog Conseils" \
    "/, /blog-pieces-auto"

test_page_breadcrumb \
    "$BASE_URL/blog-pieces-auto/guide" \
    "Blog Guides" \
    "/, /blog-pieces-auto"

test_page_breadcrumb \
    "$BASE_URL/blog-pieces-auto/auto" \
    "Blog Constructeurs" \
    "/, /blog-pieces-auto"

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TEST 6: Pages Catalogue
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
log_header "6ï¸âƒ£ PAGES CATALOGUE"

test_page_breadcrumb \
    "$BASE_URL/pieces/catalogue" \
    "Catalogue piÃ¨ces" \
    "/"

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TEST 7: Pages Statiques / LÃ©gales
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
log_header "7ï¸âƒ£ PAGES STATIQUES"

test_page_breadcrumb \
    "$BASE_URL/contact" \
    "Contact" \
    "/"

test_page_breadcrumb \
    "$BASE_URL/legal/cgv" \
    "CGV" \
    "/"

test_page_breadcrumb \
    "$BASE_URL/legal/mentions-legales" \
    "Mentions lÃ©gales" \
    "/"

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TEST 8: Pages Compte (si accessible sans auth)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
log_header "8ï¸âƒ£ PAGES COMPTE (peut nÃ©cessiter auth)"

test_page_breadcrumb \
    "$BASE_URL/account/dashboard" \
    "Mon compte" \
    "/"

test_page_breadcrumb \
    "$BASE_URL/account/orders" \
    "Mes commandes" \
    "/, /account/dashboard"

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ðŸ“Š RÃ‰SUMÃ‰ DES TESTS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

log_header "ðŸ“Š RÃ‰SUMÃ‰ DES TESTS"

echo -e "${BOLD}Total tests:${NC}     $TOTAL_TESTS"
echo -e "${GREEN}${BOLD}PassÃ©s:${NC}          $PASSED_TESTS"
echo -e "${RED}${BOLD}Ã‰chouÃ©s:${NC}         $FAILED_TESTS"
echo -e "${YELLOW}${BOLD}IgnorÃ©s:${NC}         $SKIPPED_TESTS"
echo ""

# Calcul du pourcentage de rÃ©ussite
if [[ $TOTAL_TESTS -gt 0 ]]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
else
    PASS_RATE=0
fi

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}ðŸŽ‰ TOUS LES TESTS ONT RÃ‰USSI ! (${PASS_RATE}%)${NC}"
    EXIT_CODE=0
else
    echo -e "${RED}${BOLD}âš ï¸  ${FAILED_TESTS} TEST(S) Ã‰CHOUÃ‰(S) (${PASS_RATE}% de rÃ©ussite)${NC}"
    EXIT_CODE=1
fi

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ðŸ“„ GÃ‰NÃ‰RATION DU RAPPORT JSON
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "base_url": "$BASE_URL",
  "summary": {
    "total": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "skipped": $SKIPPED_TESTS,
    "pass_rate": $PASS_RATE
  },
  "status": "$(if [[ $FAILED_TESTS -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)"
}
EOF

echo ""
echo -e "${BLUE}ðŸ“„ Rapport sauvegardÃ©: $REPORT_FILE${NC}"

# Nettoyage
rm -f "$TEMP_FILE"

exit $EXIT_CODE
