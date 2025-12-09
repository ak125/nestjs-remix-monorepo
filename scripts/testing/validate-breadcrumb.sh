#!/bin/bash

# ðŸ§ª Script de validation du fil d'ariane Schema.org

echo "ðŸž Validation du fil d'ariane (Breadcrumb)"
echo "=========================================="
echo ""

# URL Ã  tester (remplacer par votre URL de production)
URL="${1:-http://localhost:3000/constructeurs/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html}"

echo "ðŸ” URL testÃ©e: $URL"
echo ""

# 1. Extraire le JSON-LD
echo "ðŸ“Š Extraction du JSON-LD Schema.org..."
SCHEMA=$(curl -s "$URL" | grep -oP '(?<=<script type="application/ld\+json">).*?(?=</script>)' | jq '.')

if [ -z "$SCHEMA" ]; then
    echo "âŒ Aucun schema JSON-LD trouvÃ©"
    exit 1
fi

echo "âœ… Schema trouvÃ©:"
echo "$SCHEMA"
echo ""

# 2. Valider la structure
echo "ðŸ” Validation de la structure..."

# VÃ©rifier le type
TYPE=$(echo "$SCHEMA" | jq -r '.["@type"]')
if [ "$TYPE" != "BreadcrumbList" ]; then
    echo "âŒ Type incorrect: $TYPE (attendu: BreadcrumbList)"
    exit 1
fi
echo "âœ… Type correct: BreadcrumbList"

# VÃ©rifier le contexte
CONTEXT=$(echo "$SCHEMA" | jq -r '.["@context"]')
if [ "$CONTEXT" != "https://schema.org" ]; then
    echo "âŒ Contexte incorrect: $CONTEXT"
    exit 1
fi
echo "âœ… Contexte correct: https://schema.org"

# Compter les Ã©lÃ©ments
ITEMS_COUNT=$(echo "$SCHEMA" | jq '.itemListElement | length')
echo "âœ… Nombre d'Ã©lÃ©ments: $ITEMS_COUNT"

# Valider chaque Ã©lÃ©ment
echo ""
echo "ðŸ” Validation des Ã©lÃ©ments..."
for i in $(seq 0 $((ITEMS_COUNT - 1))); do
    ITEM=$(echo "$SCHEMA" | jq ".itemListElement[$i]")
    POSITION=$(echo "$ITEM" | jq -r '.position')
    NAME=$(echo "$ITEM" | jq -r '.name')
    ITEM_URL=$(echo "$ITEM" | jq -r '.item // "N/A"')
    
    echo "  [$POSITION] $NAME"
    if [ "$ITEM_URL" != "N/A" ]; then
        echo "      â†’ $ITEM_URL"
    fi
done

echo ""
echo "ðŸŽ‰ Validation terminÃ©e avec succÃ¨s!"
echo ""

# 3. Tester avec Google Rich Results (optionnel)
echo "ðŸŒ Pour tester avec Google Rich Results Test:"
echo "   https://search.google.com/test/rich-results?url=$(echo $URL | jq -sRr @uri)"
echo ""

# 4. Suggestions
echo "ðŸ’¡ Suggestions:"
echo "   - VÃ©rifier dans Google Search Console aprÃ¨s indexation"
echo "   - Tester avec diffÃ©rents navigateurs"
echo "   - Valider avec https://validator.schema.org/"
