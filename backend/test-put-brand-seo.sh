#!/bin/bash

# Test endpoint PUT /api/brands/:id/seo
# Usage: ./test-put-brand-seo.sh [marqueId]

MARQUE_ID=${1:-140}
BASE_URL="http://localhost:3000/api"

echo "ðŸ§ª Test API PUT /api/brands/${MARQUE_ID}/seo"
echo "================================================"
echo ""

# 1. RÃ©cupÃ©rer Ã©tat actuel
echo "ðŸ“– Ã‰tat actuel SEO marque ${MARQUE_ID}:"
curl -s "${BASE_URL}/brands/${MARQUE_ID}" | jq '.seo // "Pas de SEO"'
echo ""

# 2. Tester UPDATE avec donnÃ©es partielles
echo "âœï¸ Test UPDATE partiel (title + description):"
RESPONSE=$(curl -s -X PUT "${BASE_URL}/brands/${MARQUE_ID}/seo" \
  -H "Content-Type: application/json" \
  -d '{
    "sm_title": "Test API PUT - Renault - PiÃ¨ces Auto Pas Cher",
    "sm_descrip": "Description mise Ã  jour via API PUT. Catalogue complet piÃ¨ces Renault avec variables #PrixPasCher#."
  }')

echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo "âœ… UPDATE rÃ©ussi"
else
  echo "âŒ UPDATE Ã©chouÃ©"
  exit 1
fi

echo ""

# 3. VÃ©rifier mise Ã  jour effective
echo "ðŸ” VÃ©rification donnÃ©es mises Ã  jour:"
sleep 1
curl -s "${BASE_URL}/brands/${MARQUE_ID}" | jq '.seo'
echo ""

# 4. Tester UPDATE complet (tous champs)
echo "ðŸ“ Test UPDATE complet (tous champs):"
RESPONSE_FULL=$(curl -s -X PUT "${BASE_URL}/brands/${MARQUE_ID}/seo" \
  -H "Content-Type: application/json" \
  -d '{
    "sm_title": "PiÃ¨ces Auto Renault | #PrixPasCher# | Automecanik",
    "sm_descrip": "Catalogue complet piÃ¨ces dÃ©tachÃ©es #VMarque# avec livraison express. Variables: #PrixPasCher#",
    "sm_h1": "PiÃ¨ces DÃ©tachÃ©es #VMarque# - Freinage, Distribution, Embrayage",
    "sm_content": "<h2>Notre gamme complÃ¨te pour #VMarque#</h2><p>DÃ©couvrez toutes les piÃ¨ces #PrixPasCher# disponibles en stock.</p><ul><li>Freinage</li><li>Distribution</li><li>Embrayage</li></ul>",
    "sm_keywords": "renault, pieces auto renault, freinage renault, prix pas cher"
  }')

echo "$RESPONSE_FULL" | jq '.'
SUCCESS_FULL=$(echo "$RESPONSE_FULL" | jq -r '.success')

if [ "$SUCCESS_FULL" = "true" ]; then
  echo "âœ… UPDATE complet rÃ©ussi"
else
  echo "âŒ UPDATE complet Ã©chouÃ©"
  exit 1
fi

echo ""

# 5. VÃ©rifier traitement variables
echo "ðŸ”§ VÃ©rification traitement variables:"
sleep 1
curl -s "${BASE_URL}/brands/${MARQUE_ID}" | jq '.seo | {
  title: .title,
  description: .description,
  h1: .h1,
  content: .content[0:100],
  contentText: .contentText[0:100]
}'

echo ""
echo "================================================"
echo "âœ… Tests API PUT terminÃ©s avec succÃ¨s"
