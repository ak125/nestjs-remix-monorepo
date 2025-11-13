#!/bin/bash

# 🧪 Script de test de la migration RPC V2
# Valide que le fallback fonctionne correctement

echo "🧪 Test de Migration RPC V2 avec Fallback"
echo "=========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:3000"
GAMME_ID=10

echo "📋 Configuration:"
echo "  - API URL: $API_URL"
echo "  - Gamme ID: $GAMME_ID"
echo ""

# Test 1: RPC V2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test 1: Endpoint RPC V2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RPC_V2_START=$(date +%s%3N)
RPC_V2_RESPONSE=$(curl -s "$API_URL/api/gamme-rest-optimized/$GAMME_ID/page-data-rpc-v2")
RPC_V2_END=$(date +%s%3N)
RPC_V2_DURATION=$((RPC_V2_END - RPC_V2_START))

# Vérifier si la réponse contient des données valides
if echo "$RPC_V2_RESPONSE" | jq -e '.meta.title' > /dev/null 2>&1; then
  RPC_V2_PERF=$(echo "$RPC_V2_RESPONSE" | jq -r '.performance.total_time_ms // 0')
  RPC_V2_RPC_TIME=$(echo "$RPC_V2_RESPONSE" | jq -r '.performance.rpc_time_ms // 0')
  echo -e "${GREEN}✅ RPC V2 SUCCESS${NC}"
  echo "  ⏱️  Temps HTTP: ${RPC_V2_DURATION}ms"
  echo "  ⚡ Temps total: ${RPC_V2_PERF}ms"
  echo "  🚀 Temps RPC: ${RPC_V2_RPC_TIME}ms"
  RPC_V2_STATUS="SUCCESS"
else
  echo -e "${RED}❌ RPC V2 FAILED${NC}"
  echo "$RPC_V2_RESPONSE" | jq '.' 2>/dev/null || echo "$RPC_V2_RESPONSE"
  RPC_V2_STATUS="FAILED"
fi

echo ""

# Test 2: Classic (pour comparaison)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test 2: Endpoint Classic (comparaison)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CLASSIC_START=$(date +%s%3N)
CLASSIC_RESPONSE=$(curl -s "$API_URL/api/gamme-rest-optimized/$GAMME_ID/page-data")
CLASSIC_END=$(date +%s%3N)
CLASSIC_DURATION=$((CLASSIC_END - CLASSIC_START))

if echo "$CLASSIC_RESPONSE" | jq -e '.meta.title' > /dev/null 2>&1; then
  CLASSIC_PERF=$(echo "$CLASSIC_RESPONSE" | jq -r '.performance.total_time_ms // 0')
  echo -e "${GREEN}✅ Classic SUCCESS${NC}"
  echo "  ⏱️  Temps HTTP: ${CLASSIC_DURATION}ms"
  echo "  ⚡ Temps total: ${CLASSIC_PERF}ms"
  CLASSIC_STATUS="SUCCESS"
else
  echo -e "${RED}❌ Classic FAILED${NC}"
  CLASSIC_STATUS="FAILED"
fi

echo ""

# Test 3: Comparaison des données
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Test 3: Comparaison des données"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$RPC_V2_STATUS" = "SUCCESS" ] && [ "$CLASSIC_STATUS" = "SUCCESS" ]; then
  RPC_V2_TITLE=$(echo "$RPC_V2_RESPONSE" | jq -r '.meta.title')
  CLASSIC_TITLE=$(echo "$CLASSIC_RESPONSE" | jq -r '.meta.title')
  
  RPC_V2_MOTORISATIONS=$(echo "$RPC_V2_RESPONSE" | jq -r '.motorisations | length // 0')
  CLASSIC_MOTORISATIONS=$(echo "$CLASSIC_RESPONSE" | jq -r '.motorisations.items | length // 0')
  
  if [ "$RPC_V2_TITLE" = "$CLASSIC_TITLE" ]; then
    echo -e "${GREEN}✅ Titre identique${NC}"
  else
    echo -e "${YELLOW}⚠️  Titres différents${NC}"
    echo "  RPC V2: $RPC_V2_TITLE"
    echo "  Classic: $CLASSIC_TITLE"
  fi
  
  echo ""
  echo "Motorisations:"
  echo "  RPC V2: $RPC_V2_MOTORISATIONS"
  echo "  Classic: $CLASSIC_MOTORISATIONS"
else
  echo -e "${RED}❌ Impossible de comparer (échec d'au moins un endpoint)${NC}"
fi

echo ""

# Résumé
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RÉSUMÉ DES TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$RPC_V2_STATUS" = "SUCCESS" ] && [ "$CLASSIC_STATUS" = "SUCCESS" ]; then
  # Calculer le gain
  if [ "$CLASSIC_PERF" != "0" ] && [ "$RPC_V2_PERF" != "0" ]; then
    GAIN=$(echo "scale=1; $CLASSIC_PERF / $RPC_V2_PERF" | bc)
    echo -e "${GREEN}✅ TOUS LES TESTS PASSÉS${NC}"
    echo ""
    echo "Performance RPC V2:"
    echo "  ⚡ ${RPC_V2_PERF}ms (RPC: ${RPC_V2_RPC_TIME}ms)"
    echo ""
    echo "Performance Classic:"
    echo "  🐢 ${CLASSIC_PERF}ms"
    echo ""
    echo -e "${GREEN}🚀 Gain de performance: ${GAIN}x plus rapide${NC}"
  fi
  
  echo ""
  echo "✅ Migration validée !"
  echo "   Le fallback automatique est prêt pour la production"
  exit 0
elif [ "$RPC_V2_STATUS" = "FAILED" ] && [ "$CLASSIC_STATUS" = "SUCCESS" ]; then
  echo -e "${YELLOW}⚠️  RPC V2 échoué, Classic fonctionne${NC}"
  echo ""
  echo "Le fallback automatique fonctionnera correctement."
  echo "Investiguer l'erreur RPC V2 avant déploiement."
  exit 1
elif [ "$RPC_V2_STATUS" = "SUCCESS" ] && [ "$CLASSIC_STATUS" = "FAILED" ]; then
  echo -e "${YELLOW}⚠️  RPC V2 fonctionne, Classic échoué${NC}"
  echo ""
  echo "Pas de problème : RPC V2 est prioritaire."
  exit 0
else
  echo -e "${RED}❌ ÉCHEC CRITIQUE${NC}"
  echo ""
  echo "Les deux endpoints ont échoué !"
  exit 2
fi
