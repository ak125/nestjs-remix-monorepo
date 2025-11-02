#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔍 AUDIT CRAWL BUDGET - Script CLI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Compare les URLs générées par l'app avec les données réelles
# de Google Search Console et Google Analytics 4.
#
# Usage:
#   ./scripts/audit-crawl-budget.sh [options]
#
# Options:
#   --gammes "1234,5678"    Limiter à certaines gammes (pg_id)
#   --sample 500            Nombre d'URLs à auditer (défaut: 1000)
#   --domain com            Domaine de référence: com ou fr (défaut: com)
#   --output /tmp           Dossier de sortie CSV (défaut: /tmp)
#
# Exemples:
#   # Audit complet (1000 URLs, domaine .com)
#   ./scripts/audit-crawl-budget.sh
#
#   # Audit gammes spécifiques en .fr
#   ./scripts/audit-crawl-budget.sh --gammes "1234,5678" --domain fr
#
#   # Audit large (5000 URLs)
#   ./scripts/audit-crawl-budget.sh --sample 5000
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration par défaut
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
SAMPLE_SIZE=1000
DOMAIN="com"
OUTPUT_DIR="/tmp"
GAMMES=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --gammes)
      GAMMES="$2"
      shift 2
      ;;
    --sample)
      SAMPLE_SIZE="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}❌ Option inconnue: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 Audit Crawl Budget - URLs App vs GSC vs GA4${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Préparer le body JSON
BODY="{\"sampleSize\": $SAMPLE_SIZE, \"domain\": \"$DOMAIN\""

if [ -n "$GAMMES" ]; then
  # Convertir "1234,5678" en [1234, 5678]
  IFS=',' read -ra GAMME_ARRAY <<< "$GAMMES"
  GAMME_IDS=$(printf '%s\n' "${GAMME_ARRAY[@]}" | jq -R . | jq -s .)
  BODY="$BODY, \"gammeIds\": $GAMME_IDS"
fi

BODY="$BODY}"

echo -e "${YELLOW}⚙️  Configuration:${NC}"
echo "   Backend: $BACKEND_URL"
echo "   Sample size: $SAMPLE_SIZE URLs"
echo "   Domaine: .$DOMAIN"
if [ -n "$GAMMES" ]; then
  echo "   Gammes: $GAMMES"
fi
echo "   Output: $OUTPUT_DIR"
echo ""

# Vérifier que le backend est accessible
echo -e "${YELLOW}📡 Vérification connexion backend...${NC}"
if ! curl -sf "$BACKEND_URL/seo-logs/crawl-budget/stats" > /dev/null 2>&1; then
  echo -e "${RED}❌ Backend inaccessible à $BACKEND_URL${NC}"
  echo -e "${YELLOW}💡 Assurez-vous que le backend est démarré:${NC}"
  echo "   cd backend && npm run dev"
  exit 1
fi
echo -e "${GREEN}✅ Backend accessible${NC}"
echo ""

# Lancer l'audit
echo -e "${YELLOW}🔍 Lancement de l'audit...${NC}"
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_JSON="$OUTPUT_DIR/audit-$TIMESTAMP.json"
OUTPUT_REPORT="$OUTPUT_DIR/audit-report-$TIMESTAMP.txt"

# Appeler l'API
RESPONSE=$(curl -s -X POST "$BACKEND_URL/seo-logs/crawl-budget/audit" \
  -H "Content-Type: application/json" \
  -d "$BODY")

# Vérifier le statut
if ! echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${RED}❌ Erreur lors de l'audit${NC}"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

# Sauvegarder le JSON brut
echo "$RESPONSE" | jq '.' > "$OUTPUT_JSON"
echo -e "${GREEN}✅ Résultats sauvegardés: $OUTPUT_JSON${NC}"
echo ""

# Extraire les données clés
TOTAL_URLS=$(echo "$RESPONSE" | jq -r '.data.app_urls.total')
PERFECT_MATCH=$(echo "$RESPONSE" | jq -r '.data.comparison.perfect_match | length')
APP_ONLY=$(echo "$RESPONSE" | jq -r '.data.comparison.app_only | length')
GSC_ONLY=$(echo "$RESPONSE" | jq -r '.data.comparison.gsc_only | length')
DOMAIN_MISMATCH=$(echo "$RESPONSE" | jq -r '.data.comparison.domain_mismatch | length')

# Générer rapport texte
{
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔍 RAPPORT D'AUDIT CRAWL BUDGET"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Domaine: .$DOMAIN"
  if [ -n "$GAMMES" ]; then
    echo "Gammes: $GAMMES"
  fi
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 STATISTIQUES"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "URLs générées par l'app:     $TOTAL_URLS"
  echo "URLs crawlées par GSC:       $(echo "$RESPONSE" | jq -r '.data.gsc_urls.total')"
  echo "Top pages GA4:               $(echo "$RESPONSE" | jq -r '.data.ga4_urls.top_pages | length')"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔀 COMPARAISON CROISÉE"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "✅ Perfect match (app + GSC + GA4):  $PERFECT_MATCH URLs"
  echo "📤 Uniquement dans app:              $APP_ONLY URLs"
  echo "📥 Uniquement dans GSC:              $GSC_ONLY URLs"
  echo "⚠️  Mauvais domaine (.com vs .fr):   $DOMAIN_MISMATCH URLs"
  echo ""
  
  # Taux de matching
  if [ "$TOTAL_URLS" -gt 0 ]; then
    MATCH_RATE=$(echo "scale=1; $PERFECT_MATCH * 100 / $TOTAL_URLS" | bc)
    echo "Taux de matching: $MATCH_RATE%"
  fi
  echo ""
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "💡 RECOMMANDATIONS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  # Afficher recommandations
  echo "$RESPONSE" | jq -r '.data.recommendations[]' | while read -r line; do
    echo "  $line"
  done
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📁 FICHIERS GÉNÉRÉS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "JSON complet: $OUTPUT_JSON"
  echo "Rapport texte: $OUTPUT_REPORT"
  echo ""
  
  # Top 10 URLs app uniquement
  if [ "$APP_ONLY" -gt 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📤 TOP 10 URLs app non crawlées"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "$RESPONSE" | jq -r '.data.comparison.app_only[:10][]'
    echo ""
  fi
  
  # Top 10 URLs GSC uniquement
  if [ "$GSC_ONLY" -gt 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📥 TOP 10 URLs GSC orphelines"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "$RESPONSE" | jq -r '.data.comparison.gsc_only[:10][]'
    echo ""
  fi
  
} | tee "$OUTPUT_REPORT"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Audit terminé avec succès !${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💡 Prochaines étapes:${NC}"
echo ""
echo "   1. Analyser les URLs app_only (non crawlées par Google)"
echo "      cat $OUTPUT_JSON | jq '.data.comparison.app_only'"
echo ""
echo "   2. Vérifier les URLs GSC_only (orphelines)"
echo "      cat $OUTPUT_JSON | jq '.data.comparison.gsc_only'"
echo ""
echo "   3. Créer expérience A/B basée sur ces résultats"
echo "      curl -X POST $BACKEND_URL/seo-logs/crawl-budget/experiments -d {...}"
echo ""

# Résumé coloré
MATCH_RATE=$(echo "scale=1; $PERFECT_MATCH * 100 / $TOTAL_URLS" | bc 2>/dev/null || echo "0")

if (( $(echo "$MATCH_RATE >= 80" | bc -l) )); then
  echo -e "${GREEN}✅ Excellent: $MATCH_RATE% de matching${NC}"
elif (( $(echo "$MATCH_RATE >= 50" | bc -l) )); then
  echo -e "${YELLOW}⚠️  À améliorer: $MATCH_RATE% de matching${NC}"
else
  echo -e "${RED}🚨 Critique: $MATCH_RATE% de matching${NC}"
fi
echo ""
