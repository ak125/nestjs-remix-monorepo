#!/bin/bash

# ==============================================================================
# Script d'analyse du taux de crawl du sitemap
# ==============================================================================
#
# KPI: % d'URLs du sitemap crawlées dans les dernières 72h
#
# Mesure la réactivité des moteurs de recherche au sitemap
# Objectif: >80% des URLs crawlées en <72h après publication/mise à jour
#

set -e

LOKI_URL=${LOKI_URL:-http://localhost:3100}
SITEMAP_URL=${SITEMAP_URL:-https://automecanik.fr/sitemap.xml}
TIME_WINDOW=${1:-72h}  # Fenêtre de temps (72h par défaut)

echo "🔍 Analyse du taux de crawl du sitemap"
echo "======================================"
echo "Sitemap: $SITEMAP_URL"
echo "Fenêtre: $TIME_WINDOW"
echo "Loki: $LOKI_URL"
echo ""

# 1. Récupérer les URLs du sitemap
echo "📋 Récupération des URLs du sitemap..."
SITEMAP_URLS=$(curl -s "$SITEMAP_URL" | \
    grep -o '<loc>[^<]*</loc>' | \
    sed 's/<loc>//g;s/<\/loc>//g' | \
    wc -l)

echo "✅ $SITEMAP_URLS URLs trouvées dans le sitemap"
echo ""

# 2. Requête Loki pour compter les URLs crawlées (bots uniquement)
echo "🤖 Analyse des crawls dans les dernières $TIME_WINDOW..."

# Query LogQL pour compter les URLs uniques crawlées par des bots
LOGQL_QUERY='count(count_over_time({job="caddy-access"} | json | bot != "" | __error__="" ['"$TIME_WINDOW"'])) by (path)'

# Encoder la query pour URL
ENCODED_QUERY=$(echo "$LOGQL_QUERY" | jq -sRr @uri)

# Requête Loki
LOKI_RESPONSE=$(curl -s -G "$LOKI_URL/loki/api/v1/query" \
    --data-urlencode "query=$LOGQL_QUERY" \
    --data-urlencode "time=$(date +%s)")

# Extraire le nombre d'URLs crawlées
CRAWLED_URLS=$(echo "$LOKI_RESPONSE" | jq -r '.data.result | length // 0')

echo "✅ $CRAWLED_URLS URLs uniques crawlées par des bots"
echo ""

# 3. Calculer le KPI
if [ "$SITEMAP_URLS" -gt 0 ]; then
    CRAWL_RATE=$(awk "BEGIN {printf \"%.2f\", ($CRAWLED_URLS / $SITEMAP_URLS) * 100}")
    
    echo "📊 KPI - Taux de crawl"
    echo "======================"
    echo "URLs dans sitemap: $SITEMAP_URLS"
    echo "URLs crawlées ($TIME_WINDOW): $CRAWLED_URLS"
    echo "Taux de crawl: $CRAWL_RATE%"
    echo ""
    
    # Évaluation du KPI
    THRESHOLD=80
    if (( $(echo "$CRAWL_RATE >= $THRESHOLD" | bc -l) )); then
        echo "✅ EXCELLENT - Taux > ${THRESHOLD}%"
        echo "   Les moteurs de recherche crawlent activement votre site!"
    elif (( $(echo "$CRAWL_RATE >= 50" | bc -l) )); then
        echo "⚠️  MOYEN - Taux entre 50% et ${THRESHOLD}%"
        echo "   Améliorer: fréquence mise à jour sitemap, robots.txt, PageSpeed"
    else
        echo "❌ FAIBLE - Taux < 50%"
        echo "   Actions urgentes:"
        echo "   - Vérifier robots.txt"
        echo "   - Soumettre sitemap à Google Search Console"
        echo "   - Améliorer temps de chargement"
        echo "   - Vérifier que le sitemap est accessible"
    fi
else
    echo "❌ Erreur: Aucune URL trouvée dans le sitemap"
    exit 1
fi

echo ""

# 4. Top 10 des bots les plus actifs
echo "🤖 Top 10 des bots crawlers"
echo "==========================="

TOP_BOTS_QUERY='{job="caddy-access"} | json | bot != "" | __error__="" ['"$TIME_WINDOW"']'
TOP_BOTS=$(curl -s -G "$LOKI_URL/loki/api/v1/query" \
    --data-urlencode "query=topk(10, sum by (bot) (count_over_time($TOP_BOTS_QUERY)))" \
    --data-urlencode "time=$(date +%s)")

echo "$TOP_BOTS" | jq -r '.data.result[] | "\(.metric.bot): \(.value[1]) hits"' | \
    awk '{printf "  %2d. %s\n", NR, $0}'

echo ""

# 5. URLs les plus crawlées
echo "📄 Top 10 des URLs les plus crawlées"
echo "====================================="

TOP_URLS_QUERY='{job="caddy-access"} | json | bot != "" | __error__="" ['"$TIME_WINDOW"']'
TOP_URLS=$(curl -s -G "$LOKI_URL/loki/api/v1/query" \
    --data-urlencode "query=topk(10, sum by (path) (count_over_time($TOP_URLS_QUERY)))" \
    --data-urlencode "time=$(date +%s)")

echo "$TOP_URLS" | jq -r '.data.result[] | "\(.metric.path): \(.value[1]) crawls"' | \
    awk '{printf "  %2d. %s\n", NR, $0}'

echo ""
echo "💡 Conseils pour améliorer le taux de crawl:"
echo "   - Soumettre le sitemap régulièrement (Google Search Console, Bing Webmaster)"
echo "   - Mettre à jour <lastmod> dans le sitemap après chaque modification"
echo "   - Ajouter <changefreq> et <priority> pertinents"
echo "   - Améliorer le temps de réponse du serveur (<200ms)"
echo "   - Créer un sitemap index pour sites >50k URLs"
echo "   - Utiliser robots.txt pour guider les crawlers"
