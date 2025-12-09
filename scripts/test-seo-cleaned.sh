#!/bin/bash

# ðŸ§ª Test du nettoyage des balises <p> dans le contenu SEO
# VÃ©rifie que les <p> orphelines ont bien Ã©tÃ© supprimÃ©es

echo "=========================================="
echo "ðŸ§ª TEST NETTOYAGE SEO - Balises <p>"
echo "=========================================="
echo ""

API_URL="http://localhost:3456/api/catalog/seo-gamme-car-content"

# Test 1: Kit d'embrayage FIAT DOBLO (pg_id=479, type_id=19324)
echo "ðŸ“¦ Test 1: Kit d'embrayage FIAT DOBLO"
echo "--------------------------------------"

RESPONSE=$(curl -s "$API_URL/479/19324")

# Extraire le H1
H1=$(echo "$RESPONSE" | jq -r '.h1' 2>/dev/null)
echo "H1: $H1"

# Extraire le dÃ©but du content
CONTENT=$(echo "$RESPONSE" | jq -r '.content' 2>/dev/null | head -c 200)
echo "Content (200 premiers chars): $CONTENT"

# VÃ©rifier s'il reste des <p>
if echo "$H1" | grep -q '<p>'; then
    echo "âŒ H1 contient encore des <p>"
else
    echo "âœ… H1 propre (pas de <p>)"
fi

if echo "$CONTENT" | grep -q '<p>'; then
    echo "âš ï¸  Content contient encore des <p> (peut-Ãªtre normal si contenu riche)"
else
    echo "âœ… Content propre (pas de <p>)"
fi

echo ""
echo "--------------------------------------"
echo ""

# Test 2: Batterie ALFA ROMEO (pg_id=1, type_id=100)
echo "ðŸ”‹ Test 2: Batterie ALFA ROMEO"
echo "--------------------------------------"

RESPONSE2=$(curl -s "$API_URL/1/100")

H1_2=$(echo "$RESPONSE2" | jq -r '.h1' 2>/dev/null)
echo "H1: $H1_2"

CONTENT_2=$(echo "$RESPONSE2" | jq -r '.content' 2>/dev/null | head -c 200)
echo "Content (200 premiers chars): $CONTENT_2"

if echo "$H1_2" | grep -q '<p>'; then
    echo "âŒ H1 contient encore des <p>"
else
    echo "âœ… H1 propre (pas de <p>)"
fi

if echo "$CONTENT_2" | grep -q '<p>'; then
    echo "âš ï¸  Content contient encore des <p>"
else
    echo "âœ… Content propre (pas de <p>)"
fi

echo ""
echo "--------------------------------------"
echo ""

# Test 3: VÃ©rifier plusieurs type_ids pour la mÃªme gamme
echo "ðŸ” Test 3: VÃ©rification multiple type_ids (gamme 1)"
echo "--------------------------------------"

for TYPE_ID in 100 200 500 1000; do
    H1_MULTI=$(curl -s "$API_URL/1/$TYPE_ID" | jq -r '.h1' 2>/dev/null)
    
    if echo "$H1_MULTI" | grep -q '<p>'; then
        echo "Type $TYPE_ID: âŒ Contient <p>"
    else
        echo "Type $TYPE_ID: âœ… Propre - $(echo "$H1_MULTI" | cut -c1-60)..."
    fi
done

echo ""
echo "=========================================="
echo "âœ… Tests terminÃ©s"
echo "=========================================="
