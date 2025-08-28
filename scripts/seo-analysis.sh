#!/bin/bash
# 🔍 Script d'Analyse SEO Complet - Automecanik
# Usage: ./scripts/seo-analysis.sh [--full] [--performance] [--monitoring]

set -e

BASE_URL="http://localhost:3000"
REPORT_DIR="./reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Créer le dossier de rapports
mkdir -p $REPORT_DIR

echo -e "${BLUE}🔍 LANCEMENT ANALYSE SEO COMPLÈTE - $(date)${NC}"
echo "=================================================="

# Fonction de test de connectivité
test_connectivity() {
    echo -e "${YELLOW}📡 Test de connectivité...${NC}"
    if curl -s --max-time 5 "$BASE_URL" > /dev/null; then
        echo -e "${GREEN}✅ Serveur accessible${NC}"
    else
        echo -e "${RED}❌ Serveur inaccessible${NC}"
        exit 1
    fi
}

# Analyse des métadonnées principales
analyze_metadata() {
    echo -e "\n${YELLOW}📊 1. ANALYSE DES MÉTADONNÉES${NC}"
    echo "--------------------------------"
    
    local pages=("accueil" "contact" "mentions-legales" "products/freinage" "constructeurs/renault")
    
    for page in "${pages[@]}"; do
        echo -e "🔍 Analyse: ${BLUE}$page${NC}"
        response=$(curl -s "$BASE_URL/api/seo/metadata/$page")
        
        if echo "$response" | jq . > /dev/null 2>&1; then
            title=$(echo "$response" | jq -r '.meta_title // "N/A"')
            description=$(echo "$response" | jq -r '.meta_description // "N/A"')
            echo "  📝 Titre: $title"
            echo "  📄 Description: ${description:0:80}..."
            echo "$response" > "$REPORT_DIR/metadata_${page//\//_}_$TIMESTAMP.json"
        else
            echo -e "  ${RED}❌ Erreur API${NC}"
        fi
        echo ""
    done
}

# Analyse du sitemap
analyze_sitemap() {
    echo -e "\n${YELLOW}🗺️ 2. ANALYSE DU SITEMAP${NC}"
    echo "----------------------------"
    
    echo "📥 Téléchargement sitemap index..."
    sitemap_content=$(curl -s "$BASE_URL/sitemap.xml")
    
    if [[ $sitemap_content == *"<sitemapindex"* ]]; then
        echo -e "${GREEN}✅ Sitemap index valide${NC}"
        
        # Compter les sitemaps
        sitemap_count=$(echo "$sitemap_content" | grep -c "<sitemap>" || echo "0")
        echo "📊 Nombre de sitemaps: $sitemap_count"
        
        # Sauvegarder
        echo "$sitemap_content" > "$REPORT_DIR/sitemap_index_$TIMESTAMP.xml"
        
        # Analyser chaque sitemap
        echo "$sitemap_content" | grep -o '<loc>[^<]*</loc>' | sed 's/<loc>\|<\/loc>//g' | while read -r sitemap_url; do
            filename=$(basename "$sitemap_url" .xml)
            echo "  🔍 Analyse $filename..."
            curl -s "$sitemap_url" > "$REPORT_DIR/sitemap_${filename}_$TIMESTAMP.xml" 2>/dev/null || echo "    ❌ Erreur téléchargement"
        done
    else
        echo -e "${RED}❌ Sitemap invalide${NC}"
    fi
}

# Analyse robots.txt
analyze_robots() {
    echo -e "\n${YELLOW}🤖 3. ANALYSE ROBOTS.TXT${NC}"
    echo "-----------------------------"
    
    robots_content=$(curl -s "$BASE_URL/robots.txt")
    
    if [[ $robots_content == *"User-agent:"* ]]; then
        echo -e "${GREEN}✅ Robots.txt valide${NC}"
        echo "📊 Lignes: $(echo "$robots_content" | wc -l)"
        echo "📊 Sitemaps référencés: $(echo "$robots_content" | grep -c "Sitemap:" || echo "0")"
        
        # Sauvegarder
        echo "$robots_content" > "$REPORT_DIR/robots_$TIMESTAMP.txt"
        
        # Afficher le contenu
        echo -e "\n${BLUE}Contenu:${NC}"
        echo "$robots_content" | head -10
    else
        echo -e "${RED}❌ Robots.txt invalide${NC}"
    fi
}

# Test de performance
performance_test() {
    echo -e "\n${YELLOW}⚡ 4. TESTS DE PERFORMANCE${NC}"
    echo "-------------------------------"
    
    local endpoints=("api/seo/metadata/accueil" "sitemap.xml" "robots.txt")
    
    for endpoint in "${endpoints[@]}"; do
        echo -e "🚀 Test: ${BLUE}$endpoint${NC}"
        
        # Test de temps de réponse
        start_time=$(date +%s.%3N)
        response=$(curl -s "$BASE_URL/$endpoint")
        end_time=$(date +%s.%3N)
        duration=$(echo "$end_time - $start_time" | bc -l)
        
        # Test de taille
        size=$(echo "$response" | wc -c)
        
        echo "  ⏱️  Temps: ${duration}s"
        echo "  📏 Taille: ${size} bytes"
        
        # Validation
        if (( $(echo "$duration < 1.0" | bc -l) )); then
            echo -e "  ${GREEN}✅ Performance OK${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Performance lente${NC}"
        fi
        echo ""
    done
}

# Analytics avancées
advanced_analytics() {
    echo -e "\n${YELLOW}📈 5. ANALYTICS AVANCÉES${NC}"
    echo "----------------------------"
    
    # Test de l'API analytics (nécessite auth)
    echo "🔐 Test API analytics..."
    analytics_response=$(curl -s "$BASE_URL/api/seo/analytics" 2>/dev/null || echo '{"error":"auth_required"}')
    
    if echo "$analytics_response" | jq . > /dev/null 2>&1; then
        if echo "$analytics_response" | jq -e '.totalPages' > /dev/null 2>&1; then
            total_pages=$(echo "$analytics_response" | jq -r '.totalPages')
            echo "📊 Total pages indexées: $total_pages"
            echo "$analytics_response" > "$REPORT_DIR/analytics_$TIMESTAMP.json"
        else
            echo -e "${YELLOW}⚠️  Authentification requise pour analytics${NC}"
        fi
    else
        echo -e "${RED}❌ Erreur API analytics${NC}"
    fi
}

# Rapport final
generate_report() {
    echo -e "\n${YELLOW}📋 6. GÉNÉRATION DU RAPPORT${NC}"
    echo "--------------------------------"
    
    report_file="$REPORT_DIR/seo_report_$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# Rapport d'Analyse SEO - $(date)

## Résumé Exécutif
- Serveur: $BASE_URL
- Date: $(date)
- Rapports générés: $REPORT_DIR/

## Fichiers Analysés
$(ls -la $REPORT_DIR/*_$TIMESTAMP.* | awk '{print "- " $9 " (" $5 " bytes)"}')

## Recommandations
- [ ] Vérifier les métadonnées manquantes
- [ ] Optimiser les temps de réponse > 1s  
- [ ] Contrôler la validité des sitemaps
- [ ] Tester l'authentification pour analytics

EOF
    
    echo -e "${GREEN}✅ Rapport généré: $report_file${NC}"
    
    # Statistiques finales
    echo -e "\n${BLUE}📊 STATISTIQUES:${NC}"
    echo "- Fichiers créés: $(ls -1 $REPORT_DIR/*_$TIMESTAMP.* | wc -l)"
    echo "- Taille totale: $(du -sh $REPORT_DIR | awk '{print $1}')"
}

# Monitoring en temps réel
monitoring_mode() {
    echo -e "\n${YELLOW}📡 MODE MONITORING ACTIVÉ${NC}"
    echo "Ctrl+C pour arrêter..."
    
    while true; do
        clear
        echo -e "${BLUE}🔍 MONITORING SEO - $(date)${NC}"
        echo "=================================="
        
        # Test rapide de connectivité
        if curl -s --max-time 2 "$BASE_URL" > /dev/null; then
            echo -e "${GREEN}✅ Serveur OK${NC}"
            
            # Métadonnées accueil
            title=$(curl -s "$BASE_URL/api/seo/metadata/accueil" | jq -r '.meta_title // "N/A"' 2>/dev/null)
            echo "📝 Titre accueil: $title"
            
            # Taille sitemap
            sitemap_size=$(curl -s "$BASE_URL/sitemap.xml" | wc -c)
            echo "🗺️ Taille sitemap: $sitemap_size bytes"
            
        else
            echo -e "${RED}❌ Serveur indisponible${NC}"
        fi
        
        sleep 10
    done
}

# Fonction principale
main() {
    test_connectivity
    
    case "${1:-}" in
        "--full")
            analyze_metadata
            analyze_sitemap
            analyze_robots
            performance_test
            advanced_analytics
            generate_report
            ;;
        "--performance")
            performance_test
            ;;
        "--monitoring")
            monitoring_mode
            ;;
        *)
            analyze_metadata
            analyze_sitemap
            analyze_robots
            generate_report
            ;;
    esac
    
    echo -e "\n${GREEN}🎯 ANALYSE TERMINÉE !${NC}"
    echo "Rapports disponibles dans: $REPORT_DIR/"
}

# Exécution
main "$@"
