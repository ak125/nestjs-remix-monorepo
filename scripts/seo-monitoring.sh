#!/bin/bash
# 📡 Monitoring SEO en Temps Réel
# Usage: ./scripts/seo-monitoring.sh

BASE_URL="http://localhost:3000"
REFRESH_INTERVAL=30

echo "📡 MONITORING SEO EN TEMPS RÉEL"
echo "Intervalle: ${REFRESH_INTERVAL}s | Ctrl+C pour arrêter"
echo "========================================"

while true; do
    clear
    echo "🔍 MONITORING SEO - $(date)"
    echo "========================================"
    
    # Status serveur
    if curl -s --max-time 3 "$BASE_URL" > /dev/null 2>&1; then
        echo "✅ Serveur: OPÉRATIONNEL"
    else
        echo "❌ Serveur: INDISPONIBLE"
        sleep $REFRESH_INTERVAL
        continue
    fi
    
    # Métadonnées principales
    echo ""
    echo "📄 MÉTADONNÉES:"
    response=$(curl -s "$BASE_URL/api/seo/metadata/accueil" 2>/dev/null)
    if [[ $? -eq 0 ]] && echo "$response" | jq . > /dev/null 2>&1; then
        title=$(echo "$response" | jq -r '.meta_title // "N/A"')
        echo "  🏠 Accueil: $title"
    else
        echo "  ❌ Erreur métadonnées"
    fi
    
    # Sitemap stats
    echo ""
    echo "🗺️ SITEMAP:"
    sitemap_response=$(curl -s "$BASE_URL/sitemap.xml" 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        sitemap_count=$(echo "$sitemap_response" | grep -c "<sitemap>" 2>/dev/null || echo "0")
        sitemap_size=$(echo "$sitemap_response" | wc -c)
        echo "  📊 Sitemaps: $sitemap_count"
        echo "  📏 Taille: $sitemap_size bytes"
    else
        echo "  ❌ Erreur sitemap"
    fi
    
    # Performance temps réel
    echo ""
    echo "⚡ PERFORMANCE:"
    start_time=$(date +%s.%3N)
    curl -s "$BASE_URL/api/seo/metadata/accueil" > /dev/null 2>&1
    end_time=$(date +%s.%3N)
    duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "N/A")
    echo "  ⏱️ Réponse API: ${duration}s"
    
    # Analytics (si disponible)
    echo ""
    echo "📈 ANALYTICS:"
    analytics_response=$(curl -s "$BASE_URL/api/seo/analytics" 2>/dev/null)
    if echo "$analytics_response" | jq -e '.totalPages' > /dev/null 2>&1; then
        total_pages=$(echo "$analytics_response" | jq -r '.totalPages')
        completion_rate=$(echo "$analytics_response" | jq -r '.completionRate // "N/A"')
        echo "  📊 Total pages: $total_pages"
        echo "  📈 Taux optimisation: $completion_rate%"
    else
        echo "  🔐 Authentification requise"
    fi
    
    echo ""
    echo "⏰ Prochaine mise à jour dans ${REFRESH_INTERVAL}s..."
    
    sleep $REFRESH_INTERVAL
done
