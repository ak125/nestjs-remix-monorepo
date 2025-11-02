#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧪 Script de test A/B Testing Crawl Budget
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test A/B Testing Crawl Budget"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 1: Stats globales
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[1/6]${NC} Test endpoint /stats..."
STATS_RESPONSE=$(curl -s "$BASE_URL/seo-logs/crawl-budget/stats")
STATS_SUCCESS=$(echo "$STATS_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$STATS_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✅ Stats endpoint OK${NC}"
  echo "$STATS_RESPONSE" | jq
else
  echo -e "${RED}❌ Stats endpoint failed${NC}"
  echo "$STATS_RESPONSE"
  exit 1
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 2: Créer une expérience
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[2/6]${NC} Création d'une expérience de test..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/seo-logs/crawl-budget/experiments" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test automatique - exclusion pneus anciens",
    "description": "Test créé par le script de validation",
    "action": "exclude",
    "targetFamilies": ["PNEU_VIEUX", "PNEU_OCCASION"],
    "durationDays": 7
  }')

CREATE_SUCCESS=$(echo "$CREATE_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")
EXPERIMENT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id' 2>/dev/null || echo "")

if [ "$CREATE_SUCCESS" = "true" ] && [ -n "$EXPERIMENT_ID" ]; then
  echo -e "${GREEN}✅ Expérience créée: $EXPERIMENT_ID${NC}"
  echo "$CREATE_RESPONSE" | jq '.data | {id, name, status, action}'
else
  echo -e "${RED}❌ Création expérience failed${NC}"
  echo "$CREATE_RESPONSE"
  exit 1
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 3: Récupérer l'expérience
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[3/6]${NC} Récupération de l'expérience..."
GET_RESPONSE=$(curl -s "$BASE_URL/seo-logs/crawl-budget/experiments/$EXPERIMENT_ID")
GET_SUCCESS=$(echo "$GET_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$GET_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✅ Expérience récupérée${NC}"
  echo "$GET_RESPONSE" | jq '.data | {id, name, status, target_families, baseline}'
else
  echo -e "${RED}❌ Récupération failed${NC}"
  echo "$GET_RESPONSE"
  exit 1
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 4: Télécharger sitemap filtré
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[4/6]${NC} Téléchargement du sitemap filtré..."
SITEMAP_RESPONSE=$(curl -s "$BASE_URL/seo-logs/crawl-budget/experiments/$EXPERIMENT_ID/sitemap.xml")

if echo "$SITEMAP_RESPONSE" | grep -q "<urlset"; then
  URL_COUNT=$(echo "$SITEMAP_RESPONSE" | grep -c "<loc>" || echo 0)
  echo -e "${GREEN}✅ Sitemap généré: $URL_COUNT URLs${NC}"
  echo "$SITEMAP_RESPONSE" | head -20
else
  echo -e "${RED}❌ Sitemap generation failed${NC}"
  echo "$SITEMAP_RESPONSE"
  exit 1
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 5: Activer l'expérience
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[5/6]${NC} Activation de l'expérience..."
ACTIVATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/seo-logs/crawl-budget/experiments/$EXPERIMENT_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "running"}')

ACTIVATE_SUCCESS=$(echo "$ACTIVATE_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")
NEW_STATUS=$(echo "$ACTIVATE_RESPONSE" | jq -r '.data.status' 2>/dev/null || echo "")

if [ "$ACTIVATE_SUCCESS" = "true" ] && [ "$NEW_STATUS" = "running" ]; then
  echo -e "${GREEN}✅ Expérience activée: status=$NEW_STATUS${NC}"
else
  echo -e "${RED}❌ Activation failed${NC}"
  echo "$ACTIVATE_RESPONSE"
  exit 1
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 6: Recommandations
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[6/6]${NC} Récupération des recommandations..."
RECO_RESPONSE=$(curl -s "$BASE_URL/seo-logs/crawl-budget/experiments/$EXPERIMENT_ID/recommendations")
RECO_SUCCESS=$(echo "$RECO_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$RECO_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✅ Recommandations récupérées${NC}"
  echo "$RECO_RESPONSE" | jq
else
  echo -e "${RED}❌ Recommandations failed${NC}"
  echo "$RECO_RESPONSE"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Tous les tests sont passés avec succès !${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Résumé:"
echo "  - Expérience ID: $EXPERIMENT_ID"
echo "  - Status: running"
echo "  - URLs dans sitemap: $URL_COUNT"
echo ""
echo "🚀 Prochaines étapes:"
echo "  1. Soumettre sitemap à Google Search Console"
echo "  2. Attendre 7-30 jours pour collecter données"
echo "  3. Analyser les recommandations"
echo ""
