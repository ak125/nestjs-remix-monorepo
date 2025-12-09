#!/bin/bash
# =====================================================
# Test Script - SEO Internal Links
# scripts/test-internal-links.sh
# 
# Tests de non-rÃ©gression pour le maillage interne SEO
# Usage: ./scripts/test-internal-links.sh [BASE_URL]
# =====================================================

BASE_URL="${1:-http://localhost:3000}"
BASELINE_DIR="scripts/baselines"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() { echo -e "${GREEN}[OK]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# =====================================================
# 1. Test Backend API - Blog Advice
# =====================================================

echo -e "\n${YELLOW}=== TEST 1: Backend API Blog Advice ===${NC}"

ADVICE_URL="$BASE_URL/api/blog/advice?limit=1"
info "GET $ADVICE_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$ADVICE_URL")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    success "API blog/advice accessible (status 200)"
    
    # VÃ©rifier si le contenu contient des liens internes
    if echo "$BODY" | grep -q 'href="/pieces'; then
        success "Liens internes trouvÃ©s dans le contenu"
    else
        warn "Aucun lien interne trouvÃ© (normal si pas de #LinkGammeCar#)"
    fi
    
    # Compter les liens avec data-link-type
    LINK_COUNT=$(echo "$BODY" | grep -o 'data-link-type=' | wc -l)
    info "Liens avec tracking: $LINK_COUNT"
    
    # Compter les formules A/B
    FORMULA_COUNT=$(echo "$BODY" | grep -o 'data-formula=' | wc -l)
    info "Liens avec formule A/B: $FORMULA_COUNT"
else
    fail "Erreur API: HTTP $HTTP_CODE"
fi

# =====================================================
# 2. Test Tracking Endpoint - Click
# =====================================================

echo -e "\n${YELLOW}=== TEST 2: Tracking Click Endpoint ===${NC}"

TRACK_CLICK_URL="$BASE_URL/api/seo/track-click"
SESSION_ID="test-session-$(date +%Y%m%d%H%M%S)"

CLICK_PAYLOAD=$(cat <<EOF
{
    "linkType": "LinkGammeCar",
    "sourceUrl": "/blog/test-article",
    "destinationUrl": "/pieces/plaquettes-frein/peugeot/308.html",
    "anchorText": "Test link",
    "linkPosition": "content",
    "sessionId": "$SESSION_ID",
    "deviceType": "desktop",
    "switchVerbId": 1,
    "switchNounId": 2,
    "switchFormula": "1:2",
    "targetGammeId": 45
}
EOF
)

info "POST $TRACK_CLICK_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$CLICK_PAYLOAD" \
    "$TRACK_CLICK_URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    success "Click trackÃ© avec succÃ¨s (status $HTTP_CODE)"
else
    fail "Erreur tracking: HTTP $HTTP_CODE"
fi

# =====================================================
# 3. Test Tracking Endpoint - Impression
# =====================================================

echo -e "\n${YELLOW}=== TEST 3: Tracking Impression Endpoint ===${NC}"

TRACK_IMPRESSION_URL="$BASE_URL/api/seo/track-impression"

IMPRESSION_PAYLOAD=$(cat <<EOF
{
    "linkType": "LinkGammeCar",
    "pageUrl": "/blog/test-article",
    "linkCount": 5,
    "sessionId": "$SESSION_ID"
}
EOF
)

info "POST $TRACK_IMPRESSION_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$IMPRESSION_PAYLOAD" \
    "$TRACK_IMPRESSION_URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    success "Impression trackÃ©e avec succÃ¨s (status $HTTP_CODE)"
else
    warn "Impression endpoint peut ne pas exister: HTTP $HTTP_CODE"
fi

# =====================================================
# 4. Test InternalLinkingService Cache Stats
# =====================================================

echo -e "\n${YELLOW}=== TEST 4: Internal Linking Cache Stats ===${NC}"

CACHE_STATS_URL="$BASE_URL/api/seo/internal-linking/stats"
info "GET $CACHE_STATS_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$CACHE_STATS_URL")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    success "Cache stats rÃ©cupÃ©rÃ©es"
    echo "$BODY" | jq -r '.verbsCached, .nounsCached, .gammesCached, .hitRate' 2>/dev/null || echo "$BODY"
else
    warn "Endpoint stats peut ne pas exister (optionnel)"
fi

# =====================================================
# 5. Test Frontend Page Rendering
# =====================================================

echo -e "\n${YELLOW}=== TEST 5: Frontend Page HTML ===${NC}"

FRONTEND_URL="$BASE_URL/blog-pieces-auto"
info "GET $FRONTEND_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$FRONTEND_URL")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    success "Page blog chargÃ©e (status 200)"
    
    # VÃ©rifier la prÃ©sence de liens internes
    INTERNAL_LINKS=$(echo "$BODY" | grep -o 'href="/pieces[^"]*"' | wc -l)
    info "Liens vers /pieces trouvÃ©s: $INTERNAL_LINKS"
    
    # VÃ©rifier la prÃ©sence d'attributs de tracking
    TRACKING_LINKS=$(echo "$BODY" | grep -o 'data-link-type=' | wc -l)
    info "Liens avec tracking: $TRACKING_LINKS"
else
    warn "Page frontend peut ne pas Ãªtre disponible: HTTP $HTTP_CODE"
fi

# =====================================================
# 6. Test avec curl verbose (optionnel)
# =====================================================

if [ "$2" = "-v" ]; then
    echo -e "\n${YELLOW}=== TEST 6: Verbose curl output ===${NC}"
    curl -v "$BASE_URL/api/blog/advice?limit=1" 2>&1 | head -50
fi

# =====================================================
# RÃ©sumÃ©
# =====================================================

echo -e "\n${YELLOW}=== RESUME ===${NC}"
echo "Tests exÃ©cutÃ©s sur: $BASE_URL"
echo "Pour mode verbeux: ./scripts/test-internal-links.sh $BASE_URL -v"
echo ""
echo "Prochaines Ã©tapes:"
echo "  1. DÃ©marrer le backend: cd backend && npm run start:dev"
echo "  2. DÃ©marrer le frontend: cd frontend && npm run dev"
echo "  3. Relancer ce script: ./scripts/test-internal-links.sh"
