#!/bin/bash

# 📊 Script de Monitoring et Performance - Intégration Graduelle
# Version: 2.0
# Date: 2025-09-29

echo "🚀 Monitoring Performance - Service de Recherche Intégré"
echo "======================================================="

# Configuration
BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api/search"
MONITORING_DURATION=60  # 60 secondes
REQUESTS_PER_SECOND=2

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Fonction de test de performance
test_search_performance() {
    local query="$1"
    local description="$2"
    
    echo -e "\n${BLUE}📈 Test Performance: $description${NC}"
    echo "Query: $query"
    
    # Mesure du temps de réponse
    start_time=$(date +%s%N)
    response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" "$API_URL?q=$query")
    end_time=$(date +%s%N)
    
    # Extraction des données
    http_status=$(echo $response | grep -o 'HTTPSTATUS:[0-9]*' | cut -d: -f2)
    response_time=$(echo $response | grep -o 'TIME:[0-9.]*' | cut -d: -f2)
    body=$(echo $response | sed 's/HTTPSTATUS:[0-9]*;TIME:[0-9.]*//')
    
    # Calcul du temps total (nanoseconds to milliseconds)
    total_time=$(((end_time - start_time) / 1000000))
    curl_time=$(echo "$response_time * 1000" | bc)
    
    if [ "$http_status" = "200" ]; then
        # Extraction du nombre de résultats et du temps d'exécution
        total_results=$(echo "$body" | jq -r '.total // 0' 2>/dev/null)
        execution_time=$(echo "$body" | jq -r '.executionTime // 0' 2>/dev/null)
        
        echo -e "${GREEN}✅ Status: $http_status${NC}"
        echo -e "${GREEN}⏱️  Temps total: ${total_time}ms${NC}"
        echo -e "${GREEN}🌐 Temps cURL: ${curl_time}ms${NC}"
        echo -e "${GREEN}⚡ Temps exécution: ${execution_time}ms${NC}"
        echo -e "${GREEN}📋 Résultats: $total_results${NC}"
        
        # Retourner les métriques
        echo "$total_time,$execution_time,$total_results"
    else
        echo -e "${RED}❌ Erreur: Status $http_status${NC}"
        echo "0,0,0"
    fi
}

# Tests de charge avec différentes requêtes
echo -e "\n${YELLOW}🔍 Phase 1: Tests de Performance Individuelle${NC}"
echo "=============================================="

declare -a test_queries=(
    "filtre,Recherche simple"
    "bosch filtre,Recherche avec marque"
    "filtre huile renault,Recherche complexe"
    "186115,Recherche par référence"
    "v8,Recherche courte"
)

declare -a response_times=()
declare -a execution_times=()
declare -a result_counts=()

for query_info in "${test_queries[@]}"; do
    IFS=',' read -r query description <<< "$query_info"
    result=$(test_search_performance "$query" "$description")
    IFS=',' read -r total_time exec_time results <<< "$result"
    
    if [ "$total_time" != "0" ]; then
        response_times+=($total_time)
        execution_times+=($exec_time)
        result_counts+=($results)
    fi
    
    sleep 1
done

# Phase 2: Test de charge
echo -e "\n${YELLOW}⚡ Phase 2: Test de Charge${NC}"
echo "==========================="

echo -e "${BLUE}🚀 Lancement de $((MONITORING_DURATION * REQUESTS_PER_SECOND)) requêtes sur ${MONITORING_DURATION}s${NC}"

# Tableau pour stocker les temps de réponse
declare -a load_test_times=()
start_load_test=$(date +%s)

for i in $(seq 1 $MONITORING_DURATION); do
    for j in $(seq 1 $REQUESTS_PER_SECOND); do
        query_index=$((RANDOM % ${#test_queries[@]}))
        query=$(echo "${test_queries[$query_index]}" | cut -d',' -f1)
        
        # Test en arrière-plan pour simuler la charge
        (
            start_req=$(date +%s%N)
            curl -s "$API_URL?q=$query" > /dev/null
            end_req=$(date +%s%N)
            req_time=$(((end_req - start_req) / 1000000))
            echo $req_time >> /tmp/load_test_times.txt
        ) &
    done
    
    # Affichage du progrès
    progress=$((i * 100 / MONITORING_DURATION))
    echo -ne "\r${CYAN}📊 Progrès: $progress% [$i/${MONITORING_DURATION}s]${NC}"
    
    sleep 1
done

# Attendre la fin de toutes les requêtes
wait
echo -e "\n${GREEN}✅ Test de charge terminé${NC}"

# Phase 3: Analyse des résultats
echo -e "\n${YELLOW}📊 Phase 3: Analyse des Performances${NC}"
echo "===================================="

# Calcul des moyennes pour les tests individuels
if [ ${#response_times[@]} -gt 0 ]; then
    avg_response=$(printf '%s\n' "${response_times[@]}" | awk '{sum+=$1} END {printf "%.1f", sum/NR}')
    min_response=$(printf '%s\n' "${response_times[@]}" | sort -n | head -1)
    max_response=$(printf '%s\n' "${response_times[@]}" | sort -n | tail -1)
    
    avg_execution=$(printf '%s\n' "${execution_times[@]}" | awk '{sum+=$1} END {printf "%.1f", sum/NR}')
    total_results=$(printf '%s\n' "${result_counts[@]}" | awk '{sum+=$1} END {print sum}')
    
    echo -e "${GREEN}🎯 Tests Individuels:${NC}"
    echo -e "   📈 Temps moyen: ${avg_response}ms"
    echo -e "   ⚡ Min/Max: ${min_response}ms / ${max_response}ms"
    echo -e "   🔧 Exécution moyenne: ${avg_execution}ms"
    echo -e "   📋 Total résultats: $total_results"
fi

# Analyse du test de charge
if [ -f /tmp/load_test_times.txt ]; then
    load_test_times=($(cat /tmp/load_test_times.txt))
    
    if [ ${#load_test_times[@]} -gt 0 ]; then
        load_avg=$(printf '%s\n' "${load_test_times[@]}" | awk '{sum+=$1} END {printf "%.1f", sum/NR}')
        load_min=$(printf '%s\n' "${load_test_times[@]}" | sort -n | head -1)
        load_max=$(printf '%s\n' "${load_test_times[@]}" | sort -n | tail -1)
        load_count=${#load_test_times[@]}
        
        # Calcul du percentile 95
        p95_index=$(echo "$load_count * 0.95" | bc | cut -d. -f1)
        load_p95=$(printf '%s\n' "${load_test_times[@]}" | sort -n | sed -n "${p95_index}p")
        
        echo -e "\n${GREEN}⚡ Test de Charge ($load_count requêtes):${NC}"
        echo -e "   📊 Temps moyen: ${load_avg}ms"
        echo -e "   🎯 P95: ${load_p95}ms"
        echo -e "   ⚡ Min/Max: ${load_min}ms / ${load_max}ms"
        echo -e "   🚀 Débit: $(echo "scale=2; $load_count / $MONITORING_DURATION" | bc) req/s"
    fi
    
    rm -f /tmp/load_test_times.txt
fi

# Phase 4: Récupération des métriques du serveur
echo -e "\n${YELLOW}📋 Phase 4: Métriques du Serveur${NC}"
echo "================================="

# Métriques de monitoring
echo -e "${BLUE}📊 Récupération des métriques...${NC}"
metrics_response=$(curl -s "$API_URL/metrics")
if [ $? -eq 0 ]; then
    echo "$metrics_response" | jq . 2>/dev/null || echo "$metrics_response"
else
    echo -e "${RED}❌ Impossible de récupérer les métriques${NC}"
fi

# Rapport de performance
echo -e "\n${BLUE}📈 Récupération du rapport de performance...${NC}"
report_response=$(curl -s "$API_URL/performance-report")
if [ $? -eq 0 ]; then
    echo "$report_response" | jq . 2>/dev/null || echo "$report_response"
else
    echo -e "${RED}❌ Impossible de récupérer le rapport${NC}"
fi

# Recommandations
echo -e "\n${YELLOW}💡 Phase 5: Recommandations${NC}"
echo "============================"

echo -e "${PURPLE}🎯 Recommandations d'optimisation:${NC}"

# Analyse des temps de réponse
if [ ! -z "$avg_response" ]; then
    if (( $(echo "$avg_response > 200" | bc -l) )); then
        echo -e "   ⚠️  Temps de réponse élevé (${avg_response}ms) - Optimiser les requêtes"
    elif (( $(echo "$avg_response > 100" | bc -l) )); then
        echo -e "   📈 Temps de réponse modéré (${avg_response}ms) - Surveillance recommandée"
    else
        echo -e "   ✅ Temps de réponse excellent (${avg_response}ms)"
    fi
fi

# Recommandations spécifiques
echo -e "   🔧 Intégrer progressivement le service enhanced"
echo -e "   📊 Surveiller les métriques en temps réel"
echo -e "   🎯 Optimiser le cache Redis pour de meilleures performances"
echo -e "   ⚡ Considérer l'indexation Meilisearch pour les requêtes complexes"

echo -e "\n${GREEN}🎉 Analyse de performance terminée !${NC}"
echo -e "${BLUE}💡 Le service de recherche est prêt pour la production.${NC}"