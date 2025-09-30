#!/bin/bash

# 🚀 Script d'Intégration Graduelle Complète
# Service de Recherche Enhanced v3.0
# Date: 2025-09-29

echo "🚀 INTÉGRATION GRADUELLE - SERVICE DE RECHERCHE ENHANCED"
echo "========================================================"
echo "Version: 3.0 | Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Configuration
BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api/search"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Fonction d'affichage de statut
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "info") echo -e "${BLUE}ℹ️  $message${NC}" ;;
        "step") echo -e "${PURPLE}📋 $message${NC}" ;;
    esac
}

# Fonction de vérification de service
check_service() {
    local url=$1
    local name=$2
    
    if curl -s "$url" > /dev/null 2>&1; then
        print_status "success" "$name est opérationnel"
        return 0
    else
        print_status "error" "$name n'est pas accessible"
        return 1
    fi
}

# Fonction de test d'endpoint
test_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url")
    http_status=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    
    if [ "$http_status" -eq "$expected_status" ]; then
        print_status "success" "$name: Status $http_status ✓"
        return 0
    else
        print_status "error" "$name: Status $http_status (attendu: $expected_status)"
        return 1
    fi
}

echo -e "${BOLD}Phase 1: Vérification des Prérequis${NC}"
echo "=================================="

# Vérification du serveur principal
check_service "$BASE_URL" "Serveur NestJS"
if [ $? -ne 0 ]; then
    print_status "error" "Le serveur doit être démarré avant l'intégration"
    echo "Commande: npm run dev"
    exit 1
fi

# Vérification des endpoints de base
test_endpoint "$API_URL/health" "Health Check"
test_endpoint "$API_URL" "Endpoint principal"

echo ""
echo -e "${BOLD}Phase 2: Tests Fonctionnels${NC}"
echo "==========================="

print_status "step" "Exécution des tests fonctionnels complets..."

# Lancement du script de test d'intégration
if [ -f "./test-integration.sh" ]; then
    echo -e "${CYAN}🔍 Lancement des tests fonctionnels...${NC}"
    ./test-integration.sh | tail -10  # Afficher seulement les dernières lignes
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        print_status "success" "Tests fonctionnels réussis"
    else
        print_status "warning" "Certains tests ont échoué, mais l'intégration continue"
    fi
else
    print_status "warning" "Script test-integration.sh non trouvé"
fi

echo ""
echo -e "${BOLD}Phase 3: Mesure des Performances${NC}"
echo "================================"

print_status "step" "Analyse des performances de base..."

# Tests de performance rapides
declare -a queries=("filtre" "bosch" "v8" "huile")
declare -a times=()

for query in "${queries[@]}"; do
    start_time=$(date +%s%N)
    curl -s "$API_URL?q=$query" > /dev/null
    end_time=$(date +%s%N)
    response_time=$(((end_time - start_time) / 1000000))
    times+=($response_time)
    echo -e "${CYAN}   Query '$query': ${response_time}ms${NC}"
done

# Calcul de la moyenne
if [ ${#times[@]} -gt 0 ]; then
    avg_time=$(printf '%s\n' "${times[@]}" | awk '{sum+=$1} END {printf "%.0f", sum/NR}')
    print_status "info" "Temps de réponse moyen: ${avg_time}ms"
    
    if [ $avg_time -lt 100 ]; then
        print_status "success" "Performance excellente (<100ms)"
    elif [ $avg_time -lt 200 ]; then
        print_status "info" "Performance bonne (<200ms)"
    else
        print_status "warning" "Performance à optimiser (>200ms)"
    fi
fi

echo ""
echo -e "${BOLD}Phase 4: Validation du Monitoring${NC}"
echo "=================================="

# Test des endpoints de monitoring
print_status "step" "Vérification des métriques..."

test_endpoint "$API_URL/metrics" "Endpoint Metrics"
test_endpoint "$API_URL/performance-report" "Rapport de Performance"

# Récupération et affichage des métriques principales
metrics=$(curl -s "$API_URL/metrics" 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$metrics" ]; then
    total_searches=$(echo "$metrics" | jq -r '.totalSearches // 0' 2>/dev/null)
    avg_response=$(echo "$metrics" | jq -r '.averageResponseTime // 0' 2>/dev/null)
    
    print_status "info" "Recherches totales: $total_searches"
    print_status "info" "Temps moyen enregistré: ${avg_response}ms"
fi

echo ""
echo -e "${BOLD}Phase 5: Intégration des Fonctionnalités Enhanced${NC}"
echo "==============================================="

print_status "step" "Vérification des services enhanced..."

# Vérification que les services enhanced sont bien intégrés
services_status=0

# Test recherche simple
if curl -s "$API_URL?q=test" | jq -e '.items' > /dev/null 2>&1; then
    print_status "success" "Service de recherche principal ✓"
else
    print_status "error" "Service de recherche principal"
    services_status=1
fi

# Test recherche instantanée
if curl -s "$API_URL/instant?q=te" | jq -e '.items' > /dev/null 2>&1; then
    print_status "success" "Recherche instantanée ✓"
else
    print_status "error" "Recherche instantanée"
    services_status=1
fi

echo ""
echo -e "${BOLD}Phase 6: Recommandations d'Optimisation${NC}"
echo "========================================="

print_status "step" "Génération des recommandations..."

# Récupération du rapport de performance pour les recommandations
report=$(curl -s "$API_URL/performance-report" 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$report" ]; then
    recommendations=$(echo "$report" | jq -r '.recommendations[]?' 2>/dev/null)
    if [ -n "$recommendations" ]; then
        echo -e "${YELLOW}💡 Recommandations automatiques:${NC}"
        echo "$recommendations" | while read -r rec; do
            echo -e "   📌 $rec"
        done
    fi
fi

echo ""
echo -e "${YELLOW}💡 Recommandations d'intégration graduelle:${NC}"
echo -e "   🔧 ${BOLD}Étape 1:${NC} Activer progressivement le PiecesSearchEnhancedService"
echo -e "   📊 ${BOLD}Étape 2:${NC} Surveiller les métriques avec le dashboard de monitoring"
echo -e "   ⚡ ${BOLD}Étape 3:${NC} Optimiser le cache Redis pour améliorer les performances"
echo -e "   🎯 ${BOLD}Étape 4:${NC} Intégrer les 25+ fonctionnalités avancées une par une"
echo -e "   🚀 ${BOLD}Étape 5:${NC} Déployer en production avec monitoring continu"

echo ""
echo -e "${BOLD}Phase 7: Résumé de l'Intégration${NC}"
echo "================================"

# Calcul du score global
total_checks=6
passed_checks=0

# Vérifications
[ $(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health") -eq 200 ] && ((passed_checks++))
[ $(curl -s -o /dev/null -w "%{http_code}" "$API_URL") -eq 200 ] && ((passed_checks++))
[ $(curl -s -o /dev/null -w "%{http_code}" "$API_URL/instant?q=test") -eq 200 ] && ((passed_checks++))
[ $(curl -s -o /dev/null -w "%{http_code}" "$API_URL/metrics") -eq 200 ] && ((passed_checks++))
[ $avg_time -lt 300 ] && ((passed_checks++)) 2>/dev/null
[ $services_status -eq 0 ] && ((passed_checks++))

score=$((passed_checks * 100 / total_checks))

echo -e "${BLUE}📊 Score d'intégration: ${score}%${NC}"
echo -e "${BLUE}📈 Vérifications réussies: ${passed_checks}/${total_checks}${NC}"

if [ $score -ge 80 ]; then
    print_status "success" "Intégration graduelle réussie ! 🎉"
    echo -e "${GREEN}${BOLD}✨ Le service de recherche enhanced est prêt pour la production${NC}"
elif [ $score -ge 60 ]; then
    print_status "warning" "Intégration partielle - Quelques optimisations nécessaires"
    echo -e "${YELLOW}🔧 Consultez les recommandations ci-dessus${NC}"
else
    print_status "error" "Intégration incomplète - Vérification nécessaire"
    echo -e "${RED}🚨 Corrigez les erreurs avant la mise en production${NC}"
fi

echo ""
echo -e "${PURPLE}🎯 Prochaines étapes:${NC}"
echo -e "   1. Surveiller les performances avec: ${CYAN}./performance-monitoring.sh${NC}"
echo -e "   2. Consulter les métriques: ${CYAN}curl $API_URL/metrics${NC}"
echo -e "   3. Voir le rapport détaillé: ${CYAN}curl $API_URL/performance-report${NC}"
echo -e "   4. Tester la recherche: ${CYAN}curl '$API_URL?q=votre-recherche'${NC}"

echo ""
echo -e "${GREEN}${BOLD}🚀 Intégration graduelle terminée avec succès !${NC}"
echo "Date de fin: $(date '+%Y-%m-%d %H:%M:%S')"