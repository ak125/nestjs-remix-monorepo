#!/bin/bash

# ==============================================================================
# Script d'analyse du taux de crawl du sitemap
# ==============================================================================
#
# KPI: % d'URLs du sitemap crawlÃ©es dans les derniÃ¨res 72h
#
# Mesure la rÃ©activitÃ© des moteurs de recherche au sitemap
# Objectif: >80% des URLs crawlÃ©es en <72h aprÃ¨s publication/mise Ã  jour
#

set -e

LOKI_URL=${LOKI_URL:-http://localhost:3100}
SITEMAP_URL=${SITEMAP_URL:-https://automecanik.fr/sitemap.xml}
TIME_WINDOW=${1:-72h}  # FenÃªtre de temps (72h par dÃ©faut)

echo "ðŸ” Analyse du taux de crawl du sitemap"
echo "======================================"
echo "Sitemap: $SITEMAP_URL"
echo "FenÃªtre: $TIME_WINDOW"
echo "Loki: $LOKI_URL"
echo ""

# 1. RÃ©cupÃ©rer les URLs du sitemap
echo "ðŸ“‹ RÃ©cupÃ©ration des URLs du sitemap..."
SITEMAP_URLS=$(curl -s "$SITEMAP_URL" | \
    grep -o '<loc>[^<]*</loc>' | \
    sed 's/<loc>//g;s/<\/loc>//g' | \
    wc -l)

echo "âœ… $SITEMAP_URLS URLs trouvÃ©es dans le sitemap"
echo ""

# 2. RequÃªte Loki pour compter les URLs crawlÃ©es (bots uniquement)
echo "ðŸ¤– Analyse des crawls dans les derniÃ¨res $TIME_WINDOW..."

# Query LogQL pour compter les URLs uniques crawlÃ©es par des bots
LOGQL_QUERY='count(count_over_time({job="caddy-access"} | json | bot != "" | __error__="" ['"$TIME_WINDOW"'])) by (path)'

# Encoder la query pour URL
ENCODED_QUERY=$(echo "$LOGQL_QUERY" | jq -sRr @uri)

# RequÃªte Loki
LOKI_RESPONSE=$(curl -s -G "$LOKI_URL/loki/api/v1/query" \
    --data-urlencode "query=$LOGQL_QUERY" \
    --data-urlencode "time=$(date +%s)")

# Extraire le nombre d'URLs crawlÃ©es
CRAWLED_URLS=$(echo "$LOKI_RESPONSE" | jq -r '.data.result | length // 0')

echo "âœ… $CRAWLED_URLS URLs uniques crawlÃ©es par des bots"
echo ""

# 3. Calculer le KPI
if [ "$SITEMAP_URLS" -gt 0 ]; then
    CRAWL_RATE=$(awk "BEGIN {printf \"%.2f\", ($CRAWLED_URLS / $SITEMAP_URLS) * 100}")
    
    echo "ðŸ“Š KPI - Taux de crawl"
    echo "======================"
    echo "URLs dans sitemap: $SITEMAP_URLS"
    echo "URLs crawlÃ©es ($TIME_WINDOW): $CRAWLED_URLS"
    echo "Taux de crawl: $CRAWL_RATE%"
    echo ""
    
    # Ã‰valuation du KPI
    THRESHOLD=80
    if (( $(echo "$CRAWL_RATE >= $THRESHOLD" | bc -l) )); then
        echo "âœ… EXCELLENT - Taux > ${THRESHOLD}%"
        echo "   Les moteurs de recherche crawlent activement votre site!"
    elif (( $(echo "$CRAWL_RATE >= 50" | bc -l) )); then
        echo "âš ï¸  MOYEN - Taux entre 50% et ${THRESHOLD}%"
        echo "   AmÃ©liorer: frÃ©quence mise Ã  jour sitemap, robots.txt, PageSpeed"
    else
        echo "âŒ FAIBLE - Taux < 50%"
        echo "   Actions urgentes:"
        echo "   - VÃ©rifier robots.txt"
        echo "   - Soumettre sitemap Ã  Google Search Console"
        echo "   - AmÃ©liorer temps de chargement"
        echo "   - VÃ©rifier que le sitemap est accessible"
    fi
else
    echo "âŒ Erreur: Aucune URL trouvÃ©e dans le sitemap"
    exit 1
fi

echo ""

# 4. Top 10 des bots les plus actifs
echo "ðŸ¤– Top 10 des bots crawlers"
echo "==========================="

TOP_BOTS_QUERY='{job="caddy-access"} | json | bot != "" | __error__="" ['"$TIME_WINDOW"']'
TOP_BOTS=$(curl -s -G "$LOKI_URL/loki/api/v1/query" \
    --data-urlencode "query=topk(10, sum by (bot) (count_over_time($TOP_BOTS_QUERY)))" \
    --data-urlencode "time=$(date +%s)")

echo "$TOP_BOTS" | jq -r '.data.result[] | "\(.metric.bot): \(.value[1]) hits"' | \
    awk '{printf "  %2d. %s\n", NR, $0}'

echo ""

# 5. URLs les plus crawlÃ©es
echo "ðŸ“„ Top 10 des URLs les plus crawlÃ©es"
echo "====================================="

TOP_URLS_QUERY='{job="caddy-access"} | json | bot != "" | __error__="" ['"$TIME_WINDOW"']'
TOP_URLS=$(curl -s -G "$LOKI_URL/loki/api/v1/query" \
    --data-urlencode "query=topk(10, sum by (path) (count_over_time($TOP_URLS_QUERY)))" \
    --data-urlencode "time=$(date +%s)")

echo "$TOP_URLS" | jq -r '.data.result[] | "\(.metric.path): \(.value[1]) crawls"' | \
    awk '{printf "  %2d. %s\n", NR, $0}'

echo ""
echo "ðŸ’¡ Conseils pour amÃ©liorer le taux de crawl:"
echo "   - Soumettre le sitemap rÃ©guliÃ¨rement (Google Search Console, Bing Webmaster)"
echo "   - Mettre Ã  jour <lastmod> dans le sitemap aprÃ¨s chaque modification"
echo "   - Ajouter <changefreq> et <priority> pertinents"
echo "   - AmÃ©liorer le temps de rÃ©ponse du serveur (<200ms)"
echo "   - CrÃ©er un sitemap index pour sites >50k URLs"
echo "   - Utiliser robots.txt pour guider les crawlers"
