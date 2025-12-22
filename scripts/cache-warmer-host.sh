#!/bin/bash
# 🚀 Cache Warmer - Version Host (pour serveur Docker)
# Fonctionne directement sur l'hôte, pas besoin d'accéder au container
# Usage: ./cache-warmer-host.sh [limit]
# Cron: 0 * * * * /home/deploy/cache-warmer-host.sh 500 >> /var/log/cache-warmer.log 2>&1

set -e

# Configuration
BASE_URL="${BASE_URL:-https://www.automecanik.com}"
LIMIT="${1:-500}"
DELAY_MS="${DELAY_MS:-100}"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Colors (désactivées si non-interactif)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    NC='\033[0m'
else
    GREEN=''
    YELLOW=''
    RED=''
    NC=''
fi

log() {
    echo -e "[$TIMESTAMP] $1"
}

log "${GREEN}🚀 Cache Warmer Started (Host Mode)${NC}"
log "Base URL: $BASE_URL"
log "Limit: $LIMIT pages"
log "Delay: ${DELAY_MS}ms between requests"

# Counters
SUCCESS=0
FAILED=0

# Fetch sitemap URLs
SITEMAP_URL="$BASE_URL/sitemap-pieces-1.xml"

log "📄 Fetching sitemap: $SITEMAP_URL"

# Check if sitemap is accessible
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$SITEMAP_URL" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    log "${GREEN}✓ Sitemap accessible${NC}"

    # Extract URLs from sitemap (limit to $LIMIT)
    URLS=$(curl -s --max-time 30 "$SITEMAP_URL" 2>/dev/null | grep -oP '(?<=<loc>)[^<]+' | grep '/pieces/' | head -n "$LIMIT")
    URL_COUNT=$(echo "$URLS" | wc -l)
    log "Found $URL_COUNT URLs to warm"
else
    log "${YELLOW}⚠️ Sitemap not accessible (HTTP $HTTP_STATUS), using popular URLs${NC}"

    # Fallback: Top 20 popular product pages
    URLS=$(cat << 'EOF'
https://www.automecanik.com/pieces/alternateur-4/renault-140/clio-ii-140002/1-5-dci-8663.html
https://www.automecanik.com/pieces/batterie-6/peugeot-142/208-142079/1-2-puretech-9145.html
https://www.automecanik.com/pieces/plaquettes-de-frein-avant-16/volkswagen-148/golf-iv-148020/1-9-tdi-8875.html
https://www.automecanik.com/pieces/filtre-a-huile-24/citroen-2/c3-2009/1-4-hdi-8721.html
https://www.automecanik.com/pieces/bougie-d-allumage-35/toyota-147/yaris-147003/1-0-vvt-i-8945.html
https://www.automecanik.com/pieces/disque-de-frein-avant-19/ford-138/focus-ii-138015/1-6-tdci-8812.html
https://www.automecanik.com/pieces/amortisseur-avant-27/opel-141/corsa-d-141045/1-3-cdti-8956.html
https://www.automecanik.com/pieces/courroie-de-distribution-42/fiat-137/punto-iii-137088/1-3-jtd-8867.html
https://www.automecanik.com/pieces/filtre-a-air-22/mercedes-benz-145/classe-a-w168-145010/a-160-8934.html
https://www.automecanik.com/pieces/radiateur-de-chauffage-467/renault-140/symbol-ii-140093/1-2-16v-9292.html
https://www.automecanik.com/pieces/kit-de-distribution-43/peugeot-142/307-142045/1-6-hdi-8723.html
https://www.automecanik.com/pieces/pompe-a-eau-45/volkswagen-148/passat-148035/1-9-tdi-8876.html
https://www.automecanik.com/pieces/demarreur-5/renault-140/megane-ii-140015/1-5-dci-8664.html
https://www.automecanik.com/pieces/embrayage-48/citroen-2/berlingo-2025/1-6-hdi-8722.html
https://www.automecanik.com/pieces/rotule-de-direction-55/peugeot-142/partner-142098/1-6-hdi-9147.html
https://www.automecanik.com/pieces/roulement-de-roue-58/renault-140/kangoo-140045/1-5-dci-8665.html
https://www.automecanik.com/pieces/silent-bloc-62/ford-138/fiesta-138025/1-4-tdci-8813.html
https://www.automecanik.com/pieces/capteur-abs-67/opel-141/astra-h-141055/1-7-cdti-8957.html
https://www.automecanik.com/pieces/thermostat-72/toyota-147/corolla-147015/1-4-d-4d-8946.html
https://www.automecanik.com/pieces/vanne-egr-78/mercedes-benz-145/classe-c-w203-145025/c-220-cdi-8935.html
EOF
    )
fi

# Warm cache for each URL
while IFS= read -r URL; do
    if [ -z "$URL" ]; then
        continue
    fi

    # Fetch with cache warming headers
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-Cache-Warm: true" \
        -H "User-Agent: CacheWarmer/1.0 (automecanik.com)" \
        --max-time 30 \
        "$URL" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        SUCCESS=$((SUCCESS + 1))
        # Progress indicator (every 10 pages)
        if [ $((SUCCESS % 10)) -eq 0 ]; then
            echo -ne "\r${GREEN}✓${NC} $SUCCESS pages warmed..."
        fi
    elif [ "$HTTP_CODE" = "410" ]; then
        # 410 Gone = page removed, expected
        FAILED=$((FAILED + 1))
    else
        FAILED=$((FAILED + 1))
        log "${RED}✗ Failed ($HTTP_CODE): $URL${NC}"
    fi

    # Rate limiting (convert ms to seconds)
    sleep "0.$(printf '%03d' $DELAY_MS)"

done <<< "$URLS"

echo ""
log "${GREEN}✅ Cache Warming Complete${NC}"
log "   Success: $SUCCESS"
log "   Failed: $FAILED"
log "   Total: $((SUCCESS + FAILED))"

# Verify cache hit on sample URL
SAMPLE_URL="$BASE_URL/pieces/radiateur-de-chauffage-467/renault-140/symbol-ii-140093/1-2-16v-9292.html"
CACHE_STATUS=$(curl -sI "$SAMPLE_URL" 2>/dev/null | grep -i "cf-cache-status" | cut -d: -f2 | tr -d ' \r\n')

if [ -n "$CACHE_STATUS" ]; then
    log "📊 Cloudflare Cache Status: $CACHE_STATUS"
    if [ "$CACHE_STATUS" = "HIT" ]; then
        log "${GREEN}🎉 CDN Cache is HOT!${NC}"
    fi
fi

# Exit with error only if >20% failed (410s for removed pages are expected)
if [ $FAILED -gt $((SUCCESS / 5)) ] && [ $SUCCESS -gt 0 ]; then
    log "${YELLOW}⚠️ Warning: High failure rate (${FAILED}/$((SUCCESS + FAILED)))${NC}"
    exit 1
fi

exit 0
