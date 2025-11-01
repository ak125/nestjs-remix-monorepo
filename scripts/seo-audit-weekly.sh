#!/bin/bash

###############################################################################
# 🔍 SEO Weekly Audit - Validation Sitemap & Détection d'incohérences
#
# Ce script effectue un audit hebdomadaire automatique pour détecter :
# - Validation XSD du sitemap XML
# - URLs avec noindex présentes dans le sitemap
# - URLs retournant 4xx/5xx
# - Hreflang non réciproques
# - Canoniques divergents
#
# Usage: ./scripts/seo-audit-weekly.sh
# Cron:  0 3 * * 1 /path/to/seo-audit-weekly.sh >> /var/log/seo-audit.log 2>&1
###############################################################################

set -eo pipefail  # Removed -u to allow unset variables

#!/bin/bash
set -eo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SEO WEEKLY AUDIT SCRIPT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ─────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────
# 🔧 PRODUCTION: Remplacer .fr par .com lors du déploiement en production
SITEMAP_URL="${SITEMAP_URL:-https://automecanik.fr/sitemap.xml}"
BASE_URL="${BASE_URL:-https://automecanik.fr}"
LOKI_URL="${LOKI_URL:-http://loki:3100}"
MEILISEARCH_HOST="${MEILISEARCH_HOST:-http://localhost:7700}"
MEILISEARCH_API_KEY="${MEILISEARCH_API_KEY:-}"  # Optionnel
OUTPUT_DIR="${OUTPUT_DIR:-/tmp/seo-audit-$(date +%Y%m%d)}"
WEBHOOK_URL="${SEO_AUDIT_WEBHOOK_URL:-}"  # Slack/Teams webhook pour alertes

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compteurs
TOTAL_ERRORS=0
TOTAL_WARNINGS=0

# Créer le répertoire de sortie
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 SEO WEEKLY AUDIT - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

###############################################################################
# 1. VALIDATION XSD DU SITEMAP
###############################################################################

echo -e "${BLUE}📋 [1/5] Validation XSD du sitemap...${NC}"

# Télécharger le sitemap
SITEMAP_FILE="$OUTPUT_DIR/sitemap.xml"
curl -s "$SITEMAP_URL" -o "$SITEMAP_FILE"

if [ ! -s "$SITEMAP_FILE" ]; then
  echo -e "${RED}❌ ERREUR: Impossible de télécharger le sitemap${NC}"
  ((TOTAL_ERRORS++))
else
  # Détecter si c'est un sitemap index ou un sitemap standard
  if grep -q "<sitemapindex" "$SITEMAP_FILE"; then
    echo -e "${BLUE}📑 Sitemap Index détecté${NC}"
    
    # Extraire les URLs de tous les sitemaps enfants
    SITEMAP_URLS=$(grep -oP '(?<=<loc>)[^<]+' "$SITEMAP_FILE")
    > "$OUTPUT_DIR/sitemap-urls.txt"
    
    CHILD_ERRORS=0
    for CHILD_SITEMAP in $SITEMAP_URLS; do
      # 🔧 PRODUCTION: Supprimer cette ligne de remplacement .com → .fr en production
      CHILD_SITEMAP_ADJUSTED="${CHILD_SITEMAP/automecanik.com/automecanik.fr}"
      
      echo -e "${BLUE}📥 Téléchargement: $CHILD_SITEMAP_ADJUSTED${NC}"
      CHILD_FILE="$OUTPUT_DIR/sitemap-child-$(basename $CHILD_SITEMAP_ADJUSTED)"
      
      # Télécharger avec vérification du code HTTP
      HTTP_CODE=$(curl -s -w "%{http_code}" -o "$CHILD_FILE" "$CHILD_SITEMAP_ADJUSTED")
      
      if [ "$HTTP_CODE" != "200" ]; then
        echo -e "${RED}❌ Erreur HTTP $HTTP_CODE pour $CHILD_SITEMAP_ADJUSTED${NC}"
        ((CHILD_ERRORS++))
        continue
      fi
      
      # Vérifier que ce n'est pas une page d'erreur HTML
      if grep -q "<html" "$CHILD_FILE" || grep -q "404 Not Found" "$CHILD_FILE"; then
        echo -e "${YELLOW}⚠️  Page d'erreur reçue pour $CHILD_SITEMAP_ADJUSTED${NC}"
        ((CHILD_ERRORS++))
        continue
      fi
      
      # Extraire les URLs de ce sitemap enfant
      CHILD_URL_COUNT=$(grep -oP '(?<=<loc>)[^<]+' "$CHILD_FILE" | tee -a "$OUTPUT_DIR/sitemap-urls.txt" | wc -l)
      echo -e "${GREEN}  ✓ $CHILD_URL_COUNT URLs extraites${NC}"
    done
    
    TOTAL_URLS=$(wc -l < "$OUTPUT_DIR/sitemap-urls.txt")
    
    if [ $CHILD_ERRORS -gt 0 ]; then
      echo -e "${YELLOW}⚠️  Sitemap Index traité avec $CHILD_ERRORS erreurs: $TOTAL_URLS URLs extraites${NC}"
      ((TOTAL_WARNINGS++))
    else
      echo -e "${GREEN}✅ Sitemap Index traité: $TOTAL_URLS URLs extraites${NC}"
    fi
    
  else
    echo -e "${BLUE}📄 Sitemap standard détecté${NC}"
    
    # Validation XSD pour sitemap standard
    XSD_FILE="$OUTPUT_DIR/sitemap.xsd"
    curl -s "https://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd" -o "$XSD_FILE"
    
    if command -v xmllint &> /dev/null; then
      if xmllint --noout --schema "$XSD_FILE" "$SITEMAP_FILE" 2>&1 | tee "$OUTPUT_DIR/xsd-validation.log"; then
        echo -e "${GREEN}✅ Sitemap valide selon XSD${NC}"
      else
        echo -e "${YELLOW}⚠️  Validation XSD échouée (voir $OUTPUT_DIR/xsd-validation.log)${NC}"
        ((TOTAL_WARNINGS++))
      fi
    else
      echo -e "${YELLOW}⚠️  xmllint non disponible, validation XSD ignorée${NC}"
      ((TOTAL_WARNINGS++))
    fi
    
    # Extraire les URLs
    grep -oP '(?<=<loc>)[^<]+' "$SITEMAP_FILE" > "$OUTPUT_DIR/sitemap-urls.txt"
    TOTAL_URLS=$(wc -l < "$OUTPUT_DIR/sitemap-urls.txt")
    echo -e "${BLUE}📊 Total URLs dans sitemap: $TOTAL_URLS${NC}"
  fi
fi

echo ""

###############################################################################
# 2. DÉTECTION URLs NOINDEX
###############################################################################

echo -e "${BLUE}🚫 [2/5] Détection URLs noindex présentes dans sitemap...${NC}"

NOINDEX_FILE="$OUTPUT_DIR/noindex-urls.txt"
> "$NOINDEX_FILE"  # Reset file

# Échantillonner 100 URLs aléatoires (audit complet trop long)
SAMPLE_SIZE=100
shuf -n "$SAMPLE_SIZE" "$OUTPUT_DIR/sitemap-urls.txt" > "$OUTPUT_DIR/sample-urls.txt"

echo "Analyse de $SAMPLE_SIZE URLs échantillonnées..."
NOINDEX_COUNT=0

while IFS= read -r url; do
  # Récupérer les meta tags
  RESPONSE=$(curl -s -L -A "SEO-Audit-Bot/1.0" "$url" | grep -i "noindex" || true)
  
  if [ -n "$RESPONSE" ]; then
    echo "$url" >> "$NOINDEX_FILE"
    echo -e "${RED}❌ NOINDEX trouvé: $url${NC}"
    ((NOINDEX_COUNT++))
    ((TOTAL_ERRORS++))
  fi
done < "$OUTPUT_DIR/sample-urls.txt"

if [ "$NOINDEX_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ Aucune URL noindex détectée dans l'échantillon${NC}"
else
  echo -e "${RED}❌ $NOINDEX_COUNT URLs avec noindex trouvées (voir $NOINDEX_FILE)${NC}"
  echo -e "${YELLOW}💡 Action: Retirer ces URLs du sitemap ou enlever noindex${NC}"
fi

echo ""

###############################################################################
# 3. DÉTECTION URLs 4xx/5xx
###############################################################################

echo -e "${BLUE}🔴 [3/5] Détection URLs retournant 4xx/5xx...${NC}"

ERROR_URLS_FILE="$OUTPUT_DIR/error-urls.txt"
> "$ERROR_URLS_FILE"

# Vérifier les erreurs dans Loki (7 derniers jours)
LOGQL_QUERY='count by (path, status) (count_over_time({job="caddy-access"} | json | status >= 400 [7d]))'

if command -v curl &> /dev/null && [ -n "$LOKI_URL" ]; then
  LOKI_RESPONSE=$(curl -s -G "$LOKI_URL/loki/api/v1/query" \
    --data-urlencode "query=$LOGQL_QUERY" \
    --data-urlencode "time=$(date +%s)" || echo '{"data":{"result":[]}}')
  
  ERROR_COUNT=$(echo "$LOKI_RESPONSE" | jq -r '.data.result | length' 2>/dev/null || echo "0")
  
  if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "$LOKI_RESPONSE" | jq -r '.data.result[] | "\(.metric.status) \(.metric.path) (\(.value[1]) hits)"' > "$ERROR_URLS_FILE"
    echo -e "${RED}❌ $ERROR_COUNT URLs avec erreurs HTTP détectées:${NC}"
    head -10 "$ERROR_URLS_FILE"
    ((TOTAL_ERRORS += ERROR_COUNT))
  else
    echo -e "${GREEN}✅ Aucune erreur HTTP détectée dans les logs (7j)${NC}"
  fi
else
  # Fallback: tester l'échantillon directement
  echo "Test direct de l'échantillon..."
  ERROR_COUNT=0
  
  while IFS= read -r url; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "$url")
    
    if [ "$HTTP_CODE" -ge 400 ]; then
      echo "$HTTP_CODE $url" >> "$ERROR_URLS_FILE"
      echo -e "${RED}❌ $HTTP_CODE: $url${NC}"
      ((ERROR_COUNT++))
      ((TOTAL_ERRORS++))
    fi
  done < "$OUTPUT_DIR/sample-urls.txt"
  
  if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ Aucune erreur HTTP dans l'échantillon${NC}"
  fi
fi

echo ""

###############################################################################
# 4. VALIDATION HREFLANG RÉCIPROQUES
###############################################################################

echo -e "${BLUE}🌍 [4/5] Validation hreflang réciproques...${NC}"

HREFLANG_ERRORS_FILE="$OUTPUT_DIR/hreflang-errors.txt"
> "$HREFLANG_ERRORS_FILE"

# Échantillonner 50 URLs avec hreflang (URLs /fr/, /en/, /es/)
grep -E "/(fr|en|es|de|it)/" "$OUTPUT_DIR/sitemap-urls.txt" | head -50 > "$OUTPUT_DIR/hreflang-sample.txt" || true

HREFLANG_ERROR_COUNT=0

while IFS= read -r url; do
  # Extraire les hreflang de la page
  HREFLANG_LINKS=$(curl -s -L "$url" | grep -oP 'hreflang="[^"]+"\s+href="[^"]+"' || true)
  
  if [ -z "$HREFLANG_LINKS" ]; then
    continue
  fi
  
  # Vérifier la réciprocité
  while IFS= read -r link; do
    TARGET_LANG=$(echo "$link" | grep -oP 'hreflang="\K[^"]+')
    TARGET_URL=$(echo "$link" | grep -oP 'href="\K[^"]+')
    
    # Vérifier que l'URL cible pointe bien en retour
    REVERSE_CHECK=$(curl -s -L "$TARGET_URL" | grep -F "hreflang=\"$(basename $url)\"" || true)
    
    if [ -z "$REVERSE_CHECK" ]; then
      echo "$url -> $TARGET_URL ($TARGET_LANG) NON RÉCIPROQUE" >> "$HREFLANG_ERRORS_FILE"
      echo -e "${YELLOW}⚠️  Hreflang non réciproque: $url -> $TARGET_URL${NC}"
      ((HREFLANG_ERROR_COUNT++))
      ((TOTAL_WARNINGS++))
    fi
  done <<< "$HREFLANG_LINKS"
  
done < "$OUTPUT_DIR/hreflang-sample.txt"

if [ "$HREFLANG_ERROR_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ Tous les hreflang sont réciproques${NC}"
else
  echo -e "${YELLOW}⚠️  $HREFLANG_ERROR_COUNT erreurs hreflang trouvées (voir $HREFLANG_ERRORS_FILE)${NC}"
fi

echo ""

###############################################################################
# 5. VALIDATION CANONIQUES
###############################################################################

echo -e "${BLUE}🔗 [5/5] Validation canoniques divergents...${NC}"

CANONICAL_ERRORS_FILE="$OUTPUT_DIR/canonical-errors.txt"
> "$CANONICAL_ERRORS_FILE"

CANONICAL_ERROR_COUNT=0

while IFS= read -r url; do
  # Extraire le canonical
  CANONICAL=$(curl -s -L "$url" | grep -oP 'rel="canonical"\s+href="\K[^"]+' || true)
  
  if [ -z "$CANONICAL" ]; then
    # Pas de canonical = pas d'erreur (peut être volontaire)
    continue
  fi
  
  # Normaliser les URLs pour comparaison
  NORMALIZED_URL=$(echo "$url" | sed 's:/*$::')  # Retirer trailing slash
  NORMALIZED_CANONICAL=$(echo "$CANONICAL" | sed 's:/*$::')
  
  if [ "$NORMALIZED_URL" != "$NORMALIZED_CANONICAL" ]; then
    echo "$url -> $CANONICAL (DIVERGENT)" >> "$CANONICAL_ERRORS_FILE"
    echo -e "${YELLOW}⚠️  Canonical divergent: $url -> $CANONICAL${NC}"
    ((CANONICAL_ERROR_COUNT++))
    ((TOTAL_WARNINGS++))
  fi
done < "$OUTPUT_DIR/sample-urls.txt"

if [ "$CANONICAL_ERROR_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ Tous les canoniques sont cohérents${NC}"
else
  echo -e "${YELLOW}⚠️  $CANONICAL_ERROR_COUNT canoniques divergents (voir $CANONICAL_ERRORS_FILE)${NC}"
  echo -e "${BLUE}💡 Note: Peut être intentionnel (variantes produits, pagination)${NC}"
fi

echo ""

###############################################################################
# RAPPORT FINAL
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 RAPPORT FINAL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

REPORT_FILE="$OUTPUT_DIR/audit-report.json"

cat > "$REPORT_FILE" <<EOF
{
  "audit_date": "$(date -Iseconds)",
  "sitemap_url": "$SITEMAP_URL",
  "total_urls": $TOTAL_URLS,
  "sample_size": $SAMPLE_SIZE,
  "results": {
    "xsd_validation": "$([ -f "$OUTPUT_DIR/xsd-validation.log" ] && echo "valid" || echo "skipped")",
    "noindex_urls": $NOINDEX_COUNT,
    "http_errors": $ERROR_COUNT,
    "hreflang_errors": $HREFLANG_ERROR_COUNT,
    "canonical_divergent": $CANONICAL_ERROR_COUNT
  },
  "summary": {
    "total_errors": $TOTAL_ERRORS,
    "total_warnings": $TOTAL_WARNINGS,
    "status": "$([ $TOTAL_ERRORS -eq 0 ] && echo "PASS" || echo "FAIL")"
  },
  "output_dir": "$OUTPUT_DIR"
}
EOF

cat "$REPORT_FILE" | jq .

echo ""
echo -e "${BLUE}📁 Fichiers générés:${NC}"
echo "  - Rapport JSON: $REPORT_FILE"
echo "  - URLs sitemap: $OUTPUT_DIR/sitemap-urls.txt"
echo "  - URLs noindex: $NOINDEX_FILE"
echo "  - URLs erreurs: $ERROR_URLS_FILE"
echo "  - Erreurs hreflang: $HREFLANG_ERRORS_FILE"
echo "  - Canoniques divergents: $CANONICAL_ERRORS_FILE"

echo ""

# Statut final
if [ "$TOTAL_ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✅ AUDIT PASSED - Aucune erreur critique${NC}"
  EXIT_CODE=0
else
  echo -e "${RED}❌ AUDIT FAILED - $TOTAL_ERRORS erreur(s) critique(s)${NC}"
  EXIT_CODE=1
fi

if [ "$TOTAL_WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  $TOTAL_WARNINGS avertissement(s)${NC}"
fi

echo ""

###############################################################################
# WEBHOOK NOTIFICATION (optionnel)
###############################################################################

if [ -n "$WEBHOOK_URL" ]; then
  echo -e "${BLUE}📨 Envoi notification webhook...${NC}"
  
  STATUS_EMOJI=$([ $TOTAL_ERRORS -eq 0 ] && echo "✅" || echo "❌")
  
  WEBHOOK_PAYLOAD=$(cat <<EOF
{
  "text": "$STATUS_EMOJI SEO Weekly Audit - $(date '+%Y-%m-%d')",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*SEO Weekly Audit Report*\n\n*Status:* $([ $TOTAL_ERRORS -eq 0 ] && echo "PASS ✅" || echo "FAIL ❌")\n*Total URLs:* $TOTAL_URLS\n*Errors:* $TOTAL_ERRORS\n*Warnings:* $TOTAL_WARNINGS"
      }
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Noindex URLs:*\n$NOINDEX_COUNT"},
        {"type": "mrkdwn", "text": "*HTTP Errors:*\n$ERROR_COUNT"},
        {"type": "mrkdwn", "text": "*Hreflang Issues:*\n$HREFLANG_ERROR_COUNT"},
        {"type": "mrkdwn", "text": "*Canonical Divergent:*\n$CANONICAL_ERROR_COUNT"}
      ]
    }
  ]
}
EOF
)
  
  curl -X POST -H 'Content-type: application/json' \
    --data "$WEBHOOK_PAYLOAD" \
    "$WEBHOOK_URL" || echo "Webhook failed"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

exit $EXIT_CODE
