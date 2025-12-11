#!/bin/bash

# ðŸ” Script de validation de cohÃ©rence URL â†” Breadcrumb
# Usage: ./validate-url-breadcrumb-coherence.sh <url>
# Exemple: ./validate-url-breadcrumb-coherence.sh https://site.com/pieces/freinage/bmw/serie-1/118d.html

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
URL="${1:-}"
TEMP_FILE=$(mktemp)
REPORT_DIR="./url-breadcrumb-coherence-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/coherence-check-$TIMESTAMP.json"

# CrÃ©er le rÃ©pertoire de rapports
mkdir -p "$REPORT_DIR"

# VÃ©rification des arguments
if [[ -z "$URL" ]]; then
  echo -e "${RED}âŒ URL manquante${NC}"
  echo "Usage: $0 <url>"
  echo "Exemple: $0 https://site.com/pieces/freinage/bmw/serie-1/118d.html"
  exit 1
fi

echo -e "${BLUE}${BOLD}ðŸ” Validation CohÃ©rence URL â†” Breadcrumb${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""
echo -e "ðŸŒ URL: ${YELLOW}$URL${NC}"
echo ""

# TÃ©lÃ©charger la page
echo -e "${BLUE}â¬‡ï¸  TÃ©lÃ©chargement de la page...${NC}"
if ! curl -s -L "$URL" -o "$TEMP_FILE"; then
  echo -e "${RED}âŒ Impossible de tÃ©lÃ©charger l'URL${NC}"
  rm -f "$TEMP_FILE"
  exit 1
fi

# Extraire le JSON-LD du breadcrumb
echo -e "${BLUE}ðŸ“Š Extraction du Schema.org BreadcrumbList...${NC}"
BREADCRUMB_JSON=$(grep -oP '(?<=<script type="application/ld\+json">).*?(?=</script>)' "$TEMP_FILE" | grep -m1 '"@type":"BreadcrumbList"' || echo "")

if [[ -z "$BREADCRUMB_JSON" ]]; then
  echo -e "${RED}âŒ Aucun BreadcrumbList trouvÃ© dans la page${NC}"
  rm -f "$TEMP_FILE"
  exit 1
fi

# Parser les Ã©lÃ©ments du breadcrumb
BREADCRUMB_ITEMS=$(echo "$BREADCRUMB_JSON" | jq -r '.itemListElement[] | "\(.position)|\(.name)|\(.item)"' 2>/dev/null || echo "")

if [[ -z "$BREADCRUMB_ITEMS" ]]; then
  echo -e "${RED}âŒ Impossible de parser le BreadcrumbList${NC}"
  rm -f "$TEMP_FILE"
  exit 1
fi

echo -e "${GREEN}âœ… BreadcrumbList trouvÃ©${NC}"
echo ""

# Afficher le breadcrumb
echo -e "${BOLD}ðŸ“ Fil d'Ariane (Schema.org):${NC}"
echo "$BREADCRUMB_ITEMS" | while IFS='|' read -r pos name url; do
  echo -e "  ${YELLOW}[$pos]${NC} $name ${BLUE}â†’${NC} $url"
done
echo ""

# Extraire les segments de l'URL
echo -e "${BOLD}ðŸ”— Segments URL:${NC}"
URL_PATH=$(echo "$URL" | sed -E 's|^https?://[^/]+||' | sed 's|\.html$||')
IFS='/' read -ra SEGMENTS <<< "$URL_PATH"

SEGMENT_NUM=1
for segment in "${SEGMENTS[@]}"; do
  if [[ -n "$segment" ]]; then
    echo -e "  ${YELLOW}[$SEGMENT_NUM]${NC} /$segment"
    ((SEGMENT_NUM++))
  fi
done
echo ""

# Validation de cohÃ©rence
echo -e "${BOLD}ðŸŽ¯ Validation de CohÃ©rence:${NC}"
echo ""

ISSUES=0
WARNINGS=0

# Test 1: Ordre des segments
echo -e "${BLUE}Test 1:${NC} Ordre des segments URL vs Breadcrumb"

# Extraire labels breadcrumb (sans "Accueil")
BREADCRUMB_LABELS=$(echo "$BREADCRUMB_ITEMS" | awk -F'|' '{print $2}' | tail -n +2)

# Convertir segments URL en labels attendus
# /pieces/freinage-1/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html
# â†’ Freinage, BMW SÃ©rie 1, ...

URL_SEGMENT_2=$(echo "${SEGMENTS[1]:-}" | sed -E 's/-[0-9]+$//' | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++)sub(/./,toupper(substr($i,1,1)),$i)}1')
URL_SEGMENT_3=$(echo "${SEGMENTS[2]:-}" | sed -E 's/-[0-9]+$//' | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++)sub(/./,toupper(substr($i,1,1)),$i)}1')

# VÃ©rifier si segment 2 URL apparaÃ®t avant segment 3 dans le breadcrumb
BREADCRUMB_ORDER=$(echo "$BREADCRUMB_LABELS" | grep -n ".*" | tr '\n' '|')

if [[ "$URL_PATH" =~ ^/pieces/.+/.+/.+/.+ ]]; then
  # URL de type /pieces/{gamme}/{marque}/{modele}/{type}
  echo -e "  ${BLUE}Type dÃ©tectÃ©:${NC} PiÃ¨ces par vÃ©hicule"
  
  # Breadcrumb attendu: Gamme â†’ VÃ©hicule â†’ RÃ©sultat
  FIRST_BREADCRUMB=$(echo "$BREADCRUMB_ITEMS" | awk -F'|' 'NR==2 {print $2}')
  SECOND_BREADCRUMB=$(echo "$BREADCRUMB_ITEMS" | awk -F'|' 'NR==3 {print $2}')
  
  echo -e "  ${YELLOW}Breadcrumb[1]:${NC} $FIRST_BREADCRUMB"
  echo -e "  ${YELLOW}Breadcrumb[2]:${NC} $SECOND_BREADCRUMB"
  echo -e "  ${YELLOW}URL Segment[1]:${NC} $URL_SEGMENT_2 (gamme)"
  echo -e "  ${YELLOW}URL Segment[2]:${NC} $URL_SEGMENT_3 (vÃ©hicule)"
  
  # VÃ©rifier que gamme apparaÃ®t avant vÃ©hicule
  if echo "$FIRST_BREADCRUMB" | grep -iq "$URL_SEGMENT_2"; then
    if echo "$SECOND_BREADCRUMB" | grep -iq "$URL_SEGMENT_3"; then
      echo -e "  ${GREEN}âœ… Ordre correct : Gamme â†’ VÃ©hicule${NC}"
    else
      echo -e "  ${RED}âŒ VÃ©hicule non trouvÃ© en 2e position${NC}"
      ((ISSUES++))
    fi
  else
    echo -e "  ${YELLOW}âš ï¸  Gamme non trouvÃ©e en 1Ã¨re position (vÃ©rification manuelle requise)${NC}"
    ((WARNINGS++))
  fi
  
elif [[ "$URL_PATH" =~ ^/constructeurs/.+/.+/.+ ]]; then
  # URL de type /constructeurs/{marque}/{modele}/{type}
  echo -e "  ${BLUE}Type dÃ©tectÃ©:${NC} VÃ©hicule"
  echo -e "  ${GREEN}âœ… Structure attendue : Constructeurs â†’ Marque â†’ ModÃ¨le${NC}"
  
elif [[ "$URL_PATH" =~ ^/pieces/.+ ]]; then
  # URL de type /pieces/{gamme}
  echo -e "  ${BLUE}Type dÃ©tectÃ©:${NC} PiÃ¨ces par gamme"
  echo -e "  ${GREEN}âœ… Structure attendue : PiÃ¨ces â†’ Gamme${NC}"
fi

echo ""

# Test 2: Labels correspondent aux slugs
echo -e "${BLUE}Test 2:${NC} Labels correspondent aux segments URL"

# VÃ©rifier que chaque segment URL a un label similaire dans le breadcrumb
for i in "${!SEGMENTS[@]}"; do
  segment="${SEGMENTS[$i]}"
  if [[ -z "$segment" ]]; then
    continue
  fi
  
  # Normaliser segment (retirer IDs, remplacer tirets par espaces, capitaliser)
  normalized=$(echo "$segment" | sed -E 's/-[0-9]+$//' | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++)sub(/./,toupper(substr($i,1,1)),$i)}1')
  
  # Chercher dans breadcrumb
  if echo "$BREADCRUMB_LABELS" | grep -iq "$normalized"; then
    echo -e "  ${GREEN}âœ…${NC} /$segment â†’ $normalized (trouvÃ©)"
  else
    echo -e "  ${YELLOW}âš ï¸${NC}  /$segment â†’ $normalized (non trouvÃ©, vÃ©rification manuelle)"
    ((WARNINGS++))
  fi
done

echo ""

# Test 3: Premier Ã©lÃ©ment = "Accueil"
echo -e "${BLUE}Test 3:${NC} Premier Ã©lÃ©ment = 'Accueil'"
FIRST_ITEM=$(echo "$BREADCRUMB_ITEMS" | head -n1 | awk -F'|' '{print $2}')
if [[ "$FIRST_ITEM" == "Accueil" ]]; then
  echo -e "  ${GREEN}âœ… Premier Ã©lÃ©ment = 'Accueil'${NC}"
else
  echo -e "  ${RED}âŒ Premier Ã©lÃ©ment = '$FIRST_ITEM' (devrait Ãªtre 'Accueil')${NC}"
  ((ISSUES++))
fi

echo ""

# Test 4: Positions sÃ©quentielles
echo -e "${BLUE}Test 4:${NC} Positions sÃ©quentielles"
POSITIONS=$(echo "$BREADCRUMB_ITEMS" | awk -F'|' '{print $1}')
EXPECTED_POS=1
IS_SEQUENTIAL=true

while IFS= read -r pos; do
  if [[ "$pos" -ne "$EXPECTED_POS" ]]; then
    echo -e "  ${RED}âŒ Position $pos trouvÃ©e, $EXPECTED_POS attendue${NC}"
    IS_SEQUENTIAL=false
    ((ISSUES++))
  fi
  ((EXPECTED_POS++))
done <<< "$POSITIONS"

if $IS_SEQUENTIAL; then
  echo -e "  ${GREEN}âœ… Positions sÃ©quentielles (1, 2, 3, ...)${NC}"
fi

echo ""

# Test 5: URLs absolues dans Schema.org
echo -e "${BLUE}Test 5:${NC} URLs absolues dans Schema.org"
RELATIVE_URLS=$(echo "$BREADCRUMB_ITEMS" | awk -F'|' '$3 ~ /^\//' | wc -l)

if [[ "$RELATIVE_URLS" -gt 0 ]]; then
  echo -e "  ${RED}âŒ $RELATIVE_URLS URL(s) relative(s) trouvÃ©e(s) (doivent Ãªtre absolues)${NC}"
  ((ISSUES++))
else
  echo -e "  ${GREEN}âœ… Toutes les URLs sont absolues${NC}"
fi

echo ""

# Test 6: Dernier Ã©lÃ©ment sans lien
echo -e "${BLUE}Test 6:${NC} Dernier Ã©lÃ©ment sans lien ou lien vers page actuelle"
LAST_URL=$(echo "$BREADCRUMB_ITEMS" | tail -n1 | awk -F'|' '{print $3}')

if [[ -z "$LAST_URL" ]] || [[ "$LAST_URL" == "$URL" ]] || [[ "$LAST_URL" == "null" ]]; then
  echo -e "  ${GREEN}âœ… Dernier Ã©lÃ©ment sans lien${NC}"
else
  echo -e "  ${YELLOW}âš ï¸  Dernier Ã©lÃ©ment a un lien : $LAST_URL${NC}"
  echo -e "     ${YELLOW}(Acceptable si lien vers page actuelle)${NC}"
  ((WARNINGS++))
fi

echo ""

# RÃ©sumÃ©
echo -e "${BOLD}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BOLD}ðŸ“Š RÃ‰SUMÃ‰${NC}"
echo -e "${BOLD}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"

if [[ "$ISSUES" -eq 0 ]] && [[ "$WARNINGS" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}âœ… VALIDATION RÃ‰USSIE${NC}"
  echo -e "${GREEN}CohÃ©rence URL â†” Breadcrumb : 100%${NC}"
  SCORE=100
elif [[ "$ISSUES" -eq 0 ]]; then
  echo -e "${YELLOW}${BOLD}âš ï¸  VALIDATION AVEC AVERTISSEMENTS${NC}"
  echo -e "${YELLOW}$WARNINGS avertissement(s) - VÃ©rification manuelle recommandÃ©e${NC}"
  SCORE=75
else
  echo -e "${RED}${BOLD}âŒ VALIDATION Ã‰CHOUÃ‰E${NC}"
  echo -e "${RED}$ISSUES erreur(s), $WARNINGS avertissement(s)${NC}"
  SCORE=25
fi

echo ""
echo -e "Score de cohÃ©rence : ${BOLD}$SCORE%${NC}"

# GÃ©nÃ©rer rapport JSON
cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "url": "$URL",
  "breadcrumb": {
    "items": [
$(echo "$BREADCRUMB_ITEMS" | awk -F'|' '{printf "      {\"position\": %s, \"name\": \"%s\", \"url\": \"%s\"}%s\n", $1, $2, $3, (NR==cnt?"":",")}'  cnt=$(echo "$BREADCRUMB_ITEMS" | wc -l))
    ]
  },
  "validation": {
    "issues": $ISSUES,
    "warnings": $WARNINGS,
    "score": $SCORE,
    "status": "$(if [[ $ISSUES -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then echo "PASS"; elif [[ $ISSUES -eq 0 ]]; then echo "WARN"; else echo "FAIL"; fi)"
  }
}
EOF

echo ""
echo -e "${BLUE}ðŸ“„ Rapport sauvegardÃ© : $REPORT_FILE${NC}"

# Nettoyage
rm -f "$TEMP_FILE"

# Exit code
if [[ "$ISSUES" -gt 0 ]]; then
  exit 1
else
  exit 0
fi
