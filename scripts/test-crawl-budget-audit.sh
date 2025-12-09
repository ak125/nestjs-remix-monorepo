#!/bin/bash

# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# ðŸ” SCRIPT TEST AUDIT CRAWL BUDGET
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# 
# Objectif : VÃ©rifier la cohÃ©rence entre :
# - URLs gÃ©nÃ©rÃ©es par l'app
# - URLs crawlÃ©es par Google Search Console
# - Top pages dans Google Analytics
#
# âš ï¸ Prend en compte .com (production) vs .fr (dev/test)
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

set -e  # ArrÃªter en cas d'erreur

BASE_URL="http://localhost:3000"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo -e "${BLUE}ðŸ” Test Audit Crawl Budget - URLs .com vs .fr${NC}"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# Test 1 : Audit de cohÃ©rence URLs (.com)
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
echo -e "${YELLOW}[1/5] Audit cohÃ©rence URLs production (.com)...${NC}"
RESPONSE=$(curl -s "${BASE_URL}/seo-logs/crawl-budget/audit/consistency?domain=com&sampleSize=100")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}âœ… Audit .com OK${NC}"
  
  # Extraire mÃ©triques clÃ©s
  APP_URLS=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*')
  GSC_URLS=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | tail -1 | grep -o '[0-9]*')
  PERFECT_MATCH=$(echo "$RESPONSE" | grep -o '"perfect_match":\[[^]]*\]' | grep -o ',' | wc -l)
  
  echo "  ðŸ“Š URLs app: $APP_URLS"
  echo "  ðŸ“Š URLs GSC: $GSC_URLS"
  echo "  ðŸ“Š Perfect match: $PERFECT_MATCH"
  echo ""
  echo "$RESPONSE" | jq '.'
else
  echo -e "${RED}âŒ Erreur audit .com${NC}"
  echo "$RESPONSE"
  exit 1
fi
echo ""

# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# Test 2 : Audit de cohÃ©rence URLs (.fr)
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
echo -e "${YELLOW}[2/5] Audit cohÃ©rence URLs dev/test (.fr)...${NC}"
RESPONSE=$(curl -s "${BASE_URL}/seo-logs/crawl-budget/audit/consistency?domain=fr&sampleSize=100")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}âœ… Audit .fr OK${NC}"
  echo "$RESPONSE" | jq '.data.comparison' 2>/dev/null || echo "$RESPONSE"
else
  echo -e "${RED}âŒ Erreur audit .fr${NC}"
  echo "$RESPONSE"
fi
echo ""

# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# Test 3 : Rapport domaine (.com vs .fr)
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
echo -e "${YELLOW}[3/5] Rapport cohÃ©rence domaines...${NC}"
RESPONSE=$(curl -s "${BASE_URL}/seo-logs/crawl-budget/audit/domain-report")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}âœ… Rapport domaine OK${NC}"
  
  # Afficher recommandations
  echo -e "${BLUE}ðŸ“‹ Recommandations :${NC}"
  echo "$RESPONSE" | jq '.data.recommendations[]' 2>/dev/null || echo "Aucune recommandation"
  
  echo ""
  echo "$RESPONSE" | jq '.data' 2>/dev/null || echo "$RESPONSE"
else
  echo -e "${RED}âŒ Erreur rapport domaine${NC}"
  echo "$RESPONSE"
fi
echo ""

# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# Test 4 : Top gammes par sessions
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
echo -e "${YELLOW}[4/5] Top gammes par sessions...${NC}"
RESPONSE=$(curl -s "${BASE_URL}/seo-logs/crawl-budget/audit/top-gammes?metric=sessions&limit=5")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}âœ… Top gammes OK${NC}"
  
  echo -e "${BLUE}ðŸ“Š Top 5 gammes par trafic organique :${NC}"
  echo "$RESPONSE" | jq '.data.results[] | "- \(.gamme_name) (\(.gamme_id)): \(.sessions_30d) sessions â†’ \(.recommendation)"' 2>/dev/null || echo "$RESPONSE"
else
  echo -e "${RED}âŒ Erreur top gammes${NC}"
  echo "$RESPONSE"
fi
echo ""

# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# Test 5 : Audit gamme spÃ©cifique (exemple: 1234)
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
echo -e "${YELLOW}[5/5] Audit gamme spÃ©cifique (ID: 1234)...${NC}"
RESPONSE=$(curl -s "${BASE_URL}/seo-logs/crawl-budget/audit/gamme/1234")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}âœ… Audit gamme OK${NC}"
  
  echo -e "${BLUE}ðŸ“Š DÃ©tails gamme 1234 :${NC}"
  echo "$RESPONSE" | jq '.data' 2>/dev/null || echo "$RESPONSE"
  
  # Afficher recommandations spÃ©cifiques
  echo ""
  echo -e "${BLUE}ðŸ’¡ Recommandations :${NC}"
  echo "$RESPONSE" | jq '.data.recommendations[]' 2>/dev/null || echo "Aucune recommandation"
else
  echo -e "${RED}âŒ Erreur audit gamme${NC}"
  echo "$RESPONSE"
fi
echo ""

# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# RÃ©sumÃ©
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo -e "${GREEN}ðŸŽ‰ Tous les tests d'audit sont terminÃ©s !${NC}"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
echo -e "${BLUE}ðŸ“‹ InterprÃ©tation des rÃ©sultats :${NC}"
echo ""
echo "1. ${GREEN}Perfect match${NC} : URLs prÃ©sentes dans App + GSC + GA4"
echo "   â†’ Ces URLs sont bien indexÃ©es et gÃ©nÃ¨rent du trafic"
echo ""
echo "2. ${YELLOW}App only${NC} : URLs gÃ©nÃ©rÃ©es mais jamais crawlÃ©es"
echo "   â†’ Soumettre sitemap ou attendre crawl naturel"
echo ""
echo "3. ${YELLOW}GSC only${NC} : URLs dans GSC mais pas dans App"
echo "   â†’ Anciennes URLs, erreurs 404, ou contenu supprimÃ©"
echo ""
echo "4. ${RED}Domain mismatch${NC} : URLs avec .com au lieu de .fr (ou inverse)"
echo "   â†’ Mettre en place redirections 301"
echo ""
echo -e "${BLUE}ðŸš€ Prochaines Ã©tapes :${NC}"
echo "1. Analyser les recommandations ci-dessus"
echo "2. Identifier gammes candidates pour exclusion (crawl_rate < 30%)"
echo "3. Identifier gammes prioritaires pour inclusion (sessions > 1000)"
echo "4. CrÃ©er expÃ©riences A/B basÃ©es sur ces insights"
echo ""
echo "ðŸ’¡ Commande pour crÃ©er une expÃ©rience :"
echo "   curl -X POST ${BASE_URL}/seo-logs/crawl-budget/experiments \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"name\": \"Test\", \"action\": \"exclude\", \"targetFamilies\": [\"1234\"]}'"
echo ""
