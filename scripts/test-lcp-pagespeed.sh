#!/bin/bash
# 🚀 LCP Performance Test via PageSpeed Insights API
# Fonctionne sur serveur sans Chrome - utilise l'API Google
# Usage: ./test-lcp-pagespeed.sh [url]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default URL
DEFAULT_URL="https://www.automecanik.com/pieces/radiateur-de-chauffage-467/renault-140/symbol-ii-140093/1-2-16v-9292.html"
URL="${1:-$DEFAULT_URL}"

# Output
OUTPUT_DIR="/opt/automecanik/app/scripts/pagespeed-reports"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$OUTPUT_DIR/pagespeed-$TIMESTAMP.json"

echo -e "${BLUE}🔍 PageSpeed Insights - LCP Test${NC}"
echo -e "URL: ${YELLOW}$URL${NC}"
echo ""
echo -e "${CYAN}⏳ Analyse en cours (30-60 secondes)...${NC}"
echo ""

# Clé API optionnelle (pour quota illimité)
# Créer une clé sur: https://console.cloud.google.com/apis/credentials
# puis: export PAGESPEED_API_KEY="votre-clé"
API_KEY="${PAGESPEED_API_KEY:-}"

# Appel API PageSpeed Insights (mobile)
API_URL="https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=$(echo "$URL" | jq -sRr @uri)&strategy=mobile&category=performance"
if [ -n "$API_KEY" ]; then
  API_URL="${API_URL}&key=${API_KEY}"
fi

# Fetch avec timeout
RESPONSE=$(curl -s --max-time 120 "$API_URL")

# Sauvegarder le rapport complet
echo "$RESPONSE" > "$REPORT_FILE"

# Vérifier si la réponse est valide
if ! echo "$RESPONSE" | jq -e '.lighthouseResult' > /dev/null 2>&1; then
  echo -e "${RED}❌ Erreur API PageSpeed${NC}"
  echo "$RESPONSE" | jq '.error' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

# Extraire les métriques
echo -e "${BLUE}📊 Core Web Vitals (Mobile):${NC}"
echo "─────────────────────────────────────────"

# LCP
LCP=$(echo "$RESPONSE" | jq -r '.lighthouseResult.audits["largest-contentful-paint"].numericValue // 0')
LCP_DISPLAY=$(echo "$RESPONSE" | jq -r '.lighthouseResult.audits["largest-contentful-paint"].displayValue // "N/A"')
LCP_SEC=$(echo "scale=2; $LCP / 1000" | bc)

if (( $(echo "$LCP < 2500" | bc -l) )); then
  echo -e "LCP:  ${GREEN}${LCP_DISPLAY} (${LCP_SEC}s)${NC} ✅ Good < 2.5s"
elif (( $(echo "$LCP < 4000" | bc -l) )); then
  echo -e "LCP:  ${YELLOW}${LCP_DISPLAY} (${LCP_SEC}s)${NC} ⚠️  Needs Improvement < 4s"
else
  echo -e "LCP:  ${RED}${LCP_DISPLAY} (${LCP_SEC}s)${NC} ❌ Poor > 4s"
fi

# FCP
FCP=$(echo "$RESPONSE" | jq -r '.lighthouseResult.audits["first-contentful-paint"].displayValue // "N/A"')
echo -e "FCP:  $FCP"

# TTFB
TTFB=$(echo "$RESPONSE" | jq -r '.lighthouseResult.audits["server-response-time"].displayValue // "N/A"')
echo -e "TTFB: $TTFB"

# Speed Index
SI=$(echo "$RESPONSE" | jq -r '.lighthouseResult.audits["speed-index"].displayValue // "N/A"')
echo -e "SI:   $SI"

# TBT
TBT=$(echo "$RESPONSE" | jq -r '.lighthouseResult.audits["total-blocking-time"].displayValue // "N/A"')
echo -e "TBT:  $TBT"

# CLS
CLS=$(echo "$RESPONSE" | jq -r '.lighthouseResult.audits["cumulative-layout-shift"].displayValue // "N/A"')
echo -e "CLS:  $CLS"

# Performance Score
SCORE=$(echo "$RESPONSE" | jq -r '.lighthouseResult.categories.performance.score // 0')
SCORE_PERCENT=$(echo "$SCORE * 100" | bc | cut -d'.' -f1)

echo "─────────────────────────────────────────"
if (( SCORE_PERCENT >= 90 )); then
  echo -e "Score: ${GREEN}${SCORE_PERCENT}%${NC} ✅ Good"
elif (( SCORE_PERCENT >= 50 )); then
  echo -e "Score: ${YELLOW}${SCORE_PERCENT}%${NC} ⚠️  Needs Improvement"
else
  echo -e "Score: ${RED}${SCORE_PERCENT}%${NC} ❌ Poor"
fi

# LCP Element
echo ""
echo -e "${BLUE}🎯 LCP Element:${NC}"
LCP_ELEMENT=$(echo "$RESPONSE" | jq -r '.lighthouseResult.audits["largest-contentful-paint-element"].details.items[0].node.snippet // "N/A"' 2>/dev/null)
echo "$LCP_ELEMENT" | head -c 300
echo ""

# Opportunités d'amélioration
echo ""
echo -e "${BLUE}💡 Top Opportunités:${NC}"
echo "$RESPONSE" | jq -r '
  .lighthouseResult.audits | to_entries[] |
  select(.value.details.overallSavingsMs > 100) |
  "• \(.value.title): -\(.value.details.overallSavingsMs)ms"
' 2>/dev/null | head -5

echo ""
echo -e "${GREEN}✅ Rapport sauvegardé:${NC} $REPORT_FILE"
echo ""
echo -e "${CYAN}🔗 Voir en ligne:${NC}"
echo "https://pagespeed.web.dev/analysis?url=$(echo "$URL" | jq -sRr @uri)"
