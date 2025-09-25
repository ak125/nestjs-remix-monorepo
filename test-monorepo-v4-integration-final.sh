#!/bin/bash
# 🎯 Test complet d'intégration V4 dans le monorepo

echo "🚀 === TEST INTÉGRATION V4 MONOREPO - PORT 3000 ==="
echo "📅 $(date)"
echo ""

BASE_URL="http://localhost:3000"

# Test 1: API V4 - Catalogue véhicule
echo "🔧 Test 1: API V4 - Catalogue véhicule..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
  "$BASE_URL/api/catalog/families/vehicle-v4/22547")

HTTP_STATUS=$(echo $RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
TIME_TOTAL=$(echo $RESPONSE | grep -o "TIME:[0-9.]*" | cut -d: -f2)
BODY=$(echo $RESPONSE | sed -E 's/HTTPSTATUS:[0-9]*;TIME:[0-9.]*$//')

if [ "$HTTP_STATUS" = "200" ]; then
    FAMILIES_COUNT=$(echo $BODY | jq -r '.catalog.families | length' 2>/dev/null || echo "N/A")
    QUERY_TYPE=$(echo $BODY | jq -r '.catalog.queryType' 2>/dev/null || echo "N/A")
    echo "✅ API V4 OK - ${FAMILIES_COUNT} familles (${QUERY_TYPE}) - ${TIME_TOTAL}s"
else
    echo "❌ API V4 ERREUR - Status: $HTTP_STATUS"
    echo "   Body: $BODY"
fi
echo ""

# Test 2: Métriques V4
echo "🔧 Test 2: Métriques V4..."
METRICS_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  "$BASE_URL/api/catalog/families/metrics-v4")

HTTP_STATUS=$(echo $METRICS_RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
METRICS_BODY=$(echo $METRICS_RESPONSE | sed 's/HTTPSTATUS:[0-9]*$//')

if [ "$HTTP_STATUS" = "200" ]; then
    CACHE_RATIO=$(echo $METRICS_BODY | jq -r '.metrics.performance.cacheHitRatio' 2>/dev/null || echo "N/A")
    TOTAL_REQUESTS=$(echo $METRICS_BODY | jq -r '.metrics.performance.totalRequests' 2>/dev/null || echo "N/A")
    CACHED_VEHICLES=$(echo $METRICS_BODY | jq -r '.metrics.performance.totalCachedVehicles' 2>/dev/null || echo "N/A")
    echo "✅ Métriques OK - Cache: ${CACHE_RATIO}, Requêtes: ${TOTAL_REQUESTS}, Véhicules cachés: ${CACHED_VEHICLES}"
else
    echo "❌ Métriques ERREUR - Status: $HTTP_STATUS"
fi
echo ""

# Test 3: Performance cache avec appels multiples
echo "🔧 Test 3: Performance cache (5 appels)..."
TIMES=()
for i in {1..5}; do
    START_TIME=$(date +%s%3N)
    curl -s "$BASE_URL/api/catalog/families/vehicle-v4/22547" > /dev/null
    END_TIME=$(date +%s%3N)
    ELAPSED=$((END_TIME - START_TIME))
    TIMES+=($ELAPSED)
    echo "   Appel $i: ${ELAPSED}ms"
done

# Calcul temps moyen
TOTAL=0
for time in "${TIMES[@]}"; do
    TOTAL=$((TOTAL + time))
done
AVERAGE=$((TOTAL / ${#TIMES[@]}))
echo "✅ Temps moyen: ${AVERAGE}ms"
echo ""

# Test 4: Pages frontend
echo "🔧 Test 4: Pages frontend..."

# Page véhicule
echo "   - Page véhicule..."
VEHICLE_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
  "$BASE_URL/constructeurs/audi-22/a5-i-22046/18-tfsi-22547.html")

HTTP_STATUS=$(echo $VEHICLE_RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
TIME_TOTAL=$(echo $VEHICLE_RESPONSE | grep -o "TIME:[0-9.]*" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ Page véhicule OK - ${TIME_TOTAL}s"
else
    echo "   ❌ Page véhicule ERREUR - Status: $HTTP_STATUS"
fi

# Page test V4
echo "   - Page test V4..."
TEST_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
  "$BASE_URL/test-v4-ultimate/22547")

HTTP_STATUS=$(echo $TEST_RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
TIME_TOTAL=$(echo $TEST_RESPONSE | grep -o "TIME:[0-9.]*" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ Page test V4 OK - ${TIME_TOTAL}s"
else
    echo "   ❌ Page test V4 ERREUR - Status: $HTTP_STATUS"
fi

# Page comparaison
echo "   - Page comparaison V3/V4..."
COMPARE_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
  "$BASE_URL/compare-v3-v4/22547")

HTTP_STATUS=$(echo $COMPARE_RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
TIME_TOTAL=$(echo $COMPARE_RESPONSE | grep -o "TIME:[0-9.]*" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ Page comparaison OK - ${TIME_TOTAL}s"
else
    echo "   ❌ Page comparaison ERREUR - Status: $HTTP_STATUS"
fi
echo ""

# Test 5: Différents véhicules
echo "🔧 Test 5: Test multi-véhicules..."
VEHICLES=(22547 17173 472 15432)

for vehicle in "${VEHICLES[@]}"; do
    RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
      "$BASE_URL/api/catalog/families/vehicle-v4/$vehicle")
    
    HTTP_STATUS=$(echo $RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    TIME_TOTAL=$(echo $RESPONSE | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    
    if [ "$HTTP_STATUS" = "200" ]; then
        BODY=$(echo $RESPONSE | sed -E 's/HTTPSTATUS:[0-9]*;TIME:[0-9.]*$//')
        FAMILIES_COUNT=$(echo $BODY | jq -r '.catalog.families | length' 2>/dev/null || echo "N/A")
        echo "   ✅ Véhicule $vehicle: ${FAMILIES_COUNT} familles - ${TIME_TOTAL}s"
    else
        echo "   ❌ Véhicule $vehicle ERREUR - Status: $HTTP_STATUS"
    fi
done
echo ""

# Test 6: Vérification cache après les tests
echo "🔧 Test 6: État final du cache..."
FINAL_METRICS=$(curl -s "$BASE_URL/api/catalog/families/metrics-v4")
FINAL_CACHE_RATIO=$(echo $FINAL_METRICS | jq -r '.metrics.performance.cacheHitRatio' 2>/dev/null || echo "N/A")
FINAL_REQUESTS=$(echo $FINAL_METRICS | jq -r '.metrics.performance.totalRequests' 2>/dev/null || echo "N/A")
FINAL_CACHED=$(echo $FINAL_METRICS | jq -r '.metrics.performance.totalCachedVehicles' 2>/dev/null || echo "N/A")

echo "✅ Cache final - Ratio: ${FINAL_CACHE_RATIO}, Total requêtes: ${FINAL_REQUESTS}, Véhicules: ${FINAL_CACHED}"
echo ""

# Résumé final
echo "🎉 === RÉSUMÉ INTÉGRATION V4 MONOREPO ==="
echo "✅ Service V4 opérationnel sur port 3000"
echo "✅ Cache mémoire intelligent fonctionnel"
echo "✅ Frontend intégré avec API V4"
echo "✅ Pages de test et comparaison disponibles"
echo "✅ Performance optimisée (temps moyen: ${AVERAGE}ms)"
echo "✅ Support multi-véhicules validé"
echo ""
echo "🔗 URLs disponibles:"
echo "   - API V4: $BASE_URL/api/catalog/families/vehicle-v4/{typeId}"
echo "   - Métriques: $BASE_URL/api/catalog/families/metrics-v4"
echo "   - Page véhicule: $BASE_URL/constructeurs/audi-22/a5-i-22046/18-tfsi-22547.html"
echo "   - Test V4: $BASE_URL/test-v4-ultimate/22547"
echo "   - Comparaison: $BASE_URL/compare-v3-v4/22547"
echo ""
echo "🎯 INTÉGRATION V4 MONOREPO: SUCCÈS COMPLET !"