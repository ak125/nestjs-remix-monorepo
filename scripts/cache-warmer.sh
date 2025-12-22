#!/bin/bash
# 🚀 Cache Warmer Script - TTFB Optimization
# Pre-loads popular product pages into Redis + CDN cache
# Usage: ./cache-warmer.sh [limit]
# Cron: 0 * * * * /opt/automecanik/app/scripts/cache-warmer.sh 500

set -e

# Configuration
BASE_URL="${BASE_URL:-https://www.automecanik.com}"
LIMIT="${1:-500}"
DELAY_MS="${DELAY_MS:-100}"
LOG_FILE="/var/log/cache-warmer.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "[$TIMESTAMP] $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "[$TIMESTAMP] $1"
}

log "${GREEN}🚀 Cache Warmer Started${NC}"
log "Base URL: $BASE_URL"
log "Limit: $LIMIT pages"
log "Delay: ${DELAY_MS}ms between requests"

# Counter
SUCCESS=0
FAILED=0

# Method 1: Use sitemap if available
SITEMAP_URL="$BASE_URL/sitemap-pieces.xml"

if curl -s --head "$SITEMAP_URL" | grep -q "200 OK"; then
    log "${GREEN}📄 Using sitemap: $SITEMAP_URL${NC}"

    # Extract URLs from sitemap
    URLS=$(curl -s "$SITEMAP_URL" | grep -oP '(?<=<loc>)[^<]+' | grep '/pieces/' | head -n "$LIMIT")
else
    log "${YELLOW}⚠️ Sitemap not found, using fallback URLs${NC}"

    # Fallback: Common product pages (gammes populaires)
    URLS=$(cat << 'EOF'
/pieces/alternateur-4/renault-140/clio-ii-140002/1-5-dci-8663.html
/pieces/batterie-6/peugeot-142/208-142079/1-2-puretech-9145.html
/pieces/plaquettes-de-frein-avant-16/volkswagen-148/golf-iv-148020/1-9-tdi-8875.html
/pieces/filtre-a-huile-24/citroen-2/c3-2009/1-4-hdi-8721.html
/pieces/bougie-d-allumage-35/toyota-147/yaris-147003/1-0-vvt-i-8945.html
/pieces/disque-de-frein-avant-19/ford-138/focus-ii-138015/1-6-tdci-8812.html
/pieces/amortisseur-avant-27/opel-141/corsa-d-141045/1-3-cdti-8956.html
/pieces/courroie-de-distribution-42/fiat-137/punto-iii-137088/1-3-jtd-8867.html
/pieces/filtre-a-air-22/mercedes-benz-145/classe-a-w168-145010/a-160-8934.html
/pieces/radiateur-de-chauffage-467/renault-140/symbol-ii-140093/1-2-16v-9292.html
EOF
    )
fi

# Warm cache for each URL
while IFS= read -r path; do
    if [ -z "$path" ]; then
        continue
    fi

    # Build full URL if path is relative
    if [[ "$path" != http* ]]; then
        URL="$BASE_URL$path"
    else
        URL="$path"
    fi

    # Fetch with cache warming header
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-Cache-Warm: true" \
        -H "User-Agent: CacheWarmer/1.0 (automecanik.com)" \
        --max-time 30 \
        "$URL" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        ((SUCCESS++))
        echo -ne "\r${GREEN}✓${NC} $SUCCESS pages warmed..."
    else
        ((FAILED++))
        log "${RED}✗ Failed ($HTTP_CODE): $URL${NC}"
    fi

    # Rate limiting
    sleep "0.$(printf '%03d' $DELAY_MS)"

done <<< "$URLS"

echo ""
log "${GREEN}✅ Cache Warming Complete${NC}"
log "   Success: $SUCCESS"
log "   Failed: $FAILED"
log "   Total: $((SUCCESS + FAILED))"

# Exit with error if more than 10% failed
if [ $FAILED -gt $((SUCCESS / 10)) ] && [ $SUCCESS -gt 0 ]; then
    log "${YELLOW}⚠️ Warning: High failure rate${NC}"
    exit 1
fi

exit 0
