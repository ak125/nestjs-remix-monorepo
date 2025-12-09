#!/bin/bash
# ðŸ§ª Test complet intÃ©gration SEO marque

echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘  ðŸ§ª TEST COMPLET - INTÃ‰GRATION SEO MARQUE               â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""

# Variables
API_URL="http://localhost:3000"
BRANDS=("renault" "peugeot" "volkswagen" "bmw")

# Check serveur
echo "ðŸ” VÃ©rification serveur..."
if ! curl -s "$API_URL/api/health" > /dev/null 2>&1; then
  echo "âŒ Serveur non disponible sur $API_URL"
  echo "ðŸ’¡ Lancer: cd backend && npm run dev"
  exit 1
fi
echo "âœ… Serveur disponible"
echo ""

# Test chaque marque
TOTAL=0
SUCCESS=0
FAILED=0

for brand in "${BRANDS[@]}"; do
  ((TOTAL++))
  echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"
  echo "ðŸ“¦ Test marque: $brand"
  echo ""
  
  RESPONSE=$(curl -s "$API_URL/api/brands/brand/$brand")
  
  if [ -z "$RESPONSE" ]; then
    echo "âŒ Pas de rÃ©ponse"
    ((FAILED++))
    continue
  fi
  
  # Parse JSON
  SUCCESS_STATUS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)
  
  if [ "$SUCCESS_STATUS" != "true" ]; then
    echo "âŒ Marque non trouvÃ©e"
    ((FAILED++))
    continue
  fi
  
  # Extraire SEO
  HAS_SEO=$(echo "$RESPONSE" | jq -r '.data.seo != null' 2>/dev/null)
  
  if [ "$HAS_SEO" == "true" ]; then
    TITLE=$(echo "$RESPONSE" | jq -r '.data.seo.title' 2>/dev/null)
    CONTENT_HTML=$(echo "$RESPONSE" | jq -r '.data.seo.content[:80]' 2>/dev/null)
    CONTENT_TEXT=$(echo "$RESPONSE" | jq -r '.data.seo.contentText[:80]' 2>/dev/null)
    
    echo "âœ… SEO trouvÃ©"
    echo ""
    echo "ðŸ“‹ Title:"
    echo "   $TITLE"
    echo ""
    echo "ðŸ“ Content HTML (80 car):"
    echo "   $CONTENT_HTML..."
    echo ""
    echo "ðŸ“„ Content Text (80 car):"
    echo "   $CONTENT_TEXT..."
    echo ""
    
    # VÃ©rifications
    CHECKS_OK=true
    
    # Check 1: Variables remplacÃ©es
    if echo "$TITLE" | grep -q "#"; then
      echo "âš ï¸  Variables non remplacÃ©es dans title"
      CHECKS_OK=false
    fi
    
    # Check 2: contentText sans HTML
    if echo "$CONTENT_TEXT" | grep -qE "<|>"; then
      echo "âš ï¸  Balises HTML dans contentText"
      CHECKS_OK=false
    fi
    
    # Check 3: content avec HTML
    if ! echo "$CONTENT_HTML" | grep -qE "<b>|<strong>"; then
      echo "â„¹ï¸  Pas de balises HTML dans content (normal si SEO par dÃ©faut)"
    fi
    
    if [ "$CHECKS_OK" == "true" ]; then
      echo "âœ… Toutes les vÃ©rifications OK"
      ((SUCCESS++))
    else
      ((FAILED++))
    fi
  else
    echo "â„¹ï¸  Pas de SEO custom (utilise fallback)"
    ((SUCCESS++))
  fi
  echo ""
done

# RÃ©sumÃ©
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "ðŸ“Š RÃ‰SUMÃ‰"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "Total tests:   $TOTAL"
echo "âœ… RÃ©ussis:    $SUCCESS"
echo "âŒ Ã‰chouÃ©s:    $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "ðŸŽ‰ Tous les tests sont passÃ©s !"
  exit 0
else
  echo "âš ï¸  Certains tests ont Ã©chouÃ©"
  exit 1
fi
