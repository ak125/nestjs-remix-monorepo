#!/bin/bash
# ⚡ Script de Test de Performance SEO
# Usage: ./scripts/seo-performance.sh

BASE_URL="http://localhost:3000"
ITERATIONS=5

echo "⚡ TESTS DE PERFORMANCE SEO"
echo "=========================="

# Test de benchmarking
benchmark_endpoint() {
    local endpoint=$1
    local name=$2
    
    echo "🚀 Test: $name"
    echo "URL: $BASE_URL/$endpoint"
    
    local total_time=0
    local min_time=999999
    local max_time=0
    
    for i in $(seq 1 $ITERATIONS); do
        start_time=$(date +%s.%3N)
        curl -s "$BASE_URL/$endpoint" > /dev/null
        end_time=$(date +%s.%3N)
        
        duration=$(echo "$end_time - $start_time" | bc -l)
        total_time=$(echo "$total_time + $duration" | bc -l)
        
        if (( $(echo "$duration < $min_time" | bc -l) )); then
            min_time=$duration
        fi
        
        if (( $(echo "$duration > $max_time" | bc -l) )); then
            max_time=$duration
        fi
        
        echo -n "."
    done
    
    avg_time=$(echo "scale=3; $total_time / $ITERATIONS" | bc -l)
    
    echo ""
    echo "  📊 Moyenne: ${avg_time}s"
    echo "  📊 Min: ${min_time}s"
    echo "  📊 Max: ${max_time}s"
    
    # Évaluation
    if (( $(echo "$avg_time < 0.5" | bc -l) )); then
        echo "  ✅ Excellent"
    elif (( $(echo "$avg_time < 1.0" | bc -l) )); then
        echo "  🟡 Bon"
    else
        echo "  🔴 À améliorer"
    fi
    echo ""
}

# Tests des endpoints principaux
benchmark_endpoint "api/seo/metadata/accueil" "Métadonnées Accueil"
benchmark_endpoint "sitemap.xml" "Sitemap Index"
benchmark_endpoint "robots.txt" "Robots.txt"
benchmark_endpoint "api/seo/config" "Configuration SEO"

echo "🎯 Tests terminés !"
